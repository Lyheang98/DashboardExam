/**
 * District Service
 * Handles all district-related data operations
 * Provides caching, deduplication, and normalized data
 */

import { getToken } from '../../auth';
import { logger } from '../../logger';
import { dataCache } from '../../cache/dataCache';

export interface DistrictData {
  province_id: string;
  district_name: string;
  total_count: number;
}

export interface DistrictServiceResponse {
  success: boolean;
  data?: DistrictData[];
  total_students?: number;
  count?: number;
  error?: string;
}

export interface DistrictServiceParams {
  limit?: number;
  offset?: number;
  province_id?: string;
  district_name?: string;
  q?: string; // Search query
}

const CACHE_KEY_PREFIX = 'district_service_';
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * Generate cache key from parameters
 */
function getCacheKey(params: DistrictServiceParams): string {
  const key = `limit_${params.limit || 10000}_offset_${params.offset || 0}_pid_${params.province_id || 'all'}_dname_${params.district_name || 'all'}_q_${params.q || 'all'}`;
  return `${CACHE_KEY_PREFIX}${key}`;
}

/**
 * Normalize district data to ensure consistent format
 */
function normalizeDistrictData(data: any[]): DistrictData[] {
  if (!Array.isArray(data)) {
    return [];
  }

  // Deduplicate by province_id + district_name combination
  const districtMap = new Map<string, DistrictData>();

  for (const item of data) {
    const provinceId = (item.province_id || item.id || item.province_ID || '').toString().trim();
    const districtName = (item.district_name || item.name || item.district_Name || '').toString().trim();
    const totalCount = typeof item.total_count === 'number' ? item.total_count : 
                      (typeof item.student_count === 'number' ? item.student_count :
                      (typeof item.count === 'number' ? item.count : 0));

    if (!provinceId || !districtName) {
      continue; // Skip invalid records
    }

    // Use combination key for deduplication
    const key = `${provinceId}:${districtName}`;

    if (districtMap.has(key)) {
      const existing = districtMap.get(key)!;
      // Merge counts if duplicate
      existing.total_count += totalCount;
    } else {
      districtMap.set(key, {
        province_id: provinceId,
        district_name: districtName,
        total_count: totalCount,
      });
    }
  }

  return Array.from(districtMap.values());
}

export const districtService = {
  /**
   * Get all districts with aggregated student counts
   */
  async getAll(params: DistrictServiceParams = {}): Promise<DistrictServiceResponse> {
    try {
      const token = getToken();
      if (!token) {
        return {
          success: false,
          error: 'Authentication required',
        };
      }

      // Check cache first (skip cache for empty results when province_id is provided, to allow fallback)
      const cacheKey = getCacheKey(params);
      const cached = dataCache.get<DistrictServiceResponse>(cacheKey);
      if (cached && cached.success && cached.data && cached.data.length > 0) {
        logger.info(`[DISTRICT_SERVICE] Cache hit for key: ${cacheKey}`, 'DISTRICT_SERVICE');
        return cached;
      }
      // Also skip cache if we have empty results for a province_id lookup (allow fallback to retry)
      if (cached && cached.success && cached.data && cached.data.length === 0 && params.province_id) {
        logger.info(`[DISTRICT_SERVICE] Skipping cached empty result for province_id=${params.province_id} to allow fallback`, 'DISTRICT_SERVICE');
      }

      // Build API URL
      const queryParams = new URLSearchParams();
      if (params.limit) queryParams.append('limit', params.limit.toString());
      if (params.offset) queryParams.append('offset', params.offset.toString());
      if (params.province_id) queryParams.append('province_id', params.province_id);
      if (params.district_name) queryParams.append('district_name', params.district_name);
      if (params.q) queryParams.append('q', params.q);

      const url = `/api/districts${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

      logger.info(`[DISTRICT_SERVICE] Fetching districts: ${url}`, 'DISTRICT_SERVICE');

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`[DISTRICT_SERVICE] API error ${response.status}: ${errorText}`, 'DISTRICT_SERVICE');
        return {
          success: false,
          error: `HTTP ${response.status}: ${errorText}`,
        };
      }

      const result = await response.json();

      if (!result.success) {
        logger.error(`[DISTRICT_SERVICE] API returned error: ${result.error}`, 'DISTRICT_SERVICE');
        return {
          success: false,
          error: result.error || 'Failed to fetch districts',
        };
      }

      // Normalize and deduplicate data (handle both 'data' and 'results' response formats)
      const rawData = result.data || result.results || [];
      const normalizedData = normalizeDistrictData(rawData);
      const totalStudents = normalizedData.reduce((sum, d) => sum + (d.total_count || 0), 0);

      const responseData: DistrictServiceResponse = {
        success: true,
        data: normalizedData,
        count: normalizedData.length,
        total_students: result.total_students || totalStudents,
      };

      // Only cache non-empty results to allow fallback to retry
      // Don't cache empty results when province_id is provided (fallback should try Schools API)
      if (normalizedData.length > 0 || !params.province_id) {
        dataCache.set(cacheKey, responseData, CACHE_TTL);
        logger.info(`[DISTRICT_SERVICE] Cached ${normalizedData.length} districts`, 'DISTRICT_SERVICE');
      } else {
        logger.warn(`[DISTRICT_SERVICE] Not caching empty result for province_id=${params.province_id} - fallback may be needed`, 'DISTRICT_SERVICE');
      }

      return responseData;
    } catch (error: any) {
      logger.error(`[DISTRICT_SERVICE] Error: ${error.message}`, 'DISTRICT_SERVICE', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch districts',
      };
    }
  },
};

