/**
 * Schools Service
 */

import { apiClient, EXTERNAL_ENDPOINTS } from '../client';
import { logger } from '../../logger';

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
      // Fetch ALL schools using pagination to ensure we get all schools from all provinces
      const allSchools: School[] = [];
      let offset = 0;
      const limit = 100; // Fetch in batches of 100
      let hasMore = true;
      let totalCount = 0;

      // First, get the total count from the first page (limit 100 to get actual schools)
      const firstPageResult = await this.getAll(token, { limit: 100, offset: 0 });
      if (firstPageResult.success) {
        totalCount = firstPageResult.count || 0;
        const firstBatch = firstPageResult.data || [];
        allSchools.push(...firstBatch);
        logger.info(`First page result: count=${totalCount}, schools=${firstBatch.length}`, 'SCHOOLS');
        offset = 100; // Start from offset 100 since we already got the first 100
      } else {
        logger.error('Failed to get first page for total count', 'SCHOOLS', firstPageResult.error);
        // If first page fails, start from offset 0
        offset = 0;
      }

      // Fetch all schools page by page
      let batchCount = 0;
      while (hasMore && batchCount < 100) { // Safety limit of 100 batches
        batchCount++;
        const batchResult = await this.getAll(token, { limit, offset });
        
        if (!batchResult.success) {
          logger.error(`Failed to fetch schools batch at offset ${offset}`, 'SCHOOLS', batchResult.error);
          // If we have some data, continue with what we have
          if (allSchools.length > 0) {
            logger.warn(`Stopping pagination after ${batchCount} batches, have ${allSchools.length} schools`, 'SCHOOLS');
          }
          break;
        }

        const batch = batchResult.data || [];
        if (batch.length === 0) {
          hasMore = false;
          break;
        }
        
        allSchools.push(...batch);
        logger.info(`Batch ${batchCount}: fetched ${batch.length} schools (total so far: ${allSchools.length})`, 'SCHOOLS');

        // Check if there are more pages
        hasMore = batchResult.next !== null && batch.length === limit;
        offset += limit;

        // Safety check to prevent infinite loops
        if (totalCount > 0 && allSchools.length >= totalCount) {
          hasMore = false;
        }
      }

      logger.info(`Fetched ${allSchools.length} schools total (API reported: ${totalCount})`, 'SCHOOLS');
      
      if (allSchools.length === 0) {
        logger.warn('No schools fetched from API - this might indicate an authentication or API issue', 'SCHOOLS', { 
          totalCount, 
          firstPageSuccess: firstPageResult.success,
          firstPageError: firstPageResult.error 
        });
      }

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
        filteredSchools = filteredSchools.filter((school) => {
          const type = (school.school_type_h || '').toLowerCase();
          return type.includes(params.school_type!.toLowerCase());
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

  async getTotalCount(token: string): Promise<{ success: boolean; total: number; target: number; notTarget: number; error?: string }> {
    try {
      // Fetch first page to get total count from API
      const result = await this.getAll(token, { limit: 1, offset: 0 });
      
      if (!result.success) {
        return { success: false, total: 0, target: 0, notTarget: 0, error: result.error };
      }

      // Use the count from API response (this is the accurate total)
      const total = result.count || 0;

      // Fetch all schools using pagination to count target/not target
      const allSchools: School[] = [];
      let offset = 0;
      const limit = 100; // Fetch in batches
      let hasMore = true;

      while (hasMore) {
        const batchResult = await this.getAll(token, { limit, offset });
        
        if (!batchResult.success) {
          break;
        }

        const batch = batchResult.data || [];
        allSchools.push(...batch);

        // Check if there are more pages
        hasMore = batchResult.next !== null && batch.length === limit;
        offset += limit;
      }

      // Count target schools - schools with "សាលាគោលដៅ" (target school) in school_type
      const target = allSchools.filter((school) => isTargetSchool(school)).length;
      
      // Count not target schools - ONLY volunteer schools (សាលាស្ម័គ្រចិត្ត)
      const notTarget = allSchools.filter((school) => isVolunteerSchool(school)).length;

      return { success: true, total, target, notTarget };
    } catch (error: any) {
      logger.error('Get schools total count error', 'SCHOOLS', error);
      return { success: false, total: 0, target: 0, notTarget: 0, error: error.message || 'Failed to fetch schools count' };
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

