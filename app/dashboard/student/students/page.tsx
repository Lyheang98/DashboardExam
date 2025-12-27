'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
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
import { useFilterState } from '@/lib/filters';
import { StudentDetail } from '@/lib/api/services/studentDetail.service';
import { studentIndexService, provinceService, districtService, schoolService } from '@/lib/api';
import { getToken } from '@/lib/auth';

interface SchoolSummary {
  school_name: string;
  total_students: number;
}

/**
 * STUDENTS PAGE - Refactored with strict scope
 * 
 * Requirements:
 * - Requires: province_ID + district_name (school_name is OPTIONAL)
 * - Filter Data button disabled until province + district are selected
 * - Cascading: Province change resets district & school; District change resets school
 * - Supports pagination (uses response.count, never results.length)
 * - School sub-view: Groups students by school_name when province + district selected
 */
export default function StudentsPage() {
  const { t, language } = useLanguage();
  
  // ============================================
  // CENTRALIZED FILTER STATE
  // ============================================
  const {
    filters,
    setProvinceId,
    setDistrictName,
    setSchoolName,
    setSearchQuery,
    isValid,
    canFilter,
  } = useFilterState({ pageType: 'student' });
  
  // ============================================
  // STATE: Data & UI
  // ============================================
  const [allStudents, setAllStudents] = useState<StudentDetail[]>([]); // All loaded students (for client-side filtering)
  const [students, setStudents] = useState<StudentDetail[]>([]); // Filtered students to display
  const [totalCount, setTotalCount] = useState<number>(0); // Total count from API
  const [loading, setLoading] = useState(false);
  const [activeFilters, setActiveFilters] = useState<{
    provinceId?: string;
    districtName?: string;
    schoolName?: string;
    grade?: string;
    room?: string;
    studentType?: string;
  }>({}); // Track active filters for client-side filtering
  const [provinces, setProvinces] = useState<Array<{ province_id: string; province_name: string }>>([]);
  const [districts, setDistricts] = useState<Array<{ province_id: string; district_name: string }>>([]);
  const [schools, setSchools] = useState<Array<{ province_id: string; district_name: string; school_name: string }>>([]);
  const [provinceDistrictCounts, setProvinceDistrictCounts] = useState<Map<string, number>>(new Map());
  const [districtSchoolCounts, setDistrictSchoolCounts] = useState<Map<string, number>>(new Map());
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25); // Small page size for performance (25-50 range)
  const [searchQuery, setSearchQueryLocal] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [studentIdQuery, setStudentIdQueryLocal] = useState('');
  const [debouncedStudentId, setDebouncedStudentId] = useState('');
  const [hasInitialFetch, setHasInitialFetch] = useState(false);
  
  // ============================================
  // STATE: Additional Filters
  // ============================================
  const [gradeFilter, setGradeFilter] = useState<string>('');
  const [roomFilter, setRoomFilter] = useState<string>('');
  const [studentTypeFilter, setStudentTypeFilter] = useState<string>('');
  
  // ============================================
  // STATE: Available Filter Options (derived from fetched data)
  // ============================================
  const [availableGrades, setAvailableGrades] = useState<string[]>([]);
  const [availableRooms, setAvailableRooms] = useState<string[]>([]);
  const [availableStudentTypes, setAvailableStudentTypes] = useState<string[]>([]);

  // ============================================
  // STATE: School Sub-View (derived from students)
  // ============================================
  const [schoolSummaries, setSchoolSummaries] = useState<SchoolSummary[]>([]);
  const [selectedSchoolFromView, setSelectedSchoolFromView] = useState<string | null>(null);
  
  // ============================================
  // REFS: Request cancellation & debouncing
  // ============================================
  const abortControllerRef = useRef<AbortController | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const studentIdTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // ============================================
  // DEBOUNCING: Search query (name)
  // ============================================
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // ============================================
  // DEBOUNCING: Search query (student ID)
  // ============================================
  useEffect(() => {
    if (studentIdTimeoutRef.current) {
      clearTimeout(studentIdTimeoutRef.current);
    }
    studentIdTimeoutRef.current = setTimeout(() => {
      setDebouncedStudentId(studentIdQuery);
    setPage(1);
    }, 300);

    return () => {
      if (studentIdTimeoutRef.current) {
        clearTimeout(studentIdTimeoutRef.current);
      }
    };
  }, [studentIdQuery]);

  // ============================================
  // DATA FETCHING: Load provinces for dropdown
  // ============================================
  useEffect(() => {
    const loadProvinces = async () => {
      try {
        const result = await provinceService.getAll({
          limit: 1000,
          offset: 0,
        });

        if (result.success && result.data && Array.isArray(result.data)) {
          setProvinces(result.data.map((p: any) => ({
            province_id: p.province_id,
            province_name: p.province_name,
          })));
        }
      } catch (error: any) {
        logger.error('Failed to fetch provinces', 'STUDENTS', error);
      }
    };

    loadProvinces();
  }, []);

  // ============================================
  // FILTER DEPENDENCIES: Reset dependent filters when parent changes
  // ============================================
  // Reset district and school when province changes
  useEffect(() => {
    if (filters.provinceId) {
      // Reset dependent filters when province changes
      setDistrictName('');
      setSchoolName('');
      setStudents([]);
      setTotalCount(0);
      setHasInitialFetch(false);
      setSchoolSummaries([]);
      setSelectedSchoolFromView(null);
    }
  }, [filters.provinceId, setDistrictName, setSchoolName]);

  // Reset school when district changes
  useEffect(() => {
    if (filters.districtName && filters.provinceId) {
      // Only reset school when district changes (province already set)
      setSchoolName('');
      setStudents([]);
      setTotalCount(0);
      setHasInitialFetch(false);
      setSchoolSummaries([]);
      setSelectedSchoolFromView(null);
    }
  }, [filters.districtName, filters.provinceId, setSchoolName]);

  // ============================================
  // UPDATE DISTRICTS DROPDOWN: When province changes
  // ============================================
  useEffect(() => {
    if (filters.provinceId) {
      // Fetch districts using districtService (uses Districts API, not Student API)
      const loadDistricts = async () => {
        try {
          logger.info(`[STUDENTS] Loading districts for province ${filters.provinceId}`, 'STUDENTS');
          const result = await districtService.getAll({
            province_id: filters.provinceId,
            limit: 10000,
            offset: 0,
          });

          if (result.success && result.data && Array.isArray(result.data)) {
            // Extract unique district names for dropdown
            const uniqueDistricts = Array.from(
              new Map(
                result.data.map((d: any) => [
                  d.district_name,
                  { province_id: d.province_id, district_name: d.district_name }
                ])
              ).values()
            );
            
            setDistricts(uniqueDistricts);
            
            // Update province district counts for dropdown display
            const countsMap = new Map<string, number>();
            result.data.forEach((d: any) => {
              const pid = (d.province_id || '').trim();
              if (pid) {
                countsMap.set(pid, (countsMap.get(pid) || 0) + 1);
              }
            });
            setProvinceDistrictCounts(countsMap);
            
            logger.info(`[STUDENTS] Loaded ${uniqueDistricts.length} districts for province ${filters.provinceId}`, 'STUDENTS');
          } else {
            logger.warn(`[STUDENTS] No districts found for province ${filters.provinceId}`, 'STUDENTS');
            setDistricts([]);
          }
        } catch (error: any) {
          logger.error(`[STUDENTS] Failed to fetch districts for province ${filters.provinceId}`, 'STUDENTS', error);
          setDistricts([]);
        }
      };

      loadDistricts();
    } else {
      setDistricts([]);
      setSchools([]); // Also clear schools when province is cleared
    }
  }, [filters.provinceId]);

  // ============================================
  // UPDATE SCHOOLS DROPDOWN: When district changes
  // ============================================
  useEffect(() => {
    if (filters.provinceId && filters.districtName) {
      // Fetch schools using schoolService (uses Schools API, not Student API)
      const loadSchools = async () => {
        try {
          logger.info(`[STUDENTS] Loading schools for province ${filters.provinceId}, district ${filters.districtName}`, 'STUDENTS');
          const result = await schoolService.getAll({
            province_id: filters.provinceId,
            district_name: filters.districtName,
            limit: 10000,
            offset: 0,
          });

          if (result.success && result.data && Array.isArray(result.data)) {
            // Extract unique school names for dropdown
            const uniqueSchools = Array.from(
              new Map(
                result.data.map((s: any) => [
                  s.school_name,
                  { 
                    province_id: s.province_id, 
                    district_name: s.district_name,
                    school_name: s.school_name 
                  }
                ])
              ).values()
            );
            
            setSchools(uniqueSchools);
            
            // Update district school counts for dropdown display
            const schoolCountsMap = new Map<string, number>();
            result.data.forEach((s: any) => {
              const key = `${s.province_id}:${s.district_name}`;
              schoolCountsMap.set(key, (schoolCountsMap.get(key) || 0) + 1);
            });
            setDistrictSchoolCounts(schoolCountsMap);
            
            logger.info(`[STUDENTS] Loaded ${uniqueSchools.length} schools for province ${filters.provinceId}, district ${filters.districtName}`, 'STUDENTS');
            
            // Don't auto-clear students - let user apply filters manually
            // If school filter is invalid, just clear it
            if (filters.schoolName && !uniqueSchools.some(s => s.school_name === filters.schoolName)) {
              setSchoolName(''); // Clear invalid school filter
            }
          } else {
            logger.warn(`[STUDENTS] No schools found for province ${filters.provinceId}, district ${filters.districtName}`, 'STUDENTS');
            setSchools([]);
            setStudents([]);
            setTotalCount(0);
            setHasInitialFetch(false);
            setSchoolSummaries([]);
            setSelectedSchoolFromView(null);
          }
        } catch (error: any) {
          logger.error(`[STUDENTS] Failed to fetch schools for province ${filters.provinceId}, district ${filters.districtName}`, 'STUDENTS', error);
          setSchools([]);
          setStudents([]);
          setTotalCount(0);
          setHasInitialFetch(false);
        }
      };

      loadSchools();
    } else {
      setSchools([]);
      // Don't clear students when district is cleared - let user apply filters manually
      setSchoolSummaries([]);
      setSelectedSchoolFromView(null);
    }
  }, [filters.provinceId, filters.districtName]);

  // ============================================
  // INITIAL FETCH: Load all students on page load
  // ============================================
  useEffect(() => {
    const fetchInitialData = async () => {
      // Cancel previous request if still pending
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setLoading(true);

      try {
        const token = getToken();
        if (!token) {
          throw new Error('Authentication required');
        }

        // Fetch all students initially (no filters)
        // Use a large limit to get a good sample for initial display
        logger.info(`[STUDENTS] Fetching initial student data: limit=1000`, 'INITIAL_FETCH');

        const result = await studentIndexService.getList(
          token,
          {
            limit: 1000, // Fetch larger initial dataset
            offset: 0,
          },
          abortController.signal
        );

        if (abortController.signal.aborted) {
          return;
        }

        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch students');
        }

      // Read data from response
      const fetchedStudents = result.data || [];
      
      // Store all fetched students for client-side filtering
      setAllStudents(fetchedStudents);
      setStudents(fetchedStudents);
      
      // Clear active filters for initial load (no filters applied)
      setActiveFilters({});
      
      // Set total count from response.count
      setTotalCount(result.count || 0);
      setHasInitialFetch(true);
        
        // Extract available filter options from fetched students
        // Only update if we have data, otherwise keep existing options
        if (fetchedStudents.length > 0) {
          const grades = new Set<string>();
          const rooms = new Set<string>();
          const types = new Set<string>();
          
          fetchedStudents.forEach((student: any) => {
            if (student.grade && String(student.grade).trim()) {
              grades.add(String(student.grade).trim());
            }
            if (student.room && String(student.room).trim()) {
              rooms.add(String(student.room).trim());
            }
            if (student.student_type && String(student.student_type).trim()) {
              types.add(String(student.student_type).trim());
            }
          });
          
          // Merge with existing options to preserve all available values
          const existingGrades = new Set(availableGrades);
          const existingRooms = new Set(availableRooms);
          const existingTypes = new Set(availableStudentTypes);
          
          grades.forEach(g => existingGrades.add(g));
          rooms.forEach(r => existingRooms.add(r));
          types.forEach(t => existingTypes.add(t));
          
          setAvailableGrades(Array.from(existingGrades).sort());
          setAvailableRooms(Array.from(existingRooms).sort());
          setAvailableStudentTypes(Array.from(existingTypes).sort());
        }

        logger.info(`[STUDENTS] Initial fetch: ${fetchedStudents.length} students, Total count: ${result.count || 0}`, 'INITIAL_FETCH');
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          logger.error('[STUDENTS] Failed to fetch initial students', 'INITIAL_FETCH', error);
          setStudents([]);
          setTotalCount(0);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };

    // Only fetch once on initial mount
    fetchInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run once on mount

  // ============================================
  // UPDATE SCHOOL SUMMARIES: Group students by school_name
  // ============================================
  const updateSchoolSummaries = useCallback((studentData: StudentDetail[]) => {
    if (!filters.provinceId || !filters.districtName) {
      setSchoolSummaries([]);
      return;
    }

    // Group students by school_name
    const schoolMap = new Map<string, number>();
    
    for (const student of studentData) {
      const schoolName = student.school_name || student.school_Name || student.School_name || '';
      if (schoolName) {
        schoolMap.set(schoolName, (schoolMap.get(schoolName) || 0) + 1);
      }
    }

    const summaries: SchoolSummary[] = Array.from(schoolMap.entries())
      .map(([school_name, total_students]) => ({ school_name, total_students }))
      .sort((a, b) => b.total_students - a.total_students);

    setSchoolSummaries(summaries);
  }, [filters.provinceId, filters.districtName]);

  // ============================================
  // REFETCH: When page or perPage changes (pagination only)
  // This effect only handles pagination, not filter changes
  // ============================================
  useEffect(() => {
    // Only refetch if data was previously loaded (hasInitialFetch is true)
    // Skip if this is the initial mount (initial fetch handles that)
    if (hasInitialFetch && page > 1) {
      const fetchPage = async () => {
        // Cancel previous request if still pending
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        setLoading(true);

        try {
          const token = getToken();
          if (!token) {
            throw new Error('Authentication required');
          }

          // Build params with current filters (API-supported filters only)
        const params: any = {
          limit: perPage,
          offset: (page - 1) * perPage,
        };

          // Only add filters if they have actual values (not empty strings)
          if (filters.provinceId && filters.provinceId.trim()) {
            params.province_id = filters.provinceId.trim();
          }
          if (filters.districtName && filters.districtName.trim()) {
            params.district_name = filters.districtName.trim();
          }
          if (filters.schoolName && filters.schoolName.trim()) {
            params.school_name = filters.schoolName.trim();
          }
          if (gradeFilter && gradeFilter.trim()) {
            params.grade = gradeFilter.trim();
          }
          if (roomFilter && roomFilter.trim()) {
            params.room = roomFilter.trim();
          }
          if (studentTypeFilter && studentTypeFilter.trim()) {
            params.student_type = studentTypeFilter.trim();
          }

          logger.info(`[STUDENTS] Fetching page ${page} with params: ${JSON.stringify(params)}`, 'PAGINATION');

          const result = await studentIndexService.getList(
            token,
            params,
            abortController.signal
          );

          if (abortController.signal.aborted) {
            return;
          }

        if (result.success) {
      // Read data from response
      const fetchedStudents = result.data || [];
      
      // Store all fetched students for client-side filtering
      setAllStudents(fetchedStudents);
      setStudents(fetchedStudents);
      
      // Set total count from response.count
          setTotalCount(result.count || 0);
      
      // Update school summaries if province and district are selected
      if (filters.provinceId && filters.districtName) {
        updateSchoolSummaries(fetchedStudents);
      }
        }
      } catch (error: any) {
          if (error.name !== 'AbortError') {
            logger.error('[STUDENTS] Failed to fetch page', 'PAGINATION', error);
        setStudents([]);
        setTotalCount(0);
          }
      } finally {
          if (!abortController.signal.aborted) {
        setLoading(false);
          }
        }
      };

      fetchPage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, perPage]);

  // ============================================
  // FETCH ALL DATA: Fetch all students without filters
  // ============================================
  const fetchAllData = useCallback(async () => {
    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setLoading(true);
    setPage(1);

    try {
      const token = getToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      // Fetch all students (no filters)
      // Use a large limit to get a good sample
      const params: any = {
        limit: 1000, // Fetch larger dataset
        offset: 0,
      };

      logger.info(`[STUDENTS] Fetching all students: limit=1000`, 'FETCH_ALL');

      const result = await studentIndexService.getList(
        token,
        params,
        abortController.signal
      );

      if (abortController.signal.aborted) {
        return;
      }

      if (!result.success) {
        logger.error(`[STUDENTS] Fetch all failed: ${result.error}`, 'FETCH_ALL');
        setStudents([]);
        setTotalCount(0);
        return;
      }

      const fetchedStudents = result.data || [];
      setStudents(fetchedStudents);
      setTotalCount(result.count || 0);
      setHasInitialFetch(true);
      setSchoolSummaries([]);
      
      // Extract available filter options
      if (fetchedStudents.length > 0) {
        const grades = new Set<string>();
        const rooms = new Set<string>();
        const types = new Set<string>();
        
        fetchedStudents.forEach((student: any) => {
          if (student.grade && String(student.grade).trim()) {
            grades.add(String(student.grade).trim());
          }
          if (student.room && String(student.room).trim()) {
            rooms.add(String(student.room).trim());
          }
          if (student.student_type && String(student.student_type).trim()) {
            types.add(String(student.student_type).trim());
          }
        });
        
        setAvailableGrades(Array.from(grades).sort());
        setAvailableRooms(Array.from(rooms).sort());
        setAvailableStudentTypes(Array.from(types).sort());
      }
      
      logger.info(`[STUDENTS] Fetched all: ${fetchedStudents.length} students, Total count: ${result.count || 0}`, 'FETCH_ALL');
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return;
      }
      logger.error('[STUDENTS] Failed to fetch all students', 'FETCH_ALL', error);
      setStudents([]);
      setTotalCount(0);
    } finally {
      if (!abortController.signal.aborted) {
        setLoading(false);
      }
    }
  }, [perPage]);

  // ============================================
  // FILTER DATA: User-triggered API call with all filters
  // All filters are optional - can filter with any combination
  // ============================================
  const handleFilterData = useCallback(async () => {
    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setLoading(true);
    setPage(1); // Reset to first page when filtering

    try {
      const token = getToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      // Build params with active filters (all optional)
      // Use a large limit to fetch ALL matching data for client-side filtering
      // Display pagination will be handled client-side
      const params: any = {
        limit: 10000, // Fetch large dataset for client-side filtering
        offset: 0,
      };

      // Add filters only if they have actual values (not empty strings)
      if (filters.provinceId && filters.provinceId.trim()) {
        params.province_id = filters.provinceId.trim();
      }
      if (filters.districtName && filters.districtName.trim()) {
        params.district_name = filters.districtName.trim();
      }
      if (filters.schoolName && filters.schoolName.trim()) {
        params.school_name = filters.schoolName.trim();
      }
      if (gradeFilter && gradeFilter.trim()) {
        params.grade = gradeFilter.trim();
      }
      if (roomFilter && roomFilter.trim()) {
        params.room = roomFilter.trim();
      }
      if (studentTypeFilter && studentTypeFilter.trim()) {
        params.student_type = studentTypeFilter.trim();
      }
      // Note: search and student_id are handled client-side only (not sent to API)

      logger.info(`[STUDENTS] Applying filters with params: ${JSON.stringify(params)}`, 'FILTER');

      const result = await studentIndexService.getList(
        token,
        params,
        abortController.signal
      );

      if (abortController.signal.aborted) {
        return;
      }

      if (!result.success) {
        logger.error(`[STUDENTS] Filter failed: ${result.error}`, 'FILTER');
        // Don't throw - just show empty state
        setStudents([]);
        setTotalCount(0);
        return;
      }

      // Read data from response
      let fetchedStudents = result.data || [];
      
      // If backend filtered properly, use the filtered results
      // If backend didn't filter (returned all data), we'll filter client-side
      // Check if we got more data than expected (might indicate backend didn't filter)
      const expectedFilteredCount = result.count || 0;
      const actualFetchedCount = fetchedStudents.length;
      
      logger.info(`[STUDENTS] Fetched ${actualFetchedCount} students, API count: ${expectedFilteredCount}`, 'FILTER');
      
      // Store all fetched students for client-side filtering
      setAllStudents(fetchedStudents);
      
      // Set active filters so client-side filtering can apply them
      const currentActiveFilters: typeof activeFilters = {};
      if (filters.provinceId && filters.provinceId.trim()) currentActiveFilters.provinceId = filters.provinceId.trim();
      if (filters.districtName && filters.districtName.trim()) currentActiveFilters.districtName = filters.districtName.trim();
      if (filters.schoolName && filters.schoolName.trim()) currentActiveFilters.schoolName = filters.schoolName.trim();
      if (gradeFilter && gradeFilter.trim()) currentActiveFilters.grade = gradeFilter.trim();
      if (roomFilter && roomFilter.trim()) currentActiveFilters.room = roomFilter.trim();
      if (studentTypeFilter && studentTypeFilter.trim()) currentActiveFilters.studentType = studentTypeFilter.trim();
      setActiveFilters(currentActiveFilters);
      
      // Set total count - will be updated by useEffect after client-side filtering
      // Use API count if it seems reasonable, otherwise will use filtered count
      setTotalCount(expectedFilteredCount > 0 ? expectedFilteredCount : actualFetchedCount);
      setHasInitialFetch(true);
      
      logger.info(`[STUDENTS] Filter applied successfully: ${fetchedStudents.length} students fetched, Active filters: ${JSON.stringify(currentActiveFilters)}`, 'FILTER');
      
      // Update school summaries if province and district are selected
      if (filters.provinceId && filters.districtName) {
        updateSchoolSummaries(fetchedStudents);
      } else {
        setSchoolSummaries([]);
      }
      
      // Extract available filter options from fetched students
      // Merge with existing options to preserve all available values
      if (fetchedStudents.length > 0) {
        const grades = new Set<string>(availableGrades);
        const rooms = new Set<string>(availableRooms);
        const types = new Set<string>(availableStudentTypes);
        
        fetchedStudents.forEach((student: any) => {
          if (student.grade && String(student.grade).trim()) {
            grades.add(String(student.grade).trim());
          }
          if (student.room && String(student.room).trim()) {
            rooms.add(String(student.room).trim());
          }
          if (student.student_type && String(student.student_type).trim()) {
            types.add(String(student.student_type).trim());
          }
        });
        
        setAvailableGrades(Array.from(grades).sort());
        setAvailableRooms(Array.from(rooms).sort());
        setAvailableStudentTypes(Array.from(types).sort());
      }
      
      logger.info(`[STUDENTS] Filtered students: ${fetchedStudents.length}, Total count: ${result.count || 0}`, 'FILTER');
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return; // Request was cancelled, ignore
      }
      logger.error('[STUDENTS] Failed to filter students', 'FILTER', error);
      setStudents([]);
      setTotalCount(0);
    } finally {
      if (!abortController.signal.aborted) {
        setLoading(false);
      }
    }
  }, [filters.provinceId, filters.districtName, filters.schoolName, gradeFilter, roomFilter, studentTypeFilter, perPage, updateSchoolSummaries]);

  // ============================================
  // HANDLE SCHOOL CLICK: From sub-view
  // ============================================
  const handleSchoolClick = useCallback((schoolName: string) => {
    logger.info(`[STUDENTS] School clicked in sub-view: ${schoolName}`, 'FILTERS');
    setSchoolName(schoolName);
    setSelectedSchoolFromView(schoolName);
    // Trigger refetch with school filter
    // Note: This will be handled by the filter change effect
  }, [setSchoolName]);

  // ============================================
  // MEMOIZED COMPUTATIONS: Apply ALL filters (both API and client-side)
  // This ensures all selected filters work together
  // ============================================
  const filteredStudents = useMemo(() => {
    // Start with all students (always use allStudents for filtering)
    let filtered = allStudents;
    
    // Apply ALL filters client-side to ensure they work
    // Province filter
    if (activeFilters.provinceId) {
      filtered = filtered.filter((student: any) => {
        const studentProvinceId = (student.province_ID || student.province_id || '').toString().trim();
        return studentProvinceId === activeFilters.provinceId;
      });
    }
    
    // District filter
    if (activeFilters.districtName) {
      filtered = filtered.filter((student: any) => {
        const studentDistrict = (student.district_name || '').toString().trim();
        return studentDistrict === activeFilters.districtName;
      });
    }
    
    // School filter
    if (activeFilters.schoolName) {
      filtered = filtered.filter((student: any) => {
        const studentSchool = (student.school_name || student.school_Name || student.School_name || '').toString().trim();
        return studentSchool === activeFilters.schoolName;
      });
    }
    
    // Grade filter
    if (activeFilters.grade) {
      filtered = filtered.filter((student: any) => {
        const studentGrade = (student.grade || '').toString().trim();
        return studentGrade === activeFilters.grade;
      });
    }
    
    // Room/Class filter
    if (activeFilters.room) {
      filtered = filtered.filter((student: any) => {
        const studentRoom = (student.room || '').toString().trim();
        return studentRoom === activeFilters.room;
      });
    }
    
    // Student Type filter
    if (activeFilters.studentType) {
      filtered = filtered.filter((student: any) => {
        const studentType = (student.student_type || '').toString().trim();
        return studentType === activeFilters.studentType;
      });
    }
    
    // Apply client-side search filters (name and ID)
    if (debouncedSearch) {
      const searchLower = debouncedSearch.toLowerCase();
      filtered = filtered.filter((student: any) => {
        // Search across common student fields (name, etc.)
        const studentString = JSON.stringify(student).toLowerCase();
        return studentString.includes(searchLower);
      });
    }
    
    // Filter by student ID
    if (debouncedStudentId) {
      const studentIdLower = debouncedStudentId.toLowerCase().trim();
      filtered = filtered.filter((student: any) => {
        const studentId = (student.student_ID || student.student_id || student.id || '').toString().toLowerCase();
        return studentId.includes(studentIdLower);
      });
    }
    
    return filtered;
  }, [allStudents, activeFilters, debouncedSearch, debouncedStudentId]);

  // Memoize filters key for stable comparison
  const filtersKey = useMemo(() => {
    return `${activeFilters.provinceId || ''}_${activeFilters.districtName || ''}_${activeFilters.schoolName || ''}_${activeFilters.grade || ''}_${activeFilters.room || ''}_${activeFilters.studentType || ''}_${debouncedSearch}_${debouncedStudentId}`;
  }, [activeFilters.provinceId, activeFilters.districtName, activeFilters.schoolName, activeFilters.grade, activeFilters.room, activeFilters.studentType, debouncedSearch, debouncedStudentId]);

  // Paginate filtered students for display (client-side pagination)
  const paginatedStudents = useMemo(() => {
    const startIndex = (page - 1) * perPage;
    const endIndex = startIndex + perPage;
    return filteredStudents.slice(startIndex, endIndex);
  }, [filteredStudents, page, perPage]);

  // Update displayed students and count when filtered results change
  // Use refs to track previous values and prevent infinite loops
  const prevFilteredCountRef = useRef(0);
  const prevFiltersKeyRef = useRef<string>('');
  const prevAllStudentsLengthRef = useRef(0);
  const prevPageRef = useRef(1);
  
  useEffect(() => {
    const currentFilteredCount = filteredStudents.length;
    const currentAllStudentsLength = allStudents.length;
    const currentPage = page;
    
    // Only update if something actually changed
    if (currentFilteredCount !== prevFilteredCountRef.current || 
        filtersKey !== prevFiltersKeyRef.current ||
        currentAllStudentsLength !== prevAllStudentsLengthRef.current ||
        currentPage !== prevPageRef.current) {
      // Update displayed students from paginated filtered results
      setStudents(paginatedStudents);
      
      // Update count based on whether filters are active
      const hasActiveFilters = Object.keys(activeFilters).length > 0 || debouncedSearch || debouncedStudentId;
      if (hasActiveFilters) {
        // If filters are active, use filtered count (total matching students from fetched data)
        // This is the count of students that match filters in the data we fetched
        setTotalCount(currentFilteredCount);
      }
      // If no filters, keep the API count (don't update it here)
      
      // Update refs
      prevFilteredCountRef.current = currentFilteredCount;
      prevFiltersKeyRef.current = filtersKey;
      prevAllStudentsLengthRef.current = currentAllStudentsLength;
      prevPageRef.current = currentPage;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paginatedStudents, filteredStudents.length, filtersKey, allStudents.length, page, perPage]);

  // CRITICAL: Use totalCount for pagination
  const totalPages = useMemo(() => Math.ceil(totalCount / perPage), [totalCount, perPage]);

  // ============================================
  // TABLE COLUMNS: Dynamic based on student data
  // ============================================
  const studentColumns: DataTableColumn<StudentDetail>[] = useMemo(() => {
    if (students.length === 0) {
      return [];
    }

    // Get all keys from first student record
    const firstStudent = students[0];
    const keys = Object.keys(firstStudent);

    // Create columns dynamically
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

  // ============================================
  // EMPTY STATE LOGIC
  // ============================================
  const showEmptyState = !loading && students.length === 0;
  const showNoDataFound = showEmptyState && hasInitialFetch;

  // ============================================
  // SHOW SCHOOL SUB-VIEW: When province + district selected, school not selected
  // ============================================
  const showSchoolSubView = filters.provinceId && filters.districtName && !filters.schoolName && schoolSummaries.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mt-6">
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

      {/* ============================================ */}
      {/* SEARCH AND FILTERS SECTION */}
      {/* ============================================ */}
      <div className="w-full
  bg-white dark:bg-card
  rounded-lg
  border border-gray-200 dark:border-border
  p-6 shadow-sm
">
        <div
          className="w-full grid 
    grid-cols-1
    gap-4
    sm:grid-cols-2
    md:grid-cols-3
    lg:grid-cols-4
    xl:grid-cols-6"
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
              value={filters.provinceId || ''}
              onChange={(e) => setProvinceId(e.target.value)}
              className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-khmer"
            >
              <option value="" className="font-khmer">
                {language === 'km' ? 'ជ្រើសខេត្ត...' : 'Select province...'}
              </option>
              {provinces.map((province) => {
                const districtCount = provinceDistrictCounts.get(province.province_id) || 0;
                return (
                  <option key={province.province_id} value={province.province_id} className="font-khmer">
                    {province.province_name} {districtCount > 0 ? `(${districtCount})` : ''}
                  </option>
                );
              })}
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
              value={filters.districtName || ''}
              onChange={(e) => setDistrictName(e.target.value)}
              disabled={!filters.provinceId}
              className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-khmer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="" className="font-khmer">
                {language === 'km' ? 'ជ្រើសស្រុក...' : 'Select district...'}
              </option>
              {districts.map((district) => {
                const key = `${filters.provinceId}:${district.district_name}`;
                const schoolCount = districtSchoolCounts.get(key) || 0;
                return (
                  <option key={district.district_name} value={district.district_name} className="font-khmer">
                    {district.district_name} {schoolCount > 0 ? `(${schoolCount})` : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* School Filter */}
          <div className="space-y-2">
            <Label
              htmlFor="school-filter"
              className={`text-sm font-medium text-primary ${language === 'km' ? 'font-khmer' : ''}`}
            >
              {language === 'km' ? 'សាលា' : 'School'} <span className="text-muted-foreground text-xs">(Optional)</span>
            </Label>
            <select
              id="school-filter"
              value={filters.schoolName || ''}
              onChange={(e) => setSchoolName(e.target.value)}
              disabled={!filters.provinceId || !filters.districtName}
              className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-khmer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="" className="font-khmer">
                {language === 'km' ? 'ជ្រើសសាលា...' : 'Select school...'}
              </option>
              {schools.map((school) => (
                <option key={school.school_name} value={school.school_name} className="font-khmer">
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
              {language === 'km' ? 'ថ្នាក់' : 'Grade'} <span className="text-muted-foreground text-xs">(Optional)</span>
            </Label>
            <select
              id="grade-filter"
              value={gradeFilter}
              onChange={(e) => {
                setGradeFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{language === 'km' ? 'ទាំងអស់' : 'All Grades'}</option>
              {availableGrades.map((grade) => (
                <option key={grade} value={grade}>
                  {grade}
                </option>
              ))}
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
              onChange={(e) => {
                setRoomFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{language === 'km' ? 'ទាំងអស់' : 'All Classes'}</option>
              {availableRooms.map((room) => (
                <option key={room} value={room}>
                  {room}
                </option>
              ))}
            </select>
          </div>

          {/* Student Type Filter */}
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
              onChange={(e) => {
                setStudentTypeFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-khmer"
            >
              <option value="" className="font-khmer">{language === 'km' ? 'ទាំងអស់' : 'All Types'}</option>
              {availableStudentTypes.map((type) => (
                <option key={type} value={type} className="font-khmer">
                  {type}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search Inputs - Below filters, full width */}
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {/* Search by Name */}
          <div className="w-full space-y-2">
            <Label
              htmlFor="search"
              className={`text-sm font-medium text-primary ${language === 'km' ? 'font-khmer' : ''}`}
            >
              {language === 'km' ? 'ស្វែងរកតាមឈ្មោះ' : 'Search by Name'}
            </Label>
            <Input
              id="search"
              placeholder={language === 'km' ? 'ស្វែងរកតាមឈ្មោះសិស្ស...' : 'Search by student name...'}
              value={searchQuery}
              onChange={(e) => setSearchQueryLocal(e.target.value)}
              className={`w-full ${language === 'km' ? 'font-khmer' : ''}`}
            />
          </div>

          {/* Search by Student ID */}
          <div className="w-full space-y-2">
            <Label
              htmlFor="search-student-id"
              className={`text-sm font-medium text-primary ${language === 'km' ? 'font-khmer' : ''}`}
            >
              {language === 'km' ? 'ស្វែងរកតាមលេខសម្គាល់' : 'Search by ID'}
            </Label>
            <Input
              id="search-student-id"
              placeholder={language === 'km' ? 'ស្វែងរកតាមលេខសម្គាល់សិស្ស...' : 'Search by student ID...'}
              value={studentIdQuery}
              onChange={(e) => setStudentIdQueryLocal(e.target.value)}
              className={`w-full ${language === 'km' ? 'font-khmer' : ''}`}
            />
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="w-full mt-4 flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => {
              // Clear all filters
              setProvinceId('');
              setDistrictName('');
              setSchoolName('');
              setGradeFilter('');
              setRoomFilter('');
              setStudentTypeFilter('');
              setSearchQueryLocal('');
              setStudentIdQueryLocal('');
              setActiveFilters({}); // Clear active filters
              setPage(1);
              // Refetch all data without filters
              fetchAllData();
            }}
            disabled={loading}
            className={`min-w-[120px] ${language === 'km' ? 'font-khmer' : ''}`}
          >
            {language === 'km' ? 'លុបតម្រង' : 'Clear Filters'}
          </Button>
          <Button
            onClick={handleFilterData}
            disabled={loading}
            className={`min-w-[120px] ${language === 'km' ? 'font-khmer' : ''}`}
          >
            {loading ? (
              language === 'km' ? 'កំពុងផ្ទុក...' : 'Loading...'
            ) : (
              language === 'km' ? 'តម្រង' : 'Apply Filters'
            )}
          </Button>
        </div>
      </div>

      {/* ============================================ */}
      {/* SCHOOL SUB-VIEW: Show when province + district selected, school not selected */}
      {/* ============================================ */}
      {showSchoolSubView && (
        <Card>
          <CardContent className="pt-6">
            <div className="mb-4">
              <h2 className={`text-lg font-semibold text-primary ${language === 'km' ? 'font-khmer' : ''}`}>
                {language === 'km' ? 'សាលាក្នុងស្រុក' : 'Schools in District'}
              </h2>
              <p className={`text-sm text-muted-foreground mt-1 ${language === 'km' ? 'font-khmer' : ''}`}>
                {language === 'km' 
                  ? 'ចុចលើសាលាដើម្បីមើលសិស្ស'
                  : 'Click on a school to view students'
                }
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {schoolSummaries.map((school) => (
                <Card
                  key={school.school_name}
                  className={`cursor-pointer transition-colors hover:bg-muted ${
                    selectedSchoolFromView === school.school_name ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => handleSchoolClick(school.school_name)}
                >
                  <CardContent className="pt-4">
                    <h3 className={`font-semibold text-primary mb-2 ${language === 'km' ? 'font-khmer' : ''}`}>
                      {school.school_name}
                    </h3>
                    <p className={`text-sm text-muted-foreground ${language === 'km' ? 'font-khmer' : ''}`}>
                      {school.total_students.toLocaleString()} {language === 'km' ? 'សិស្ស' : 'students'}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className={`text-xl font-bold tracking-tight text-primary ${language === 'km' ? 'font-khmer' : ''}`}>
            {language === 'km' ? 'សិស្ស' : 'Students'}
          </h1>
          <p className={`text-muted-foreground mt-2 text-sm ${language === 'km' ? 'font-khmer' : ''}`}>
            {language === 'km' 
              ? `${t.common.showing} ${totalCount.toLocaleString()} ${language === 'km' ? 'សិស្ស' : 'students'}`
              : `${t.common.showing} ${totalCount.toLocaleString()} students`
            }
          </p>
        </div>
      </div>

      {/* Table Card */}
      <Card>
        <CardContent>
          {loading ? (
            <Loading language={language} />
          ) : students.length > 0 ? (
            <>
              <DataTable
                data={students} // Use paginated students for display
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
                  {t.common.showing} {totalCount === 0 ? 0 : ((page - 1) * perPage) + 1}–{Math.min(page * perPage, totalCount)} {t.common.of} {totalCount}
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
                  
                  <Select
                    value={perPage.toString()}
                    onValueChange={(value) => {
                      setPerPage(parseInt(value, 10));
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className={`w-20 h-9 ${language === 'km' ? 'font-khmer' : ''}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="20" className={language === 'km' ? 'font-khmer' : ''}>20</SelectItem>
                      <SelectItem value="25" className={language === 'km' ? 'font-khmer' : ''}>25</SelectItem>
                      <SelectItem value="50" className={language === 'km' ? 'font-khmer' : ''}>50</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          ) : showNoDataFound ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className={language === 'km' ? 'font-khmer' : ''}>
                {language === 'km' ? 'រកមិនឃើញសិស្ស' : 'No students found'}
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
