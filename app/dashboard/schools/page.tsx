"use client";

/**
 * Schools Management Page
 *
 * This page provides a comprehensive schools management interface with:
 * - Real-time school search and filtering by province, district, school type, and target status
 * - Pagination support for large school catalogs
 * - View school details
 * - Performance optimizations for smooth scaling with large datasets
 *
 * Performance Features:
 * - Search debouncing (500ms) to reduce API calls
 * - useCallback hooks to prevent unnecessary re-renders
 * - useMemo for expensive calculations and pagination
 * - Only renders visible items (paginated data)
 */

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable, DataTableColumn } from "@/components/dashboard/DataTable";
import { logger } from "@/lib/logger";
import { useLanguage } from "@/lib/i18n/context";
import { getToken } from "@/lib/auth";
import { Loading } from "@/components/ui/Loading";
import { dataCache } from "@/lib/cache/dataCache";

// ============================================
// TYPE DEFINITIONS
// ============================================

interface School {
  id: string | number;
  geip_school_ID?: string;
  school_name?: string;
  SE_school?: string;
  province_ID?: string;
  province_name?: string;
  district_name?: string;
  school_code?: string;
  school_type_h?: string;
  school_type_k?: string;
  is_target?: boolean;
  target?: boolean;
  [key: string]: any;
}

