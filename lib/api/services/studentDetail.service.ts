/**
 * Student Detail Service
 * 
 * Purpose: Handle SINGLE student detail queries
 * Used ONLY for /students/{id} (single student lookup)
 * 
 * STRICT RULES:
 * - NEVER used for list queries (use students.service.ts instead)
 * - NEVER uses query params for filtering (only for single student ID)
 * - ONLY for fetching individual student records by ID
 * 
 * For student LIST queries, use students.service.ts which uses hierarchical endpoints.
 */

import { logger } from '../../logger';
import { EXTERNAL_ENDPOINTS } from '../config';
import { apiClient } from '../client';

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
  id: string | number; // REQUIRED - student ID for single student lookup
}

export const studentDetailService = {
  /**
   * Fetch a SINGLE student detail by ID
   * 
   * STRICT: This is ONLY for /students/{id} (single student)
   * For student lists, use students.service.ts instead
   * 
   * @param token - Authentication token
   * @param params - Student ID parameter
   * @param signal - AbortSignal for request cancellation
   */
  async getStudentDetails(
    token: string,
    params: StudentDetailParams,
    signal?: AbortSignal
  ): Promise<StudentDetailResponse> {
    try {
      // Validate required ID
      if (!params.id) {
        logger.error('[STUDENT_DETAIL] Student ID is required', 'STUDENT_DETAIL');
        return {
          success: false,
          error: 'Student ID is required',
        };
      }

      // Build hierarchical endpoint for single student: /students/{id}/
      const endpoint = EXTERNAL_ENDPOINTS.STUDENTS.DETAIL(params.id);
      
      logger.info(`[STUDENT_DETAIL] Fetching student detail: ${endpoint}`, 'STUDENT_DETAIL');

      // Call external API directly using hierarchical endpoint
      const response = await apiClient.get(endpoint, { token, signal });

      if (!response.success) {
        logger.error(`[STUDENT_DETAIL] API returned error: ${response.error}`, 'STUDENT_DETAIL');
        return {
          success: false,
          error: response.error || 'Failed to fetch student details',
        };
      }

      // Parse response data
      const data = response.data as any;
      const student = Array.isArray(data) ? data[0] : data;
      const students = student ? [student] : [];

      logger.info(`[STUDENT_DETAIL] Fetched student detail for ID: ${params.id}`, 'STUDENT_DETAIL');

      return {
        success: true,
        data: students,
        count: students.length,
        next: null,
        previous: null,
      };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        logger.info('[STUDENT_DETAIL] Request cancelled', 'STUDENT_DETAIL');
        return {
          success: false,
          error: 'Request cancelled',
        };
      }

      logger.error('[STUDENT_DETAIL] Get student details error', 'STUDENT_DETAIL', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch student details',
      };
    }
  },
};
