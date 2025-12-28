'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLanguage } from '@/lib/i18n/context';
import { Loading } from '@/components/ui/Loading';
import { DataTable, DataTableColumn } from '@/components/dashboard/DataTable';
import { logger } from '@/lib/logger';
import { StudentDetail } from '@/lib/api/services/studentDetail.service';
import { studentsService } from '@/lib/api';
import { EXTERNAL_ENDPOINTS } from '@/lib/api/config';
import { apiClient } from '@/lib/api/client';
import { getToken } from '@/lib/auth';
import { getProvinces } from '@/lib/constants/provinces';

// Constants for dropdown options
const GRADES = ['7', '8', '9', '10', '11', '12']; // Only grades 7-12 (numeric: "7", "8", ..., "12")
// Note: Class (Room) and Student Type options are derived dynamically from API response

/**
 * STUDENTS PAGE - Filtered Query Page (NOT a list page)
 * 
 * STRICT RULES:
 * 1. NEVER fetch all students
 * 2. NEVER auto-fetch on page load
 * 3. ONLY fetch after explicit "Apply Filters" click
 * 4. Server-side pagination only
 * 5. Total students ≈ 530,000+ - must be performant
 * 
 * BEHAVIOR:
 * - Initial: students = [], total = 0, show instruction message
 * - User selects filters (no API calls)
 * - User clicks "Apply Filters" → ONE API call
 * - Pagination changes → new API call with same filters
 */