export default function SchoolsPage() {
  const { t, language } = useLanguage();
  // ============================================
  // STATE MANAGEMENT
  // ============================================

  // Data state
  const [allSchools, setAllSchools] = useState<School[]>([]); // Cache all schools for client-side filtering
  const [schools, setSchools] = useState<School[]>([]); // Filtered schools
  const [loading, setLoading] = useState(true); // Show loading initially
  const [mounted, setMounted] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true); // Track if we need to fetch all data

  // Pagination state
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalStudents, setTotalStudents] = useState<number>(0);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [provinceFilter, setProvinceFilter] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [schoolTypeFilter, setSchoolTypeFilter] = useState("");
  const [targetFilter, setTargetFilter] = useState("");

  // ============================================
  // PERFORMANCE OPTIMIZATION: Debouncing & Request Management
  // ============================================

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const filterTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [debouncedFilters, setDebouncedFilters] = useState({
    province: "",
    district: "",
    schoolType: "",
    target: "",
  });

  // Debounce search query (300ms for faster response)
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      // Only reset page if search actually changed
      if (searchQuery !== debouncedSearchQuery) {
        setPage(1);
      }
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Debounce filter changes - faster for school type (200ms), normal for others (300ms)
  useEffect(() => {
    if (filterTimeoutRef.current) {
      clearTimeout(filterTimeoutRef.current);
    }
    
    // Use shorter debounce if only school type changed (small dataset, fast filter)
    const isOnlySchoolTypeChange = schoolTypeFilter !== debouncedFilters.schoolType &&
      provinceFilter === debouncedFilters.province &&
      districtFilter === debouncedFilters.district &&
      targetFilter === debouncedFilters.target;
    
    const debounceTime = isOnlySchoolTypeChange ? 200 : 300;
    
    filterTimeoutRef.current = setTimeout(() => {
      const newFilters = {
        province: provinceFilter,
        district: districtFilter,
        schoolType: schoolTypeFilter,
        target: targetFilter,
      };
      
      // Check if filters actually changed
      const filtersChanged = 
        newFilters.province !== debouncedFilters.province ||
        newFilters.district !== debouncedFilters.district ||
        newFilters.schoolType !== debouncedFilters.schoolType ||
        newFilters.target !== debouncedFilters.target;
      
      setDebouncedFilters(newFilters);
      
      // Reset to first page only if filters actually changed
      if (filtersChanged) {
        setPage(1);
      }
    }, debounceTime);

    return () => {
      if (filterTimeoutRef.current) {
        clearTimeout(filterTimeoutRef.current);
      }
    };
  }, [provinceFilter, districtFilter, schoolTypeFilter, targetFilter, debouncedFilters]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // ============================================
  // API CALLS - Optimized with Request Cancellation
  // ============================================

  const fetchSchools = useCallback(async () => {
    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

      // Set loading immediately for consistent UX
      setLoading(true);
      const startTime = Date.now();
      // Use shorter minimum loading time for simple filters (school type, target)
      const hasSimpleFilterOnly = debouncedFilters.schoolType && 
        !debouncedSearchQuery && 
        !debouncedFilters.province && 
        !debouncedFilters.district;
      const minLoadingTime = hasSimpleFilterOnly ? 150 : 300; // Faster for simple filters

    try {
      const token = getToken();
      if (!token) {
        logger.warn('No token available for schools fetch', 'SCHOOLS');
        if (!abortController.signal.aborted) {
          setSchools([]);
          setTotal(0);
          setLoading(false);
        }
        return;
      }

      // If we have cached data, skip API call and use client-side filtering
      if (allSchools.length > 0 && !isInitialLoad) {
        // Skip API call, use client-side filtering - instant response
        setLoading(false);
        return;
      }
      
      // Otherwise, make API call to fetch all schools (no filters on initial load)
      const params = new URLSearchParams();
      // Don't send filters on initial load - fetch all schools for client-side filtering

      const response = await fetch(`/api/schools/search?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal: abortController.signal,
        cache: 'no-store', // Ensure fresh data
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Check if request was cancelled
      if (abortController.signal.aborted) {
        return;
      }

      // Log the response for debugging
      if (!data.success) {
        logger.error('API returned error', 'SCHOOLS', data.error);
        throw new Error(data.error || 'Failed to fetch schools');
      }

      // Use the data directly from the API - it's already formatted by schoolsService
      const fetchedSchools: School[] = data.data || [];

      logger.info(`Fetched ${fetchedSchools.length} schools, count: ${data.count}`, 'SCHOOLS');

      // Ensure minimum loading time for smooth UX
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, minLoadingTime - elapsedTime);

      await new Promise(resolve => setTimeout(resolve, remainingTime));

      // Double-check request wasn't cancelled during wait
      if (!abortController.signal.aborted) {
        // Always cache all schools for client-side filtering (data is small)
        if (isInitialLoad) {
          setAllSchools(fetchedSchools);
          setIsInitialLoad(false);
        }
        
        setSchools(fetchedSchools);
        setTotal(data.count || fetchedSchools.length);
      }
    } catch (error: any) {
      // Ignore abort errors (cancelled requests)
      if (error.name === 'AbortError') {
        return;
      }
      logger.error("Failed to fetch schools", "SCHOOLS", error);
      if (!abortController.signal.aborted) {
        setSchools([]);
        setTotal(0);
      }
    } finally {
      if (!abortController.signal.aborted) {
        setLoading(false);
      }
    }
  }, [debouncedSearchQuery, debouncedFilters, allSchools, isInitialLoad]);

  useEffect(() => {
    if (mounted) {
      fetchSchools();
    }

    // Cleanup: abort request if component unmount or dependencies change
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [mounted, fetchSchools]);


  // Fetch total students count from 25 provinces
  useEffect(() => {
    if (!mounted) return;
    
    const controller = new AbortController();
    let isMounted = true;

    const fetchTotalStudents = async () => {
      try {
        const token = getToken();
        if (!token) {
          logger.warn('No token available for students fetch', 'SCHOOLS');
          return;
        }

        // Check cache first
        const cacheKey = 'province_summary:total_students';
        const cached = dataCache.get<number>(cacheKey);
        if (cached !== null && cached !== undefined) {
          if (isMounted && !controller.signal.aborted) {
            setTotalStudents(cached);
          }
          return;
        }

        // Fetch with minimal params to get total_students
        const response = await fetch('/api/students/provinces?limit=1&offset=0', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (isMounted && !controller.signal.aborted) {
          if (data.success && data.total_students !== undefined) {
            const total = data.total_students;
            setTotalStudents(total);
            // Cache for 30 minutes (same as province summary)
            dataCache.set(cacheKey, total, 30 * 60 * 1000);
            logger.info(`Total students fetched: ${total}`, 'SCHOOLS');
          } else {
            setTotalStudents(0);
          }
        }
      } catch (error: any) {
        if (isMounted && error?.name !== 'AbortError') {
          logger.error('Failed to fetch total students', 'SCHOOLS', error);
          setTotalStudents(0);
        }
      }
    };

    fetchTotalStudents();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [mounted]);

  // ============================================
  // COMPUTED VALUES (Memoized)
  // ============================================

  // Helper function to determine if a school is target (matches backend logic)
  const isTargetSchool = useCallback((school: School): boolean => {
    const typeH = (school.school_type_h || '').toString();
    const typeK = (school.school_type_k || '').toString();
    
    // Check if school_type contains "សាលាគោលដៅ" (target school)
    if (typeH.includes('សាលាគោលដៅ') || typeK.includes('សាលាគោលដៅ')) {
      return true;
    }
    
    // Also check for SRS or NET-SRS as they might be target schools
    if (typeH.includes('SRS') || typeH.includes('NET-SRS')) {
      // But exclude volunteer schools
      if (typeH.includes('សាលាស្ម័គ្រចិត្ត') || typeK.includes('សាលាស្ម័គ្រចិត្ត')) {
        return false;
      }
      return true;
    }
    
    // Only use API fields if school_type doesn't exist
    if (!typeH && !typeK) {
      if (school.is_target !== undefined) return school.is_target === true;
      if (school.target !== undefined) return school.target === true;
    }
    
    // Default to not target
    return false;
  }, []);

  // Client-side filtering - always use this after initial load since data is small
  const filteredSchools = useMemo(() => {
    // Use allSchools if available (cached), otherwise use schools from API
    const sourceData = allSchools.length > 0 ? allSchools : schools;
    let filtered = [...sourceData];
    
    // Apply search filter (school name)
    if (debouncedSearchQuery) {
      const query = debouncedSearchQuery.toLowerCase().trim();
      filtered = filtered.filter(s => {
        const name = (s.school_name || '').toLowerCase();
        return name.includes(query);
      });
    }
    
    // Apply province filter
    if (debouncedFilters.province) {
      filtered = filtered.filter(s => {
        const province = (s.province_name || '').toLowerCase();
        return province.includes(debouncedFilters.province.toLowerCase());
      });
    }
    
    // Apply district filter
    if (debouncedFilters.district) {
      filtered = filtered.filter(s => {
        const district = (s.district_name || '').toLowerCase();
        return district.includes(debouncedFilters.district.toLowerCase());
      });
    }
    
    // Apply school type filter
    if (debouncedFilters.schoolType) {
      const filterType = debouncedFilters.schoolType.trim();
      filtered = filtered.filter(s => {
        const typeH = (s.school_type_h || '').toString();
        const typeK = (s.school_type_k || '').toString();
        
        // For "GEIP" filter, show only schools where school_type_h is exactly "GEIP" (not "GEIP-AF")
        if (filterType.toLowerCase() === 'geip') {
          const exactGEIP = (typeH.toLowerCase() === 'geip' || typeK.toLowerCase() === 'geip');
          if (exactGEIP) {
            // Make sure it's not GEIP-AF
            const isAF = typeH.toLowerCase().includes('geip-af') || 
                        typeK.toLowerCase().includes('geip-af') ||
                        typeH.toLowerCase().includes('geip af') || 
                        typeK.toLowerCase().includes('geip af');
            return !isAF;
          }
          return false;
        }
        
        // For "GEIP-AF" or "GEIP AF" filter
        if (filterType.toLowerCase() === 'geip-af' || filterType.toLowerCase() === 'geip af') {
          const typeHUpper = typeH.toUpperCase();
          const typeKUpper = typeK.toUpperCase();
          return typeHUpper.includes('GEIP-AF') || typeKUpper.includes('GEIP-AF') ||
                 typeHUpper.includes('GEIP AF') || typeKUpper.includes('GEIP AF');
        }
        
        // For other filters, use exact match first, then fall back to includes
        const exactMatch = typeH.toLowerCase() === filterType.toLowerCase() || 
                         typeK.toLowerCase() === filterType.toLowerCase();
        if (exactMatch) return true;
        
        return typeH.toLowerCase().includes(filterType.toLowerCase()) || 
               typeK.toLowerCase().includes(filterType.toLowerCase());
      });
    }
    
    // Apply target filter
    if (debouncedFilters.target) {
      const isTarget = debouncedFilters.target === 'true' || debouncedFilters.target === '1';
      filtered = filtered.filter(s => {
        const schoolIsTarget = isTargetSchool(s);
        return isTarget ? schoolIsTarget : !schoolIsTarget;
      });
    }
    
    return filtered;
  }, [allSchools, schools, debouncedFilters, debouncedSearchQuery, isTargetSchool]);

  const paginatedSchools = useMemo(
    () => filteredSchools.slice((page - 1) * perPage, page * perPage),
    [filteredSchools, page, perPage]
  );

  // Always use filtered count for pagination (client-side filtering)
  const effectiveTotal = useMemo(() => {
    return filteredSchools.length;
  }, [filteredSchools.length]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(effectiveTotal / perPage)),
    [effectiveTotal, perPage]
  );

  const start = useMemo(
    () => (effectiveTotal === 0 ? 0 : (page - 1) * perPage + 1),
    [effectiveTotal, page, perPage]
  );

  const end = useMemo(
    () => Math.min(page * perPage, effectiveTotal),
    [page, perPage, effectiveTotal]
  );

  // Get unique provinces with counts for filters (use allSchools if cached)
  const provinceList = useMemo(() => {
    const sourceData = allSchools.length > 0 && allSchools.length < 5000 ? allSchools : schools;
    const provinceCounts = new Map<string, number>();
    sourceData.forEach(school => {
      if (school.province_name) {
        const count = provinceCounts.get(school.province_name) || 0;
        provinceCounts.set(school.province_name, count + 1);
      }
    });
    return Array.from(provinceCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allSchools, schools]);

  const uniqueSchoolTypes = useMemo(() => {
    const sourceData = allSchools.length > 0 && allSchools.length < 5000 ? allSchools : schools;
    
    // Helper function to determine if a school is target (matches backend logic)
    const isTargetSchool = (school: School): boolean => {
      const typeH = (school.school_type_h || '').toString();
      const typeK = (school.school_type_k || '').toString();
      
      // Check if school_type contains "សាលាគោលដៅ" (target school)
      if (typeH.includes('សាលាគោលដៅ') || typeK.includes('សាលាគោលដៅ')) {
        return true;
      }
      
      // Also check for SRS or NET-SRS as they might be target schools
      if (typeH.includes('SRS') || typeH.includes('NET-SRS')) {
        // But exclude volunteer schools
        if (typeH.includes('សាលាស្ម័គ្រចិត្ត') || typeK.includes('សាលាស្ម័គ្រចិត្ត')) {
          return false;
        }
        return true;
      }
      
      // Only use API fields if school_type doesn't exist
      if (!typeH && !typeK) {
        if (school.is_target !== undefined) return school.is_target === true;
        if (school.target !== undefined) return school.target === true;
      }
      
      // Default to not target
      return false;
    };
    
    // Filter by target status if target filter is applied
    let filteredData = sourceData;
    if (targetFilter) {
      const isTarget = targetFilter === 'true' || targetFilter === '1';
      filteredData = sourceData.filter(school => {
        const schoolIsTarget = isTargetSchool(school);
        return isTarget ? schoolIsTarget : !schoolIsTarget;
      });
    }
    
    const types = new Set<string>();
    filteredData.forEach(school => {
      if (school.school_type_h) types.add(school.school_type_h);
    });
    return Array.from(types).sort();
  }, [allSchools, schools, targetFilter]);

  // ============================================
  // HANDLERS
  // ============================================

  // Table columns definition
  const columns: DataTableColumn<School>[] = useMemo(() => [
    { 
      key: 'school_name', 
      label: t.schools.schoolName,
      render: (value) => value ? <span className="font-khmer">{value}</span> : '-',
    },
    {
      key: 'province_name',
      label: t.schools.province,
      render: (value) => value ? (
        <span className="text-primary font-semibold font-khmer">
          {value}
        </span>
      ) : '-',
    },
    {
      key: 'district_name',
      label: t.schools.district,
      render: (value) => value ? <span className="font-khmer">{value}</span> : '-',
    },
    {
      key: 'school_type_h',
      label: t.schools.schoolType,
      render: (value) => value ? <span className="font-khmer">{value}</span> : '-',
    },
    {
      key: 'is_target',
      label: t.schools.targetStatus,
      render: (value, row) => {
        const isTarget = row.is_target === true || row.target === true;
        return (
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${language === 'km' ? 'font-khmer' : ''} ${
              isTarget
                ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
            }`}
          >
            {isTarget ? t.schools.target : t.schools.nonTarget}
          </span>
        );
      },
    },
  ], [t, language]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mt-6">
        <h1 className={`text-xl font-bold tracking-tight text-primary ${language === 'km' ? 'font-khmer' : ''}`}>
          {language === 'km' ? 'តម្រងសាលា' : 'Filter School'}
        </h1>
        <p className={`text-muted-foreground mt-2 text-sm ${language === 'km' ? 'font-khmer' : ''}`}>
          {t.schools.subtitle}
        </p>
      </div>

      {/* ============================================ */}
      {/* SEARCH AND FILTERS SECTION */}
      {/* ============================================ */}
      <div className="
  bg-white dark:bg-card
  rounded-lg
  border border-gray-200 dark:border-border
  p-6 shadow-sm
