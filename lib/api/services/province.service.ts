/**
 * Province Service
 * Handles all province-related data operations
 * Provides caching, deduplication, and normalized data
 */

import { getToken } from '../../auth';
import { logger } from '../../logger';
import { dataCache } from '../../cache/dataCache';

export interface ProvinceData {
  province_id: string;
  province_name: string;
  total_count: number;
}

export interface ProvinceServiceResponse {
  success: boolean;
  data?: ProvinceData[];
  total_students?: number;
  count?: number;
  error?: string;
}

export interface ProvinceServiceParams {
  limit?: number;
  offset?: number;
  province_id?: string;
  province_name?: string;
}

const CACHE_KEY_PREFIX = 'province_service_';
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * Generate cache key from parameters
 */
function getCacheKey(params: ProvinceServiceParams): string {
  const key = `limit_${params.limit || 1000}_offset_${params.offset || 0}_pid_${params.province_id || 'all'}_pname_${params.province_name || 'all'}`;
  return `${CACHE_KEY_PREFIX}${key}`;
}

/**
 * Normalize province data to ensure consistent format
 */
function normalizeProvinceData(data: any[]): ProvinceData[] {
  if (!Array.isArray(data)) {
    return [];
  }

  // Deduplicate by province_id
  const provinceMap = new Map<string, ProvinceData>();

  for (const item of data) {
    const provinceId = (item.province_id || item.id || item.province_ID || '').toString().trim();
    const provinceName = (item.province_name || item.name || item.province_Name || '').toString().trim();
    const totalCount = typeof item.total_count === 'number' ? item.total_count : 
                      (typeof item.student_count === 'number' ? item.student_count :
                      (typeof item.count === 'number' ? item.count : 0));

    if (!provinceId || !provinceName) {
      continue; // Skip invalid records
    }

    // Use existing record if available, or create new one
    if (provinceMap.has(provinceId)) {
      const existing = provinceMap.get(provinceId)!;
      // Merge counts if duplicate
      existing.total_count += totalCount;
    } else {
      provinceMap.set(provinceId, {
        province_id: provinceId,
        province_name: provinceName,
        total_count: totalCount,
      });
    }
  }

  return Array.from(provinceMap.values());
}

export const provinceService = {
  /**
   * Get all provinces with aggregated student counts
   */
  async getAll(params: ProvinceServiceParams = {}): Promise<ProvinceServiceResponse> {
    try {
      const token = getToken();
      if (!token) {
        return {
          success: false,
          error: 'Authentication required',
        };
      }

      // Check cache first
      const cacheKey = getCacheKey(params);
      const cached = dataCache.get<ProvinceServiceResponse>(cacheKey);
      if (cached && cached.success && cached.data) {
        logger.info(`[PROVINCE_SERVICE] Cache hit for key: ${cacheKey}`, 'PROVINCE_SERVICE');
        return cached;
      }

      // Build API URL
      const queryParams = new URLSearchParams();
      if (params.limit) queryParams.append('limit', params.limit.toString());
      if (params.offset) queryParams.append('offset', params.offset.toString());
      if (params.province_id) queryParams.append('province_id', params.province_id);
      if (params.province_name) queryParams.append('province_name', params.province_name);

      const url = `/api/provinces${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

      logger.info(`[PROVINCE_SERVICE] Fetching provinces: ${url}`, 'PROVINCE_SERVICE');

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`[PROVINCE_SERVICE] API error ${response.status}: ${errorText}`, 'PROVINCE_SERVICE');
        return {
          success: false,
          error: `HTTP ${response.status}: ${errorText}`,
        };
      }

      const result = await response.json();

      if (!result.success) {
        logger.error(`[PROVINCE_SERVICE] API returned error: ${result.error}`, 'PROVINCE_SERVICE');
        return {
          success: false,
          error: result.error || 'Failed to fetch provinces',
        };
      }

      // Normalize and deduplicate data
      const normalizedData = normalizeProvinceData(result.data || []);
      const totalStudents = normalizedData.reduce((sum, p) => sum + (p.total_count || 0), 0);

      const responseData: ProvinceServiceResponse = {
        success: true,
        data: normalizedData,
        count: normalizedData.length,
        total_students: result.total_students || totalStudents,
      };

      // Cache the result
      dataCache.set(cacheKey, responseData, CACHE_TTL);
      logger.info(`[PROVINCE_SERVICE] Cached ${normalizedData.length} provinces`, 'PROVINCE_SERVICE');

      return responseData;
    } catch (error: any) {
      logger.error(`[PROVINCE_SERVICE] Error: ${error.message}`, 'PROVINCE_SERVICE', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch provinces',
      };
    }
  },
};

