/**
 * Students Service - Student List Queries
 * 
 * STRICT RULES:
 * 1. MUST require provinceId + districtId (no unfiltered queries)
 * 2. MUST require pagination (page + size)
 * 3. NEVER auto-fetch
 * 4. ONLY used for student table/list queries
 * 5. Uses hierarchical endpoints (NOT flat /students/)
 * 6. Always uses the DEEPEST possible scope for safety
 * 
 * HIERARCHICAL ENDPOINT STRUCTURE (deepest to shallowest):
 * - /students/{province}/districts/{district}/schools/{school}/grades/{grade}/rooms/{room}/
 * - /students/{province}/districts/{district}/schools/{school}/grades/{grade}/
 * - /students/{province}/districts/{district}/schools/{school}/
 * - /students/{province}/districts/{district}/ (minimum required)
 * 
 * This service is the ONLY service for fetching student lists.
 * studentDetail.service.ts is ONLY for /students/{id} (single student)
 */

import { logger } from '../../logger';
import { EXTERNAL_ENDPOINTS } from '../config';
import { apiClient } from '../client';

export interface Student {
  id: string | number;
  [key: string]: any; // Student records can have various fields
}

export interface StudentsListResponse {
  success: boolean;
  data?: Student[];
  count?: number;
  total?: number;
  page?: number;
  size?: number;
  totalPages?: number;
  error?: string;
}

export interface StudentsListParams {
  provinceId: string; // REQUIRED
  districtId: string; // REQUIRED (maps to district_name in API)
  schoolId?: string; // Optional - if provided, uses deeper endpoint
  grade?: string; // Optional - if provided, uses deeper endpoint
  class?: string; // Optional (maps to room in API) - if provided, uses deepest endpoint
  studentType?: string; // Optional - query param only
  name?: string; // Optional - query param only
  studentId?: string; // Optional - query param only
  page: number; // REQUIRED (1-based)
  size: number; // REQUIRED (default: 25)
}

/**
 * Validate that required parameters are present
 */
function validateParams(params: StudentsListParams): { valid: boolean; error?: string } {
  if (!params.provinceId || !params.provinceId.trim()) {
    return { valid: false, error: 'provinceId is required' };
  }
  if (!params.districtId || !params.districtId.trim()) {
    return { valid: false, error: 'districtId is required' };
  }
  if (!params.page || params.page < 1) {
    return { valid: false, error: 'page must be >= 1' };
  }
  if (!params.size || params.size < 1) {
    return { valid: false, error: 'size must be >= 1' };
  }
  return { valid: true };
}

/**
 * Build hierarchical endpoint path using the DEEPEST possible scope
 * Always uses the most specific endpoint available based on provided filters
 * 
 * Priority (deepest to shallowest):
 * 1. BY_ROOM: if province + district + school + grade + room
 * 2. BY_GRADE: if province + district + school + grade
 * 3. BY_SCHOOL: if province + district + school
 * 4. BY_DISTRICT: if province + district (minimum)
 */
function buildHierarchicalEndpoint(params: StudentsListParams): string {
  const provinceId = params.provinceId.trim();
  const districtName = params.districtId.trim();
  const schoolName = params.schoolId?.trim();
  const grade = params.grade?.trim();
  const room = params.class?.trim(); // class maps to room
  
  // Build the DEEPEST possible endpoint based on available filters
  // This ensures maximum safety by using the most specific scope
  
  if (provinceId && districtName && schoolName && grade && room) {
    // Deepest: All filters available - use BY_ROOM
    logger.info(`[STUDENTS] Using deepest endpoint: BY_ROOM`, 'STUDENTS');
    return EXTERNAL_ENDPOINTS.STUDENTS.BY_ROOM(provinceId, districtName, schoolName, grade, room);
  }
  
  if (provinceId && districtName && schoolName && grade) {
    // Deep: School + Grade - use BY_GRADE
    logger.info(`[STUDENTS] Using deep endpoint: BY_GRADE`, 'STUDENTS');
    return EXTERNAL_ENDPOINTS.STUDENTS.BY_GRADE(provinceId, districtName, schoolName, grade);
  }
  
  if (provinceId && districtName && schoolName) {
    // Medium: School only - use BY_SCHOOL
    logger.info(`[STUDENTS] Using medium endpoint: BY_SCHOOL`, 'STUDENTS');
    return EXTERNAL_ENDPOINTS.STUDENTS.BY_SCHOOL(provinceId, districtName, schoolName);
  }
  
  // Minimum: Province + District only - use BY_DISTRICT
  logger.info(`[STUDENTS] Using minimum endpoint: BY_DISTRICT`, 'STUDENTS');
  return EXTERNAL_ENDPOINTS.STUDENTS.BY_DISTRICT(provinceId, districtName);
}