">
        <div
          className=" grid 
    grid-cols-1
    gap-3
    sm:grid-cols-2
    lg:grid-cols-3
    xl:grid-cols-5"
        >
          {/* Search Input */}
          <div className="space-y-2">
            <Label
              htmlFor="search"
              className={`text-sm font-medium text-primary ${language === 'km' ? 'font-khmer' : ''}`}
            >
              {t.schools.searchByName}
            </Label>
            <Input
              id="search"
              placeholder={t.schools.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full font-khmer"
            />
          </div>

          {/* Province Filter */}
          <div className="space-y-2">
            <Label
              htmlFor="province-filter"
              className={`text-sm font-medium text-primary ${language === 'km' ? 'font-khmer' : ''}`}
            >
              {t.schools.province}
            </Label>
            <select
              id="province-filter"
              value={provinceFilter}
              onChange={(e) => setProvinceFilter(e.target.value)}
              className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-khmer"
            >
              <option value="" className="font-khmer">{t.schools.allProvinces}</option>
              {provinceList.map((province) => (
                <option key={province.name} value={province.name} className="font-khmer">
                  {province.name} ({province.count})
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
              {t.schools.district}
            </Label>
            <Input
              id="district-filter"
              placeholder={`${t.common.filter} ${t.schools.district}...`}
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className="w-full font-khmer"
            />
          </div>

          {/* School Type Filter */}
          <div className="space-y-2">
            <Label
              htmlFor="school-type-filter"
              className={`text-sm font-medium text-primary ${language === 'km' ? 'font-khmer' : ''}`}
            >
              {t.schools.schoolType}
            </Label>
            <select
              id="school-type-filter"
              value={schoolTypeFilter}
              onChange={(e) => setSchoolTypeFilter(e.target.value)}
              className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-khmer"
            >
              <option value="" className="font-khmer">{t.schools.allTypes}</option>
              {uniqueSchoolTypes.map((type) => (
                <option key={type} value={type} className="font-khmer">
                  {type}
                </option>
              ))}
            </select>
          </div>

          {/* Target Filter */}
          <div className="space-y-2">
            <Label
              htmlFor="target-filter"
              className={`text-sm font-medium text-primary ${language === 'km' ? 'font-khmer' : ''}`}
            >
              {t.schools.targetStatus}
            </Label>
            <select
              id="target-filter"
              value={targetFilter}
              onChange={(e) => setTargetFilter(e.target.value)}
              className={`w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${language === 'km' ? 'font-khmer' : ''}`}
            >
              <option value="" className={language === 'km' ? 'font-khmer' : ''}>{t.schools.allSchools}</option>
              <option value="true" className={language === 'km' ? 'font-khmer' : ''}>{t.schools.targetSchools}</option>
              <option value="false" className={language === 'km' ? 'font-khmer' : ''}>{t.schools.nonTargetSchools}</option>
            </select>
          </div>
        </div>
      </div>

      {/* ============================================ */}
      {/* PAGE HEADER ABOVE TABLE */}
      {/* ============================================ */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className={`text-xl font-bold tracking-tight text-primary ${language === 'km' ? 'font-khmer' : ''}`}>
            {t.schools.title}
          </h1>
          <p className={`text-muted-foreground mt-2 text-sm ${language === 'km' ? 'font-khmer' : ''}`}>
            {t.schools.manageAndView} ({effectiveTotal} {t.schools.total})
          </p>
        </div>
      </div>

      {/* ============================================ */}
      {/* TABLE CARD */}
      {/* ============================================ */}
      <Card>
        <CardContent>
          {loading ? (
            <Loading
              title={t.common.loadingData}
              description={t.common.pleaseWait}
              showSkeleton={true}
              language={language}
            />
          ) : paginatedSchools.length > 0 ? (
            <>
              {/* Data Table */}
              <DataTable<School>
                columns={columns}
                data={paginatedSchools}
              />

              {/* ============================================ */}
              {/* PAGINATION CONTROLS */}
              {/* ============================================ */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className={`text-sm text-muted-foreground ${language === 'km' ? 'font-khmer' : ''}`}>
                  {t.common.showing} {start}–{end} {t.common.of} {effectiveTotal}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className={language === 'km' ? 'font-khmer' : ''}
                  >
                    {t.common.prev}
                  </Button>

                  <div className={`px-3 text-sm text-muted-foreground ${language === 'km' ? 'font-khmer' : ''}`}>
                    {t.common.page} {page} {t.common.of} {totalPages}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const nextPage = page + 1;
                      if (nextPage <= totalPages) {
                        setPage(nextPage);
                      }
                    }}
                    disabled={page >= totalPages || loading}
                    className={language === 'km' ? 'font-khmer' : ''}
                  >
                    {t.common.next}
                  </Button>

                  <select
                    value={perPage}
                    onChange={(e) => {
                      setPerPage(Number(e.target.value));
                      setPage(1);
                    }}
                    className={`ml-2 rounded border bg-background px-2 py-1 text-sm ${language === 'km' ? 'font-khmer' : ''}`}
                  >
                    <option value={5} className={language === 'km' ? 'font-khmer' : ''}>5</option>
                    <option value={10} className={language === 'km' ? 'font-khmer' : ''}>10</option>
                    <option value={20} className={language === 'km' ? 'font-khmer' : ''}>20</option>
                    <option value={50} className={language === 'km' ? 'font-khmer' : ''}>50</option>
                  </select>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p className={language === 'km' ? 'font-khmer' : ''}>
                {t.common.noData}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

