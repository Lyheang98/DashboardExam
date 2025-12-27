/**
 * Pagination Utilities
 * Handles automatic pagination for aggregation endpoints
 * Fetches all pages until next === null
 */

import { apiClient, EXTERNAL_ENDPOINTS } from '../api/client';
import { logger } from '../logger';

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/**
 * Fetch all pages from a paginated API endpoint
 * Automatically follows next links until all data is retrieved
 */
export async function fetchAllPages<T>(
  baseUrl: string,
  token: string,
  context?: string
): Promise<{ results: T[]; totalCount: number }> {
  const allResults: T[] = [];
  let nextUrl: string | null = baseUrl;
  let totalCount = 0;
  let pageCount = 0;
  const maxPages = 1000; // Safety limit to prevent infinite loops

  logger.info(`[${context || 'PAGINATION'}] Starting to fetch all pages from: ${baseUrl}`, 'FILTERS');

  while (nextUrl && pageCount < maxPages) {
    pageCount++;
    
    logger.info(`[${context || 'PAGINATION'}] Fetching page ${pageCount}: ${nextUrl}`, 'FILTERS');

    const response = await apiClient.get(nextUrl, { token });

    if (!response.success) {
      logger.error(`[${context || 'PAGINATION'}] Failed to fetch page ${pageCount}: ${response.error}`, 'FILTERS');
      break;
    }

    const data = response.data as any;
    
    // Extract results and pagination info
    const results = data?.results || data?.data || (Array.isArray(data) ? data : []);
    const count = data?.count ?? 0;
    const next = data?.next || null;

    // Use count from first page (should be consistent across pages)
    if (pageCount === 1) {
      totalCount = count;
      logger.info(`[${context || 'PAGINATION'}] Total count from API: ${totalCount}`, 'FILTERS');
    }

    logger.info(`[${context || 'PAGINATION'}] Page ${pageCount}: received ${results.length} results, next: ${next}`, 'FILTERS');

    allResults.push(...results);

    // Check if there are more pages
    if (!next) {
      logger.info(`[${context || 'PAGINATION'}] Reached last page (page ${pageCount})`, 'FILTERS');
      break;
    }

    // Extract next URL (handle both absolute and relative URLs)
    if (next.startsWith('http://') || next.startsWith('https://')) {
      nextUrl = next;
    } else {
      // Relative URL - construct from base
      const baseUrlObj = new URL(baseUrl);
      const nextUrlObj = new URL(next, baseUrlObj.origin);
      nextUrl = nextUrlObj.toString();
    }
  }

  if (pageCount >= maxPages) {
    logger.warn(`[${context || 'PAGINATION'}] Reached max pages limit (${maxPages}), stopping`, 'FILTERS');
  }

  logger.info(`[${context || 'PAGINATION'}] Completed: fetched ${pageCount} pages, ${allResults.length} total results, totalCount: ${totalCount}`, 'FILTERS');

  return {
    results: allResults,
    totalCount,
  };
}

