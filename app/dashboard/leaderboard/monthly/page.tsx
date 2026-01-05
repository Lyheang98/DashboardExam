'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/i18n/context';
import { Loading } from '@/components/ui/Loading';
import { DataTable, DataTableColumn } from '@/components/dashboard/DataTable';
import { logger } from '@/lib/logger';
import { EXTERNAL_ENDPOINTS } from '@/lib/api/config';
import { apiClient } from '@/lib/api/client';
import { getToken } from '@/lib/auth';
import { getProvinces } from '@/lib/constants/provinces';
import { resultSubjectsService, ResultSubjectsParams } from '@/lib/api/services/resultSubjects.service';
import { studentsService } from '@/lib/api';
import { StudentDetail } from '@/lib/api/services/studentDetail.service';

const GRADES = ['7', '8', '9', '10', '11', '12'];
// Note: Subjects are extracted dynamically from API response (Khmer keys)
const MONTHS = [
  { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
  { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' },
  { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' },
  { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' },
];

// localStorage keys for persisting leaderboard data
const STORAGE_KEYS = {
  DATA: 'leaderboard_monthly_data',
  FILTERS: 'leaderboard_monthly_filters',
  HAS_DATA: 'leaderboard_monthly_has_data',
} as const;

// Helper functions for localStorage persistence
function saveLeaderboardData(data: any[], filters: ResultSubjectsParams | null, hasData: boolean) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.DATA, JSON.stringify(data));
    localStorage.setItem(STORAGE_KEYS.FILTERS, JSON.stringify(filters));
    localStorage.setItem(STORAGE_KEYS.HAS_DATA, JSON.stringify(hasData));
    if (process.env.NODE_ENV === 'development') {
      logger.info(`[LEADERBOARD] Saved data to localStorage (${data.length} records)`, 'LEADERBOARD');
    }
  } catch (error) {
    logger.error('[LEADERBOARD] Failed to save data to localStorage', 'LEADERBOARD', error);
  }
}

function loadLeaderboardData(): {
  data: any[];
  filters: ResultSubjectsParams | null;
  hasData: boolean;
} {
  if (typeof window === 'undefined') {
    return { data: [], filters: null, hasData: false };
  }
  try {
    const dataStr = localStorage.getItem(STORAGE_KEYS.DATA);
    const filtersStr = localStorage.getItem(STORAGE_KEYS.FILTERS);
    const hasDataStr = localStorage.getItem(STORAGE_KEYS.HAS_DATA);
    
    const data = dataStr ? JSON.parse(dataStr) : [];
    const filters = filtersStr ? JSON.parse(filtersStr) : null;
    const hasData = hasDataStr ? JSON.parse(hasDataStr) : false;
    
    if (process.env.NODE_ENV === 'development' && data.length > 0) {
      logger.info(`[LEADERBOARD] Loaded data from localStorage (${data.length} records)`, 'LEADERBOARD');
    }
    
    return { data, filters, hasData };
  } catch (error) {
    logger.error('[LEADERBOARD] Failed to load data from localStorage', 'LEADERBOARD', error);
    return { data: [], filters: null, hasData: false };
  }
}

function clearLeaderboardData() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEYS.DATA);
    localStorage.removeItem(STORAGE_KEYS.FILTERS);
    localStorage.removeItem(STORAGE_KEYS.HAS_DATA);
    if (process.env.NODE_ENV === 'development') {
      logger.info('[LEADERBOARD] Cleared data from localStorage', 'LEADERBOARD');
    }
  } catch (error) {
    logger.error('[LEADERBOARD] Failed to clear data from localStorage', 'LEADERBOARD', error);
  }
}

