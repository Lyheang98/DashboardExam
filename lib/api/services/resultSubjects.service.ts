/**
 * Result Subjects Service - Raw API Layer Only
 * 
 * Purpose: Handle ALL result-subjects API calls
 * - NO business logic
 * - NO UI logic
 * - Only raw API operations
 * 
 * Uses existing:
 * - client.ts (apiClient)
 * - safeFetch.ts (via apiClient)
 * - rateLimiter.ts (via apiClient)
 */

import { logger } from '../../logger';
import { EXTERNAL_ENDPOINTS } from '../config';
import { apiClient } from '../client';

// Constants
const LOG_CONTEXT = 'RESULT_SUBJECTS';
const DEFAULT_PAGE_SIZE = 50;
const MIN_MONTH = 1;
const MAX_MONTH = 12;
const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

// Types
export interface ResultSubject {
  id?: string | number;
  student_id?: string;
  student_name?: string;
  student_name_en?: string;
  student_name_km?: string;
  gender?: string;
  province_name?: string;
  district_name?: string;
  school_name?: string;
  geip_school_ID?: string;
  grade?: string;
  grade_name?: string;
  room?: string;
  class?: string;
  subject?: string;
  subject_name?: string;
  score?: number;
  exam_date?: string;
  exam_month?: number;
  exam_year?: number;
  [key: string]: any; // Allow additional fields from API
}

export interface ResultSubjectsResponse {
  success: boolean;
  data?: ResultSubject[];
  count?: number;
  total?: number;
  next?: string | null;
  previous?: string | null;
  error?: string;
}

export interface ResultSubjectsParams {
  // Hierarchical filters
  provinceName?: string;
  provinceId?: string | number; // For monthly endpoints (province_id)
  districtName?: string;
  geipSchoolId?: string;
  gradeName?: string;
  room?: string;
  
  // Force monthly endpoints (for analytics pages - Leaderboard, Student Tracker)
  forceMonthlyEndpoint?: boolean; // If true, ALWAYS use monthly endpoints even if month/year not provided
  
  // Monthly/Yearly filters
  month?: number; // 1-12
  year?: number; // e.g., 2024
  
  // Pagination
  page?: number;
  limit?: number;
  offset?: number;
  
  // Query params
  subject?: string;
  studentId?: string;
  studentName?: string;
}

// Type guards and validators
function isValidMonth(month: number): boolean {
  return month >= MIN_MONTH && month <= MAX_MONTH;
}

function isValidYear(year: number): boolean {
  return year >= MIN_YEAR && year <= MAX_YEAR;
}

// Helper functions
function getDefaultMonthYear(): { month: number; year: number } {
  const now = new Date();
  return {
    month: now.getMonth() + 1,
    year: now.getFullYear()
  };
}
// 009 768 459

function normalizeParams(params: ResultSubjectsParams): ResultSubjectsParams & {
  provinceId?: string;
  month?: number;
  year?: number;
} {
  const normalized = {
    ...params,
    provinceId: params.provinceId ? String(params.provinceId) : undefined,
    month: params.month ? Number(params.month) : undefined,
    year: params.year ? Number(params.year) : undefined,
  };

  // Validate month and year if provided
  if (normalized.month !== undefined && !isValidMonth(normalized.month)) {
    logger.warn(`[${LOG_CONTEXT}] Invalid month value: ${normalized.month}. Must be between ${MIN_MONTH} and ${MAX_MONTH}`, LOG_CONTEXT);
    normalized.month = undefined;
  }

  if (normalized.year !== undefined && !isValidYear(normalized.year)) {
    logger.warn(`[${LOG_CONTEXT}] Invalid year value: ${normalized.year}. Must be between ${MIN_YEAR} and ${MAX_YEAR}`, LOG_CONTEXT);
    normalized.year = undefined;
  }

  return normalized;
}

