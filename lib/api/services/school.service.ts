/**
 * School Service
 * Handles all school-related data operations
 * Provides caching, deduplication, and normalized data
 * This is the SINGLE source of truth for all school operations
 */

import { getToken } from '../../auth';
import { logger } from '../../logger';
import { dataCache, CACHE_KEYS } from '../../cache/dataCache';
import { apiClient, EXTERNAL_ENDPOINTS } from '../client';
import { SCHOOL_CACHE_TTL } from '../../cache/cacheConstants';

export interface SchoolData {
  province_id: string;
  district_name: string;
  school_name: string;
  total_count: number;
  geip_school_ID?: string; // Added for Student page dropdown
}

export interface School {
  id: string | number;
  geip_school_ID?: string;
  school_name?: string;
  SE_school?: string;
  province_ID?: string;
  province_name?: string;
  district_name?: string;
  school_code?: string;
  school_type_h?: string;
  school_type_k?: string;
  is_target?: boolean;
  target?: boolean;
  [key: string]: any;
}

export interface SchoolServiceResponse {
  success: boolean;
  data?: SchoolData[] | School[];
  total_students?: number;
  count?: number;
  next?: string | null;
  previous?: string | null;
  error?: string;
}

export interface SchoolSearchParams {
  q?: string;
  province?: string;
  district?: string;
  school_type?: string;
  is_target?: string;
  page?: number;
  limit?: number;
  offset?: number;
}

export interface SchoolServiceParams {
  limit?: number;
  offset?: number;
  province_id: string; // Required
  district_name: string; // Required
  school_name?: string;
  q?: string; // Search query
}

const CACHE_KEY_PREFIX = 'school_service_';
// Use centralized cache constant - 10 minutes for schools
const DEFAULT_CACHE_TTL = SCHOOL_CACHE_TTL;

/**
 * Generate cache key from parameters
 */
function getCacheKey(params: SchoolServiceParams): string {
  const key = `limit_${params.limit || 1000}_offset_${params.offset || 0}_pid_${params.province_id}_dname_${params.district_name}_sname_${params.school_name || 'all'}_q_${params.q || 'all'}`;
  return `${CACHE_KEY_PREFIX}${key}`;
}

/**
 * Normalize school data to ensure consistent format
 */
function normalizeSchoolData(data: any[]): SchoolData[] {
  if (!Array.isArray(data)) {
    return [];
  }

  // Deduplicate by province_id + district_name + school_name combination
  const schoolMap = new Map<string, SchoolData>();

  for (const item of data) {
    const provinceId = (item.province_id || item.id || item.province_ID || '').toString().trim();
    const districtName = (item.district_name || item.name || item.district_Name || '').toString().trim();
    const schoolName = (item.school_name || item.name || item.school_Name || '').toString().trim();
    const geipSchoolId = (item.geip_school_ID || item.geip_school_id || item.id || '').toString().trim();
    const totalCount = typeof item.total_count === 'number' ? item.total_count : 
                      (typeof item.student_count === 'number' ? item.student_count :
                      (typeof item.count === 'number' ? item.count : 0));

    if (!provinceId || !districtName || !schoolName) {
      continue; // Skip invalid records
    }

    // Use combination key for deduplication
    const key = `${provinceId}:${districtName}:${schoolName}`;

    if (schoolMap.has(key)) {
      const existing = schoolMap.get(key)!;
      // Merge counts if duplicate
      existing.total_count += totalCount;
      // Preserve geip_school_ID if missing in existing but present in new item
      if (!existing.geip_school_ID && geipSchoolId) {
        existing.geip_school_ID = geipSchoolId;
      }
    } else {
      schoolMap.set(key, {
        province_id: provinceId,
        district_name: districtName,
        school_name: schoolName,
        total_count: totalCount,
        ...(geipSchoolId && { geip_school_ID: geipSchoolId }),
      });
    }
  }

  return Array.from(schoolMap.values());
}

