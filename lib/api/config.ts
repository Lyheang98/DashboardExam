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
    // REMOVED: BASE and LIST are unsafe - never expose flat /students/ endpoint
    // Only hierarchical endpoints are allowed for safety
    DETAIL: (id: string | number) => `${EXTERNAL_API_BASE}/api/Base/data/v1/students/${id}/`,
    // Fast ID search - highest priority, ignores other filters
    BY_EXAM_CODE: (examCode: string) => `${EXTERNAL_API_BASE}/api/Base/data/v1/student/by-exam-code/${encodeURIComponent(examCode)}/`,
    // Hierarchical endpoint builders - enforce safe usage by design
    BY_DISTRICT: (provinceId: string, districtName: string) => 
      `${EXTERNAL_API_BASE}/api/Base/data/v1/students/${encodeURIComponent(provinceId)}/districts/${encodeURIComponent(districtName)}/`,
    BY_SCHOOL: (provinceId: string, districtName: string, schoolName: string) => 
      `${EXTERNAL_API_BASE}/api/Base/data/v1/students/${encodeURIComponent(provinceId)}/districts/${encodeURIComponent(districtName)}/schools/${encodeURIComponent(schoolName)}/`,
    BY_GRADE: (provinceId: string, districtName: string, schoolName: string, grade: string) => 
      `${EXTERNAL_API_BASE}/api/Base/data/v1/students/${encodeURIComponent(provinceId)}/districts/${encodeURIComponent(districtName)}/schools/${encodeURIComponent(schoolName)}/grades/${encodeURIComponent(grade)}/`,
    BY_ROOM: (provinceId: string, districtName: string, schoolName: string, grade: string, room: string) => 
      `${EXTERNAL_API_BASE}/api/Base/data/v1/students/${encodeURIComponent(provinceId)}/districts/${encodeURIComponent(districtName)}/schools/${encodeURIComponent(schoolName)}/grades/${encodeURIComponent(grade)}/rooms/${encodeURIComponent(room)}/`,
  },
  RESULT_SUBJECTS: {
    // Base endpoint
    BASE: `${EXTERNAL_API_BASE}/api/v1/result/result-Subjects/`,
    // Hierarchical endpoints - enforce safe usage by design
    BY_PROVINCE: (provinceName: string) => 
      `${EXTERNAL_API_BASE}/api/v1/result/result-Subjects/${encodeURIComponent(provinceName)}/`,
    BY_DISTRICT: (provinceName: string, districtName: string) => 
      `${EXTERNAL_API_BASE}/api/v1/result/result-Subjects/${encodeURIComponent(provinceName)}/districts/${encodeURIComponent(districtName)}/`,
    BY_SCHOOL: (provinceName: string, districtName: string, geipSchoolId: string) => 
      `${EXTERNAL_API_BASE}/api/v1/result/result-Subjects/${encodeURIComponent(provinceName)}/districts/${encodeURIComponent(districtName)}/schools/${encodeURIComponent(geipSchoolId)}/`,
    BY_GRADE: (provinceName: string, districtName: string, geipSchoolId: string, gradeName: string) => 
      `${EXTERNAL_API_BASE}/api/v1/result/result-Subjects/${encodeURIComponent(provinceName)}/districts/${encodeURIComponent(districtName)}/schools/${encodeURIComponent(geipSchoolId)}/grades/${encodeURIComponent(gradeName)}/`,
    BY_ROOM: (provinceName: string, districtName: string, geipSchoolId: string, gradeName: string, room: string) => 
      `${EXTERNAL_API_BASE}/api/v1/result/result-Subjects/${encodeURIComponent(provinceName)}/districts/${encodeURIComponent(districtName)}/schools/${encodeURIComponent(geipSchoolId)}/grades/${encodeURIComponent(gradeName)}/rooms/${encodeURIComponent(room)}/`,
    // Monthly/Yearly aggregation endpoints
    BY_MONTH_YEAR: (provinceId: string, month: number, year: number) => 
      `${EXTERNAL_API_BASE}/api/v1/result/result-Subjects-byMonth-Year/${encodeURIComponent(provinceId)}/${month}/${year}/`,
    BY_MONTH_YEAR_DISTRICT: (provinceId: string, month: number, year: number, districtName: string) => 
      `${EXTERNAL_API_BASE}/api/v1/result/result-Subjects-byMonth-Year/${encodeURIComponent(provinceId)}/${month}/${year}/districts/${encodeURIComponent(districtName)}/`,
    BY_MONTH_YEAR_SCHOOL: (provinceId: string, month: number, year: number, districtName: string, geipSchoolId: string) => 
      `${EXTERNAL_API_BASE}/api/v1/result/result-Subjects-byMonth-Year/${encodeURIComponent(provinceId)}/${month}/${year}/districts/${encodeURIComponent(districtName)}/schools/${encodeURIComponent(geipSchoolId)}/`,
    BY_MONTH_YEAR_GRADE: (provinceId: string, month: number, year: number, districtName: string, geipSchoolId: string, gradeName: string) => 
      `${EXTERNAL_API_BASE}/api/v1/result/result-Subjects-byMonth-Year/${encodeURIComponent(provinceId)}/${month}/${year}/districts/${encodeURIComponent(districtName)}/schools/${encodeURIComponent(geipSchoolId)}/grades/${encodeURIComponent(gradeName)}/`,
    BY_MONTH_YEAR_ROOM: (provinceId: string, month: number, year: number, districtName: string, geipSchoolId: string, gradeName: string, room: string) => 
      `${EXTERNAL_API_BASE}/api/v1/result/result-Subjects-byMonth-Year/${encodeURIComponent(provinceId)}/${month}/${year}/districts/${encodeURIComponent(districtName)}/schools/${encodeURIComponent(geipSchoolId)}/grades/${encodeURIComponent(gradeName)}/rooms/${encodeURIComponent(room)}/`,
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
  SCHOOLS: {
    BASE: `${INTERNAL_API_BASE}/schools`,
    LIST: `${INTERNAL_API_BASE}/schools`,
    DETAIL: (id: string | number) => `${INTERNAL_API_BASE}/schools/${id}`,
  },
} as const;

