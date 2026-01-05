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
import { studentTrackerService, StudentTrackerParams } from '@/lib/api/services/studentTracker.service';
import { resultSubjectsService } from '@/lib/api/services/resultSubjects.service';
import { studentsService } from '@/lib/api';
import { StudentDetail } from '@/lib/api/services/studentDetail.service';

const GRADES = ['7', '8', '9', '10', '11', '12'];
// Note: Subjects are extracted dynamically from API response (row.subjects structure)

export default function StudentTrackerPage() {
  const { t, language } = useLanguage();
  
  // Filter Inputs
  const [provinceId, setProvinceId] = useState<string>('');
  const [districtName, setDistrictName] = useState<string>('');
  const [geipSchoolId, setGeipSchoolId] = useState<string>('');
  const [gradeFilter, setGradeFilter] = useState<string>('');
  const [roomFilter, setRoomFilter] = useState<string>('');

  // Applied Filters
  const [appliedFilters, setAppliedFilters] = useState<StudentTrackerParams | null>(null);

  // Data
  const [rawApiData, setRawApiData] = useState<any[]>([]); // Store raw API data (with row.subjects structure)
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAppliedFilters, setHasAppliedFilters] = useState(false);
  
  // Dropdown Options
  const [provinces] = useState<Array<{ province_id: string; province_name: string }>>(getProvinces());
  const [districts, setDistricts] = useState<Array<{ province_id: string; district_name: string }>>([]);
  const [schools, setSchools] = useState<Array<{ province_id: string; district_name: string; school_name: string; geip_school_ID: string }>>([]);
  const [schoolLoading, setSchoolLoading] = useState(false);
  const [roomOptions, setRoomOptions] = useState<string[]>([]); // Room options from student data

  // Pagination
  const [page, setPage] = useState(1);
  const perPage = 25;
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load Districts
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
        logger.error(`[STUDENT_TRACKER] Failed to fetch districts`, 'STUDENT_TRACKER', error);
        setDistricts([]);
      }
    };
    loadDistricts();
  }, [provinceId]);

  // Load Schools
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
        logger.error(`[STUDENT_TRACKER] Failed to fetch schools`, 'STUDENT_TRACKER', error);
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
        logger.info(`[STUDENT_TRACKER] No room data available for Grade ${gradeFilter} - Room dropdown will be empty`, 'STUDENT_TRACKER');
        setRoomOptions([]);
      }
    };

    loadRoomOptions();
  }, [provinceId, districtName, geipSchoolId, gradeFilter]);

  // Fetch Tracker Data
  const fetchTrackerData = useCallback(async (filters: StudentTrackerParams, pageNum: number) => {
    // Validate required filters - Student Tracker requires: provinceId, districtName, geipSchoolId, gradeName
    // Note: provinceId is required for monthly endpoints
    if (!filters.provinceId || !filters.districtName || !filters.geipSchoolId || !filters.gradeName) {
      if (process.env.NODE_ENV === 'development') {
        logger.warn(`[STUDENT_TRACKER] Missing required filters for fetch: ${JSON.stringify({
          provinceId: !!filters.provinceId,
          districtName: !!filters.districtName,
          geipSchoolId: !!filters.geipSchoolId,
          gradeName: !!filters.gradeName,
        })}`, 'STUDENT_TRACKER');
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
      logger.info(`[STUDENT_TRACKER] View state: INIT → LOADING`, 'STUDENT_TRACKER');
    }

    try {
      const token = getToken();
      if (!token) throw new Error('Authentication required');

      // Fetch raw API data directly (with row.subjects structure)
      const result = await resultSubjectsService.getList(
        token,
        {
          ...filters,
          forceMonthlyEndpoint: true, // Always use monthly endpoints for Student Tracker
        },
        abortController.signal
      );

      if (abortController.signal.aborted) return;

      if (!result.success) {
        // Debug: Log view state transition to ERROR
        if (process.env.NODE_ENV === 'development') {
          logger.info(`[STUDENT_TRACKER] View state: LOADING → ERROR`, 'STUDENT_TRACKER');
        }
        throw new Error(result.error || 'Failed to fetch tracker data');
      }

      // Store raw API data (with row.subjects structure)
      const rawData = Array.isArray(result.data) ? result.data : [];
      
      // Debug logging (dev only)
      if (process.env.NODE_ENV === 'development') {
        logger.info(`[STUDENT_TRACKER] Raw API data length: ${rawData.length}`, 'STUDENT_TRACKER');
        if (rawData.length > 0) {
          const sampleRow = rawData[0] as any;
          logger.info(`[STUDENT_TRACKER] Sample row structure: ${JSON.stringify(Object.keys(sampleRow))}`, 'STUDENT_TRACKER');
          if (sampleRow.subjects) {
            logger.info(`[STUDENT_TRACKER] Sample row.subjects keys: ${Object.keys(sampleRow.subjects).join(', ')}`, 'STUDENT_TRACKER');
          }
        }
        // Log view state transition: LOADING → DATA or EMPTY
        logger.info(`[STUDENT_TRACKER] View state: LOADING → ${rawData.length > 0 ? 'DATA' : 'EMPTY'}`, 'STUDENT_TRACKER');
      }

      setRawApiData(rawData);
      // Stats and monthly comparison not needed - only showing data table
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      const errorMessage = error.message || 'Failed to fetch tracker data';
      logger.error('[STUDENT_TRACKER] Failed to fetch tracker data', 'STUDENT_TRACKER', error);
      setError(errorMessage);
      setRawApiData([]);
      // Debug: Log view state transition to ERROR
      if (process.env.NODE_ENV === 'development') {
        logger.info(`[STUDENT_TRACKER] View state: LOADING → ERROR`, 'STUDENT_TRACKER');
      }
    } finally {
      if (!abortController.signal.aborted) {
        setLoading(false);
      }
    }
  }, [perPage]);

  // Apply Filters
  const handleApplyFilters = useCallback(() => {
    // Validate REQUIRED filters for Student Tracker
    // Required: Province, District, School, Grade
    // Optional: Class (room), Subject
    if (!provinceId || !districtName || !geipSchoolId || !gradeFilter) {
      // Don't block - just don't fetch if required filters missing
      if (process.env.NODE_ENV === 'development') {
        logger.warn(`[STUDENT_TRACKER] Apply Filters clicked but required filters missing`, 'STUDENT_TRACKER');
      }
      setError(null); // Clear any previous errors
      return;
    }

    // Debug: Log Apply Filters clicked
    if (process.env.NODE_ENV === 'development') {
      logger.info(`[STUDENT_TRACKER] Apply Filters clicked`, 'STUDENT_TRACKER');
    }

    const province = provinces.find(p => p.province_id === provinceId);
    
    // Snapshot current filter state (don't rely on live state)
    // CRITICAL: For Student Tracker, we need provinceId (string) for monthly endpoints
    const filterSnapshot: StudentTrackerParams = {
      provinceId: provinceId ? String(provinceId) : undefined, // Use provinceId (as string) for monthly endpoints
      provinceName: province?.province_name, // Keep for compatibility
      districtName: districtName.trim(),
      geipSchoolId: geipSchoolId.trim(),
      gradeName: gradeFilter.trim(),
      // Room filter is OPTIONAL - only include if explicitly selected
      ...(roomFilter && roomFilter.trim() && { room: roomFilter.trim() }),
    };

    // Debug: Log filter snapshot
    if (process.env.NODE_ENV === 'development') {
      logger.info(`[STUDENT_TRACKER] Filter snapshot: ${JSON.stringify({
        provinceName: filterSnapshot.provinceName,
        districtName: filterSnapshot.districtName,
        geipSchoolId: filterSnapshot.geipSchoolId,
        gradeName: filterSnapshot.gradeName,
        room: filterSnapshot.room || '(none - optional)',
      })}`, 'STUDENT_TRACKER');
      logger.info(`[STUDENT_TRACKER] View state: INIT → LOADING (triggered by Apply Filters)`, 'STUDENT_TRACKER');
    }

    // Set state BEFORE calling fetch (so UI updates immediately)
    setAppliedFilters(filterSnapshot);
    setHasAppliedFilters(true);
    setPage(1);
    setError(null); // Clear any previous errors
    setRawApiData([]); // Clear previous data while loading
    
    // Trigger fetch with snapshot (ALWAYS runs if we get here)
    fetchTrackerData(filterSnapshot, 1);
  }, [provinceId, districtName, geipSchoolId, gradeFilter, roomFilter, provinces, fetchTrackerData, language]);

  // Pagination
  useEffect(() => {
    if (appliedFilters && page > 1) {
      fetchTrackerData(appliedFilters, page);
    }
  }, [page, appliedFilters, fetchTrackerData]);

  // Clear Filters
  const handleClearFilters = useCallback(() => {
    setProvinceId('');
    setDistrictName('');
    setGeipSchoolId('');
    setGradeFilter('');
    setRoomFilter('');
    setAppliedFilters(null);
    setHasAppliedFilters(false);
    setRawApiData([]);
    setPage(1);
    setError(null);
    setDistricts([]);
    setSchools([]);
  }, []);

  // Flatten raw API data: Show one row per student per subject (from row.subjects)
  const trackerData = useMemo(() => {
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
          logger.warn(`[STUDENT_TRACKER] Row missing student ID, skipping`, 'STUDENT_TRACKER');
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
      
      if (row.subjects && typeof row.subjects === 'object') {
        Object.keys(row.subjects).forEach((subjectName: string) => {
          const subjectData = row.subjects[subjectName];
          if (!subjectData) return;
          
          // Extract score from subjectData
          const score = typeof subjectData.score === 'number' ? subjectData.score : 0;
          
          // Store exam attempt: 1 if score > 0, 0 if no score
          const examAttempts = score > 0 ? 1 : 0;
          subjects[subjectName] = {
            examAttempts,
            score: score > 0 ? score : 0,
            status: score > 0 ? 'Exam' : 'Not Exam',
          };
        });
      }
      
      processed.push({
        studentId,
        studentName: fullName,
        school: row.school_name,
        grade: row.grade || row.grade_name,
        subjects,
      });
    });
    
    // Debug logging (dev only)
    if (process.env.NODE_ENV === 'development') {
      logger.info(`[STUDENT_TRACKER] Processed tracker data: ${processed.length} students (from ${filtered.length} raw rows)`, 'STUDENT_TRACKER');
      if (processed.length > 0) {
        const sampleStudent = processed[0];
        logger.info(`[STUDENT_TRACKER] Sample student ID: ${sampleStudent.studentId}, Name: ${sampleStudent.studentName}`, 'STUDENT_TRACKER');
        logger.info(`[STUDENT_TRACKER] Sample student subjects: ${Object.keys(sampleStudent.subjects || {}).join(', ')}`, 'STUDENT_TRACKER');
      } else if (filtered.length > 0) {
        // Debug: Check why no students were processed
        const sampleRow = filtered[0] as any;
        logger.warn(`[STUDENT_TRACKER] No students processed. Sample row keys: ${Object.keys(sampleRow).join(', ')}`, 'STUDENT_TRACKER');
        logger.warn(`[STUDENT_TRACKER] Sample row student_ID: ${sampleRow.student_ID}, student_id: ${sampleRow.student_id}, id: ${sampleRow.id}`, 'STUDENT_TRACKER');
      }
    }
    
    return processed;
  }, [rawApiData, appliedFilters?.room]);

  // Extract all unique subject names from aggregated data
  const subjectColumns = useMemo(() => {
    if (!trackerData || trackerData.length === 0) return [];
    
    const subjectSet = new Set<string>();
    trackerData.forEach((student: any) => {
      if (student.subjects && typeof student.subjects === 'object') {
        Object.keys(student.subjects).forEach((subjectName) => {
          subjectSet.add(subjectName);
        });
      }
    });
    
    return Array.from(subjectSet).sort();
  }, [trackerData]);

  // Table Columns: Base columns + dynamic subject columns
  const columns: DataTableColumn<any>[] = useMemo(() => {
    const baseColumns: DataTableColumn<any>[] = [
      { key: 'studentId', label: language === 'km' ? 'លេខសម្គាល់សិស្ស' : 'Student ID' },
      { key: 'studentName', label: language === 'km' ? 'ឈ្មោះសិស្ស' : 'Student Name' },
      { key: 'school', label: language === 'km' ? 'សាលា' : 'School' },
      { key: 'grade', label: language === 'km' ? 'ថ្នាក់' : 'Grade' },
    ];
    
    // Add dynamic subject columns
    // Note: Using a unique key per subject, but accessing data via render function
    const subjectCols: DataTableColumn<any>[] = subjectColumns.map((subjectName) => ({
      key: `subject_${subjectName}` as any, // Unique key for TypeScript
      label: subjectName,
      render: (value: any, row: any) => {
        // Access nested subject data: row.subjects[subjectName].examAttempts
        const subjectData = row.subjects?.[subjectName];
        const examAttempts = subjectData?.examAttempts ?? 0;
        return (
          <span className={examAttempts > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
            {examAttempts}
          </span>
        );
      }
    }));
    
    return [...baseColumns, ...subjectCols];
  }, [language, subjectColumns]);

  const totalPages = Math.ceil(trackerData.length / perPage);
  const pageData = useMemo(() => {
    const startIndex = (page - 1) * perPage;
    const endIndex = startIndex + perPage;
    return trackerData.slice(startIndex, endIndex);
  }, [trackerData, page, perPage]);

  const canApplyFilters = provinceId && districtName && geipSchoolId && gradeFilter;

  return (
    <div className="w-full space-y-6">
      {/* Filter Container */}
      <div className="w-full mt-1 md:mt-2 lg:mt-3 bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-border shadow-sm">
        <div className="p-6 pb-4">
          <h1 className={`text-xl font-bold tracking-tight text-primary ${language === 'km' ? 'font-khmer' : ''}`}>
            {language === 'km' ? 'តម្រងតាមដានសិស្ស' : 'Filter Student Tracker'}
          </h1>
          <p className={`text-muted-foreground mt-2 text-sm ${language === 'km' ? 'font-khmer' : ''}`}>
            {language === 'km' 
              ? 'តាមដានការចូលរួមប្រឡងរបស់សិស្ស'
              : 'Track student exam participation'
            }
          </p>
        </div>

        <div className="px-6 pb-6 border-t border-gray-200 dark:border-border pt-6">
          <div className="w-full grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {/* Province, District, School, Grade, Class filters - same pattern */}
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

          {/* Buttons */}
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
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
            {language === 'km' ? 'តាមដានសិស្ស' : 'Student Tracker'}
          </h1>
          
          {loading ? (
            <Loading language={language} showSkeleton />
          ) : error ? (
            <div className="text-center py-12">
              <p className={`text-red-500 font-medium ${language === 'km' ? 'font-khmer' : ''}`}>{language === 'km' ? 'កំហុស' : 'Error'}</p>
              <p className={`text-muted-foreground mt-2 text-sm ${language === 'km' ? 'font-khmer' : ''}`}>{error}</p>
              <Button
                variant="outline"
                onClick={() => {
                  setError(null);
                  if (appliedFilters) {
                    fetchTrackerData(appliedFilters, page);
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
                {language === 'km' ? 'សូមជ្រើសតម្រងដើម្បីមើលតាមដានសិស្ស' : 'Select Filters to View Student Tracker'}
              </p>
            </div>
          ) : trackerData.length === 0 ? (
            // EMPTY state: After Apply Filters, fetch succeeded, but zero records
            <div className="text-center py-12 text-muted-foreground">
              <p className={`text-lg font-medium mb-2 ${language === 'km' ? 'font-khmer' : ''}`}>
                {language === 'km' ? 'មិនមានទិន្នន័យតាមដានសិស្ស' : 'No student tracker data available'}
              </p>
              <p className={`text-sm ${language === 'km' ? 'font-khmer' : ''}`}>
                {language === 'km' 
                  ? 'មិនមានទិន្នន័យសម្រាប់តម្រងដែលបានជ្រើស។ សូមកែតម្រងឬជ្រើសរយៈពេលផ្សេង។'
                  : 'There is no tracker data for the selected filters. Please adjust filters or select a different period.'
                }
              </p>
            </div>
          ) : pageData.length > 0 ? (
            <>
              <DataTable data={pageData} columns={columns} getRowKey={(row, index) => row.studentId || `row-${index}`} />
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className={`text-sm text-muted-foreground ${language === 'km' ? 'font-khmer' : ''}`}>
                  {t.common.showing} {((page - 1) * perPage) + 1}–{Math.min(page * perPage, trackerData.length)} {t.common.of} {trackerData.length}
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
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p className={`text-lg font-medium mb-2 ${language === 'km' ? 'font-khmer' : ''}`}>{language === 'km' ? 'រកមិនឃើញទិន្នន័យ' : 'No Data Found'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