export default function StudentsPage() {
  const { t, language } = useLanguage();
  
  // ============================================
  // STATE: Filter Inputs (NOT applied yet)
  // ============================================
  const [provinceId, setProvinceId] = useState<string>('');
  const [districtName, setDistrictName] = useState<string>('');
  const [geipSchoolId, setGeipSchoolId] = useState<string>(''); // Store geip_school_ID (NOT school_name)
  const [gradeFilter, setGradeFilter] = useState<string>('');
  const [roomFilter, setRoomFilter] = useState<string>('');
  const [studentTypeFilter, setStudentTypeFilter] = useState<string>('');
  const [nameSearch, setNameSearch] = useState<string>('');

  // ============================================
  // STATE: Applied Filters (snapshot when "Apply Filters" clicked)
  // ============================================
  const [appliedFilters, setAppliedFilters] = useState<{
    provinceId: string;
    districtName: string;
    geipSchoolId: string; // REQUIRED - geip_school_ID (NOT school_name)
    grade: string; // REQUIRED - numeric: "11" (NOT "Grade 11")
    room?: string; // Optional - room letter: "A", "B", "C" (NOT "Class 3")
    studentType?: string;
  } | null>(null);

  // ============================================
  // STATE: Data (only populated after "Apply Filters")
  // ============================================
  const [students, setStudents] = useState<StudentDetail[]>([]);
  const [baseStudents, setBaseStudents] = useState<StudentDetail[]>([]); // Base students for local filtering
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // ============================================
  // REFS: Debounce for name search
  // ============================================
  const nameSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ============================================
  // STATE: Dropdown Options
  // ============================================
  const [provinces, setProvinces] = useState<Array<{ province_id: string; province_name: string }>>([]);
  const [districts, setDistricts] = useState<Array<{ province_id: string; district_name: string }>>([]);
  const [schools, setSchools] = useState<Array<{ province_id: string; district_name: string; school_name: string; geip_school_ID: string }>>([]);
  
  // Dynamic options derived from API response
  const [roomOptions, setRoomOptions] = useState<string[]>([]); // Class/Room options from student data
  const [studentTypeOptions, setStudentTypeOptions] = useState<string[]>([]); // Student Type options from student data

  // ============================================
  // STATE: Loading Flags (for UI messages)
  // ============================================
  const [schoolLoading, setSchoolLoading] = useState(false);
  const [schoolLoaded, setSchoolLoaded] = useState(false); // true when API request completes
  const [studentsLoaded, setStudentsLoaded] = useState(false); // true when students API request completes

  // ============================================
  // STATE: Pagination
  // ============================================
  const [page, setPage] = useState(1);
  const perPage = 25; // Fixed page size = 25

  // ============================================
  // REFS: Request Management
  // ============================================
  const abortControllerRef = useRef<AbortController | null>(null);

  // ============================================
  // LOAD PROVINCES: From constants (no API call)
  // ============================================
  useEffect(() => {
    const provincesData = getProvinces();
    setProvinces(provincesData);
    logger.info(`[STUDENTS] Loaded ${provincesData.length} provinces from constants`, 'STUDENTS');
  }, []);

  // ============================================
  // LOAD DISTRICTS: When province changes (for dropdown only)
  // ============================================
  useEffect(() => {
    if (!provinceId) {
      setDistricts([]);
      setDistrictName('');
      setSchools([]);
      setGeipSchoolId('');
      return;
    }

    const loadDistricts = async () => {
      try {
        const token = getToken();
        if (!token) {
          logger.warn(`[STUDENTS] Cannot load districts: No authentication token`, 'STUDENTS');
          setDistricts([]);
          return;
        }

        // Use MoEYS lookup endpoint directly: /api/Base/data/v1/api/lookup/v1/district/{province_id}/
        const lookupUrl = EXTERNAL_ENDPOINTS.DISTRICTS.LOOKUP(provinceId);
        logger.info(`[STUDENTS] Fetching districts from MoEYS lookup: ${lookupUrl}`, 'STUDENTS');

        const response = await apiClient.get(lookupUrl, { token });

        if (!response.success) {
          logger.error(`[STUDENTS] Failed to fetch districts: ${response.error}`, 'STUDENTS');
          setDistricts([]);
          return;
        }

        // Parse response data
        const data = response.data as any;
        const districtsData = data?.results || data?.data || (Array.isArray(data) ? data : []);

        if (Array.isArray(districtsData) && districtsData.length > 0) {
          // Normalize district data
          const uniqueDistricts = districtsData
            .map((d: any) => ({
              province_id: d.province_id || d.province_ID || provinceId,
              district_name: d.district_name || d.district_Name || d.name || '',
            }))
            .filter((d: any) => d.district_name && d.district_name.trim())
            .sort((a: any, b: any) => a.district_name.localeCompare(b.district_name));
          
          setDistricts(uniqueDistricts);
          logger.info(`[STUDENTS] Loaded ${uniqueDistricts.length} districts from MoEYS lookup for province ${provinceId}`, 'STUDENTS');
        } else {
          // No districts found - show UI message, do NOT fetch students
          logger.info(`[STUDENTS] No districts found for province ${provinceId} from MoEYS lookup - district dropdown will be empty`, 'STUDENTS');
          setDistricts([]);
        }
      } catch (error: any) {
        logger.error(`[STUDENTS] Failed to fetch districts for province ${provinceId}`, 'STUDENTS', error);
        setDistricts([]);
      }
    };

    loadDistricts();
  }, [provinceId]);

  // ============================================
  // RESET DEPENDENT FILTERS: Cascade behavior
  // ============================================
  useEffect(() => {
    if (provinceId) {
      setDistrictName('');
      setGeipSchoolId('');
      setSchools([]);
      // Reset dependent filters
      setGradeFilter('');
      setRoomFilter('');
      setStudents([]);
      setTotalCount(0);
      setAppliedFilters(null);
      // Reset dynamic options
      setRoomOptions([]);
      setStudentTypeOptions([]);
      // Reset loading flags (hide messages during reset)
      setSchoolLoading(false);
      setSchoolLoaded(false);
      setStudentsLoaded(false);
    }
  }, [provinceId]);

  useEffect(() => {
    if (districtName && provinceId) {
      setGeipSchoolId('');
      setSchools([]);
      // Reset dependent filters
      setGradeFilter('');
      setRoomFilter('');
      setStudents([]);
      setTotalCount(0);
      setAppliedFilters(null);
      // Reset dynamic options
      setRoomOptions([]);
      setStudentTypeOptions([]);
      // Reset loading flags (hide messages during reset)
      setSchoolLoading(false);
      setSchoolLoaded(false);
      setStudentsLoaded(false);
    }
  }, [districtName, provinceId]);

  // ============================================
  // LOAD SCHOOLS: When district changes (for dropdown only)
  // ============================================
  useEffect(() => {
    if (!provinceId || !districtName) {
      setSchools([]);
      setGeipSchoolId('');
      return;
    }

    const loadSchools = async () => {
      setSchoolLoading(true);
      setSchoolLoaded(false); // Reset flag - request in progress
      
      try {
        const token = getToken();
        if (!token) {
          logger.warn(`[STUDENTS] Cannot load schools: No authentication token`, 'STUDENTS');
          setSchools([]);
          setSchoolLoading(false);
          setSchoolLoaded(true); // Request completed (failed, but completed)
          return;
        }

        // Use MoEYS lookup endpoint directly: /api/Base/data/v1/api/lookup/v1/school/{province_id}/{district_name}/
        const lookupUrl = EXTERNAL_ENDPOINTS.SCHOOLS_LOOKUP.LIST(provinceId, districtName);
        logger.info(`[STUDENTS] Fetching schools from MoEYS lookup: ${lookupUrl}`, 'STUDENTS');

        const response = await apiClient.get(lookupUrl, { token });

        if (!response.success) {
          logger.error(`[STUDENTS] Failed to fetch schools: ${response.error}`, 'STUDENTS');
          setSchools([]);
          setSchoolLoading(false);
          setSchoolLoaded(true); // Request completed (failed, but completed)
          return;
        }

        // Parse response data
        const data = response.data as any;
        const schoolsData = data?.results || data?.data || (Array.isArray(data) ? data : []);

        if (Array.isArray(schoolsData) && schoolsData.length > 0) {
          // Log first school to debug structure
          logger.info(`[STUDENTS] First school data structure: ${JSON.stringify(schoolsData[0])}`, 'STUDENTS');
          
          // Normalize school data from MoEYS API
          // Note: MoEYS lookup API may not include geip_school_ID
          // The student API endpoint accepts either geip_school_ID OR school_name in the path
          const uniqueSchools = schoolsData
            .map((s: any) => {
              const schoolName = (s.school_name || s.school_Name || s.name || '').toString().trim();
              
              // Try multiple possible field names for geip_school_ID
              let geipSchoolId = (s.geip_school_ID || s.geip_school_id || 
                                  s.school_id || s.school_ID || s.id || s.pk || '').toString().trim();
              
              // If geip_school_ID is missing, use school_name as fallback
              // The API endpoint accepts school_name in the path, so this is valid
              if (!geipSchoolId && schoolName) {
                logger.info(`[STUDENTS] School "${schoolName}" missing geip_school_ID, using school_name as identifier`, 'STUDENTS');
                geipSchoolId = schoolName;
              }
              
              return {
                province_id: s.province_id || s.province_ID || provinceId,
                district_name: s.district_name || s.district_Name || districtName,
                school_name: schoolName,
                geip_school_ID: geipSchoolId, // Will be school_name if geip_school_ID not available
              };
            })
            .filter((s: any) => {
              // Only require school_name - this is the minimum required field
              const hasName = s.school_name && s.school_name.trim();
              if (!hasName) {
                logger.warn(`[STUDENTS] Filtered out school: missing school_name`, 'STUDENTS');
                return false;
              }
              
              // geip_school_ID should always be set (either from API or fallback to school_name)
              if (!s.geip_school_ID || !s.geip_school_ID.trim()) {
                logger.warn(`[STUDENTS] School "${s.school_name}" has no identifier - this should not happen`, 'STUDENTS');
                return false;
              }
              
              return true;
            })
            .sort((a: any, b: any) => a.school_name.localeCompare(b.school_name));
          
          setSchools(uniqueSchools);
          logger.info(`[STUDENTS] Loaded ${uniqueSchools.length} schools (from ${schoolsData.length} raw) for district ${districtName} from MoEYS lookup`, 'STUDENTS');
        } else {
          // No schools found - API request completed with empty result
          logger.info(`[STUDENTS] No schools found for district ${districtName} from MoEYS lookup - school dropdown will be empty`, 'STUDENTS');
          setSchools([]);
        }
        
        // Mark as loaded (request completed)
        setSchoolLoading(false);
        setSchoolLoaded(true);
      } catch (error: any) {
        logger.error(`[STUDENTS] Failed to fetch schools for district ${districtName}`, 'STUDENTS', error);
        setSchools([]);
        setSchoolLoading(false);
        setSchoolLoaded(true); // Request completed (with error, but completed)
      }
    };

    loadSchools();
  }, [provinceId, districtName]);

  // ============================================
  // FILTER CASCADE: School change resets Grade, Class, Students
  // ============================================
  useEffect(() => {
    if (geipSchoolId) {
      // School changed - reset Grade, Class, Students
      // DO NOT fetch - user must click "Apply Filters"
      setGradeFilter('');
      setRoomFilter('');
      setStudents([]);
      setTotalCount(0);
      setAppliedFilters(null);
      // Reset dynamic options
      setRoomOptions([]);
      setStudentTypeOptions([]);
      // Reset loading flags (hide messages during reset)
      setStudentsLoaded(false);
      const selectedSchool = schools.find(s => s.geip_school_ID === geipSchoolId);
      logger.info(`[STUDENTS] School changed to "${selectedSchool?.school_name || geipSchoolId}" (ID: ${geipSchoolId}) - reset Grade, Class, Students (no fetch)`, 'STUDENTS');
    }
  }, [geipSchoolId, schools]);

  // ============================================
  // FETCH ROOM OPTIONS: When Grade changes (for dropdown only)
  // ============================================
  const fetchRoomOptions = useCallback(async () => {
    // STRICT: Only fetch if all required filters are present
    if (!provinceId || !districtName || !geipSchoolId || !gradeFilter) {
      setRoomOptions([]);
      return;
    }

    // Cancel previous room options fetch
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setRoomOptions([]); // Clear existing options

    try {
      const token = getToken();
      if (!token) {
        logger.warn('[STUDENTS] Cannot fetch room options: No authentication token', 'STUDENTS');
        return;
      }

      // Fetch students using BY_GRADE endpoint to get room options
      // Use a reasonable page size to get all rooms (e.g., 100 students should cover most cases)
      logger.info(`[STUDENTS] Fetching room options for Grade ${gradeFilter} using BY_GRADE endpoint`, 'STUDENTS');
      
      const result = await studentsService.getList(
        token,
        {
          provinceId: provinceId.trim(),
          districtId: districtName.trim(), // districtId maps to district_name
          schoolId: geipSchoolId.trim(), // Use geip_school_id (not school name)
          grade: gradeFilter.trim(),
          page: 1,
          size: 100, // Fetch enough to get all unique rooms
        },
        abortController.signal
      );

      if (abortController.signal.aborted) {
        return;
      }

      if (!result.success || !result.data) {
        // Not an error - room data is optional and may not exist
        logger.info(`[STUDENTS] No room data available for Grade ${gradeFilter} - Room dropdown will be empty`, 'STUDENTS');
        setRoomOptions([]);
        return;
      }

      // Extract unique room values from response
      const uniqueRooms = new Set<string>();
      result.data.forEach((student: StudentDetail) => {
        const room = student.room || student.class || student.class_name || '';
        if (room && room.toString().trim()) {
          uniqueRooms.add(room.toString().trim());
        }
      });

      const sortedRooms = Array.from(uniqueRooms).sort();
      setRoomOptions(sortedRooms);
      
      if (sortedRooms.length > 0) {
        logger.info(`[STUDENTS] Extracted ${sortedRooms.length} unique rooms from Grade ${gradeFilter}: ${sortedRooms.join(', ')}`, 'STUDENTS');
      } else {
        logger.info(`[STUDENTS] No rooms found for Grade ${gradeFilter} - Room dropdown will be empty (this is normal, room data is optional)`, 'STUDENTS');
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return;
      }
      // Not an error - room data is optional and may not exist
      logger.info(`[STUDENTS] No room data available for Grade ${gradeFilter} (fetch failed) - Room dropdown will be empty`, 'STUDENTS');
      setRoomOptions([]);
    }
  }, [provinceId, districtName, geipSchoolId, gradeFilter]);

  // ============================================
  // FILTER CASCADE: Grade change fetches room options
  // ============================================
  useEffect(() => {
    if (gradeFilter && provinceId && districtName && geipSchoolId) {
      // Grade changed - fetch room options from API using BY_GRADE endpoint
      // Reset room filter and student data (but don't fetch students yet)
      setRoomFilter('');
      setStudents([]);
      setTotalCount(0);
      setAppliedFilters(null);
      // Reset dynamic options
      setStudentTypeOptions([]);
      // Reset loading flags (hide messages during reset)
      setStudentsLoaded(false);
      
      // Fetch room options using BY_GRADE endpoint (for dropdown only, not for table)
      fetchRoomOptions();
      
      logger.info(`[STUDENTS] Grade changed to "${gradeFilter}" - fetching room options (no student table fetch)`, 'STUDENTS');
    } else if (gradeFilter) {
      // Grade selected but missing required filters - just reset
      setRoomFilter('');
      setRoomOptions([]);
      setStudents([]);
      setTotalCount(0);
      setAppliedFilters(null);
      setStudentTypeOptions([]);
      setStudentsLoaded(false);
    }
  }, [gradeFilter, provinceId, districtName, geipSchoolId, fetchRoomOptions]);

  // ============================================
  // FILTER UPDATE: Class and Student Type changes
  // ============================================
  // Note: Class and Student Type changes only update state
  // They do NOT trigger fetch or reset other filters
  // Fetch only happens when "Apply Filters" is clicked

  // ============================================
  // FETCH STUDENTS: Only when explicitly triggered
  // ============================================
  const fetchStudents = useCallback(async (filters: typeof appliedFilters, pageNum: number) => {
    // STRICT VALIDATION: Require both provinceId and districtName
    if (!filters) {
      logger.warn('[STUDENTS] Cannot fetch: filters object is null', 'STUDENTS');
      setStudents([]);
      setTotalCount(0);
      return;
    }
    if (!filters.provinceId || !filters.provinceId.trim()) {
      logger.warn('[STUDENTS] Cannot fetch: missing provinceId', 'STUDENTS');
      setError(language === 'km' ? 'សូមជ្រើសខេត្ត' : 'Please select Province');
      setStudents([]);
      setTotalCount(0);
      return;
    }
    if (!filters.districtName || !filters.districtName.trim()) {
      logger.warn('[STUDENTS] Cannot fetch: missing districtName', 'STUDENTS');
      setError(language === 'km' ? 'សូមជ្រើសស្រុក' : 'Please select District');
      setStudents([]);
      setTotalCount(0);
      return;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setLoading(true);
    setError(null);
    setStudentsLoaded(false); // Reset flag - request in progress

    try {
      const token = getToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      logger.info(`[STUDENTS] Fetching students: provinceId=${filters.provinceId}, districtName=${filters.districtName}, geipSchoolId=${filters.geipSchoolId}, grade=${filters.grade}, room=${filters.room || 'none'}, page=${pageNum}, size=${perPage}`, 'STUDENTS');

      // Use studentsService.getList (the ONLY service for student tables)
      // STRICT: All required filters (province + district + school + grade) are already validated
      // Endpoint selection: BY_ROOM if Class exists, else BY_GRADE (always have School + Grade)
      // Student Type is applied client-side after fetch (not in API path)
      const result = await studentsService.getList(
        token,
        {
          provinceId: String(filters.provinceId).trim(),
          districtId: String(filters.districtName).trim(), // districtName maps to districtId
          schoolId: String(filters.geipSchoolId).trim(), // REQUIRED - geip_school_ID (NOT school_name)
          grade: String(filters.grade).trim(), // REQUIRED - already validated
          ...(filters.room && filters.room.trim() && { class: String(filters.room).trim() }), // Optional: if exists, uses BY_ROOM endpoint
          // Note: studentType is NOT passed to API - will be filtered client-side after fetch
          // Note: name is NOT passed - filtered locally from loaded students
          // For local filtering to work, load all students on first page (size=10000)
          page: pageNum,
          size: pageNum === 1 ? 10000 : perPage, // Load all on first page for local filtering
        },
        abortController.signal
      );

      if (abortController.signal.aborted) {
        return;
      }

      if (!result.success) {
        const errorMsg = result.error || 'Failed to fetch students';
        logger.error(`[STUDENTS] API returned error: ${errorMsg}`, 'STUDENTS');
        throw new Error(errorMsg);
      }

      let fetchedStudents = result.data || [];
      const apiCount = result.count || result.total || 0;
      
      if (!Array.isArray(fetchedStudents)) {
        throw new Error('Invalid API response: expected array of students');
      }
      
      // Store base students for local filtering (only on first page)
      // For local filtering and pagination, we need all students loaded
      // So we accumulate students across pages or fetch all at once
      if (pageNum === 1) {
        // On first page, store the fetched students as base
        setBaseStudents(fetchedStudents);
      } else {
        // For subsequent pages, we're using server-side pagination
        // So baseStudents should contain all students from page 1
        // We don't update baseStudents on pagination - it stays as page 1 data
        // This means local filtering only works on page 1 data
        // If user wants to filter across all pages, we'd need to fetch all students
      }
      
      // Extract unique student types from API response for dynamic options
      // Note: Room options are now fetched separately when Grade changes (see fetchRoomOptions)
      // Only extract on first page load (pageNum === 1) to avoid duplicates from pagination
      let extractedStudentTypes: string[] = [];
      if (pageNum === 1 && fetchedStudents.length > 0) {
        // Extract unique student types (only if API provides non-empty values)
        const uniqueStudentTypes = new Set<string>();
        fetchedStudents.forEach((student: StudentDetail) => {
          const studentType = student.student_type || student.studentType || '';
          if (studentType && studentType.toString().trim()) {
            uniqueStudentTypes.add(studentType.toString().trim());
          }
        });
        extractedStudentTypes = Array.from(uniqueStudentTypes).sort();
        
        if (extractedStudentTypes.length > 0) {
          setStudentTypeOptions(extractedStudentTypes);
          logger.info(`[STUDENTS] Extracted ${extractedStudentTypes.length} unique student types from API: ${extractedStudentTypes.join(', ')}`, 'STUDENTS');
        } else {
          // API returns empty student_type - hide the filter and clear any selected value
          setStudentTypeOptions([]);
          setStudentTypeFilter(''); // Clear filter since API doesn't provide student_type data
          logger.info(`[STUDENTS] No student types found in API response (all student_type values are empty) - Student Type filter will be hidden and cleared`, 'STUDENTS');
        }
      }
      
      // Apply Student Type filter client-side after fetch if selected AND student types are available
      // Only filter if API provides non-empty student_type data
      // DO NOT filter on empty data
      if (filters.studentType && filters.studentType.trim() && extractedStudentTypes.length > 0) {
        const studentTypeLower = filters.studentType.trim().toLowerCase();
        const beforeCount = fetchedStudents.length;
        fetchedStudents = fetchedStudents.filter((student: StudentDetail) => {
          const studentType = (student.student_type || student.studentType || '').toString().toLowerCase();
          return studentType.includes(studentTypeLower);
        });
        logger.info(`[STUDENTS] Applied client-side Student Type filter: "${filters.studentType}" - ${beforeCount} → ${fetchedStudents.length} students`, 'STUDENTS');
      } else if (filters.studentType && filters.studentType.trim() && extractedStudentTypes.length === 0) {
        // Student type filter selected but API doesn't provide student_type data
        // Ignore the filter to avoid filtering on empty data
        logger.warn(`[STUDENTS] Student Type filter selected but API doesn't provide student_type data - ignoring filter`, 'STUDENTS');
      }
      
      setStudents(fetchedStudents);
      // Note: totalCount reflects API total (server-side pagination)
      // Client-side filtering (Student Type) doesn't affect totalCount
      setTotalCount(apiCount);
      
      // Mark as loaded (request completed successfully)
      setStudentsLoaded(true);
      
      logger.info(`[STUDENTS] Fetched ${fetchedStudents.length} students (page ${pageNum}), total: ${apiCount}`, 'STUDENTS');
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return;
      }
      const errorMessage = error.message || 'Failed to fetch students';
      logger.error('[STUDENTS] Failed to fetch students', 'STUDENTS', error);
      setError(errorMessage);
      setStudents([]);
      setBaseStudents([]);
      setTotalCount(0);
      setStudentsLoaded(true); // Request completed (with error, but completed)
    } finally {
      if (!abortController.signal.aborted) {
        setLoading(false);
      }
    }
  }, [perPage]);

  // ============================================
  // APPLY FILTERS: User action - snapshot filters and fetch
  // ============================================
  const handleApplyFilters = useCallback(() => {
    // STRICT VALIDATION: Require province + district + school + grade (minimum filters)
    if (!provinceId || !provinceId.trim()) {
      setError(language === 'km' 
        ? 'សូមជ្រើសខេត្ត' 
        : 'Please select Province');
      setStudents([]);
      setTotalCount(0);
      setAppliedFilters(null);
      return;
    }
    if (!districtName || !districtName.trim()) {
      setError(language === 'km' 
        ? 'សូមជ្រើសស្រុក' 
        : 'Please select District');
      setStudents([]);
      setTotalCount(0);
      setAppliedFilters(null);
      return;
    }
    if (!geipSchoolId || !geipSchoolId.trim()) {
      setError(language === 'km' 
        ? 'សូមជ្រើសសាលា' 
        : 'Please select School');
      setStudents([]);
      setTotalCount(0);
      setAppliedFilters(null);
      return;
    }
    if (!gradeFilter || !gradeFilter.trim()) {
      setError(language === 'km' 
        ? 'សូមជ្រើសថ្នាក់' 
        : 'Please select Grade');
      setStudents([]);
      setTotalCount(0);
      setAppliedFilters(null);
      return;
    }

    // Clear any previous errors
    setError(null);

    // Snapshot current filters (trim all values)
    // STRICT: geipSchoolId and grade are REQUIRED (already validated above)
    // Endpoint selection (handled by studentsService):
    // - BY_ROOM: if Class (room) exists → /students/{province}/districts/{district}/schools/{geip_school_ID}/grades/{grade}/rooms/{room}/
    // - BY_GRADE: if Class (room) does NOT exist → /students/{province}/districts/{district}/schools/{geip_school_ID}/grades/{grade}/
    // Student Type is applied client-side after fetch (not in API path)
    const filtersSnapshot = {
      provinceId: provinceId.trim(),
      districtName: districtName.trim(),
      geipSchoolId: geipSchoolId.trim(), // REQUIRED - geip_school_ID (NOT school_name)
      grade: gradeFilter.trim(), // REQUIRED - numeric: "11" (NOT "Grade 11")
      ...(roomFilter && roomFilter.trim() && { room: roomFilter.trim() }), // Optional: room letter "A", "B", "C" (NOT "Class 3")
      ...(studentTypeFilter && studentTypeFilter.trim() && { studentType: studentTypeFilter.trim() }), // Applied client-side after fetch
      // Note: nameSearch is filtered locally, not passed to API
    };

    // Set applied filters and reset to page 1
    setAppliedFilters(filtersSnapshot);
    setPage(1);
    
    // THIS IS THE ONLY PLACE WHERE INITIAL FETCH HAPPENS
    // All other fetches (pagination) happen in the pagination useEffect
    // Endpoint is built by studentsService: BY_ROOM if Class exists, else BY_GRADE
    fetchStudents(filtersSnapshot, 1);
  }, [provinceId, districtName, geipSchoolId, gradeFilter, roomFilter, studentTypeFilter, fetchStudents, language]);

  // ============================================
  // PAGINATION: Fetch new page with applied filters
  // STRICT: Only fetch when page changes AFTER filters are applied via "Apply Filters" button
  // ============================================
  useEffect(() => {
    // CRITICAL: Only fetch if:
    // 1. Filters have been applied (appliedFilters exists and is not null)
    // 2. Both required filters are present and non-empty
    // 3. Page is > 1 (initial page 1 fetch happens in handleApplyFilters, not here)
    if (appliedFilters && 
        appliedFilters.provinceId && 
        appliedFilters.provinceId.trim() &&
        appliedFilters.districtName && 
        appliedFilters.districtName.trim() &&
        appliedFilters.geipSchoolId &&
        appliedFilters.geipSchoolId.trim() &&
        appliedFilters.grade &&
        appliedFilters.grade.trim() &&
        page > 1) {
      // Only fetch if page changed AFTER filters were applied
      // The initial fetch (page 1) happens in handleApplyFilters, not here
      fetchStudents(appliedFilters, page);
    }
    // DO NOT fetch if:
    // - Filters are not applied (appliedFilters is null)
    // - Page is 1 (initial load handled by Apply Filters button)
    // - Required filters are missing
  }, [page, appliedFilters, fetchStudents]);

  // ============================================
  // FILTERED STUDENTS: Compute filtered list based on name search
  // ============================================
  const filteredStudents = useMemo(() => {
    if (baseStudents.length === 0 || !appliedFilters) {
      return [];
    }

    const searchTerm = nameSearch.trim();
    
    if (!searchTerm) {
      // No search term - return all base students
      return baseStudents;
    }

    // Normalize search term using NFC
    const normalizedSearch = searchTerm.normalize('NFC').toLowerCase();

    // Filter locally from base students - match first_name + last_name (case-insensitive, NFC normalized)
    const filtered = baseStudents.filter((student: StudentDetail) => {
      const firstName = (student.first_name || '').toString().normalize('NFC').toLowerCase();
      const lastName = (student.last_name || '').toString().normalize('NFC').toLowerCase();
      const fullName = `${firstName} ${lastName}`.trim();
      return fullName.includes(normalizedSearch);
    });

    logger.info(`[STUDENTS] Local name filter: "${searchTerm}" - ${baseStudents.length} → ${filtered.length} students`, 'STUDENTS');
    return filtered;
  }, [baseStudents, nameSearch, appliedFilters]);

  // ============================================
  // PAGINATED STUDENTS: Slice filtered students for current page
  // ============================================
  const pageStudents = useMemo(() => {
    const startIndex = (page - 1) * perPage;
    const endIndex = startIndex + perPage;
    return filteredStudents.slice(startIndex, endIndex);
  }, [filteredStudents, page, perPage]);

  // ============================================
  // RESET PAGE: When name search changes, reset to page 1
  // ============================================
  useEffect(() => {
    if (page > 1) {
      setPage(1);
    }
  }, [nameSearch]); // Reset page whenever nameSearch changes (including when cleared)

  // ============================================
  // CLEAR FILTERS: Reset everything
  // ============================================
  const handleClearFilters = useCallback(() => {
    setProvinceId('');
    setDistrictName('');
    setGeipSchoolId('');
    setGradeFilter('');
    setRoomFilter('');
    setStudentTypeFilter('');
    setNameSearch('');
    setAppliedFilters(null);
    setStudents([]);
    setBaseStudents([]);
    setTotalCount(0);
    setPage(1);
    setError(null);
    setDistricts([]);
    setSchools([]);
    // Reset dynamic options
    setRoomOptions([]);
    setStudentTypeOptions([]);
    // Reset loading flags
    setSchoolLoading(false);
    setSchoolLoaded(false);
    setStudentsLoaded(false);
    // Clear name search debounce
    if (nameSearchTimeoutRef.current) {
      clearTimeout(nameSearchTimeoutRef.current);
    }
  }, []);

  // ============================================
  // COMPUTED VALUES
  // ============================================
  // Total count: Use API count (totalCount) when no name search, use filtered count when name search is active
  const displayTotalCount = useMemo(() => {
    // If name search is active, use filtered count (local filtering)
    if (nameSearch.trim()) {
      return filteredStudents.length;
    }
    // Otherwise, always use API total count (500k+ from server)
    // This shows the true total even though we only loaded a subset for local filtering
    return totalCount;
  }, [filteredStudents.length, totalCount, nameSearch]);
  
  // Total pages: Based on filtered students (what we can actually paginate through)
  // This ensures pagination only works within loaded/filtered data
  const totalPages = useMemo(() => Math.ceil(filteredStudents.length / perPage), [filteredStudents.length, perPage]);
  const hasFiltersApplied = appliedFilters !== null;
  // STRICT: Require province + district + school (geip_school_ID) + grade before allowing Apply Filters
  const canApplyFilters = provinceId && districtName && geipSchoolId && gradeFilter;

  // ============================================
  // TABLE COLUMNS: Dynamic based on student data
  // ============================================
  const studentColumns: DataTableColumn<StudentDetail>[] = useMemo(() => {
    if (students.length === 0) {
      return [];
    }

    const firstStudent = students[0];
    const keys = Object.keys(firstStudent);

    return keys.map((key) => ({
      key,
      label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      render: (value: any) => {
        if (value === null || value === undefined) {
          return <span className="text-muted-foreground">N/A</span>;
        }
        if (typeof value === 'object') {
          return <span className="text-sm">{JSON.stringify(value)}</span>;
        }
        return <span className="text-sm font-khmer">{String(value)}</span>;
      },
    }));
  }, [students]);

  return (
    <div className="w-full space-y-6">
      {/* ============================================ */}
      {/* FILTER CONTAINER - Static Header */}
      {/* ============================================ */}
      <div className="w-full mt-1 md:mt-2 lg:mt-3 bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-border shadow-sm">
        {/* Filter Header - Static */}
        <div className="p-6 pb-4">
          <h1 className={`text-xl font-bold tracking-tight text-primary ${language === 'km' ? 'font-khmer' : ''}`}>
            {language === 'km' ? 'តម្រងសិស្ស' : 'Filter Students'}
          </h1>
          <p className={`text-muted-foreground mt-2 text-sm ${language === 'km' ? 'font-khmer' : ''}`}>
            {language === 'km' 
              ? 'មើលព័ត៌មានលម្អិតរបស់សិស្ស'
              : 'View detailed student information'
            }
          </p>
        </div>

        {/* Filter Content */}
        <div className="px-6 pb-6 border-t border-gray-200 dark:border-border pt-6">
          <div
            className="w-full grid 
    grid-cols-1
    gap-4
    sm:grid-cols-2
    md:grid-cols-3
    lg:grid-cols-5"
          >
          {/* Province Filter */}
          <div className="space-y-2">
            <Label
              htmlFor="province-filter"
              className={`text-sm font-medium text-primary ${language === 'km' ? 'font-khmer' : ''}`}
            >
              {language === 'km' ? 'ខេត្ត' : 'Province'} <span className="text-red-500">*</span>
            </Label>
            <select
              id="province-filter"
              value={provinceId}
              onChange={(e) => setProvinceId(e.target.value)}
              className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-khmer"
            >
              <option value="" className="font-khmer">
                {language === 'km' ? 'ជ្រើសខេត្ត...' : 'Select province...'}
              </option>
              {provinces.map((province) => (
                <option key={province.province_id} value={province.province_id} className="font-khmer">
                  {province.province_name}
                </option>
              ))}
            </select>
          </div>

          {/* District Filter */}
          <div className="space-y-2">
            <Label
              htmlFor="district-filter"
              className={`text-sm font-medium text-primary ${language === 'km' ? 'font-khmer' : ''}`}
            >
              {language === 'km' ? 'ស្រុក' : 'District'} <span className="text-red-500">*</span>
            </Label>
            <select
              id="district-filter"
              value={districtName}
              onChange={(e) => setDistrictName(e.target.value)}
              disabled={!provinceId}
              className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-khmer disabled:opacity-50 disabled:cursor-not-allowed"
              required
            >
              <option value="" className="font-khmer">
                {language === 'km' ? 'ជ្រើសស្រុក...' : 'Select district...'}
              </option>
              {districts.map((district) => (
                <option key={`${district.province_id}:${district.district_name}`} value={district.district_name} className="font-khmer">
                  {district.district_name}
                </option>
              ))}
            </select>
          </div>

          {/* School Filter */}
          <div className="space-y-2">
            <Label
              htmlFor="school-filter"
              className={`text-sm font-medium text-primary ${language === 'km' ? 'font-khmer' : ''}`}
            >
              {language === 'km' ? 'សាលា' : 'School'} <span className="text-red-500">*</span> <span className="text-muted-foreground text-xs">(Required)</span>
            </Label>
            <select
              id="school-filter"
              value={geipSchoolId}
              onChange={(e) => setGeipSchoolId(e.target.value)}
              disabled={!provinceId || !districtName || schoolLoading}
              className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-khmer disabled:opacity-50 disabled:cursor-not-allowed"
              required
            >
              <option value="" className="font-khmer">
                {schoolLoading
                  ? (language === 'km' ? 'កំពុងផ្ទុក...' : 'Loading...')
                  : (language === 'km' ? 'ជ្រើសសាលា...' : 'Select school...')}
              </option>
              {schools.map((school) => (
                <option key={`${school.province_id}:${school.district_name}:${school.geip_school_ID}`} value={school.geip_school_ID} className="font-khmer">
                  {school.school_name}
                </option>
              ))}
            </select>
          </div>

          {/* Grade Filter */}
          <div className="space-y-2">
            <Label
              htmlFor="grade-filter"
              className={`text-sm font-medium text-primary ${language === 'km' ? 'font-khmer' : ''}`}
            >
              {language === 'km' ? 'ថ្នាក់' : 'Grade'} <span className="text-red-500">*</span> <span className="text-muted-foreground text-xs">(Required)</span>
            </Label>
            <select
              id="grade-filter"
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              disabled={!geipSchoolId}
              className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-khmer disabled:opacity-50 disabled:cursor-not-allowed"
              required
            >
              <option value="" className="font-khmer">
                {language === 'km' ? 'ជ្រើសថ្នាក់...' : 'Select grade...'}
              </option>
              {GRADES.map((grade) => (
                <option key={grade} value={grade} className="font-khmer">
                  {language === 'km' ? `ថ្នាក់ទី${grade}` : `Grade ${grade}`}
                </option>
              ))}
              {/* Note: value is numeric "11" (NOT "Grade 11") to match API expectations */}
            </select>
          </div>

          {/* Class/Room Filter */}
          <div className="space-y-2">
            <Label
              htmlFor="room-filter"
              className={`text-sm font-medium text-primary ${language === 'km' ? 'font-khmer' : ''}`}
            >
              {language === 'km' ? 'បន្ទប់' : 'Class'} <span className="text-muted-foreground text-xs">(Optional)</span>
            </Label>
            <select
              id="room-filter"
              value={roomFilter}
              onChange={(e) => setRoomFilter(e.target.value)}
              disabled={!gradeFilter}
              className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-khmer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="" className="font-khmer">
                {language === 'km' ? 'ជ្រើសបន្ទប់...' : 'Select class...'}
              </option>
              {roomOptions.map((room) => (
                <option key={room} value={room} className="font-khmer">
                  {room}
                </option>
              ))}
              {/* Note: Options are dynamically extracted from API response after fetching students */}
            </select>
          </div>

          {/* Student Type Filter - Only show if API provides student_type data */}
          {studentTypeOptions.length > 0 && (
            <div className="space-y-2">
              <Label
                htmlFor="student-type-filter"
                className={`text-sm font-medium text-primary ${language === 'km' ? 'font-khmer' : ''}`}
              >
                {language === 'km' ? 'ប្រភេទសិស្ស' : 'Student Type'} <span className="text-muted-foreground text-xs">(Optional)</span>
              </Label>
              <select
                id="student-type-filter"
                value={studentTypeFilter}
                onChange={(e) => setStudentTypeFilter(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-khmer"
              >
                <option value="" className="font-khmer">
                  {language === 'km' ? 'ជ្រើសប្រភេទសិស្ស...' : 'Select student type...'}
                </option>
                {studentTypeOptions.map((type: string) => (
                  <option key={type} value={type} className="font-khmer">
                    {type}
                  </option>
                ))}
                {/* Note: Only shown when API provides non-empty student_type values - hidden if all values are empty */}
              </select>
            </div>
          )}
          </div>

          {/* Search Input and Buttons - Combined in one row */}
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4 items-end">
            {/* Search by Name */}
            <div className="w-full space-y-2">
              <Label
                htmlFor="search-name"
                className={`text-sm font-medium text-primary ${language === 'km' ? 'font-khmer' : ''}`}
              >
                {language === 'km' ? 'ស្វែងរកតាមឈ្មោះ' : 'Search by Name'} <span className="text-muted-foreground text-xs">(Optional)</span>
              </Label>
              <Input
                id="search-name"
                placeholder={language === 'km' ? 'ស្វែងរកតាមឈ្មោះសិស្ស...' : 'Search by student name...'}
                value={nameSearch}
                onChange={(e) => setNameSearch(e.target.value)}
                className={`w-full ${language === 'km' ? 'font-khmer' : ''}`}
              />
            </div>

            {/* Clear Filters Button */}
            <div className="w-full">
              <Button
                variant="outline"
                onClick={handleClearFilters}
                disabled={loading}
                className={`w-full h-10 ${language === 'km' ? 'font-khmer' : ''}`}
              >
                {language === 'km' ? 'លុបតម្រង' : 'Clear Filters'}
              </Button>
            </div>

            {/* Apply Filters Button */}
            <div className="w-full">
              <Button
                onClick={handleApplyFilters}
                disabled={loading || !canApplyFilters}
                className={`w-full h-10 ${language === 'km' ? 'font-khmer' : ''}`}
              >
                {loading ? (
                  language === 'km' ? 'កំពុងផ្ទុក...' : 'Loading...'
                ) : (
                  language === 'km' ? 'តម្រង' : 'Apply Filters'
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================ */}
      {/* PAGE HEADER ABOVE TABLE */}
      {/* ============================================ */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className={`text-xl font-bold tracking-tight text-primary ${language === 'km' ? 'font-khmer' : ''}`}>
            {language === 'km' ? 'សិស្ស' : 'Students'}
          </h1>
          <p className={`text-muted-foreground mt-2 text-sm ${language === 'km' ? 'font-khmer' : ''}`}>
            {hasFiltersApplied && displayTotalCount > 0 ? (
              language === 'km' 
                ? `${t.common.showing} ${((page - 1) * perPage) + 1}–${Math.min(page * perPage, displayTotalCount)} ${t.common.of} ${displayTotalCount.toLocaleString()} ${language === 'km' ? 'សិស្ស' : 'students'}`
                : `${t.common.showing} ${((page - 1) * perPage) + 1}–${Math.min(page * perPage, displayTotalCount)} ${t.common.of} ${displayTotalCount.toLocaleString()} students`
            ) : (
              language === 'km' 
                ? 'សូមជ្រើសខេត្ត ស្រុក សាលា និងថ្នាក់ បន្ទាប់មកចុច "តម្រង"' 
                : 'Please select Province, District, School, and Grade, then click "Apply Filters"'
            )}
          </p>
        </div>
      </div>

      {/* ============================================ */}
      {/* TABLE CARD */}
      {/* ============================================ */}
      <div className="w-full
  bg-white dark:bg-card
  rounded-lg
  border border-gray-200 dark:border-border
  p-6 shadow-sm
">
        {error ? (
          <div className="text-center py-12">
            <p className={`text-red-500 font-medium ${language === 'km' ? 'font-khmer' : ''}`}>
              {language === 'km' ? 'កំហុស' : 'Error'}
            </p>
            <p className={`text-muted-foreground mt-2 text-sm ${language === 'km' ? 'font-khmer' : ''}`}>
              {error}
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setError(null);
                if (appliedFilters) {
                  fetchStudents(appliedFilters, page);
                }
              }}
              className={`mt-4 ${language === 'km' ? 'font-khmer' : ''}`}
            >
              {language === 'km' ? 'ព្យាយាមម្តងទៀត' : 'Try Again'}
            </Button>
          </div>
        ) : loading ? (
          <Loading language={language} />
        ) : !hasFiltersApplied ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className={`text-lg font-medium mb-2 ${language === 'km' ? 'font-khmer' : ''}`}>
              {language === 'km' ? 'សូមជ្រើសតម្រងដើម្បីមើលសិស្ស' : 'Select Filters to View Students'}
            </p>
            <p className={`text-sm ${language === 'km' ? 'font-khmer' : ''}`}>
              {language === 'km' 
                ? 'សូមជ្រើសខេត្ត ស្រុក សាលា និងថ្នាក់ (ត្រូវការ) បន្ទាប់មកចុច "តម្រង" ដើម្បីមើលសិស្ស។'
                : 'Please select Province, District, School, and Grade (required), then click "Apply Filters" to view students.'}
            </p>
          </div>
        ) : (hasFiltersApplied && (pageStudents.length > 0 || filteredStudents.length > 0)) ? (
          <>
            <DataTable
              data={pageStudents}
              columns={studentColumns}
              getRowKey={(row, index) => {
                if (row.id) return String(row.id);
                const provinceId = row.province_ID || row.province_id || '';
                const districtName = row.district_name || '';
                const schoolName = row.school_name || '';
                return `${provinceId}:${districtName}:${schoolName}:${index}`;
              }}
            />
            
            {/* Pagination */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className={`text-sm text-muted-foreground ${language === 'km' ? 'font-khmer' : ''}`}>
                {t.common.showing} {((page - 1) * perPage) + 1}–{Math.min(page * perPage, displayTotalCount)} {t.common.of} {displayTotalCount.toLocaleString()}
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1 || loading || totalPages === 0}
                  className={language === 'km' ? 'font-khmer' : ''}
                >
                  {t.common.prev}
                </Button>
                
                <div className={`px-3 text-sm text-muted-foreground ${language === 'km' ? 'font-khmer' : ''}`}>
                  {t.common.page} {page} {t.common.of} {totalPages || 1}
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || loading || totalPages === 0}
                  className={language === 'km' ? 'font-khmer' : ''}
                >
                  {t.common.next}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p className={`text-lg font-medium mb-2 ${language === 'km' ? 'font-khmer' : ''}`}>
              {language === 'km' ? 'រកមិនឃើញសិស្ស' : 'No Students Found'}
            </p>
            <p className={`text-sm ${language === 'km' ? 'font-khmer' : ''}`}>
              {language === 'km' 
                ? `មិនមានសិស្សសម្រាប់ខេត្ត "${appliedFilters?.provinceId}" និងស្រុក "${appliedFilters?.districtName}"`
                : `No students found for Province "${appliedFilters?.provinceId}" and District "${appliedFilters?.districtName}"`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