export default function LeaderboardMonthlyPage() {
  const { t, language } = useLanguage();
  
  const [provinceId, setProvinceId] = useState<string>('');
  const [districtName, setDistrictName] = useState<string>('');
  const [geipSchoolId, setGeipSchoolId] = useState<string>('');
  const [gradeFilter, setGradeFilter] = useState<string>('');
  const [roomFilter, setRoomFilter] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const [appliedFilters, setAppliedFilters] = useState<ResultSubjectsParams | null>(null);
  const [rawApiData, setRawApiData] = useState<any[]>([]); // Store raw API data (with row.subjects structure)
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAppliedFilters, setHasAppliedFilters] = useState(false);
  
  const [provinces] = useState<Array<{ province_id: string; province_name: string }>>(getProvinces());
  const [districts, setDistricts] = useState<Array<{ province_id: string; district_name: string }>>([]);
  const [schools, setSchools] = useState<Array<{ province_id: string; district_name: string; school_name: string; geip_school_ID: string }>>([]);
  const [schoolLoading, setSchoolLoading] = useState(false);
  const [roomOptions, setRoomOptions] = useState<string[]>([]); // Room options from student data

  const [page, setPage] = useState(1);
  const perPage = 25;
  const abortControllerRef = useRef<AbortController | null>(null);
  const isInitialMount = useRef(true);

  // Load persisted data from localStorage on mount
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      const persisted = loadLeaderboardData();
      if (persisted.data.length > 0 && persisted.filters) {
        setRawApiData(persisted.data);
        setAppliedFilters(persisted.filters);
        setHasAppliedFilters(persisted.hasData);
        
        // Restore filter state from persisted filters (optional - for better UX)
        if (persisted.filters.provinceId) {
          setProvinceId(String(persisted.filters.provinceId));
        }
        if (persisted.filters.districtName) {
          setDistrictName(persisted.filters.districtName);
        }
        if (persisted.filters.geipSchoolId) {
          setGeipSchoolId(persisted.filters.geipSchoolId);
        }
        if (persisted.filters.gradeName) {
          setGradeFilter(persisted.filters.gradeName);
        }
        if (persisted.filters.room) {
          setRoomFilter(persisted.filters.room);
        }
        if (persisted.filters.month) {
          setSelectedMonth(persisted.filters.month);
        }
        if (persisted.filters.year) {
          setSelectedYear(persisted.filters.year);
        }
        
        if (process.env.NODE_ENV === 'development') {
          logger.info('[LEADERBOARD] Restored data and filters from localStorage', 'LEADERBOARD');
        }
      }
    }
  }, []); // Only run on mount

  // Load Districts and Schools (same as All page)
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
        if (!token) return;
        const lookupUrl = EXTERNAL_ENDPOINTS.DISTRICTS.LOOKUP(provinceId);
        const response = await apiClient.get(lookupUrl, { token });
        if (response.success) {
          const data = response.data as any;
          const districtsData = data?.results || data?.data || (Array.isArray(data) ? data : []);
          const uniqueDistricts = districtsData
            .map((d: any) => ({
              province_id: d.province_id || d.province_ID || provinceId,
              district_name: d.district_name || d.district_Name || d.name || '',
            }))
            .filter((d: any) => d.district_name && d.district_name.trim())
            .sort((a: any, b: any) => a.district_name.localeCompare(b.district_name));
          setDistricts(uniqueDistricts);
        }
      } catch (error: any) {
        logger.error(`[LEADERBOARD] Failed to fetch districts`, 'LEADERBOARD', error);
        setDistricts([]);
      }
    };
    loadDistricts();
  }, [provinceId]);

  useEffect(() => {
    if (!provinceId || !districtName) {
      setSchools([]);
      setGeipSchoolId('');
      return;
    }

    const loadSchools = async () => {
      setSchoolLoading(true);
      try {
        const token = getToken();
        if (!token) return;
        const lookupUrl = EXTERNAL_ENDPOINTS.SCHOOLS_LOOKUP.LIST(provinceId, districtName);
        const response = await apiClient.get(lookupUrl, { token });
        if (response.success) {
          const data = response.data as any;
          const schoolsData = data?.results || data?.data || (Array.isArray(data) ? data : []);
          const uniqueSchools = schoolsData
            .map((s: any) => ({
              province_id: s.province_id || s.province_ID || provinceId,
              district_name: s.district_name || s.district_Name || districtName,
              school_name: s.school_name || s.school_Name || s.name || '',
              geip_school_ID: s.geip_school_ID || s.geip_school_id || s.school_id || s.school_ID || s.id || '',
            }))
            .filter((s: any) => s.school_name && s.school_name.trim())
            .sort((a: any, b: any) => a.school_name.localeCompare(b.school_name));
          setSchools(uniqueSchools);
        }
      } catch (error: any) {
        logger.error(`[LEADERBOARD] Failed to fetch schools`, 'LEADERBOARD', error);
        setSchools([]);
      } finally {
        setSchoolLoading(false);
      }
    };
    loadSchools();
  }, [provinceId, districtName]);

  // Load Room Options when Grade is selected
  useEffect(() => {
    if (!provinceId || !districtName || !geipSchoolId || !gradeFilter) {
      setRoomOptions([]);
      return;
    }

    const loadRoomOptions = async () => {
      try {
        const token = getToken();
        if (!token) return;

        // Fetch students using BY_GRADE endpoint to get room options
        const result = await studentsService.getList(
          token,
          {
            provinceId: provinceId.trim(),
            districtId: districtName.trim(),
            schoolId: geipSchoolId.trim(),
            grade: gradeFilter.trim(),
            page: 1,
            size: 100, // Fetch enough to get all unique rooms
          }
        );

        if (!result.success || !result.data) {
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
      } catch (error: any) {
        logger.info(`[LEADERBOARD] No room data available for Grade ${gradeFilter} - Room dropdown will be empty`, 'LEADERBOARD');
        setRoomOptions([]);
      }
    };

    loadRoomOptions();
  }, [provinceId, districtName, geipSchoolId, gradeFilter]);

  const fetchLeaderboard = useCallback(async (filters: ResultSubjectsParams, pageNum: number) => {
    // Validate required filters - if missing, log and return early
    // Monthly requires: provinceId, districtName, geipSchoolId, gradeName, month, year
    if (!filters.provinceId || !filters.districtName || !filters.geipSchoolId || !filters.gradeName || !filters.month || !filters.year) {
      if (process.env.NODE_ENV === 'development') {
        logger.warn(`[LEADERBOARD] Missing required filters for monthly fetch: ${JSON.stringify({
          provinceId: !!filters.provinceId,
          districtName: !!filters.districtName,
          geipSchoolId: !!filters.geipSchoolId,
          gradeName: !!filters.gradeName,
          month: !!filters.month,
          year: !!filters.year,
        })}`, 'LEADERBOARD');
      }
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setLoading(true);
    setError(null);

    // Debug: Log view state transition to LOADING
    if (process.env.NODE_ENV === 'development') {
      logger.info(`[LEADERBOARD] View state: INIT → LOADING`, 'LEADERBOARD');
    }

    try {
      const token = getToken();
      if (!token) throw new Error('Authentication required');

      // Use resultSubjectsService directly to get raw API data (like Student Tracker)
      // Fetch all data - set a high limit to get all records
      const result = await resultSubjectsService.getList(
        token,
        {
          ...filters,
          month: filters.month!,
          year: filters.year!,
          forceMonthlyEndpoint: true, // Always use monthly endpoints for analytics pages
          limit: 10000, // Set high limit to fetch all data (pagination handled client-side)
        },
        abortController.signal
      );

      if (abortController.signal.aborted) return;

      // Handle API error (request failed - network, 4xx, 5xx)
      if (!result.success) {
        // Debug: Log view state transition to ERROR
        if (process.env.NODE_ENV === 'development') {
          logger.info(`[LEADERBOARD] View state: LOADING → ERROR`, 'LEADERBOARD');
        }
        throw new Error(result.error || 'Failed to fetch leaderboard');
      }

      // Request succeeded - store raw API data (with row.subjects structure)
      const rawData = Array.isArray(result.data) ? result.data : [];
      
      // Debug logging (dev only) - Log the month/year being fetched
      if (process.env.NODE_ENV === 'development') {
        logger.info(`[LEADERBOARD] Fetched data for month=${filters.month}, year=${filters.year}`, 'LEADERBOARD');
        logger.info(`[LEADERBOARD] Raw API data length: ${rawData.length}`, 'LEADERBOARD');
        if (rawData.length > 0) {
          // Log sample row structure
          const sampleRow = rawData[0] as any;
          logger.info(`[LEADERBOARD] Sample row structure: ${JSON.stringify(Object.keys(sampleRow))}`, 'LEADERBOARD');
          // Check if row has exam_month/exam_year fields to verify filtering
          if (sampleRow.exam_month || sampleRow.exam_year) {
            logger.info(`[LEADERBOARD] Sample row exam_month=${sampleRow.exam_month}, exam_year=${sampleRow.exam_year}`, 'LEADERBOARD');
          }
          if (sampleRow.subjects) {
            logger.info(`[LEADERBOARD] Sample row.subjects keys: ${Object.keys(sampleRow.subjects).join(', ')}`, 'LEADERBOARD');
          }
        }
        // Log view state transition: LOADING → DATA or EMPTY
        logger.info(`[LEADERBOARD] View state: LOADING → ${rawData.length > 0 ? 'DATA' : 'EMPTY'}`, 'LEADERBOARD');
      }
      
      // Store raw API data (replace old data with new fetch results)
      setRawApiData(rawData);
      
      // Persist data to localStorage so it survives page navigation
      saveLeaderboardData(rawData, filters, true);

      setError(null); // Clear any previous errors
      
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      // Only set error for actual failures (network, 4xx, 5xx)
      const errorMessage = error.message || 'Failed to fetch leaderboard';
      logger.error('[LEADERBOARD] Failed to fetch leaderboard', 'LEADERBOARD', error);
      setError(errorMessage);
      // NOTE: Keep old data visible even on error (don't clear it)
      // This way users can still see previous results if fetch fails
      // Debug: Log view state transition to ERROR
      if (process.env.NODE_ENV === 'development') {
        logger.info(`[LEADERBOARD] View state: LOADING → ERROR (keeping previous data)`, 'LEADERBOARD');
      }
    } finally {
      if (!abortController.signal.aborted) {
        setLoading(false);
      }
    }
  }, [perPage]);

  const handleApplyFilters = useCallback(() => {
    // Validate REQUIRED filters for Monthly Leaderboard
    // Required: Province, District, School, Grade, Month, Year
    // Optional: Class (room), Subject
    if (!provinceId || !districtName || !geipSchoolId || !gradeFilter || !selectedMonth || !selectedYear) {
      // Don't block - just don't fetch if required filters missing
      if (process.env.NODE_ENV === 'development') {
        logger.warn(`[LEADERBOARD] Apply Filters clicked but required filters missing`, 'LEADERBOARD');
      }
      setError(null); // Clear any previous errors
      return;
    }

    // Debug: Log Apply Filters clicked
    if (process.env.NODE_ENV === 'development') {
      logger.info(`[LEADERBOARD] Apply Filters clicked`, 'LEADERBOARD');
    }

    const province = provinces.find(p => p.province_id === provinceId);
    
    // Normalize types before creating filters
    const normalizedProvinceId = provinceId ? String(provinceId) : undefined;
    const normalizedMonth = selectedMonth ? Number(selectedMonth) : undefined;
    const normalizedYear = selectedYear ? Number(selectedYear) : undefined;
    const normalizedGrade = gradeFilter.trim();
    
    // Snapshot current filter state (don't rely on live state)
    const filterSnapshot: ResultSubjectsParams = {
      // For monthly endpoints, use provinceId (string representation of number)
      provinceId: normalizedProvinceId,
      provinceName: province?.province_name, // Keep for backward compatibility
      districtName: districtName.trim(),
      geipSchoolId: geipSchoolId.trim(),
      gradeName: normalizedGrade,
      month: normalizedMonth,
      year: normalizedYear,
      // Room filter is OPTIONAL - only include if explicitly selected
      ...(roomFilter && roomFilter.trim() && { room: roomFilter.trim() }),
    };

    // Debug: Log filter snapshot
    if (process.env.NODE_ENV === 'development') {
      logger.info(`[LEADERBOARD] Filter snapshot: ${JSON.stringify({
        provinceId: normalizedProvinceId,
        districtName: districtName.trim(),
        geipSchoolId: geipSchoolId.trim(),
        gradeName: normalizedGrade,
        room: roomFilter || '(none - optional)',
        month: normalizedMonth,
        year: normalizedYear,
      })}`, 'LEADERBOARD');
      logger.info(`[LEADERBOARD] Current gradeFilter state: "${gradeFilter}", normalizedGrade: "${normalizedGrade}"`, 'LEADERBOARD');
      logger.info(`[LEADERBOARD] View state: INIT → LOADING (triggered by Apply Filters)`, 'LEADERBOARD');
    }

    // Set state BEFORE calling fetch (so UI updates immediately)
    setAppliedFilters(filterSnapshot);
    setHasAppliedFilters(true);
    setPage(1);
    setError(null); // Clear any previous errors
    // NOTE: Keep old data visible while fetching new data (better UX)
    // Old data will be replaced when new fetch succeeds (and persisted to localStorage)
    
    // Debug: Log the month/year being used for the fetch
    if (process.env.NODE_ENV === 'development') {
      logger.info(`[LEADERBOARD] Applying filters with month=${normalizedMonth}, year=${normalizedYear}`, 'LEADERBOARD');
    }
    
    // Trigger fetch with snapshot (ONLY when Apply Filters button is clicked)
    // Old data will remain visible until new data is fetched
    fetchLeaderboard(filterSnapshot, 1);
  }, [provinceId, districtName, geipSchoolId, gradeFilter, roomFilter, selectedMonth, selectedYear, provinces, fetchLeaderboard, language]);

  useEffect(() => {
    if (appliedFilters && page > 1) {
      fetchLeaderboard(appliedFilters, page);
    }
  }, [page, appliedFilters, fetchLeaderboard]);

  // NOTE: We intentionally do NOT clear data when filters change
  // Data persists until user clicks "Clear Filters" or applies new filters
  // This allows users to see the previous data while adjusting filters

  const handleClearFilters = useCallback(() => {
    setProvinceId('');
    setDistrictName('');
    setGeipSchoolId('');
    setGradeFilter('');
    setRoomFilter('');
    setSelectedMonth(new Date().getMonth() + 1);
    setSelectedYear(new Date().getFullYear());
    setAppliedFilters(null);
    setHasAppliedFilters(false);
    setRawApiData([]);
    setPage(1);
    setError(null);
    setDistricts([]);
    setSchools([]);
  }, []);

  // Aggregate raw API data by studentId: API returns one row per student per subject
  const leaderboardData = useMemo(() => {
    if (!rawApiData || rawApiData.length === 0) return [];
    
    let filtered = rawApiData;
    
    // Apply room/class filter with exact matching
    if (appliedFilters?.room && appliedFilters.room.trim()) {
      const filterRoom = appliedFilters.room.trim();
      filtered = filtered.filter((row: any) => {
        const entryRoom = (row.room || row.class || '').toString().trim();
        return entryRoom === filterRoom;
      });
    }
    
    // Process rows: API returns one row per student with subjects object
    // Each row already has student_ID and subjects object
    const processed: any[] = [];
    
    filtered.forEach((row: any) => {
      // API uses student_ID (uppercase), also check lowercase variants
      const studentId = row.student_ID || row.student_id || row.id?.toString() || '';
      if (!studentId) {
        if (process.env.NODE_ENV === 'development') {
          logger.warn(`[LEADERBOARD] Row missing student ID, skipping`, 'LEADERBOARD');
        }
        return;
      }
      
      // API may use first_name + last_name, or student_name variants
      const firstName = row.first_name || '';
      const lastName = row.last_name || '';
      const fullName = firstName && lastName 
        ? `${firstName} ${lastName}`.trim()
        : (row.student_name || row.student_name_en || row.student_name_km || '');
      
      // Process subjects object from row
      const subjects: any = {};
      let totalScore = 0;
      
      if (row.subjects && typeof row.subjects === 'object') {
        Object.keys(row.subjects).forEach((subjectName: string) => {
          const subjectData = row.subjects[subjectName];
          if (!subjectData) return;
          
          // Extract score from subjectData
          // subjectData might be a number directly, or an object with score property
          let score = 0;
          if (typeof subjectData === 'number') {
            score = subjectData;
          } else if (typeof subjectData === 'object') {
            score = typeof subjectData.score === 'number' ? subjectData.score : 0;
          }
          
          // Merge subject score into subjects object
          subjects[subjectName] = {
            score,
            ...(typeof subjectData === 'object' && subjectData.max_score && { max_score: subjectData.max_score }),
            ...(typeof subjectData === 'object' && subjectData.level && { level: subjectData.level }),
            ...(typeof subjectData === 'object' && subjectData.result && { result: subjectData.result }),
          };
          
          // Add to totalScore
          totalScore += score;
        });
      }
      
      // Debug: Log first student's subject data structure (dev only)
      if (process.env.NODE_ENV === 'development' && processed.length === 0) {
        const firstSubjectKey = row.subjects ? Object.keys(row.subjects)[0] : null;
        if (firstSubjectKey) {
          const firstSubjectData = row.subjects[firstSubjectKey];
          logger.info(`[LEADERBOARD] Sample subject data structure for "${firstSubjectKey}": ${JSON.stringify(firstSubjectData)} (type: ${typeof firstSubjectData})`, 'LEADERBOARD');
        }
      }
      
      processed.push({
        studentId,
        studentName: fullName,
        gender: row.gender,
        grade: row.grade || row.grade_name,
        class: row.class || row.room,
        room: row.room || row.class,
        school: row.school_name,
        subjects,
        totalScore,
        rank: 0, // Will be calculated after sorting
      });
    });
    
    // Sort by totalScore DESC, then assign ranks
    const sorted = processed.sort((a, b) => b.totalScore - a.totalScore);
    const ranked = sorted.map((row, index) => ({
      ...row,
      rank: index + 1,
    }));
    
    // Debug logging (dev only)
    if (process.env.NODE_ENV === 'development') {
      logger.info(`[LEADERBOARD] Processed leaderboard data: ${ranked.length} students (from ${filtered.length} raw rows)`, 'LEADERBOARD');
      if (ranked.length > 0) {
        const sampleStudent = ranked[0];
        logger.info(`[LEADERBOARD] Sample student ID: ${sampleStudent.studentId}, Name: ${sampleStudent.studentName}, Total Score: ${sampleStudent.totalScore}`, 'LEADERBOARD');
        logger.info(`[LEADERBOARD] Sample student subjects: ${Object.keys(sampleStudent.subjects || {}).join(', ')}`, 'LEADERBOARD');
        
        // Log detailed score breakdown for sample student
        if (sampleStudent.subjects && Object.keys(sampleStudent.subjects).length > 0) {
          const subjectScores = Object.entries(sampleStudent.subjects).map(([name, data]: [string, any]) => 
            `${name}: ${data.score || 0}`
          ).join(', ');
          logger.info(`[LEADERBOARD] Sample student subject scores: ${subjectScores}`, 'LEADERBOARD');
        }
        
        // Check if any students have non-zero scores
        const studentsWithScores = ranked.filter(s => s.totalScore > 0);
        logger.info(`[LEADERBOARD] Students with non-zero scores: ${studentsWithScores.length} out of ${ranked.length}`, 'LEADERBOARD');
        if (studentsWithScores.length > 0) {
          const topStudent = studentsWithScores[0];
          logger.info(`[LEADERBOARD] Top student: ${topStudent.studentName} (ID: ${topStudent.studentId}) with Total Score: ${topStudent.totalScore}`, 'LEADERBOARD');
        }
      }
    }
    
    return ranked;
  }, [rawApiData, appliedFilters?.room]);

  // Extract all unique subject names from leaderboard data
  const subjectColumns = useMemo(() => {
    if (!leaderboardData || leaderboardData.length === 0) return [];
    
    const subjectSet = new Set<string>();
    leaderboardData.forEach((student: any) => {
      if (student.subjects && typeof student.subjects === 'object') {
        Object.keys(student.subjects).forEach((subjectName) => {
          subjectSet.add(subjectName);
        });
      }
    });
    
    return Array.from(subjectSet).sort();
  }, [leaderboardData]);

  // Table Columns: Base columns + dynamic subject columns
  const columns: DataTableColumn<any>[] = useMemo(() => {
    const baseColumns: DataTableColumn<any>[] = [
      { key: 'studentId', label: language === 'km' ? 'លេខសម្គាល់សិស្ស' : 'Student ID' },
      { key: 'studentName', label: language === 'km' ? 'ឈ្មោះសិស្ស' : 'Student Name' },
      { key: 'gender', label: language === 'km' ? 'ភេទ' : 'Gender' },
      { key: 'grade', label: language === 'km' ? 'ថ្នាក់' : 'Grade' },
      { key: 'class', label: language === 'km' ? 'បន្ទប់' : 'Class' },
      { key: 'school', label: language === 'km' ? 'សាលា' : 'School' },
    ];
    
    // Add dynamic subject columns
    const subjectCols: DataTableColumn<any>[] = subjectColumns.map((subjectName) => ({
      key: `subject_${subjectName}` as any, // Unique key for TypeScript
      label: subjectName,
      render: (value: any, row: any) => {
        // Access nested subject data: row.subjects[subjectName].score
        const subjectData = row.subjects?.[subjectName];
        const score = subjectData?.score ?? 0;
        return (
          <span className={score > 0 ? 'text-gray-900 dark:text-gray-100' : 'text-red-600 dark:text-red-400'}>
            {score}
          </span>
        );
      }
    }));
    
    return [...baseColumns, ...subjectCols];
  }, [language, subjectColumns]);

  const totalPages = Math.ceil(leaderboardData.length / perPage);
  const pageData = useMemo(() => {
    const startIndex = (page - 1) * perPage;
    const endIndex = startIndex + perPage;
    return leaderboardData.slice(startIndex, endIndex);
  }, [leaderboardData, page, perPage]);

  // Require Province, District, School, Grade, Month, Year (Class/Room is optional)
  const canApplyFilters = provinceId && districtName && geipSchoolId && gradeFilter && selectedMonth && selectedYear;
  const monthName = MONTHS.find(m => m.value === selectedMonth)?.label || '';

  return (
    <div className="w-full space-y-6">
      {/* Filter Container */}
      <div className="w-full mt-1 md:mt-2 lg:mt-3 bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-border shadow-sm">
        <div className="p-6 pb-4">
          <h1 className={`text-xl font-bold tracking-tight text-primary ${language === 'km' ? 'font-khmer' : ''}`}>
            {language === 'km' ? 'តម្រងកំពូលប្រចាំខែ' : 'Filter Monthly Leaderboard'}
          </h1>
          <p className={`text-muted-foreground mt-2 text-sm ${language === 'km' ? 'font-khmer' : ''}`}>
            {language === 'km' 
              ? 'មើលលំដាប់ចំណាត់ថ្នាក់សិស្សប្រចាំខែ'
              : 'View student rankings by month'
            }
          </p>
        </div>

        <div className="px-6 pb-6 border-t border-gray-200 dark:border-border pt-6">
          <div className="w-full grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {/* Province, District, School, Grade, Class filters - same as All page */}
            <div className="space-y-2">
              <Label htmlFor="province-filter" className={`text-sm font-medium text-primary ${language === 'km' ? 'font-khmer' : ''}`}>
                {language === 'km' ? 'ខេត្ត' : 'Province'} <span className="text-red-500">*</span>
              </Label>
              <select
                id="province-filter"
                value={provinceId}
                onChange={(e) => setProvinceId(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-khmer"
              >
                <option value="" className="font-khmer">{language === 'km' ? 'ជ្រើសខេត្ត...' : 'Select province...'}</option>
                {provinces.map((province) => (
                  <option key={province.province_id} value={province.province_id} className="font-khmer">
                    {province.province_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="district-filter" className={`text-sm font-medium text-primary ${language === 'km' ? 'font-khmer' : ''}`}>
                {language === 'km' ? 'ស្រុក' : 'District'} <span className="text-red-500">*</span>
              </Label>
              <select
                id="district-filter"
                value={districtName}
                onChange={(e) => setDistrictName(e.target.value)}
                disabled={!provinceId}
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-khmer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="" className="font-khmer">{language === 'km' ? 'ជ្រើសស្រុក...' : 'Select district...'}</option>
                {districts.map((district) => (
                  <option key={`${district.province_id}:${district.district_name}`} value={district.district_name} className="font-khmer">
                    {district.district_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="school-filter" className={`text-sm font-medium text-primary ${language === 'km' ? 'font-khmer' : ''}`}>
                {language === 'km' ? 'សាលា' : 'School'} <span className="text-red-500">*</span>
              </Label>
              <select
                id="school-filter"
                value={geipSchoolId}
                onChange={(e) => setGeipSchoolId(e.target.value)}
                disabled={!provinceId || !districtName || schoolLoading}
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-khmer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="" className="font-khmer">
                  {schoolLoading ? (language === 'km' ? 'កំពុងផ្ទុក...' : 'Loading...') : (language === 'km' ? 'ជ្រើសសាលា...' : 'Select school...')}
                </option>
                {schools.map((school) => (
                  <option key={`${school.province_id}:${school.district_name}:${school.geip_school_ID}`} value={school.geip_school_ID} className="font-khmer">
                    {school.school_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="grade-filter" className={`text-sm font-medium text-primary ${language === 'km' ? 'font-khmer' : ''}`}>
                {language === 'km' ? 'ថ្នាក់' : 'Grade'} <span className="text-red-500">*</span>
              </Label>
              <select
                id="grade-filter"
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value)}
                disabled={!geipSchoolId}
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-khmer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="" className="font-khmer">{language === 'km' ? 'ជ្រើសថ្នាក់...' : 'Select grade...'}</option>
                {GRADES.map((grade) => (
                  <option key={grade} value={grade} className="font-khmer">
                    {language === 'km' ? `ថ្នាក់ទី${grade}` : `Grade ${grade}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="room-filter" className={`text-sm font-medium text-primary ${language === 'km' ? 'font-khmer' : ''}`}>
                {language === 'km' ? 'បន្ទប់' : 'Class'}
              </Label>
              <select
                id="room-filter"
                value={roomFilter}
                onChange={(e) => setRoomFilter(e.target.value)}
                disabled={!gradeFilter}
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-khmer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="" className="font-khmer">{language === 'km' ? 'ជ្រើសបន្ទប់...' : 'Select class...'}</option>
                {roomOptions.map((room) => (
                  <option key={room} value={room} className="font-khmer">
                    {room}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Month, Year Filters and Buttons */}
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="month-filter" className={`text-sm font-medium text-primary ${language === 'km' ? 'font-khmer' : ''}`}>
                {language === 'km' ? 'ខែ' : 'Month'} <span className="text-red-500">*</span>
              </Label>
              <select
                id="month-filter"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {MONTHS.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="year-filter" className={`text-sm font-medium text-primary ${language === 'km' ? 'font-khmer' : ''}`}>
                {language === 'km' ? 'ឆ្នាំ' : 'Year'} <span className="text-red-500">*</span>
              </Label>
              <input
                id="year-filter"
                type="number"
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value) || new Date().getFullYear())}
                min="2020"
                max="2030"
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

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

            <div className="w-full">
              <Button
                onClick={handleApplyFilters}
                disabled={loading || !canApplyFilters}
                className={`w-full h-10 ${language === 'km' ? 'font-khmer' : ''}`}
              >
                {loading ? (language === 'km' ? 'កំពុងផ្ទុក...' : 'Loading...') : (language === 'km' ? 'តម្រង' : 'Apply Filters')}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="w-full bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-border shadow-sm">
        <div className="p-6">
          <h1 className={`text-xl font-bold tracking-tight text-primary mb-4 ${language === 'km' ? 'font-khmer' : ''}`}>
            {language === 'km' ? 'កំពូលប្រចាំខែ' : 'Monthly Leaderboard'}
          </h1>
          
          {loading ? (
            <Loading language={language} showSkeleton />
          ) : error ? (
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
                    fetchLeaderboard(appliedFilters, page);
                  }
                }}
                className={`mt-4 ${language === 'km' ? 'font-khmer' : ''}`}
              >
                {language === 'km' ? 'ព្យាយាមម្តងទៀត' : 'Try Again'}
              </Button>
            </div>
          ) : !hasAppliedFilters ? (
            // INIT state: Before Apply Filters is clicked
            <div className="text-center py-12 text-muted-foreground">
              <p className={`text-lg font-medium mb-2 ${language === 'km' ? 'font-khmer' : ''}`}>
                {language === 'km' ? 'សូមជ្រើសតម្រងដើម្បីមើលកំពូល' : 'Select Filters to View Leaderboard'}
              </p>
              <p className={`text-sm ${language === 'km' ? 'font-khmer' : ''}`}>
                {language === 'km' 
                  ? 'សូមជ្រើសខេត្ត ស្រុក សាលា ថ្នាក់ ខែ និងឆ្នាំ (ត្រូវការ) បន្ទាប់មកចុច "តម្រង"'
                  : 'Please select Province, District, School, Grade, Month, and Year (required), then click "Apply Filters"'
                }
              </p>
            </div>
          ) : leaderboardData.length === 0 ? (
            // EMPTY state: No data for the selected month
            <div className="text-center py-12 text-muted-foreground">
              <p className={`text-lg font-medium mb-2 ${language === 'km' ? 'font-khmer' : ''}`}>
                {language === 'km' 
                  ? `មិនមានទិន្នន័យកំពូលសម្រាប់ខែ ${monthName} ${selectedYear}`
                  : `No leaderboard data available for ${monthName} ${selectedYear}`
                }
              </p>
              <p className={`text-sm ${language === 'km' ? 'font-khmer' : ''}`}>
                {language === 'km' 
                  ? 'មិនមានទិន្នន័យកំពូលសម្រាប់ខែនេះ។ សូមជ្រើសរើសខែផ្សេងទៀត។'
                  : 'No data available for this month. Please select a different month.'
                }
              </p>
            </div>
          ) : pageData.length > 0 ? (
            <>
              <DataTable data={pageData} columns={columns} getRowKey={(row, index) => row.studentId || `row-${index}`} />
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className={`text-sm text-muted-foreground ${language === 'km' ? 'font-khmer' : ''}`}>
                  {t.common.showing} {((page - 1) * perPage) + 1}–{Math.min(page * perPage, leaderboardData.length)} {t.common.of} {leaderboardData.length}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || loading || totalPages === 0} className={language === 'km' ? 'font-khmer' : ''}>
                    {t.common.prev}
                  </Button>
                  <div className={`px-3 text-sm text-muted-foreground ${language === 'km' ? 'font-khmer' : ''}`}>
                    {t.common.page} {page} {t.common.of} {totalPages || 1}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages || loading || totalPages === 0} className={language === 'km' ? 'font-khmer' : ''}>
                    {t.common.next}
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
