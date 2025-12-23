/**
 * Rate Limiter Utility
 * Prevents too many API calls in a short time
 */

interface RateLimitConfig {
  maxRequests: number; // Maximum requests allowed
  windowMs: number; // Time window in milliseconds
}

class RateLimiter {
  private requests: number[] = [];
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /**
   * Check if a request is allowed
   * Returns true if allowed, false if rate limited
   */
  isAllowed(): boolean {
    const now = Date.now();
    
    // Remove requests outside the time window
    this.requests = this.requests.filter(
      (timestamp) => now - timestamp < this.config.windowMs
    );

    // Check if we've exceeded the limit
    if (this.requests.length >= this.config.maxRequests) {
      return false;
    }

    // Record this request
    this.requests.push(now);
    return true;
  }

  /**
   * Get time until next request is allowed (in ms)
   */
  getTimeUntilNext(): number {
    if (this.isAllowed()) {
      return 0;
    }

    const oldestRequest = this.requests[0];
    const windowEnd = oldestRequest + this.config.windowMs;
    return Math.max(0, windowEnd - Date.now());
  }
}

// Global rate limiter instance (10 requests per second)
export const apiRateLimiter = new RateLimiter({
  maxRequests: 10,
  windowMs: 1000,
});

/**
 * Wait until rate limit allows a request
 */
export async function waitForRateLimit(): Promise<void> {
  const waitTime = apiRateLimiter.getTimeUntilNext();
  if (waitTime > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }
}

