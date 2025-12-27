/**
 * API Client - Handles all HTTP requests with retry logic and error handling
 * Includes automatic token refresh on 401 errors
 */

import { API_CONFIG, EXTERNAL_ENDPOINTS } from './config';
import { logger } from '../logger';
import type { ApiResponse, RequestOptions } from './types';

export type { ApiResponse, RequestOptions } from './types';

// Track if we're currently refreshing to prevent multiple refresh attempts
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

async function fetchWithRetry(
  url: string,
  options: RequestOptions = {},
  retries: number = API_CONFIG.MAX_RETRIES
): Promise<Response> {
  const { timeout = API_CONFIG.TIMEOUT, signal: externalSignal, ...fetchOptions } = options;
  
  try {
    // Use external signal if provided, otherwise create one for timeout
    const controller = externalSignal ? null : new AbortController();
    const signal = externalSignal || controller!.signal;
    
    let timeoutId: NodeJS.Timeout | null = null;
    if (!externalSignal && controller) {
      timeoutId = setTimeout(() => controller.abort(), timeout);
    }
    
    const response = await fetch(url, { ...fetchOptions, signal });
    
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    return response;
  } catch (error: any) {
    // Don't retry on timeout/abort errors
    if (error.name === 'AbortError') {
      if (externalSignal && externalSignal.aborted) {
        throw error; // External cancellation
      }
      throw new Error(`Request timeout after ${timeout}ms. The server is taking too long to respond.`);
    }
    
    // Retry on network errors (but not timeouts or external cancellations)
    if (retries > 0 && (error.message?.includes('fetch') || error.message?.includes('network'))) {
      logger.warn(`Retrying... (${retries} left)`, 'API', error);
      await new Promise(resolve => setTimeout(resolve, API_CONFIG.RETRY_DELAY));
      return fetchWithRetry(url, options, retries - 1);
    }
    throw error;
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type');
  const text = await response.text();
  
  if (!text) {
    return {} as T;
  }
  
  if (contentType?.includes('application/json')) {
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as T;
    }
  }
  
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as T;
  }
}

/**
 * Attempt to refresh the access token
 * Returns new token if successful, null if failed
 */
/**
 * Get refresh token from storage (works on both client and server)
 * On server: reads from cookies (requires document.cookie, which is available in some server contexts)
 * On client: reads from sessionStorage first, then falls back to cookies
 */
function getRefreshTokenFromStorage(): string | null {
  if (typeof window !== 'undefined') {
    // Client-side: try sessionStorage first, then cookies
    const sessionToken = sessionStorage.getItem('refresh_token');
    if (sessionToken) return sessionToken;
    
    // Fallback to cookies
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'refresh_token') {
        return decodeURIComponent(value);
      }
    }
    return null;
  } else {
    // Server-side: cannot access cookies directly in this context
    // Token refresh on server-side would need to be handled at the API route level
    return null;
  }
}

/**
 * Store tokens after refresh (works on both client and server)
 */
function storeTokensAfterRefresh(newToken: string, newRefreshToken?: string | null): void {
  if (typeof window !== 'undefined') {
    // Client-side: use sessionStorage
    sessionStorage.setItem('token', newToken);
    if (newRefreshToken) {
      sessionStorage.setItem('refresh_token', newRefreshToken);
    }
  }
  // Server-side: tokens are stored in cookies by the API route
  // This function is called from client-side refresh only
}

