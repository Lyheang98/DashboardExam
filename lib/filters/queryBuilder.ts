/**
 * Query Builder
 * Standardized API query parameter construction
 * Ensures frontend param names match backend expectations
 */

import { FilterState } from './types';
import { logger } from '../logger';

export interface QueryParams {
  province_id?: string;
  district_name?: string;
  school_name?: string;
  q?: string;
  limit?: number;
  offset?: number;
}

/**
 * Build query parameters from filter state
 * Only includes non-empty parameters
 * Param names match backend API expectations exactly
 */
export function buildQueryParams(
  filters: FilterState,
  pagination?: { limit?: number; offset?: number }
): QueryParams {
  const params: QueryParams = {};

  // Only add non-empty required filters
  // CRITICAL: Frontend field names MUST match backend exactly
  // Backend uses: province_ID, district_name, school_name
  if (filters.provinceId) {
    params.province_id = filters.provinceId; // Backend expects province_ID in URL path
  }

  if (filters.districtName) {
    params.district_name = filters.districtName; // Backend expects district_name
  }

  if (filters.schoolName) {
    params.school_name = filters.schoolName; // Backend expects school_name
  }

  // Add search query if provided
  if (filters.searchQuery && filters.searchQuery.trim()) {
    params.q = filters.searchQuery.trim();
  }

  // Add pagination if provided
  if (pagination) {
    if (pagination.limit !== undefined) {
      params.limit = pagination.limit;
    }
    if (pagination.offset !== undefined) {
      params.offset = pagination.offset;
    }
  }

  return params;
}

/**
 * Convert query params to URLSearchParams string
 * Excludes undefined/null/empty values
 */
export function buildQueryString(params: QueryParams): string {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  });

  return searchParams.toString();
}

/**
 * Build full API URL with query parameters
 * Logs the final URL for debugging
 */
export function buildApiUrl(
  baseEndpoint: string,
  filters: FilterState,
  pagination?: { limit?: number; offset?: number },
  context?: string
): string {
  const params = buildQueryParams(filters, pagination);
  const queryString = buildQueryString(params);
  const url = queryString ? `${baseEndpoint}?${queryString}` : baseEndpoint;

  // Developer-grade logging
  logger.info(`[${context || 'QUERY_BUILDER'}] Built API URL: ${url}`, 'FILTERS');
  logger.info(`[${context || 'QUERY_BUILDER'}] Filter state: ${JSON.stringify(filters)}`, 'FILTERS');
  logger.info(`[${context || 'QUERY_BUILDER'}] Query params: ${JSON.stringify(params)}`, 'FILTERS');

  return url;
}

