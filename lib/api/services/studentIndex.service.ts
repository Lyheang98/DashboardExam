/**
 * Student Index Service
 * 
 * Purpose: Handle student list & filter page operations
 * - Fetch student list with filters (province, district, school, grade, class, student type)
 * - Handle pagination (limit, offset)
 * - Provide caching for performance
 * - Build lightweight summaries for dropdowns
 * 
 * Responsibilities:
 * - Fetch student list from API (via studentDetailService)
 * - Handle all filtering and pagination
 * - Cache results for performance
 * - Build district and school summaries from fetched data
 */

import { logger } from '../../logger';
import { dataCache } from '../../cache/dataCache';

/**
 * DEPRECATED: Old interface for student list params
 * This service is deprecated - use students.service.ts instead
 */
interface StudentIndexListParams {
  province_id?: string;
  district_name?: string;
  school_name?: string;
  geip_school_ID?: string;
  grade?: string;
  room?: string;
  student_type?: string;
  limit?: number;
  offset?: number;
}

export interface DistrictSummary {
  province_id: string;
  district_name: string;
  total_count: number;
}

export interface SchoolSummary {
  province_id: string;
  district_name: string;
  school_name: string;
  total_count: number;
}

/**
 * Extract province, district, and school data from API record
 * Handles various field name variations and nested structures
 */
function extractLocationData(record: any): {
  provinceId: string;
  provinceName: string;
  districtName: string;
  schoolName: string;
} | null {
  if (!record || typeof record !== 'object') {
    return null;
  }
  
  // Try direct field access with various naming conventions
  let provinceId = 
    record.province_ID || 
    record.province_id || 
    record.Province_ID || 
    record.Province_id ||
    record.provinceId ||
    record.ProvinceId ||
    record.PROVINCE_ID ||
    record['province_ID'] ||
    record['province_id'] ||
    record['Province_ID'] ||
    record.province_code ||
    record.Province_Code ||
    record.provinceCode ||
    '';
    
  let provinceName = 
    record.province_name || 
    record.province_Name || 
    record.Province_name || 
    record.Province_Name ||
    record.provinceName ||
    record.ProvinceName ||
    record.PROVINCE_NAME ||
    record['province_name'] ||
    record['province_Name'] ||
    record['Province_name'] ||
    '';
  
  let districtName = 
    record.district_name ||
    record.district_Name ||
    record.District_name ||
    record.District_Name ||
    record.districtName ||
    record.DistrictName ||
    record.DISTRICT_NAME ||
    record['district_name'] ||
    record['district_Name'] ||
    '';
  
  let schoolName = 
    record.school_name ||
    record.school_Name ||
    record.School_name ||
    record.School_Name ||
    record.schoolName ||
    record.SchoolName ||
    record.SCHOOL_NAME ||
    record['school_name'] ||
    record['school_Name'] ||
    '';
  
  // Try nested structures
  if (record.province && typeof record.province === 'object') {
    const province = record.province;
    provinceId = provinceId || province.id || province.province_id || province.province_ID || province.code || '';
    provinceName = provinceName || province.name || province.province_name || province.province_Name || '';
  }
  
  if (record.district && typeof record.district === 'object') {
    const district = record.district;
    districtName = districtName || district.name || district.district_name || district.district_Name || '';
  }
  
  if (record.school && typeof record.school === 'object') {
    const school = record.school;
    schoolName = schoolName || school.name || school.school_name || school.school_Name || '';
    if (school.district && typeof school.district === 'object') {
      const district = school.district;
      districtName = districtName || district.name || district.district_name || '';
    }
    if (school.province && typeof school.province === 'object') {
      const province = school.province;
      provinceId = provinceId || province.id || province.province_id || province.code || '';
      provinceName = provinceName || province.name || province.province_name || '';
    }
  }
  
  if (record.location && typeof record.location === 'object') {
    const location = record.location;
    provinceId = provinceId || location.province_id || location.province_ID || location.provinceId || '';
    provinceName = provinceName || location.province_name || location.province_Name || location.provinceName || '';
    districtName = districtName || location.district_name || location.district_Name || location.districtName || '';
    schoolName = schoolName || location.school_name || location.school_Name || location.schoolName || '';
  }
  
  // Convert to string and trim
  provinceId = provinceId ? String(provinceId).trim() : '';
  provinceName = provinceName ? String(provinceName).trim() : '';
  districtName = districtName ? String(districtName).trim() : '';
  schoolName = schoolName ? String(schoolName).trim() : '';
  
  // Require at least province_id and province_name
  if (!provinceId || !provinceName) {
    return null;
  }
  
  return { provinceId, provinceName, districtName, schoolName };
}

/**
 * Build index from base student data
 * This processes raw student records and creates lightweight summaries
 * Raw records are discarded after aggregation
 */