async function attemptTokenRefresh(): Promise<string | null> {
  // If already refreshing, wait for existing refresh
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      // Get refresh token from storage
      const refreshToken = getRefreshTokenFromStorage();
      if (!refreshToken) {
        logger.warn('No refresh token available for token refresh', 'API');
        return null;
      }

      logger.info('Attempting to refresh access token', 'API');
      
      // Call refresh endpoint directly (avoid circular dependency with apiClient)
      const formData = new URLSearchParams();
      formData.append('refresh', refreshToken);
      
      const refreshResponse = await fetch(EXTERNAL_ENDPOINTS.AUTH.REFRESH, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      if (!refreshResponse.ok) {
        const errorData = await refreshResponse.json().catch(() => ({}));
        const errorMsg = errorData?.error || errorData?.message || errorData?.detail || 'Token refresh failed';
        logger.error(`Token refresh failed: ${errorMsg}`, 'API');
        return null;
      }

      const refreshData = await refreshResponse.json();
      
      // Extract new token from response
      const newToken = refreshData.token || refreshData.access_token || refreshData.access || refreshData.data?.token;
      
      if (!newToken) {
        logger.error('No token in refresh response', 'API');
        return null;
      }

      // Update stored token (client-side only, server-side uses cookies)
      storeTokensAfterRefresh(newToken, refreshData.refresh_token || refreshData.refresh);

      logger.info('Token refreshed successfully', 'API');
      return newToken;
    } catch (error: any) {
      logger.error('Token refresh exception', 'API', error);
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Check if error indicates token expiration
 */
function isTokenExpiredError(status: number, errorData: any): boolean {
  if (status !== 401) return false;
  
  // Check error code
  const errorCode = (errorData?.code || '').toLowerCase();
  if (errorCode === 'token_not_valid') {
    return true;
  }
  
  // Check error message/detail
  const errorMsg = (errorData?.error || errorData?.message || errorData?.detail || '').toLowerCase();
  if (
    errorMsg.includes('token_not_valid') ||
    errorMsg.includes('token expired') ||
    errorMsg.includes('access token expired') ||
    errorMsg.includes('given token not valid') ||
    errorMsg.includes('authentication credentials') ||
    errorMsg.includes('unauthorized')
  ) {
    return true;
  }
  
  // Check messages array (Django REST Framework format)
  if (Array.isArray(errorData?.messages)) {
    for (const msg of errorData.messages) {
      const msgText = (msg?.message || '').toLowerCase();
      if (msgText.includes('expired') || msgText.includes('invalid')) {
        return true;
      }
    }
  }
  
  return false;
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const { method = 'GET', headers = {}, body, token } = options;

  const requestHeaders: Record<string, string> = {
    'accept': 'application/json',
    'Content-Type': 'application/json',
    ...headers,
  };

  if (token) {
    requestHeaders['Authorization'] = `Bearer ${token}`;
  }

  // If Content-Type is form-urlencoded and body is already a string, don't stringify
  const isFormData = requestHeaders['Content-Type']?.includes('application/x-www-form-urlencoded');
  const bodyString = body 
    ? (isFormData && typeof body === 'string' ? body : JSON.stringify(body))
    : undefined;

  const requestOptions: RequestOptions = {
    method,
    headers: requestHeaders,
    ...(bodyString && { body: bodyString }),
    timeout: options.timeout,
    retries: options.retries,
    signal: options.signal, // Pass signal for request cancellation
  };

  try {
    logger.info(`Making ${method} request to: ${endpoint}`, 'API');
    if (body) {
      logger.info(`Request body: ${JSON.stringify(body).substring(0, 100)}...`, 'API');
    }

    const response = await fetchWithRetry(endpoint, requestOptions);
    const data = await parseResponse<T>(response);

    logger.info(`Response status: ${response.status} ${response.statusText}`, 'API');

    if (!response.ok) {
      // Handle various error response formats (Django REST Framework, etc.)
      const errorData = data as any;
      let errorMsg = 
        errorData?.error || 
        errorData?.message || 
        errorData?.detail || 
        errorData?.non_field_errors?.[0] ||
        (Array.isArray(errorData?.non_field_errors) && errorData.non_field_errors[0]) ||
        errorData?.username?.[0] ||
        errorData?.password?.[0] ||
        (typeof errorData === 'string' ? errorData : null) ||
        response.statusText || 
        'Request failed';
      
      // If error is an object with multiple fields, try to extract a meaningful message
      if (!errorMsg && typeof errorData === 'object') {
        const firstErrorKey = Object.keys(errorData)[0];
        const firstError = errorData[firstErrorKey];
        if (Array.isArray(firstError) && firstError.length > 0) {
          errorMsg = `${firstErrorKey}: ${firstError[0]}`;
        } else if (typeof firstError === 'string') {
          errorMsg = `${firstErrorKey}: ${firstError}`;
        }
      }
      
      // Check if this is a token expiration error (401)
      // IMPORTANT: Check BEFORE logging error to prevent duplicate logs
      const isExpired = isTokenExpiredError(response.status, errorData);
      
      if (isExpired && token) {
        logger.warn(`Token expired for ${endpoint}, attempting refresh`, 'API');
        logger.warn(`Error details: ${JSON.stringify(errorData).substring(0, 200)}`, 'API');
        
        // Attempt to refresh token
        const newToken = await attemptTokenRefresh();
        
        if (newToken) {
          // Retry original request with new token
          logger.info(`Retrying request with refreshed token: ${endpoint}`, 'API');
          
          const retryHeaders = {
            ...requestHeaders,
            'Authorization': `Bearer ${newToken}`,
          };
          
          const retryOptions: RequestOptions = {
            ...requestOptions,
            headers: retryHeaders,
            token: newToken,
          };
          
          const retryResponse = await fetchWithRetry(endpoint, retryOptions);
          const retryData = await parseResponse<T>(retryResponse);
          
          if (retryResponse.ok) {
            logger.info(`Request succeeded after token refresh: ${endpoint}`, 'API');
            return { success: true, data: retryData as T };
          } else {
            // Retry also failed, return error
            logger.error(`Request failed after token refresh: ${endpoint}`, 'API');
            const retryErrorData = retryData as any;
            const retryErrorMsg = retryErrorData?.error || retryErrorData?.message || retryErrorData?.detail || 'Request failed after token refresh';
            return { success: false, error: retryErrorMsg };
          }
        } else {
          // Refresh failed, logout user
          logger.error('Token refresh failed, user must re-login', 'API');
          if (typeof window !== 'undefined') {
            // Clear tokens and redirect to login
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('refresh_token');
            sessionStorage.removeItem('user');
            document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT;';
            
            // Redirect to login page
            window.location.href = '/login?expired=true';
          }
          return { success: false, error: 'Authentication expired. Please login again.' };
        }
      }
      
      // Only log error if NOT a token expiration (we already handled it above)
      if (!isExpired) {
        logger.error(`API failed: ${endpoint}`, 'API', new Error(`Status: ${response.status}, Error: ${errorMsg}`));
        logger.error(`Error response data: ${JSON.stringify(errorData).substring(0, 500)}`, 'API');
      }
      
      logger.error(`API failed: ${endpoint}`, 'API', new Error(`Status: ${response.status}, Error: ${errorMsg}`));
      logger.error(`Error response data: ${JSON.stringify(errorData).substring(0, 500)}`, 'API');
      return { success: false, error: errorMsg || 'Request failed' };
    }

    return { success: true, data: data as T };
  } catch (error: any) {
    const errorMessage = error?.message || 'Network error occurred';
    logger.error(`API error: ${endpoint} - ${errorMessage}`, 'API', error);
    
    // Provide more specific error messages
    if (errorMessage.includes('timeout')) {
      return { success: false, error: 'Request timed out. The server is taking too long to respond.' };
    }
    if (errorMessage.includes('Failed to fetch') || errorMessage.includes('network')) {
      return { success: false, error: 'Unable to connect to the server. Please check your internet connection.' };
    }
    
    return { success: false, error: errorMessage };
  }
}

export const apiClient = {
  get: <T = any>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(endpoint, { ...options, method: 'GET' }),
  post: <T = any>(endpoint: string, body?: any, options?: Omit<RequestOptions, 'method'>) =>
    apiRequest<T>(endpoint, { ...options, method: 'POST', body }),
  put: <T = any>(endpoint: string, body?: any, options?: Omit<RequestOptions, 'method'>) =>
    apiRequest<T>(endpoint, { ...options, method: 'PUT', body }),
  patch: <T = any>(endpoint: string, body?: any, options?: Omit<RequestOptions, 'method'>) =>
    apiRequest<T>(endpoint, { ...options, method: 'PATCH', body }),
  delete: <T = any>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(endpoint, { ...options, method: 'DELETE' }),
};

export { EXTERNAL_ENDPOINTS, INTERNAL_ENDPOINTS } from './config';

