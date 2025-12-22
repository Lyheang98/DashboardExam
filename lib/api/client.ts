/**
 * API Client - Handles all HTTP requests with retry logic and error handling
 */

import { API_CONFIG } from './config';
import { logger } from '../logger';
import type { ApiResponse, RequestOptions } from './types';

export type { ApiResponse, RequestOptions } from './types';

async function fetchWithRetry(
  url: string,
  options: RequestOptions = {},
  retries: number = API_CONFIG.MAX_RETRIES
): Promise<Response> {
  const { timeout = API_CONFIG.TIMEOUT, ...fetchOptions } = options;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const response = await fetch(url, { ...fetchOptions, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    // Don't retry on timeout/abort errors
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms. The server is taking too long to respond.`);
    }
    
    // Retry on network errors (but not timeouts)
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