function buildIndex(records: any[]): {
  districts: Map<string, DistrictSummary>;
  schools: Map<string, SchoolSummary>;
} {
  const districtMap = new Map<string, DistrictSummary>();
  const schoolMap = new Map<string, SchoolSummary>();
  
  for (const record of records) {
    const locationData = extractLocationData(record);
    
    if (!locationData) {
      continue;
    }
    
    const { provinceId, provinceName, districtName, schoolName } = locationData;
    
    // Build district summary (if district exists)
    if (districtName) {
      const districtKey = `${provinceId}_${districtName}`;
      if (!districtMap.has(districtKey)) {
        districtMap.set(districtKey, {
          province_id: provinceId,
          district_name: districtName,
          total_count: 0,
        });
      }
      districtMap.get(districtKey)!.total_count += 1;
    }
    
    // Build school summary (if school exists)
    if (districtName && schoolName) {
      const schoolKey = `${provinceId}_${districtName}_${schoolName}`;
      if (!schoolMap.has(schoolKey)) {
        schoolMap.set(schoolKey, {
          province_id: provinceId,
          district_name: districtName,
          school_name: schoolName,
          total_count: 0,
        });
      }
      schoolMap.get(schoolKey)!.total_count += 1;
    }
  }
  
  return { districts: districtMap, schools: schoolMap };
}

/**
 * Fetch base student data from cache
 * If not cached, returns empty array (index will be empty until data is available)
 * The Province page or other pages can initialize this by calling initializeIndex()
 */
function getBaseStudentData(): any[] {
  const cacheKey = 'base_student_data:all';
  return dataCache.get<any[]>(cacheKey) || [];
}

/**
 * Get or build district index
 * Uses cached index if available, otherwise builds from base data
 */
function getDistrictIndex(): Map<string, DistrictSummary> {
  const indexCacheKey = 'student_index:districts';
  // Try to get cached as array (Maps can't be serialized)
  const cachedArray = dataCache.get<Array<[string, DistrictSummary]>>(indexCacheKey);
  
  if (cachedArray && cachedArray.length > 0) {
    // Convert array back to Map
    return new Map(cachedArray);
  }
  
  // Build index from base data
  const baseData = getBaseStudentData();
  if (!baseData || baseData.length === 0) {
    return new Map();
  }
  
  const { districts } = buildIndex(baseData);
  
  // Cache the index as array (1 hour TTL) - Maps can't be serialized
  const districtsArray = Array.from(districts.entries());
  dataCache.set(indexCacheKey, districtsArray, 60 * 60 * 1000);
  
  return districts;
}

/**
 * Get or build school index
 * Uses cached index if available, otherwise builds from base data
 */
function getSchoolIndex(): Map<string, SchoolSummary> {
  const indexCacheKey = 'student_index:schools';
  // Try to get cached as array (Maps can't be serialized)
  const cachedArray = dataCache.get<Array<[string, SchoolSummary]>>(indexCacheKey);
  
  if (cachedArray && cachedArray.length > 0) {
    // Convert array back to Map
    return new Map(cachedArray);
  }
  
  // Build index from base data
  const baseData = getBaseStudentData();
  if (!baseData || baseData.length === 0) {
    return new Map();
  }
  
  const { schools } = buildIndex(baseData);
  
  // Cache the index as array (1 hour TTL) - Maps can't be serialized
  const schoolsArray = Array.from(schools.entries());
  dataCache.set(indexCacheKey, schoolsArray, 60 * 60 * 1000);
  
  return schools;
}

export interface StudentIndexListResponse {
  success: boolean;
  data?: any[];
  count?: number;
  error?: string;
}

const CACHE_KEY_PREFIX = 'student_index_list_';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes (shorter TTL for student data)

/**
 * Generate cache key from parameters
 * Only caches first page (offset=0) to avoid cache bloat
 * DEPRECATED: This service is deprecated
 */
function getListCacheKey(params: StudentIndexListParams): string {
  // Only cache first page results
  if (params.offset && params.offset > 0) {
    return ''; // Don't cache paginated results
  }
  
  const key = `pid_${params.province_id || 'all'}_dname_${params.district_name || 'all'}_sname_${params.school_name || 'all'}_grade_${params.grade || 'all'}_room_${params.room || 'all'}_type_${params.student_type || 'all'}_limit_${params.limit || 25}`;
  return `${CACHE_KEY_PREFIX}${key}`;
}

