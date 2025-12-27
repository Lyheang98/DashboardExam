/**
 * API Types
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  token?: string;
  timeout?: number;
  retries?: number;
  signal?: AbortSignal;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  count: number;
  results: T[];
  next?: string | null;
  previous?: string | null;
}