function buildMonthlyEndpoint(params: ResultSubjectsParams & {
  provinceId?: string;
  month?: number;
  year?: number;
}): string | null {
  const { provinceId, month, year, districtName, geipSchoolId, gradeName, room } = params;

  // Monthly endpoints REQUIRE provinceId
  if (!provinceId || !month || !year) {
    return null;
  }

  // Debug: Log gradeName being used
  logger.info(`[${LOG_CONTEXT}] Building monthly endpoint with gradeName: "${gradeName || 'none'}"`, LOG_CONTEXT);

  // Select deepest monthly endpoint based on available filters
  // Room filter is OPTIONAL - only use BY_MONTH_YEAR_ROOM if room is explicitly provided
  if (districtName && geipSchoolId && gradeName && room) {
    logger.info(`[${LOG_CONTEXT}] Using monthly endpoint: BY_MONTH_YEAR_ROOM with gradeName="${gradeName}"`, LOG_CONTEXT);
    return EXTERNAL_ENDPOINTS.RESULT_SUBJECTS.BY_MONTH_YEAR_ROOM(
      provinceId, month, year, districtName, geipSchoolId, gradeName, room
    );
  }
  
  if (districtName && geipSchoolId && gradeName) {
    logger.info(`[${LOG_CONTEXT}] Using monthly endpoint: BY_MONTH_YEAR_GRADE with gradeName="${gradeName}"`, LOG_CONTEXT);
    return EXTERNAL_ENDPOINTS.RESULT_SUBJECTS.BY_MONTH_YEAR_GRADE(
      provinceId, month, year, districtName, geipSchoolId, gradeName
    );
  }
  
  if (districtName && geipSchoolId) {
    logger.info(`[${LOG_CONTEXT}] Using monthly endpoint: BY_MONTH_YEAR_SCHOOL`, LOG_CONTEXT);
    return EXTERNAL_ENDPOINTS.RESULT_SUBJECTS.BY_MONTH_YEAR_SCHOOL(
      provinceId, month, year, districtName, geipSchoolId
    );
  }
  
  if (districtName) {
    logger.info(`[${LOG_CONTEXT}] Using monthly endpoint: BY_MONTH_YEAR_DISTRICT`, LOG_CONTEXT);
    return EXTERNAL_ENDPOINTS.RESULT_SUBJECTS.BY_MONTH_YEAR_DISTRICT(
      provinceId, month, year, districtName
    );
  }
  
  logger.info(`[${LOG_CONTEXT}] Using monthly endpoint: BY_MONTH_YEAR`, LOG_CONTEXT);
  return EXTERNAL_ENDPOINTS.RESULT_SUBJECTS.BY_MONTH_YEAR(provinceId, month, year);
}

function buildHierarchicalEndpoint(params: ResultSubjectsParams): string {
  const { provinceName, districtName, geipSchoolId, gradeName, room } = params;

  // Sanitize inputs - trim and filter empty strings
  const sanitizedProvinceName = provinceName?.trim();
  const sanitizedDistrictName = districtName?.trim();
  const sanitizedGeipSchoolId = geipSchoolId?.trim();
  const sanitizedGradeName = gradeName?.trim();
  const sanitizedRoom = room?.trim();

  // Standard hierarchical endpoints (ONLY for non-analytics pages)
  // NOTE: These endpoints should NOT be used for Leaderboard or Student Tracker
  if (sanitizedProvinceName && sanitizedDistrictName && sanitizedGeipSchoolId && sanitizedGradeName && sanitizedRoom) {
    // Deepest: All filters available - use BY_ROOM
    logger.info(`[${LOG_CONTEXT}] Using deepest endpoint: BY_ROOM`, LOG_CONTEXT);
    return EXTERNAL_ENDPOINTS.RESULT_SUBJECTS.BY_ROOM(
      sanitizedProvinceName, sanitizedDistrictName, sanitizedGeipSchoolId, sanitizedGradeName, sanitizedRoom
    );
  }
  
  if (sanitizedProvinceName && sanitizedDistrictName && sanitizedGeipSchoolId && sanitizedGradeName) {
    // Deep: School + Grade - use BY_GRADE
    logger.info(`[${LOG_CONTEXT}] Using deep endpoint: BY_GRADE`, LOG_CONTEXT);
    return EXTERNAL_ENDPOINTS.RESULT_SUBJECTS.BY_GRADE(
      sanitizedProvinceName, sanitizedDistrictName, sanitizedGeipSchoolId, sanitizedGradeName
    );
  }
  
  if (sanitizedProvinceName && sanitizedDistrictName && sanitizedGeipSchoolId) {
    // Medium: School only - use BY_SCHOOL
    logger.info(`[${LOG_CONTEXT}] Using medium endpoint: BY_SCHOOL`, LOG_CONTEXT);
    return EXTERNAL_ENDPOINTS.RESULT_SUBJECTS.BY_SCHOOL(
      sanitizedProvinceName, sanitizedDistrictName, sanitizedGeipSchoolId
    );
  }
  
  if (sanitizedProvinceName && sanitizedDistrictName) {
    // Medium: District only - use BY_DISTRICT
    logger.info(`[${LOG_CONTEXT}] Using medium endpoint: BY_DISTRICT`, LOG_CONTEXT);
    return EXTERNAL_ENDPOINTS.RESULT_SUBJECTS.BY_DISTRICT(sanitizedProvinceName, sanitizedDistrictName);
  }
  
  if (sanitizedProvinceName) {
    // Shallow: Province only - use BY_PROVINCE
    logger.info(`[${LOG_CONTEXT}] Using shallow endpoint: BY_PROVINCE`, LOG_CONTEXT);
    return EXTERNAL_ENDPOINTS.RESULT_SUBJECTS.BY_PROVINCE(sanitizedProvinceName);
  }
  
  // Base endpoint (no filters)
  logger.info(`[${LOG_CONTEXT}] Using base endpoint: BASE`, LOG_CONTEXT);
  return EXTERNAL_ENDPOINTS.RESULT_SUBJECTS.BASE;
}

