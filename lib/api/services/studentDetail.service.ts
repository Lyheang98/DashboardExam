/**
 * Student Detail Service
 * 
 * Purpose: Handle HEAVY student data
 * Used ONLY by Students page
 * 
 * Responsibilities:
 * - Call required-parameter APIs such as:
 *   /students/{province_id}/
 *   /students/{province_id}/districts/{district}/schools/{school}/...
 * - Support pagination and request cancellation
 * - Clear data on filter change
 * 
 * Rules:
 * - NEVER auto-fetch
 * - Fetch ONLY on "Filter Data" click
 * - Heavy data MUST be isolated here
 */

import { logger } from '../../logger';

export interface StudentDetail {
  id: string | number;
  [key: string]: any; // Student records can have various fields
}

export interface StudentDetailResponse {
  success: boolean;
  data?: StudentDetail[];
  count?: number;
  next?: string | null;
  previous?: string | null;
  error?: string;
}

export interface StudentDetailParams {
  province_id?: string; // Optional - maps to backend: province_ID
  district_name?: string; // Optional - maps to backend: district_name
  school_name?: string; // Optional - maps to backend: geip_school_ID (for API)
  geip_school_ID?: string; // Optional - exact API field name
  grade?: string; // Optional - filter by grade
  room?: string; // Optional - filter by class/room
  student_type?: string; // Optional - filter by student type
  limit?: number;
  offset?: number;
}

/**
 * Build API URL for student detail endpoint
 * Uses internal API route /api/students instead of calling external API directly
 * Handles various endpoint patterns based on provided parameters
 */
function buildStudentDetailUrl(params: StudentDetailParams): string {
  const { province_id, district_name, school_name, geip_school_ID, grade, room, student_type, limit = 25, offset = 0 } = params;
  
  // Use internal API route
  const baseUrl = '/api/students';
  
  // Build URL with query parameters using EXACT API field names
  const queryParams = new URLSearchParams();
  // Always include pagination
  queryParams.append('limit', limit.toString());
  queryParams.append('offset', offset.toString());
  
  // Use exact API field names
  if (province_id) queryParams.append('province_ID', province_id); // API uses capital ID
  if (district_name) queryParams.append('district_name', district_name);
  // Use geip_school_ID if provided, otherwise fall back to school_name
  if (geip_school_ID) {
    queryParams.append('geip_school_ID', geip_school_ID);
  } else if (school_name) {
    queryParams.append('geip_school_ID', school_name); // Map school_name to geip_school_ID for API
  }
  if (grade) queryParams.append('grade', grade);
  if (room) queryParams.append('room', room);
  if (student_type) queryParams.append('student_type', student_type);
  
  return `${baseUrl}?${queryParams.toString()}`;
}

export const studentDetailService = {
  /**
   * Fetch student details with required parameters
   * This is the ONLY method that calls student detail APIs
   * 
   * @param token - Authentication token
   * @param params - Required parameters (province_id is mandatory)
   * @param signal - AbortSignal for request cancellation
   */
  async getStudentDetails(
    token: string,
    params: StudentDetailParams,
    signal?: AbortSignal
  ): Promise<StudentDetailResponse> {
    try {
      // All parameters are optional - API can filter by any combination
      // However, filtering by province and district is recommended for better performance
      
      const url = buildStudentDetailUrl(params);
      
      logger.info(`Fetching student details: ${url}`, 'STUDENT_DETAIL');
      
      // Call internal API route with authentication header
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal,
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        logger.error(`Failed to fetch student details: ${data.error || response.statusText}`, 'STUDENT_DETAIL');
        return {
          success: false,
          error: data.error || response.statusText || 'Failed to fetch student details',
        };
      }
      
      if (!data.success) {
        logger.error(`API returned error: ${data.error}`, 'STUDENT_DETAIL');
        return {
          success: false,
          error: data.error || 'Failed to fetch student details',
        };
      }
      
      // CRITICAL: Always use response.results and response.count (never results.length)
      // Backend returns: { count, next, previous, results } or { count, data }
      const students = data?.results || data?.data || [];
      const count = data?.count ?? data?.total_count ?? 0; // Use API count, never results.length
      const next = data?.next || null;
      const previous = data?.previous || null;
      
      logger.info(`[STUDENT_DETAIL] Fetched ${students.length} students from results, API count: ${count}`, 'STUDENT_DETAIL');
      logger.info(`[STUDENT_DETAIL] Pagination: next=${next ? 'yes' : 'no'}, previous=${previous ? 'yes' : 'no'}`, 'STUDENT_DETAIL');
      
      return {
        success: true,
        data: students,
        count,
        next,
        previous,
      };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        logger.info('Student detail request cancelled', 'STUDENT_DETAIL');
        return {
          success: false,
          error: 'Request cancelled',
        };
      }
      
      logger.error('Get student details error', 'STUDENT_DETAIL', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch student details',
      };
    }
  },
};

