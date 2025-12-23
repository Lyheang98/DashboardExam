/**
 * Data Limits Utility
 * 
 * Prevents performance issues by limiting data processing
 */

export const DATA_LIMITS = {
  // Maximum items to process for statistics calculations
  MAX_STATS_ITEMS: 1000,
  
  // Maximum items to render in a single table/page
  MAX_RENDER_ITEMS: 100,
  
  // Maximum items per API response (adjust based on your needs)
  MAX_API_RESPONSE_ITEMS: 5000,
  
  // Maximum array length for calculations
  MAX_CALCULATION_ITEMS: 10000,
} as const;

/**
 * Limit array to prevent performance issues
 */
export function limitArray<T>(array: T[], maxItems: number = DATA_LIMITS.MAX_RENDER_ITEMS): T[] {
  if (array.length <= maxItems) {
    return array;
  }
  return array.slice(0, maxItems);
}

/**
 * Calculate statistics from limited data sample
 */
export function calculateStatsFromSample<T>(
  data: T[],
  calculator: (sample: T[]) => number,
  maxSample: number = DATA_LIMITS.MAX_STATS_ITEMS
): number {
  const sample = limitArray(data, maxSample);
  return calculator(sample);
}

/**
 * Warn if data size is large (for debugging)
 */
export function warnLargeDataSet(size: number, threshold: number = 1000): void {
  if (size > threshold) {
    console.warn(
      `⚠️ Large dataset detected: ${size} items. Consider using pagination or limiting.`
    );
  }
}