export const studentIndexService = {
  /**
   * Get student list with pagination and filters
   * 
   * @deprecated This method is deprecated. Use students.service.ts with hierarchical endpoints instead.
   * 
   * @param token - Authentication token
   * @param params - Filter parameters (province_id, district_name, school_name, grade, room, student_type, limit, offset)
   * @param signal - AbortSignal for request cancellation
   */
  async getList(
    token: string,
    params: StudentIndexListParams,
    signal?: AbortSignal
  ): Promise<StudentIndexListResponse> {
    try {
      // STRICT VALIDATION: Require province_id + district_name
      if (!params.province_id || !params.province_id.trim()) {
        logger.error('[STUDENT_INDEX] Invalid parameters: province_id is required', 'STUDENT_INDEX');
        return {
          success: false,
          error: 'province_id is required',
        };
      }
      if (!params.district_name || !params.district_name.trim()) {
        logger.error('[STUDENT_INDEX] Invalid parameters: district_name is required', 'STUDENT_INDEX');
        return {
          success: false,
          error: 'district_name is required',
        };
      }
      // Require pagination
      if (params.limit === undefined || params.limit < 1) {
        logger.error('[STUDENT_INDEX] Invalid parameters: limit is required and must be >= 1', 'STUDENT_INDEX');
        return {
          success: false,
          error: 'limit is required and must be >= 1',
        };
      }
      if (params.offset === undefined || params.offset < 0) {
        logger.error('[STUDENT_INDEX] Invalid parameters: offset is required and must be >= 0', 'STUDENT_INDEX');
        return {
          success: false,
          error: 'offset is required and must be >= 0',
        };
      }

      // Check cache first (only for first page, not paginated requests)
      const cacheKey = getListCacheKey(params);
      if (cacheKey) {
        const cached = dataCache.get<StudentIndexListResponse>(cacheKey);
        if (cached && cached.success && cached.data) {
          logger.info(`[STUDENT_INDEX] Cache hit for key: ${cacheKey}`, 'STUDENT_INDEX');
          return cached;
        }
      }

      // DEPRECATED: This service should not be used for list queries
      // Use students.service.ts instead which uses hierarchical endpoints
      // Keeping this for backward compatibility but it will fail
      logger.warn('[STUDENT_INDEX] getList is deprecated. Use students.service.ts with hierarchical endpoints instead.', 'STUDENT_INDEX');
      return {
        success: false,
        error: 'studentIndexService.getList is deprecated. Use students.service.ts with hierarchical endpoints instead.',
        data: [],
        count: 0,
      };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        logger.info('[STUDENT_INDEX] Request cancelled', 'STUDENT_INDEX');
        return {
          success: false,
          error: 'Request cancelled',
        };
      }

      logger.error(`[STUDENT_INDEX] Error: ${error.message}`, 'STUDENT_INDEX', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch students',
      };
    }
  },

  /**
   * Initialize index from base student data
   * Called by Province page after fetching base data
   * This processes and caches the index for use by District/School pages
   */
  initializeIndex(records: any[]): void {
    const cacheKey = 'base_student_data:all';
    
    // Cache base data (1 hour TTL)
    dataCache.set(cacheKey, records, 60 * 60 * 1000);
    
    // Build and cache indexes
    const { districts, schools } = buildIndex(records);
    
    // Convert Maps to arrays for caching (Maps can't be serialized)
    const districtsArray = Array.from(districts.entries());
    const schoolsArray = Array.from(schools.entries());
    
    dataCache.set('student_index:districts', districtsArray, 60 * 60 * 1000);
    dataCache.set('student_index:schools', schoolsArray, 60 * 60 * 1000);
    
    logger.info(`Initialized student index: ${districts.size} districts, ${schools.size} schools`, 'STUDENT_INDEX');
  },
  
  /**
   * Get districts by province_id
   * Returns lightweight summaries only
   * NEVER returns raw student arrays
   */
  getDistrictsByProvince(province_id: string): DistrictSummary[] {
    const districtIndex = getDistrictIndex();
    const districts: DistrictSummary[] = [];
    
    for (const district of districtIndex.values()) {
      if (district.province_id === province_id) {
        districts.push(district);
      }
    }
    
    // Sort by total_count descending
    districts.sort((a, b) => b.total_count - a.total_count);
    
    return districts;
  },
  
  /**
   * Get schools by province_id and district_name
   * Returns lightweight summaries only
   * NEVER returns raw student arrays
   */
  getSchoolsByProvinceAndDistrict(
    province_id: string,
    district_name: string
  ): SchoolSummary[] {
    const schoolIndex = getSchoolIndex();
    const schools: SchoolSummary[] = [];
    
    for (const school of schoolIndex.values()) {
      if (school.province_id === province_id && school.district_name === district_name) {
        schools.push(school);
      }
    }
    
    // Sort by total_count descending
    schools.sort((a, b) => b.total_count - a.total_count);
    
    return schools;
  },
  
  /**
   * Clear all indexes
   * Useful when base data is refreshed
   */
  clearIndex(): void {
    dataCache.delete('base_student_data:all');
    dataCache.delete('student_index:districts');
    dataCache.delete('student_index:schools');
    logger.info('Cleared student index', 'STUDENT_INDEX');
  },
};

