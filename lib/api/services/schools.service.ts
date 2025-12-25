/**
 * Schools Service
 */

import { apiClient, EXTERNAL_ENDPOINTS } from '../client';
import { logger } from '../../logger';
import { dataCache, CACHE_KEYS } from '@/lib/cache/dataCache';

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

export interface SchoolsListResponse {
  success: boolean;
  count: number;
  data: School[];
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

// Helper function to determine if a school is target based on school_type
// Target schools = សាលាគោលដៅ (target school)
function isTargetSchool(school: any): boolean {
  // Always check school_type first, don't use API is_target/target fields
  // because we want to calculate based on school_type_h and school_type_k
  const typeH = (school.school_type_h || '').toString();
  const typeK = (school.school_type_k || '').toString();
  
  // Check if school_type contains "សាលាគោលដៅ" (target school)
  if (typeH.includes('សាលាគោលដៅ') || typeK.includes('សាលាគោលដៅ')) {
    return true;
  }
  
  // Also check for SRS or NET-SRS as they might be target schools
  if (typeH.includes('SRS') || typeH.includes('NET-SRS')) {
    // But exclude volunteer schools
    if (typeH.includes('សាលាស្ម័គ្រចិត្ត') || typeK.includes('សាលាស្ម័គ្រចិត្ត')) {
      return false;
    }
    return true;
  }
  
  // Only use API fields if school_type doesn't exist
  if (!typeH && !typeK) {
    if (school.is_target !== undefined) return school.is_target === true;
    if (school.target !== undefined) return school.target === true;
  }
  
  // Default to not target
  return false;
}

// Helper function to check if a school is a volunteer school (not target)
// Not target schools = សាលាស្ម័គ្រចិត្ត (volunteer school)
function isVolunteerSchool(school: any): boolean {
  const typeH = (school.school_type_h || '').toString();
  const typeK = (school.school_type_k || '').toString();
  
  // Check if school_type contains "សាលាស្ម័គ្រចិត្ត" (volunteer school)
  return typeH.includes('សាលាស្ម័គ្រចិត្ត') || typeK.includes('សាលាស្ម័គ្រចិត្ត');
}

// Helper function to check if a school is a GEIP school
// GEIP school = has geip_school_ID
function isGEIPSchool(school: any): boolean {
  return !!school.geip_school_ID;
}

// Helper function to check if a school is a GEIP AF school
// GEIP AF = has geip_school_ID and contains "GEIP-AF" or "GEIP AF" in school_type or related fields
function isGEIPAFSchool(school: any): boolean {
  if (!school.geip_school_ID) return false;
  
  const typeH = (school.school_type_h || '').toString().toUpperCase();
  const typeK = (school.school_type_k || '').toString().toUpperCase();
  const schoolType = (school.school_type || '').toString().toUpperCase();
  const geipType = (school.geip_type || school.GEIP_type || '').toString().toUpperCase();
  
  // Check for "GEIP-AF" or "GEIP AF" patterns
  return typeH.includes('GEIP-AF') || typeK.includes('GEIP-AF') ||
         typeH.includes('GEIP AF') || typeK.includes('GEIP AF') ||
         schoolType.includes('GEIP-AF') || schoolType.includes('GEIP AF') ||
         geipType.includes('GEIP-AF') || geipType.includes('GEIP AF') ||
         school.GEIP_AF === true || school.geip_af === true ||
         school.geip_type === 'GEIP-AF' || school.GEIP_type === 'GEIP-AF';
}

// Helper function to check if a school is a GEIP school (but NOT GEIP-AF)
// GEIP = school_type_h is exactly "GEIP" (not "GEIP-AF")
// This matches the filter logic exactly
function isGEIPSchoolOnly(school: any): boolean {
  const typeH = (school.school_type_h || '').toString();
  const typeK = (school.school_type_k || '').toString();
  
  // Check for exact match with "GEIP" (case-insensitive)
  const exactGEIP = (typeH.toLowerCase() === 'geip' || typeK.toLowerCase() === 'geip');
  
  if (exactGEIP) {
    // Make sure it's not GEIP-AF
    const isAF = typeH.toLowerCase().includes('geip-af') || 
                typeK.toLowerCase().includes('geip-af') ||
                typeH.toLowerCase().includes('geip af') || 
                typeK.toLowerCase().includes('geip af');
    return !isAF; // Return true only if it's NOT GEIP-AF
  }
  
  return false;
}

export const schoolsService = {
  async getAll(token: string, params?: SchoolSearchParams) {
    try {
      let url = EXTERNAL_ENDPOINTS.SCHOOLS.LIST;
      const queryParams = new URLSearchParams();
      
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.offset) queryParams.append('offset', params.offset.toString());
      
      if (queryParams.toString()) {
        url = `${url}?${queryParams.toString()}`;
      }

      const response = await apiClient.get(url, { token });

      if (!response.success) {
        return { success: false, error: response.error || 'Failed to fetch schools', data: [], count: 0 };
      }

      const data = response.data as any;
      
      // Handle paginated response structure: { count, next, previous, results: [...] }
      const totalCount = data.count || 0;
      const next = data.next || null;
      const previous = data.previous || null;
      const schools = data.results || data.data || data.schools || (Array.isArray(data) ? data : []);

      const formattedSchools = schools.map((school: any): School => {
        // Calculate target status first
        const calculatedIsTarget = isTargetSchool(school);
        
        // Build school object preserving all original data
        return {
          ...school, // Preserve all original properties from API first
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
          // Override with calculated target status based on school_type
          // - Target schools: have "សាលាគោលដៅ" (target school) in school_type_h or school_type_k
          // - Not target schools: have "សាលាស្ម័គ្រចិត្ត" (volunteer school) in school_type_h or school_type_k
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
      logger.error('Get schools error', 'SCHOOLS', error);
      return { success: false, error: error.message || 'Failed to fetch schools', data: [], count: 0 };
    }
  },

  async search(token: string, params: SchoolSearchParams) {
    try {
      // Create cache key based on params (exclude pagination for base cache)
      const cacheKey = CACHE_KEYS.SCHOOLS_LIST(
        JSON.stringify({ q: params.q, province: params.province, district: params.district, school_type: params.school_type, is_target: params.is_target })
      );
      const cacheTTL = 30 * 60 * 1000; // 30 minutes TTL

      // Check cache first (only for base data without filters or with same filters)
      const cached = dataCache.get<School[]>(cacheKey);
      if (cached) {
        logger.info(`Using cached schools data: ${cached.length} schools`, 'SCHOOLS');
        return {
          success: true,
          data: cached,
          count: cached.length,
          next: null,
          previous: null,
        };
      }

      // Fetch ALL schools using optimized parallel pagination
      const allSchools: School[] = [];
      let offset = 0;
      const limit = 2000; // Increased batch size for faster fetching
      const maxConcurrentBatches = 5; // Fetch 5 batches in parallel
      let hasMore = true;
      let totalCount = 0;

      // Fetch first batch to get total count
      const firstBatchResult = await this.getAll(token, { limit, offset });
      
      if (!firstBatchResult.success) {
        logger.error(`Failed to fetch first schools batch`, 'SCHOOLS', firstBatchResult.error);
        return { success: false, error: firstBatchResult.error || 'Failed to fetch schools', data: [], count: 0 };
      }

      totalCount = firstBatchResult.count || 0;
      const firstBatch = firstBatchResult.data || [];
      if (firstBatch.length > 0) {
        allSchools.push(...firstBatch);
        offset += limit;
        hasMore = firstBatchResult.next !== null && firstBatch.length === limit;
      }

      // Fetch remaining batches in parallel for maximum speed
      while (hasMore && allSchools.length < totalCount) {
        const batchPromises: Promise<any>[] = [];
        const batchOffsets: number[] = [];
        
        // Prepare parallel batch requests
        for (let i = 0; i < maxConcurrentBatches && offset < totalCount; i++) {
          const currentOffset = offset + (i * limit);
          if (currentOffset < totalCount) {
            batchOffsets.push(currentOffset);
            batchPromises.push(this.getAll(token, { limit, offset: currentOffset }));
          }
        }
        
        if (batchPromises.length === 0) {
          hasMore = false;
          break;
        }

        // Execute parallel batches
        const batchResults = await Promise.all(batchPromises);
        
        let foundData = false;
        for (let i = 0; i < batchResults.length; i++) {
          const batchResult = batchResults[i];
          const batchOffset = batchOffsets[i];
          
          if (!batchResult.success) {
            logger.warn(`Failed to fetch schools batch at offset ${batchOffset}`, 'SCHOOLS', batchResult.error);
            continue;
          }

          const batch = batchResult.data || [];
          if (batch.length === 0) {
            hasMore = false;
            break;
          }
          
          allSchools.push(...batch);
          foundData = true;
        }

        offset += limit * maxConcurrentBatches;
        
        // Check if there are more pages
        const lastBatchData = batchResults[batchResults.length - 1]?.data || [];
        hasMore = foundData && 
                  lastBatchData.length === limit && 
                  allSchools.length < totalCount &&
                  offset < totalCount;

        // Safety check to prevent infinite loops
        if (totalCount > 0 && allSchools.length >= totalCount) {
          hasMore = false;
        }
      }

      logger.info(`Fetched ${allSchools.length} schools total (API reported: ${totalCount})`, 'SCHOOLS');

      // Use totalCount from API as the base count (should be 1825)
      const baseTotalCount = totalCount > 0 ? totalCount : allSchools.length;

      // Apply filters
      let filteredSchools = allSchools;

      // Filter by search query (school name)
      if (params.q) {
        const query = params.q.toLowerCase();
        filteredSchools = filteredSchools.filter((school) => {
          const name = (school.school_name || '').toLowerCase();
          return name.includes(query);
        });
      }

      // Filter by province
      if (params.province) {
        filteredSchools = filteredSchools.filter((school) => {
          const province = (school.province_name || '').toLowerCase();
          return province.includes(params.province!.toLowerCase());
        });
      }

      // Filter by district
      if (params.district) {
        filteredSchools = filteredSchools.filter((school) => {
          const district = (school.district_name || '').toLowerCase();
          return district.includes(params.district!.toLowerCase());
        });
      }

      // Filter by school type
      if (params.school_type) {
        const filterType = params.school_type.trim();
        filteredSchools = filteredSchools.filter((school) => {
          const typeH = (school.school_type_h || '').toString();
          const typeK = (school.school_type_k || '').toString();
          
          // For "GEIP" filter, show only schools where school_type_h is exactly "GEIP" (not "GEIP-AF")
          if (filterType.toLowerCase() === 'geip') {
            // Check for exact match with "GEIP" but exclude "GEIP-AF" or "GEIP AF"
            const exactGEIP = (typeH.toLowerCase() === 'geip' || typeK.toLowerCase() === 'geip');
            if (exactGEIP) {
              // Make sure it's not GEIP-AF
              const isAF = typeH.toLowerCase().includes('geip-af') || 
                          typeK.toLowerCase().includes('geip-af') ||
                          typeH.toLowerCase().includes('geip af') || 
                          typeK.toLowerCase().includes('geip af');
              return !isAF; // Return true only if it's NOT GEIP-AF
            }
            return false;
          }
          
          // For "GEIP-AF" or "GEIP AF" filter, use the helper function
          if (filterType.toLowerCase() === 'geip-af' || filterType.toLowerCase() === 'geip af') {
            return isGEIPAFSchool(school);
          }
          
          // For other filters, use exact match first, then fall back to includes
          const exactMatch = typeH.toLowerCase() === filterType.toLowerCase() || 
                           typeK.toLowerCase() === filterType.toLowerCase();
          if (exactMatch) return true;
          
          return typeH.toLowerCase().includes(filterType.toLowerCase()) || 
                 typeK.toLowerCase().includes(filterType.toLowerCase());
        });
      }

      // Filter by target status
      if (params.is_target !== undefined && params.is_target !== '') {
        const isTarget = params.is_target === 'true' || params.is_target === '1';
        filteredSchools = filteredSchools.filter((school) => {
          return isTargetSchool(school) === isTarget;
        });
      }

      // If no filters are applied, return the total count from API (1825)
      // Otherwise, return the filtered count
      const hasFilters = !!(params.q || params.province || params.district || params.school_type || params.is_target);
      const finalCount = hasFilters ? filteredSchools.length : baseTotalCount;

      // Cache the unfiltered or filtered results (depending on whether filters were applied)
      // Cache base data (no filters) for reuse
      if (!hasFilters) {
        dataCache.set(cacheKey, filteredSchools, cacheTTL);
        logger.info(`Cached ${filteredSchools.length} schools for future requests`, 'SCHOOLS');
      } else {
        // Also cache filtered results for faster subsequent requests with same filters
        dataCache.set(cacheKey, filteredSchools, cacheTTL);
      }

      return { 
        success: true, 
        data: filteredSchools, 
        count: finalCount,
        next: null, // No pagination for filtered results
        previous: null 
      };
    } catch (error: any) {
      logger.error('Search schools error', 'SCHOOLS', error);
      return { success: false, error: error.message || 'Failed to search schools', data: [], count: 0 };
    }
  },

  async getTotalCount(token: string): Promise<{ success: boolean; total: number; target: number; notTarget: number; geipSchool: number; geipAF: number; error?: string }> {
    try {
      // Check cache first
      const cacheKey = CACHE_KEYS.SCHOOLS_COUNT;
      const cached = dataCache.get<{ total: number; target: number; notTarget: number; geipSchool: number; geipAF: number }>(cacheKey);
      if (cached) {
        logger.info('Using cached schools count', 'SCHOOLS');
        return { 
          success: true, 
          ...cached 
        };
      }

      // Optimized fetching: count as we fetch (streaming approach) for better performance
      const limit = 2000; // Increased batch size for faster fetching
      const maxConcurrentBatches = 5; // Fetch 5 batches in parallel
      let offset = 0;
      let total = 0;
      let hasMore = true;
      
      // Counters - count schools as we fetch them instead of storing all in memory
      let targetCount = 0;
      let notTargetCount = 0;
      let geipAFCount = 0;
      let geipSchoolCount = 0;
      let processedCount = 0;

      // Fetch first batch to get total count
      const firstBatchResult = await this.getAll(token, { limit, offset });
      
      if (!firstBatchResult.success) {
        return { success: false, total: 0, target: 0, notTarget: 0, geipSchool: 0, geipAF: 0, error: firstBatchResult.error };
      }

      total = firstBatchResult.count || 0;
      const firstBatch = firstBatchResult.data || [];
      
      // Process first batch immediately
      for (const school of firstBatch) {
        if (isTargetSchool(school)) targetCount++;
        if (isVolunteerSchool(school)) notTargetCount++;
        if (isGEIPAFSchool(school)) geipAFCount++;
        if (isGEIPSchoolOnly(school)) geipSchoolCount++;
        processedCount++;
      }

      offset += limit;
      hasMore = firstBatchResult.next !== null && firstBatch.length === limit;

      // Fetch remaining batches in parallel for maximum speed
      while (hasMore && processedCount < total) {
        const batchPromises: Promise<any>[] = [];
        const batchOffsets: number[] = [];
        
        // Prepare parallel batch requests
        for (let i = 0; i < maxConcurrentBatches && offset < total; i++) {
          const currentOffset = offset + (i * limit);
          if (currentOffset < total) {
            batchOffsets.push(currentOffset);
            batchPromises.push(this.getAll(token, { limit, offset: currentOffset }));
          }
        }
        
        if (batchPromises.length === 0) {
          hasMore = false;
          break;
        }

        // Execute parallel batches
        const batchResults = await Promise.all(batchPromises);
        
        // Process all batches
        for (let i = 0; i < batchResults.length; i++) {
          const batchResult = batchResults[i];
          
          if (!batchResult.success) {
            logger.warn(`Failed to fetch schools batch at offset ${batchOffsets[i]}`, 'SCHOOLS', batchResult.error);
            continue;
          }
          
          const batch = batchResult.data || [];
          if (batch.length === 0) {
            hasMore = false;
            break;
          }
          
          // Process batch immediately
          for (const school of batch) {
            if (isTargetSchool(school)) targetCount++;
            if (isVolunteerSchool(school)) notTargetCount++;
            if (isGEIPAFSchool(school)) geipAFCount++;
            if (isGEIPSchoolOnly(school)) geipSchoolCount++;
            processedCount++;
          }
        }

        offset += limit * maxConcurrentBatches;
        
        // Check if there are more pages
        const lastBatchData = batchResults[batchResults.length - 1]?.data || [];
        hasMore = lastBatchData.length === limit && 
                  processedCount < total &&
                  offset < total;
        
        // Early exit if we've processed all schools
        if (total > 0 && processedCount >= total) {
          hasMore = false;
        }
      }

      logger.info(`Processed ${processedCount} schools for counts`, 'SCHOOLS');

      const result = { 
        success: true, 
        total, 
        target: targetCount, 
        notTarget: notTargetCount, 
        geipSchool: geipSchoolCount, 
        geipAF: geipAFCount 
      };

      // Cache the result for 30 minutes
      dataCache.set(cacheKey, result, 30 * 60 * 1000);
      
      return result;
    } catch (error: any) {
      logger.error('Get schools total count error', 'SCHOOLS', error);
      return { success: false, total: 0, target: 0, notTarget: 0, geipSchool: 0, geipAF: 0, error: error.message || 'Failed to fetch schools count' };
    }
  },

  async getById(token: string, id: string | number) {
    try {
      return await apiClient.get<School>(EXTERNAL_ENDPOINTS.SCHOOLS.DETAIL(id), { token });
    } catch (error: any) {
      logger.error(`Get school error: ${id}`, 'SCHOOLS', error);
      return { success: false, error: error.message || 'Failed to fetch school' };
    }
  },
};