/**
 * Build endpoint path using the DEEPEST possible scope
 * Always uses the most specific endpoint available based on provided filters
 * 
 * CRITICAL: For analytics pages (Leaderboard, Student Tracker), ALWAYS use monthly endpoints
 * NEVER use non-monthly endpoints (BY_PROVINCE, BY_DISTRICT, BY_SCHOOL, BY_GRADE, BY_ROOM)
 */
function buildEndpoint(params: ResultSubjectsParams & {
  provinceId?: string;
  month?: number;
  year?: number;
}): string {
  const { forceMonthlyEndpoint, month, year, provinceId } = params;

  // If forceMonthlyEndpoint is true, default to current year and month if not provided
  if (forceMonthlyEndpoint && (!month || !year)) {
    const defaultMonthYear = getDefaultMonthYear();
    params.month = params.month || defaultMonthYear.month;
    params.year = params.year || defaultMonthYear.year;
    logger.info(
      `[${LOG_CONTEXT}] Using default month/year for monthly endpoint: ${params.month}/${params.year}`,
      LOG_CONTEXT
    );
  }

  // Determine if we should use monthly endpoints
  const shouldUseMonthly = (
    (forceMonthlyEndpoint && params.month && params.year) ||
    (!forceMonthlyEndpoint && params.month && params.year)
  );

  if (shouldUseMonthly) {
    // For monthly endpoints, we need provinceId - cannot use provinceName
    if (!params.provinceId && params.provinceName) {
      logger.warn(
        `[${LOG_CONTEXT}] Monthly endpoint requires provinceId, not provinceName`,
        LOG_CONTEXT
      );
    }

    const monthlyEndpoint = buildMonthlyEndpoint(params);
    if (monthlyEndpoint) {
      return monthlyEndpoint;
    }

    // If forceMonthlyEndpoint is true, NEVER fall back to non-monthly endpoints
    if (forceMonthlyEndpoint) {
      logger.error(
        `[${LOG_CONTEXT}] forceMonthlyEndpoint is true but monthly endpoint could not be built. Missing required parameters.`,
        LOG_CONTEXT
      );
      
      // Return a safe monthly endpoint with defaults (will likely return empty, but at least won't 404 on wrong endpoint)
      if (params.provinceId && params.month && params.year) {
        return EXTERNAL_ENDPOINTS.RESULT_SUBJECTS.BY_MONTH_YEAR(
          params.provinceId, params.month, params.year
        );
      }
      
      logger.error(
        `[${LOG_CONTEXT}] Cannot build monthly endpoint - missing provinceId or month/year`,
        LOG_CONTEXT
      );
      return EXTERNAL_ENDPOINTS.RESULT_SUBJECTS.BASE;
    }
  }

  // Use standard hierarchical endpoints
  return buildHierarchicalEndpoint(params);
}

/**
 * Build query parameters for pagination and optional filters
 */
function buildQueryParams(params: ResultSubjectsParams): URLSearchParams {
  const queryParams = new URLSearchParams();
  
  // Pagination
  const limit = params.limit || DEFAULT_PAGE_SIZE;
  queryParams.append('limit', limit.toString());
  
  if (params.offset !== undefined) {
    queryParams.append('offset', params.offset.toString());
  } else if (params.page) {
    queryParams.append('offset', ((params.page - 1) * limit).toString());
  }
  
  // Optional filters (query params only)
  if (params.subject?.trim()) {
    queryParams.append('subject', params.subject.trim());
  }
  if (params.studentId?.trim()) {
    queryParams.append('student_id', params.studentId.trim());
  }
  if (params.studentName?.trim()) {
    queryParams.append('student_name', params.studentName.trim());
  }
  
  return queryParams;
}

/**
 * Normalize response data to always return an array
 * Handles both array responses and paginated object responses
 */
function normalizeResultSubjectsResponse(response: any): ResultSubject[] {
  // If response is already an array, return it
  if (Array.isArray(response)) {
    return response;
  }
  
  // If response has results property, return results array
  if (response?.results && Array.isArray(response.results)) {
    return response.results;
  }
  
  // If response has data property, return data array
  if (response?.data && Array.isArray(response.data)) {
    return response.data;
  }
  
  // Otherwise return empty array
  return [];
}