// Helper functions for school type detection (from schools.service.ts)
function isTargetSchool(school: any): boolean {
  const typeH = (school.school_type_h || '').toString();
  const typeK = (school.school_type_k || '').toString();
  
  if (typeH.includes('សាលាគោលដៅ') || typeK.includes('សាលាគោលដៅ')) {
    return true;
  }
  
  if (typeH.includes('SRS') || typeH.includes('NET-SRS')) {
    if (typeH.includes('សាលាស្ម័គ្រចិត្ត') || typeK.includes('សាលាស្ម័គ្រចិត្ត')) {
      return false;
    }
    return true;
  }
  
  if (!typeH && !typeK) {
    if (school.is_target !== undefined) return school.is_target === true;
    if (school.target !== undefined) return school.target === true;
  }
  
  return false;
}

function isVolunteerSchool(school: any): boolean {
  const typeH = (school.school_type_h || '').toString();
  const typeK = (school.school_type_k || '').toString();
  return typeH.includes('សាលាស្ម័គ្រចិត្ត') || typeK.includes('សាលាស្ម័គ្រចិត្ត');
}

function isGEIPSchool(school: any): boolean {
  return !!school.geip_school_ID;
}

function isGEIPAFSchool(school: any): boolean {
  if (!school.geip_school_ID) return false;
  
  const typeH = (school.school_type_h || '').toString().toUpperCase();
  const typeK = (school.school_type_k || '').toString().toUpperCase();
  const schoolType = (school.school_type || '').toString().toUpperCase();
  
  return typeH.includes('GEIP-AF') || typeH.includes('GEIP AF') ||
         typeK.includes('GEIP-AF') || typeK.includes('GEIP AF') ||
         schoolType.includes('GEIP-AF') || schoolType.includes('GEIP AF');
}

function isGEIPSchoolOnly(school: any): boolean {
  if (!isGEIPSchool(school)) return false;
  return !isGEIPAFSchool(school);
}

