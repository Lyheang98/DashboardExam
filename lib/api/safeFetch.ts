/**
 * Safe API Fetch Utility
 * 
 * Provides enhanced fetch with:
 * - Request timeouts
 * - Automatic retries
 * - Request cancellation
 * - Error handling
 * - Response size limits
 */

export interface SafeFetchOptions extends RequestInit {
  timeout?: number; // Timeout in milliseconds (default: 10000)
  retries?: number; // Number of retries on failure (default: 1)
  maxResponseSize?: number; // Max response size in bytes (default: 10MB)
  signal?: AbortSignal; // Abort signal for cancellation
}

export class FetchTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FetchTimeoutError";
  }
}

export class FetchSizeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FetchSizeError";
  }
}

/**
 * Safe fetch wrapper with timeout, retries, and size limits
 */
export async function safeFetch(
  url: string,
  options: SafeFetchOptions = {}
): Promise<Response> {
  const {
    timeout = 10000, // 10 seconds default
    retries = 1,
    maxResponseSize = 10 * 1024 * 1024, // 10MB default
    signal: externalSignal,
    ...fetchOptions
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, timeout);

      // Combine signals if external signal exists
      let combinedSignal = controller.signal;
      if (externalSignal) {
        // Create a new controller that aborts when either signal aborts
        const combinedController = new AbortController();
        const onAbort = () => combinedController.abort();
        controller.signal.addEventListener("abort", onAbort);
        externalSignal.addEventListener("abort", onAbort);
        combinedSignal = combinedController.signal;
      }

      const response = await fetch(url, {
        ...fetchOptions,
        signal: combinedSignal,
      });

      clearTimeout(timeoutId);

      // Check response size
      const contentLength = response.headers.get("content-length");
      if (contentLength && parseInt(contentLength, 10) > maxResponseSize) {
        throw new FetchSizeError(
          `Response size (${contentLength} bytes) exceeds limit (${maxResponseSize} bytes)`
        );
      }

      return response;
    } catch (error: any) {
      lastError = error;

      // Don't retry on abort (user cancellation)
      if (error.name === "AbortError" && !error.message?.includes("timeout")) {
        throw error;
      }

      // Don't retry on size errors
      if (error instanceof FetchSizeError) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt < retries) {
        // Exponential backoff: wait 200ms, 400ms, 800ms...
        await new Promise((resolve) =>
          setTimeout(resolve, 200 * Math.pow(2, attempt))
        );
        continue;
      }

      // Handle timeout
      if (error.name === "AbortError") {
        throw new FetchTimeoutError(
          `Request to ${url} timed out after ${timeout}ms`
        );
      }

      throw error;
    }
  }

  throw lastError || new Error("Request failed after retries");
}

/**
 * Fetch with automatic JSON parsing and error handling
 */
export async function safeFetchJSON<T = any>(
  url: string,
  options: SafeFetchOptions = {}
): Promise<T> {
  const response = await safeFetch(url, options);

  if (!response.ok) {
    throw new Error(
      `HTTP error! status: ${response.status} ${response.statusText}`
    );
  }

  try {
    const text = await response.text();
    return JSON.parse(text) as T;
  } catch (error) {
    throw new Error(`Failed to parse JSON response: ${error}`);
  }
}