export const resultSubjectsService = {
  /**
   * Fetch result subjects with filters and pagination
   * 
   * Raw API layer - no business logic
   * 
   * @param token - Authentication token
   * @param params - Filter and pagination parameters
   * @param signal - AbortSignal for request cancellation
   */
  async getList(
    token: string,
    params: ResultSubjectsParams = {},
    signal?: AbortSignal
  ): Promise<ResultSubjectsResponse> {
    try {
      // Normalize parameters first
      const normalizedParams = normalizeParams(params);
      
      // Build endpoint
      const endpoint = buildEndpoint(normalizedParams);
      const queryParams = buildQueryParams(normalizedParams);
      const url = queryParams.toString() ? `${endpoint}?${queryParams.toString()}` : endpoint;
      
      logger.info(`[${LOG_CONTEXT}] Fetching result subjects: ${url}`, LOG_CONTEXT);
      logger.info(
        `[${LOG_CONTEXT}] Filters: provinceId=${normalizedParams.provinceId || normalizedParams.provinceName || 'none'}, ` +
        `provinceName=${normalizedParams.provinceName || 'none'}, ` +
        `districtName=${normalizedParams.districtName || 'none'}, ` +
        `geipSchoolId=${normalizedParams.geipSchoolId || 'none'}, ` +
        `gradeName=${normalizedParams.gradeName || 'none'}, ` +
        `room=${normalizedParams.room || 'none'}, ` +
        `month=${normalizedParams.month || 'none'}, ` +
        `year=${normalizedParams.year || 'none'}, ` +
        `page=${normalizedParams.page || 'none'}, ` +
        `limit=${normalizedParams.limit || DEFAULT_PAGE_SIZE}`,
        LOG_CONTEXT
      );

      // Call external API
      const response = await apiClient.get<any>(url, { token, signal });

      if (!response.success) {
        // Handle 404 as empty state (not error) - backend returns 404 when no data for period
        const errorMessage = response.error || '';
        const errorLower = errorMessage.toLowerCase();
        const is404EmptyState = 
          errorMessage.includes('404') || 
          errorLower.includes('no results found') ||
          errorLower.includes('no results found for the latest exam period') ||
          errorLower.includes('not found');
        
        if (is404EmptyState && normalizedParams.forceMonthlyEndpoint) {
          // For analytics pages, 404 means no data for the period (empty state, not error)
          logger.info(
            `[${LOG_CONTEXT}] 404 response treated as empty state (no data for period): ${errorMessage}`,
            LOG_CONTEXT
          );
          return {
            success: true,
            data: [],
            count: 0,
            total: 0,
            next: null,
            previous: null,
          };
        }
        
        logger.error(`[${LOG_CONTEXT}] API returned error: ${response.error}`, LOG_CONTEXT);
        return {
          success: false,
          error: response.error || 'Failed to fetch result subjects',
        };
      }

      // Normalize response to always get an array
      const rawData = response.data as any;
      const normalizedResults = normalizeResultSubjectsResponse(rawData);
      
      // Extract pagination metadata if available
      const count = rawData?.count ?? rawData?.total_count ?? normalizedResults.length;
      const total = rawData?.total ?? count;
      const next = rawData?.next || null;
      const previous = rawData?.previous || null;

      // Debug logging (dev only)
      if (process.env.NODE_ENV === 'development') {
        const responseType = Array.isArray(rawData) 
          ? 'Array' 
          : (rawData?.results 
            ? 'PaginatedObject(results)' 
            : (rawData?.data 
              ? 'PaginatedObject(data)' 
              : 'Unknown'));
        logger.info(
          `[${LOG_CONTEXT}] Response type: ${responseType}, Normalized array length: ${normalizedResults.length}`,
          LOG_CONTEXT
        );
      }
      
      logger.info(
        `[${LOG_CONTEXT}] Fetched ${normalizedResults.length} result subjects, total: ${total}`,
        LOG_CONTEXT
      );

      return {
        success: true,
        data: normalizedResults,
        count,
        total,
        next,
        previous,
      };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        logger.info(`[${LOG_CONTEXT}] Request cancelled`, LOG_CONTEXT);
        return {
          success: false,
          error: 'Request cancelled',
        };
      }

      logger.error(`[${LOG_CONTEXT}] Get list error`, LOG_CONTEXT, error);
      return {
        success: false,
        error: error.message || 'Failed to fetch result subjects',
      };
    }
  },

  /**
   * Fetch result subjects by month and year
   * Convenience method for monthly aggregation
   * 
   * @param token - Authentication token
   * @param params - Filter and pagination parameters (must include month and year)
   * @param signal - AbortSignal for request cancellation
   */
  async getByMonthYear(
    token: string,
    params: ResultSubjectsParams & { month: number; year: number },
    signal?: AbortSignal
  ): Promise<ResultSubjectsResponse> {
    return this.getList(token, params, signal);
  },
};