/**
 * Build query parameters for pagination and optional filters
 * Note: Filters already used in path (school, grade, room) are NOT added as query params
 * Note: studentType is filtered client-side AFTER fetch, so it's NOT added here
 */
function buildQueryParams(params: StudentsListParams): URLSearchParams {
  const queryParams = new URLSearchParams();
  
  // Always include pagination
  queryParams.append('limit', params.size.toString());
  queryParams.append('offset', ((params.page - 1) * params.size).toString());
  
  // Add optional filters that are NOT in the path (only query params)
  // Note: school, grade, and room are in the path, so they're not added here
  // Note: studentType is filtered client-side after fetch, so it's NOT added here
  if (params.name && params.name.trim()) {
    queryParams.append('name', params.name.trim());
  }
  if (params.studentId && params.studentId.trim()) {
    queryParams.append('student_id', params.studentId.trim());
  }
  
  return queryParams;
}

export const studentsService = {
  /**
   * Fetch student list with filters and pagination
   * 
   * STRICT: Requires provinceId + districtId + page + size
   * Uses hierarchical endpoints (NOT flat /students/)
   * Always uses the DEEPEST possible scope for safety
   * 
   * @param token - Authentication token
   * @param params - Filter and pagination parameters
   * @param signal - AbortSignal for request cancellation
   */
  async getList(
    token: string,
    params: StudentsListParams,
    signal?: AbortSignal
  ): Promise<StudentsListResponse> {
    try {
      // Validate required parameters
      const validation = validateParams(params);
      if (!validation.valid) {
        logger.error(`[STUDENTS] Invalid parameters: ${validation.error}`, 'STUDENTS');
        return {
          success: false,
          error: validation.error || 'Invalid parameters',
        };
      }

      // Build hierarchical endpoint path (always uses deepest possible scope)
      const endpoint = buildHierarchicalEndpoint(params);
      const queryParams = buildQueryParams(params);
      const url = `${endpoint}?${queryParams.toString()}`;
      
      logger.info(`[STUDENTS] ===== FINAL API URL =====`, 'STUDENTS');
      logger.info(`[STUDENTS] ${url}`, 'STUDENTS');
      logger.info(`[STUDENTS] Filters: provinceId=${params.provinceId}, districtId=${params.districtId}, schoolId=${params.schoolId || 'none'}, grade=${params.grade || 'none'}, room=${params.class || 'none'}, page=${params.page}, size=${params.size}`, 'STUDENTS');
      logger.info(`[STUDENTS] =========================`, 'STUDENTS');

      // Call external API directly using hierarchical endpoint
      // apiClient.get supports signal via RequestOptions
      const response = await apiClient.get(url, { token, signal });

      if (!response.success) {
        logger.error(`[STUDENTS] API returned error: ${response.error}`, 'STUDENTS');
        return {
          success: false,
          error: response.error || 'Failed to fetch students',
        };
      }

      // Parse response data
      const data = response.data as any;
      const students = data?.results || data?.data || (Array.isArray(data) ? data : []);
      const count = data?.count ?? data?.total_count ?? 0;
      const totalPages = Math.ceil(count / params.size);

      logger.info(`[STUDENTS] Fetched ${students.length} students (page ${params.page} of ${totalPages}), total: ${count}`, 'STUDENTS');

      return {
        success: true,
        data: students,
        count,
        total: count,
        page: params.page,
        size: params.size,
        totalPages,
      };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        logger.info('[STUDENTS] Request cancelled', 'STUDENTS');
        return {
          success: false,
          error: 'Request cancelled',
        };
      }

      logger.error('[STUDENTS] Get list error', 'STUDENTS', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch students',
      };
    }
  },
};
