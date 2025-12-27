/**
 * API Configuration
 * All API endpoints are configured here using environment variables
 */

const getEnv = (key: string, defaultValue: string): string => {
  return process.env[key] || defaultValue;
};

const getEnvNumber = (key: string, defaultValue: number): number => {
  const value = process.env[key];
  return value ? parseInt(value, 10) : defaultValue;
};

const EXTERNAL_API_BASE = getEnv('EXTERNAL_API_BASE_URL', 'https://moeys-exam-qbfys.ondigitalocean.app');
const INTERNAL_API_BASE = getEnv('NEXT_PUBLIC_API_URL', '/api');

export const API_CONFIG = {
  EXTERNAL_API_BASE,
  INTERNAL_API_BASE,
  TIMEOUT: getEnvNumber('API_TIMEOUT', 30000),
  MAX_RETRIES: getEnvNumber('API_MAX_RETRIES', 3),
  RETRY_DELAY: getEnvNumber('API_RETRY_DELAY', 1000),
} as const;

export const EXTERNAL_ENDPOINTS = {
  AUTH: {
    TOKEN: getEnv('EXTERNAL_API_AUTH_URL', `${EXTERNAL_API_BASE}/api/token/`),
    REFRESH: `${EXTERNAL_API_BASE}/api/token/refresh/`,
    VERIFY: `${EXTERNAL_API_BASE}/api/token/verify/`,
  },
  USERS: {
    BASE: getEnv('EXTERNAL_API_USERS_URL', `${EXTERNAL_API_BASE}/api/users/`),
    LIST: getEnv('EXTERNAL_API_USERS_URL', `${EXTERNAL_API_BASE}/api/users/`),
    SEARCH: `${EXTERNAL_API_BASE}/api/users/search/`,
    DETAIL: (id: string | number) => `${EXTERNAL_API_BASE}/api/users/${id}/`,
    UPDATE: (id: string | number) => `${EXTERNAL_API_BASE}/api/users/${id}/`,
    DELETE: (id: string | number) => `${EXTERNAL_API_BASE}/api/users/${id}/`,
  },
  PRODUCTS: {
    BASE: getEnv('EXTERNAL_API_PRODUCTS_URL', `${EXTERNAL_API_BASE}/api/products/`),
    LIST: getEnv('EXTERNAL_API_PRODUCTS_URL', `${EXTERNAL_API_BASE}/api/products/`),
    SEARCH: `${EXTERNAL_API_BASE}/api/products/search/`,
    DETAIL: (id: string | number) => `${EXTERNAL_API_BASE}/api/products/${id}/`,
    UPDATE: (id: string | number) => `${EXTERNAL_API_BASE}/api/products/${id}/`,
    DELETE: (id: string | number) => `${EXTERNAL_API_BASE}/api/products/${id}/`,
  },
  PROVINCES: {
    BASE: getEnv('EXTERNAL_API_PROVINCES_URL', `${EXTERNAL_API_BASE}/api/Base/data/v1/api/lookup/v1/province/`),
    LIST: getEnv('EXTERNAL_API_PROVINCES_URL', `${EXTERNAL_API_BASE}/api/Base/data/v1/api/lookup/v1/province/`),
  },
  DISTRICTS: {
    BASE: getEnv('EXTERNAL_API_DISTRICTS_URL', `${EXTERNAL_API_BASE}/api/Base/data/v1/api/lookup/v1/district/`),
    LIST: getEnv('EXTERNAL_API_DISTRICTS_URL', `${EXTERNAL_API_BASE}/api/Base/data/v1/api/lookup/v1/district/`),
    // Lookup endpoint requires province_id as path parameter
    LOOKUP: (province_id: string) => `${EXTERNAL_API_BASE}/api/Base/data/v1/api/lookup/v1/district/${province_id}/`,
  },
  SCHOOLS_LOOKUP: {
    // Lookup endpoint requires province_id and district_name as path parameters
    LIST: (province_id: string, district_name: string) => `${EXTERNAL_API_BASE}/api/Base/data/v1/api/lookup/v1/school/${province_id}/${encodeURIComponent(district_name)}/`,
  },
  SCHOOLS: {
    BASE: getEnv('EXTERNAL_API_SCHOOLS_URL', `${EXTERNAL_API_BASE}/api/Base/data/v1/schools/`),
    LIST: getEnv('EXTERNAL_API_SCHOOLS_URL', `${EXTERNAL_API_BASE}/api/Base/data/v1/schools/`),
    DETAIL: (id: string | number) => `${EXTERNAL_API_BASE}/api/Base/data/v1/schools/${id}/`,
  },
  STUDENTS: {
    BASE: getEnv('EXTERNAL_API_STUDENTS_URL', `${EXTERNAL_API_BASE}/api/Base/data/v1/students/`),
    LIST: getEnv('EXTERNAL_API_STUDENTS_URL', `${EXTERNAL_API_BASE}/api/Base/data/v1/students/`),
    DETAIL: (id: string | number) => `${EXTERNAL_API_BASE}/api/Base/data/v1/students/${id}/`,
  },
} as const;

export const INTERNAL_ENDPOINTS = {
  AUTH: {
    LOGIN: `${INTERNAL_API_BASE}/auth`,
    REGISTER: `${INTERNAL_API_BASE}/auth/register`,
    LOGOUT: `${INTERNAL_API_BASE}/auth/logout`,
  },
  USERS: {
    BASE: `${INTERNAL_API_BASE}/users`,
    SEARCH: `${INTERNAL_API_BASE}/users/search`,
    DETAIL: (id: string | number) => `${INTERNAL_API_BASE}/users/${id}`,
    CREATE: `${INTERNAL_API_BASE}/users`,
    UPDATE: (id: string | number) => `${INTERNAL_API_BASE}/users/${id}`,
    DELETE: (id: string | number) => `${INTERNAL_API_BASE}/users/${id}`,
  },
  PRODUCTS: {
    BASE: `${INTERNAL_API_BASE}/products`,
    SEARCH: `${INTERNAL_API_BASE}/products/search`,
    DETAIL: (id: string | number) => `${INTERNAL_API_BASE}/products/${id}`,
    CREATE: `${INTERNAL_API_BASE}/products`,
    UPDATE: (id: string | number) => `${INTERNAL_API_BASE}/products/${id}`,
    DELETE: (id: string | number) => `${INTERNAL_API_BASE}/products/${id}`,
  },
  SCHOOLS: {
    BASE: `${INTERNAL_API_BASE}/schools`,
    LIST: `${INTERNAL_API_BASE}/schools`,
    DETAIL: (id: string | number) => `${INTERNAL_API_BASE}/schools/${id}`,
  },
} as const;

