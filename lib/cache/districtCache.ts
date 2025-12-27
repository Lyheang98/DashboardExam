/**
 * District Cache
 * In-memory cache for district data by province_ID
 * Persists across component re-renders but clears on hard refresh
 */

import { logger } from '../logger';

export interface CachedDistrictData {
  province_id: string;
  district_name: string;
  total_count: number;
}

export interface DistrictCacheEntry {
  districts: CachedDistrictData[];
  totalStudents: number;
  isComplete: boolean; // Whether all pages have been fetched
  lastFetched: number; // Timestamp
}

// In-memory cache: province_ID -> cache entry
const districtCache: Map<string, DistrictCacheEntry> = new Map();

/**
 * Get cached districts for a province
 */
export function getCachedDistricts(provinceId: string): DistrictCacheEntry | null {
  const cached = districtCache.get(provinceId);
  if (cached) {
    logger.info(`[DISTRICT_CACHE] Cache HIT for province: ${provinceId} (${cached.districts.length} districts, complete: ${cached.isComplete})`, 'CACHE');
  } else {
    logger.info(`[DISTRICT_CACHE] Cache MISS for province: ${provinceId}`, 'CACHE');
  }
  return cached || null;
}

/**
 * Set cached districts for a province
 */
export function setCachedDistricts(
  provinceId: string,
  districts: CachedDistrictData[],
  totalStudents: number,
  isComplete: boolean = false
): void {
  const existing = districtCache.get(provinceId);
  
  if (existing && !isComplete) {
    // Merge with existing cache (for incremental updates)
    const existingMap = new Map(existing.districts.map(d => [`${d.province_id}:${d.district_name}`, d]));
    
    // Update or add districts
    districts.forEach(district => {
      const key = `${district.province_id}:${district.district_name}`;
      if (existingMap.has(key)) {
        // Update existing
        existingMap.set(key, district);
      } else {
        // Add new
        existingMap.set(key, district);
      }
    });
    
    const mergedDistricts = Array.from(existingMap.values());
    
    districtCache.set(provinceId, {
      districts: mergedDistricts,
      totalStudents: totalStudents || existing.totalStudents,
      isComplete,
      lastFetched: Date.now(),
    });
    
    logger.info(`[DISTRICT_CACHE] Merged cache for province: ${provinceId} (${mergedDistricts.length} districts, complete: ${isComplete})`, 'CACHE');
  } else {
    // Set new cache entry
    districtCache.set(provinceId, {
      districts,
      totalStudents,
      isComplete,
      lastFetched: Date.now(),
    });
    
    logger.info(`[DISTRICT_CACHE] Set cache for province: ${provinceId} (${districts.length} districts, complete: ${isComplete})`, 'CACHE');
  }
}

/**
 * Check if cache exists and is complete for a province
 */
export function isCacheComplete(provinceId: string): boolean {
  const cached = districtCache.get(provinceId);
  return cached?.isComplete || false;
}

/**
 * Clear cache for a specific province
 */
export function clearCache(provinceId: string): void {
  districtCache.delete(provinceId);
  logger.info(`[DISTRICT_CACHE] Cleared cache for province: ${provinceId}`, 'CACHE');
}

/**
 * Clear all cache (for debugging/testing)
 */
export function clearAllCache(): void {
  districtCache.clear();
  logger.info(`[DISTRICT_CACHE] Cleared all cache`, 'CACHE');
}

