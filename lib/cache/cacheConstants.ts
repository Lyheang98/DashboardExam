/**
 * Cache TTL Constants
 * Centralized cache time-to-live values for all API routes
 * Each constant is defined only once to prevent duplicate declaration errors
 */

// District cache: 24 hours - districts rarely change
export const DISTRICT_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Province cache: 15 minutes for API responses, 7 days for fallback markers
export const PROVINCE_API_CACHE_TTL = 15 * 60 * 1000; // 15 minutes
export const PROVINCE_FALLBACK_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

// School cache: 10 minutes (can be adjusted per endpoint)
export const SCHOOL_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// User cache: 5 minutes
export const USER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Student cache: 5 minutes
export const STUDENT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Default cache: 10 minutes
export const DEFAULT_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