export const schoolService = {
  /**
   * Get schools with aggregated student counts
   * Requires province_id and district_name
   * Used by Student page for school dropdowns
   */
  async getAll(params: SchoolServiceParams): Promise<SchoolServiceResponse> {
    try {
      // Validate required parameters
      if (!params.province_id || !params.district_name) {
        return {
          success: true, // Return success with empty data instead of error
          data: [],
          count: 0,
        };
      }

      const token = getToken();
      if (!token) {
        return {
          success: true, // Return success with empty data instead of error
          data: [],
          count: 0,
        };
      }

      // PERFORMANCE: Strict cache-first strategy
      const cacheKey = getCacheKey(params);
      
      // Check cache first (prevents 5-19s API calls)
      const cached = dataCache.get<SchoolServiceResponse>(cacheKey);
      if (cached !== null && cached !== undefined && cached.success && cached.data) {
        logger.info(`[SCHOOL_SERVICE] Cache hit (strict cache-first): Returning ${cached.data.length} schools immediately (saved 5-19s)`, 'SCHOOL_SERVICE');
        return cached;
      }
      
      logger.info(`[SCHOOL_SERVICE] Cache miss: Will fetch from slow external API (may take 5-19s)`, 'SCHOOL_SERVICE');

      // Build API URL with absolute URL for server-side fetch
      const queryParams = new URLSearchParams();
      queryParams.append('province_id', params.province_id);
      queryParams.append('district_name', params.district_name);
      if (params.limit) queryParams.append('limit', params.limit.toString());
      if (params.offset) queryParams.append('offset', params.offset.toString());
      if (params.school_name) queryParams.append('school_name', params.school_name);
      if (params.q) queryParams.append('q', params.q);

      // Use absolute URL for server-side fetch
      const apiBaseUrl = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      const url = `${apiBaseUrl}/api/schools/list?${queryParams.toString()}`;

      logger.info(`[SCHOOL_SERVICE] Fetching schools with 5s timeout: ${url}`, 'SCHOOL_SERVICE');

      // PERFORMANCE: Add timeout to prevent 5-19s waits
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), 5000); // 5 second timeout

      let response: Response;
      try {
        response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          signal: abortController.signal,
          cache: 'no-store',
        });
        clearTimeout(timeoutId);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        // Timeout or network error - return cached empty result
        if (fetchError.name === 'AbortError' || fetchError.message?.includes('timeout')) {
          logger.warn(`[SCHOOL_SERVICE] Request timeout (5s), returning empty results. API is slow (5-19s).`, 'SCHOOL_SERVICE');
          // Cache empty result to prevent repeated slow calls
          dataCache.set(cacheKey, { success: true, data: [], count: 0 }, DEFAULT_CACHE_TTL);
          return {
            success: true,
            data: [],
            count: 0,
          };
        }
        throw fetchError;
      }

      if (!response.ok) {
        // BEST PRACTICE: Return empty results instead of error
        logger.warn(`[SCHOOL_SERVICE] API error ${response.status}, returning empty results`, 'SCHOOL_SERVICE');
        // Cache empty result to prevent repeated slow calls
        dataCache.set(cacheKey, { success: true, data: [], count: 0 }, DEFAULT_CACHE_TTL);
        return {
          success: true,
          data: [],
          count: 0,
        };
      }

      const result = await response.json();

      if (!result.success) {
        // BEST PRACTICE: Return empty results instead of error
        logger.warn(`[SCHOOL_SERVICE] API returned error: ${result.error}, returning empty results`, 'SCHOOL_SERVICE');
        // Cache empty result to prevent repeated slow calls
        dataCache.set(cacheKey, { success: true, data: [], count: 0 }, DEFAULT_CACHE_TTL);
        return {
          success: true,
          data: [],
          count: 0,
        };
      }

      // Normalize and deduplicate data
      const normalizedData = normalizeSchoolData(result.data || []);
      const totalStudents = normalizedData.reduce((sum, s) => sum + (s.total_count || 0), 0);

      const responseData: SchoolServiceResponse = {
        success: true,
        data: normalizedData,
        count: normalizedData.length,
        total_students: result.total_students || totalStudents,
      };

      // PERFORMANCE: Cache result with centralized cache constant
      // This prevents repeated slow API calls (5-19s) for the same province/district
      dataCache.set(cacheKey, responseData, DEFAULT_CACHE_TTL);
      logger.info(`[SCHOOL_SERVICE] Cached ${normalizedData.length} schools for ${DEFAULT_CACHE_TTL / 1000 / 60} minutes (prevents future 5-19s API calls)`, 'SCHOOL_SERVICE');

      return responseData;
    } catch (error: any) {
      // Ignore abort errors (timeout)
      if (error.name === 'AbortError') {
        logger.warn(`[SCHOOL_SERVICE] Request aborted (timeout), returning empty results`, 'SCHOOL_SERVICE');
        return { success: true, data: [], count: 0 };
      }
      
      logger.error(`[SCHOOL_SERVICE] Error: ${error?.message || 'Unknown error'}`, 'SCHOOL_SERVICE', error);
      
      // BEST PRACTICE: Return empty results instead of error
      // Cache empty result to prevent repeated slow calls
      const cacheKey = getCacheKey(params);
      dataCache.set(cacheKey, { success: true, data: [], count: 0 }, DEFAULT_CACHE_TTL);
      
      return {
        success: true,
        data: [],
        count: 0,
      };
    }
  },

  /**
   * Get all schools (for School page)
   * Fetches all schools from external API with pagination support
   */
  async getAllSchools(token: string, params?: SchoolSearchParams): Promise<SchoolServiceResponse> {
    try {
      let url = EXTERNAL_ENDPOINTS.SCHOOLS.LIST;
      const queryParams = new URLSearchParams();
      
      // Always specify a limit - external API defaults to 20 if not provided
      // Use provided limit or default to 2000 for better performance
      const limit = params?.limit || 2000;
      queryParams.append('limit', limit.toString());
      
      if (params?.offset) queryParams.append('offset', params.offset.toString());
      
      if (queryParams.toString()) {
        url = `${url}?${queryParams.toString()}`;
      }
      
      logger.info(`[SCHOOL_SERVICE] Fetching schools from ${url} with limit=${limit} (may take 5-19s)`, 'SCHOOL_SERVICE');

      // PERFORMANCE: Add timeout to prevent long waits
      const response = await apiClient.get(url, { 
        token,
        timeout: 10000, // 10 second timeout for large requests
      });

      // if (!response.success) {
      //   // BEST PRACTICE: Return empty results instead of error
      //   logger.warn(`[SCHOOL_SERVICE] API failed: ${response.error}, returning empty results`, 'SCHOOL_SERVICE');
      //   // Cache empty result to prevent repeated slow calls
      //   dataCache.set(cacheKey, { success: true, data: [], count: 0 }, DEFAULT_CACHE_TTL);
      //   return { success: true, data: [], count: 0 };
      // }

      const data = response.data as any;
      
      // Use 'total' for total schools across all pages, fallback to 'count' for page count
      const totalCount = data.total || data.count || 0;
      const next = data.next || null;
      const previous = data.previous || null;
      const schools = data.results || data.data || data.schools || (Array.isArray(data) ? data : []);

      const formattedSchools = schools.map((school: any): School => {
        const calculatedIsTarget = isTargetSchool(school);
        
        return {
          ...school,
          id: school.geip_school_ID || school.id || school.pk || school.school_id || '',
          geip_school_ID: school.geip_school_ID,
          school_name: school.school_name || school.name || '',
          SE_school: school.SE_school,
          province_ID: school.province_ID,
          province_name: school.province_name,
          district_name: school.district_name,
          school_code: school.school_code,
          school_type_h: school.school_type_h,
          school_type_k: school.school_type_k,
          is_target: calculatedIsTarget,
          target: calculatedIsTarget,
        };
      });

      return { 
        success: true, 
        data: formattedSchools, 
        count: totalCount || formattedSchools.length,
        next,
        previous
      };
    } catch (error: any) {
      logger.error(`[SCHOOL_SERVICE] Get all schools error: ${error?.message || 'Unknown error'}`, 'SCHOOL_SERVICE', error);
      
      // BEST PRACTICE: Return empty results instead of error
      // Cache empty result to prevent repeated slow calls
      const cacheKey = `schools:all:${params?.limit || 2000}:${params?.offset || 0}`;
      dataCache.set(cacheKey, { success: true, data: [], count: 0 }, DEFAULT_CACHE_TTL);
      
      return { success: true, data: [], count: 0 };
    }
  },

  /**
   * Search schools with filters (for School page)
   * REQUIRES province_id and district_name filters
   * Uses small pagination (≤50) - NO batch fetching
   * Makes ONE request per call - NO loops, NO retries
   */
  async search(token: string, params: SchoolSearchParams): Promise<SchoolServiceResponse> {
    try {
      // REQUIRED: province_id and district_name must be provided
      // Convert province/district params to province_id/district_name format
      const province_id = (params as any).province_id || params.province;
      const district_name = (params as any).district_name || params.district;
      
      if (!province_id || !district_name) {
        return {
          success: false,
          error: 'province_id and district_name are required for school search',
          data: [],
          count: 0
        };
      }

      // Use small pagination (≤25 per architecture rules)
      const limit = Math.min(params.limit || 25, 25);
      const offset = params.offset || 0;

      // PERFORMANCE: Strict cache-first strategy
      // Build cache key (exclude pagination for better cache hits)
      const cacheKeyBase = `${province_id}:${district_name}:${params.q || ''}`;
      const cacheKey = CACHE_KEYS.SCHOOLS_LIST(cacheKeyBase);

      // STRICT CACHE-FIRST: Check cache BEFORE making slow API call (5-19s)
      // This prevents repeated slow API calls for the same province/district combination
      const cached = dataCache.get<School[]>(cacheKey);
      if (cached !== null && cached !== undefined && Array.isArray(cached)) {
        logger.info(`[SCHOOL_SERVICE] Cache hit (strict cache-first): Returning ${cached.length} schools immediately (saved 5-19s API call)`, 'SCHOOL_SERVICE');
        
        // Apply pagination to cached data
        const totalCount = cached.length;
        const start = offset;
        const end = offset + limit;
        const paginatedSchools = cached.slice(start, end);
        
        return {
          success: true,
          data: paginatedSchools,
          count: totalCount,
          next: end < totalCount ? `offset=${end}` : null,
          previous: offset > 0 ? `offset=${Math.max(0, offset - limit)}` : null,
        };
      }
      
      logger.info(`[SCHOOL_SERVICE] Cache miss: Will fetch from slow external API (may take 5-19s)`, 'SCHOOL_SERVICE');

      // Make ONE request only - use schools/list API endpoint
      // Build URL properly using URLSearchParams for correct encoding
      const queryParams = new URLSearchParams();
      queryParams.append('province_id', province_id);
      queryParams.append('district_name', district_name);
      queryParams.append('limit', limit.toString());
      queryParams.append('offset', offset.toString());
      
      // Include search query if provided
      if (params.q) {
        queryParams.append('q', params.q);
      }
      
      // PERFORMANCE: Use absolute URL for server-side fetch with timeout
      // Add timeout to prevent 5-19s waits when API is slow
      const apiBaseUrl = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      const url = `${apiBaseUrl}/api/schools/list?${queryParams.toString()}`;
      
      logger.info(`[SCHOOL_SERVICE] Fetching schools with 5s timeout: ${url}`, 'SCHOOL_SERVICE');

      // Create abort controller for timeout (5 seconds max wait)
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), 5000); // 5 second timeout

      let response: Response;
      try {
        response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          signal: abortController.signal,
          cache: 'no-store',
        });
        clearTimeout(timeoutId);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        // Timeout or network error - return cached empty result or fallback
        if (fetchError.name === 'AbortError' || fetchError.message?.includes('timeout')) {
          logger.warn(`[SCHOOL_SERVICE] Request timeout (5s), returning empty results. API is slow (5-19s).`, 'SCHOOL_SERVICE');
          // Cache empty result to prevent repeated slow calls
          dataCache.set(cacheKey, [], DEFAULT_CACHE_TTL);
          return {
            success: true,
            data: [],
            count: 0,
            next: null,
            previous: null,
          };
        }
        throw fetchError;
      }

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`[SCHOOL_SERVICE] API error ${response.status}: ${errorText}`, 'SCHOOL_SERVICE');
        
        // NO automatic retries after 429
        if (response.status === 429) {
          return {
            success: false,
            error: 'Rate limited. Please try again later.',
            data: [],
            count: 0
          };
        }
        
        return {
          success: false,
          error: `HTTP ${response.status}: ${errorText}`,
          data: [],
          count: 0
        };
      }

      const result = await response.json();

      if (!result.success) {
        logger.error(`[SCHOOL_SERVICE] API returned error: ${result.error}`, 'SCHOOL_SERVICE');
        return {
          success: false,
          error: result.error || 'Failed to fetch schools',
          data: [],
          count: 0
        };
      }

      const schools = (result.data || []) as School[];
      const totalCount = schools.length; // Full count from API
      
      // Apply pagination
      const start = offset;
      const end = offset + limit;
      const paginatedSchools = schools.slice(start, end);

      // PERFORMANCE: Cache ALL schools (before pagination) with long TTL
      // This prevents repeated slow API calls (5-19s) for the same province/district
      // Only cache if no search query to avoid stale results
      if (!params.q && schools.length > 0) {
        dataCache.set(cacheKey, schools, DEFAULT_CACHE_TTL);
        logger.info(`[SCHOOL_SERVICE] Cached ${schools.length} schools for ${DEFAULT_CACHE_TTL / 1000 / 60} minutes (prevents future 5-19s API calls)`, 'SCHOOL_SERVICE');
      }

      const responseData: SchoolServiceResponse = {
        success: true,
        data: paginatedSchools,
        count: totalCount,
        next: end < totalCount ? `offset=${end}` : null,
        previous: offset > 0 ? `offset=${Math.max(0, offset - limit)}` : null,
      };

      logger.info(`[SCHOOL_SERVICE] Fetched ${schools.length} schools (returning ${paginatedSchools.length} with pagination) for ${province_id}/${district_name}`, 'SCHOOL_SERVICE');

      return responseData;
    } catch (error: any) {
      // Ignore abort errors (timeout)
      if (error.name === 'AbortError') {
        logger.warn(`[SCHOOL_SERVICE] Request aborted (timeout), returning empty results`, 'SCHOOL_SERVICE');
        return { success: true, data: [], count: 0, next: null, previous: null };
      }
      
      logger.error(`[SCHOOL_SERVICE] Search schools error: ${error?.message || 'Unknown error'}`, 'SCHOOL_SERVICE', error);
      
      // BEST PRACTICE: Return empty results instead of error
      // Cache empty result to prevent repeated slow calls
      const cacheKeyBase = `${(params as any).province_id || params.province}:${(params as any).district_name || params.district}:${params.q || ''}`;
      const cacheKey = CACHE_KEYS.SCHOOLS_LIST(cacheKeyBase);
      dataCache.set(cacheKey, [], DEFAULT_CACHE_TTL);
      
      return { success: true, data: [], count: 0, next: null, previous: null };
    }
  },

  /**
   * Get total count of schools with breakdowns
   */
  async getTotalCount(token: string): Promise<{ success: boolean; total: number; target: number; notTarget: number; geipSchool: number; geipAF: number; error?: string }> {
    try {
      const cacheKey = CACHE_KEYS.SCHOOLS_COUNT;
      const cached = dataCache.get<{ total: number; target: number; notTarget: number; geipSchool: number; geipAF: number }>(cacheKey);
      if (cached) {
        logger.info('Using cached schools count', 'SCHOOL_SERVICE');
        return { 
          success: true, 
          ...cached 
        };
      }

      const limit = 2000;
      const maxConcurrentBatches = 5;
      let offset = 0;
      let total = 0;
      let hasMore = true;
      
      let targetCount = 0;
      let notTargetCount = 0;
      let geipAFCount = 0;
      let geipSchoolCount = 0;
      let processedCount = 0;

      const firstBatchResult = await this.getAllSchools(token, { limit, offset });
      
      if (!firstBatchResult.success) {
        return { success: false, total: 0, target: 0, notTarget: 0, geipSchool: 0, geipAF: 0, error: firstBatchResult.error };
      }

      total = firstBatchResult.count || 0;
      const firstBatch = (firstBatchResult.data || []) as School[];
      
      for (const school of firstBatch) {
        if (isTargetSchool(school)) targetCount++;
        if (isVolunteerSchool(school)) notTargetCount++;
        if (isGEIPAFSchool(school)) geipAFCount++;
        if (isGEIPSchoolOnly(school)) geipSchoolCount++;
        processedCount++;
      }

      offset += limit;
      hasMore = firstBatchResult.next !== null && firstBatch.length === limit;

      while (hasMore && processedCount < total) {
        const batchPromises: Promise<any>[] = [];
        const batchOffsets: number[] = [];
        
        for (let i = 0; i < maxConcurrentBatches && offset < total; i++) {
          const currentOffset = offset + (i * limit);
          if (currentOffset < total) {
            batchOffsets.push(currentOffset);
            batchPromises.push(this.getAllSchools(token, { limit, offset: currentOffset }));
          }
        }
        
        if (batchPromises.length === 0) {
          hasMore = false;
          break;
        }

        const batchResults = await Promise.all(batchPromises);
        
        for (let i = 0; i < batchResults.length; i++) {
          const batchResult = batchResults[i];
          
          if (!batchResult.success) {
            logger.warn(`Failed to fetch schools batch at offset ${batchOffsets[i]}`, 'SCHOOL_SERVICE', batchResult.error);
            continue;
          }
          
          const batch = (batchResult.data || []) as School[];
          if (batch.length === 0) {
            hasMore = false;
            break;
          }
          
          for (const school of batch) {
            if (isTargetSchool(school)) targetCount++;
            if (isVolunteerSchool(school)) notTargetCount++;
            if (isGEIPAFSchool(school)) geipAFCount++;
            if (isGEIPSchoolOnly(school)) geipSchoolCount++;
            processedCount++;
          }
        }

        offset += limit * maxConcurrentBatches;
        
        const lastBatchData = (batchResults[batchResults.length - 1]?.data || []) as School[];
        hasMore = lastBatchData.length === limit && 
                  processedCount < total &&
                  offset < total;
        
        if (total > 0 && processedCount >= total) {
          hasMore = false;
        }
      }

      logger.info(`Processed ${processedCount} schools for counts`, 'SCHOOL_SERVICE');

      const result = { 
        success: true, 
        total, 
        target: targetCount, 
        notTarget: notTargetCount, 
        geipSchool: geipSchoolCount, 
        geipAF: geipAFCount 
      };

      dataCache.set(cacheKey, result, 30 * 60 * 1000);
      
      return result;
    } catch (error: any) {
      logger.error('Get schools total count error', 'SCHOOL_SERVICE', error);
      return { success: false, total: 0, target: 0, notTarget: 0, geipSchool: 0, geipAF: 0, error: error.message || 'Failed to fetch schools count' };
    }
  },

  /**
   * Get school by ID
   */
  async getById(token: string, id: string | number): Promise<{ success: boolean; data?: School; error?: string }> {
    try {
      return await apiClient.get<School>(EXTERNAL_ENDPOINTS.SCHOOLS.DETAIL(id), { token });
    } catch (error: any) {
      logger.error(`Get school error: ${id}`, 'SCHOOL_SERVICE', error);
      return { success: false, error: error.message || 'Failed to fetch school' };
    }
  },
};

