/**
 * Simple in-memory cache for API responses
 * Used to speed up dashboard data loading
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class DataCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private defaultTTL = 10 * 60 * 1000; // 10 minutes default TTL (increased for better caching)

  /**
   * Get cached data if it exists and hasn't expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Store data in cache with optional TTL (time to live in milliseconds)
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const now = Date.now();
    const expiresAt = now + (ttl || this.defaultTTL);

    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt,
    });
  }

  /**
   * Remove a specific cache entry
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Clear expired entries
   */
  clearExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Check if a key exists in cache (and is not expired)
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Clear cache entries matching a pattern (useful for clearing related caches)
   */
  clearPattern(pattern: string): void {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get all cache keys (for debugging)
   */
  getKeys(): string[] {
    return Array.from(this.cache.keys());
  }
}

// Singleton instance
export const dataCache = new DataCache();

// Cache keys
export const CACHE_KEYS = {
  SCHOOLS_COUNT: 'schools:count',
  USERS_LIST: 'users:list',
  SCHOOLS_LIST: (params?: string) => `schools:list:${params || 'default'}`,
  USERS_SEARCH: (params?: string) => `users:search:${params || 'default'}`,
  PROVINCE_SUMMARY: (params?: string) => `province_summary:${params || 'all'}`,
} as const;

