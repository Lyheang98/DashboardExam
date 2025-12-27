/**
 * Centralized Data Fetching Functions
 * Reusable API call logic for all filter pages
 * Prevents duplicate code and ensures consistency
 */

import { logger } from '../logger';
import { FilterState, FilterPageType, validateFilters } from './types';
import { districtService, schoolService, studentIndexService } from '../api';
import { getToken } from '../auth';

export interface FetchResult<T> {
  success: boolean;
  data?: T[];
  count?: number;
  total_students?: number;
  error?: string;
}

/**
 * Fetch districts filtered by province
 * @deprecated Use districtService.getAll() directly
 */
export async function fetchDistricts(
  filters: FilterState,
  searchQuery?: string
): Promise<FetchResult<{ province_id: string; district_name: string; total_count: number }>> {
  // Validate filters
  const validation = validateFilters(filters, 'district');
  if (!validation.isValid) {
    logger.error(`[DISTRICTS] Invalid filters: ${validation.errorMessage}`, 'FILTERS');
    return {
      success: false,
      error: validation.errorMessage,
    };
  }

  try {
    // Use DistrictService
    const result = await districtService.getAll({
      province_id: filters.provinceId,
      q: searchQuery || filters.searchQuery,
      limit: 10000,
      offset: 0,
    });

    return {
      success: result.success,
      data: result.data || [],
      count: result.count || 0,
      total_students: result.total_students || 0,
      error: result.error,
    };
  } catch (error: any) {
    logger.error(`[DISTRICTS] Fetch error: ${error.message}`, 'FILTERS', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch districts',
    };
  }
}

/**
 * Fetch schools filtered by province and district
 * @deprecated Use schoolService.getAll() directly
 */
export async function fetchSchools(
  filters: FilterState,
  searchQuery?: string
): Promise<FetchResult<{ province_id: string; district_name: string; school_name: string; total_count: number }>> {
  // Validate filters
  const validation = validateFilters(filters, 'school');
  if (!validation.isValid) {
    logger.error(`[SCHOOLS] Invalid filters: ${validation.errorMessage}`, 'FILTERS');
    return {
      success: false,
      error: validation.errorMessage,
    };
  }

  if (!filters.provinceId || !filters.districtName) {
    return {
      success: false,
      error: 'province_id and district_name are required',
    };
  }

  try {
    // Use SchoolService
    const result = await schoolService.getAll({
      province_id: filters.provinceId,
      district_name: filters.districtName,
      school_name: filters.schoolName,
      q: searchQuery || filters.searchQuery,
      limit: 1000,
      offset: 0,
    });

    return {
      success: result.success,
      data: result.data || [],
      count: result.count || 0,
      total_students: result.total_students || 0,
      error: result.error,
    };
  } catch (error: any) {
    logger.error(`[SCHOOLS] Fetch error: ${error.message}`, 'FILTERS', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch schools',
    };
  }
}

/**
 * Fetch students filtered by province, district, and school
 * @deprecated Use studentIndexService.getList() directly
 */
export async function fetchStudents(
  filters: FilterState,
  pagination: { limit: number; offset: number },
  signal?: AbortSignal
): Promise<FetchResult<any>> {
  // Validate filters
  const validation = validateFilters(filters, 'student');
  if (!validation.isValid) {
    logger.error(`[STUDENTS] Invalid filters: ${validation.errorMessage}`, 'FILTERS');
    return {
      success: false,
      error: validation.errorMessage,
    };
  }

  const token = getToken();
  if (!token) {
    logger.error('[STUDENTS] No token available', 'FILTERS');
    return {
      success: false,
      error: 'Authentication required',
    };
  }

  if (!filters.provinceId || !filters.districtName) {
    return {
      success: false,
      error: 'province_id and district_name are required',
    };
  }

  try {
    // Use StudentIndexService
    const result = await studentIndexService.getList(
      token,
      {
        province_id: filters.provinceId,
        district_name: filters.districtName,
        school_name: filters.schoolName,
        limit: pagination.limit,
        offset: pagination.offset,
      },
      signal
    );

    return {
      success: result.success,
      data: result.data || [],
      count: result.count || 0,
      error: result.error,
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      logger.info('[STUDENTS] Request cancelled', 'FILTERS');
      return {
        success: false,
        error: 'Request cancelled',
      };
    }
    logger.error(`[STUDENTS] Fetch error: ${error.message}`, 'FILTERS', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch students',
    };
  }
}

