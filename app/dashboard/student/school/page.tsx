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
import { districtService, provinceService } from "@/lib/api";

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

// Fallback province data in case API fails
const FALLBACK_PROVINCES = [
  { province_id: '1', province_name: 'Banteay Meanchey' },
  { province_id: '2', province_name: 'Battambang' },
  { province_id: '3', province_name: 'Kampong Cham' },
  { province_id: '4', province_name: 'Kampong Chhnang' },
  { province_id: '5', province_name: 'Kampong Speu' },
  { province_id: '6', province_name: 'Kampong Thom' },
  { province_id: '7', province_name: 'Kampot' },
  { province_id: '8', province_name: 'Kandal' },
  { province_id: '9', province_name: 'Kep' },
  { province_id: '10', province_name: 'Koh Kong' },
  { province_id: '11', province_name: 'Kratie' },
  { province_id: '12', province_name: 'Mondulkiri' },
  { province_id: '13', province_name: 'Oddar Meanchey' },
  { province_id: '14', province_name: 'Pailin' },
  { province_id: '15', province_name: 'Phnom Penh' },
  { province_id: '16', province_name: 'Preah Vihear' },
  { province_id: '17', province_name: 'Prey Veng' },
  { province_id: '18', province_name: 'Pursat' },
  { province_id: '19', province_name: 'Ratanakiri' },
  { province_id: '20', province_name: 'Siem Reap' },
  { province_id: '21', province_name: 'Sihanoukville' },
  { province_id: '22', province_name: 'Stung Treng' },
  { province_id: '23', province_name: 'Svay Rieng' },
  { province_id: '24', province_name: 'Takéo' },
  { province_id: '25', province_name: 'Tboung Khmum' },
];

export default function SchoolsPage() {
  const { t, language } = useLanguage();
  // ============================================
  // STATE MANAGEMENT
  // ============================================

  // Data state
  const [schools, setSchools] = useState<School[]>([]); // Schools from API
  const [loading, setLoading] = useState(false); // Start with false - no auto-load
  const [mounted, setMounted] = useState(false);

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
  
  // Province options (from external API - ONE source of truth)
  const [provinces, setProvinces] = useState<Array<{ province_id: string; province_name: string }>>([]);
  const [provinceApiError, setProvinceApiError] = useState(false);
  
  // District options (populated when province is selected)
  const [districts, setDistricts] = useState<Array<{ province_id: string; district_name: string }>>([]);
  const [districtLoading, setDistrictLoading] = useState(false);

  // ============================================
  // PERFORMANCE OPTIMIZATION: Debouncing & Request Management
  // ============================================

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasInitialLoadRef = useRef(false);
  
  // Applied filters (used for data fetching) - only updated when "Apply Filters" is clicked
  const [appliedFilters, setAppliedFilters] = useState({
    province: "",
    district: "",
    schoolType: "",
    target: "",
    searchQuery: "",
  });
  
  // Debounce search query (300ms) - search can still be real-time for better UX
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);
  
  // Check if there are pending filter changes (filters changed but not applied)
  const hasPendingFilters = useMemo(() => {
    return (
      provinceFilter !== appliedFilters.province ||
      districtFilter !== appliedFilters.district ||
      schoolTypeFilter !== appliedFilters.schoolType ||
      targetFilter !== appliedFilters.target ||
      debouncedSearchQuery !== appliedFilters.searchQuery
    );
  }, [provinceFilter, districtFilter, schoolTypeFilter, targetFilter, debouncedSearchQuery, appliedFilters]);
  
  // Handler for Apply Filters button
  const handleApplyFilters = useCallback(() => {
    setAppliedFilters({
      province: provinceFilter,
      district: districtFilter,
      schoolType: schoolTypeFilter,
      target: targetFilter,
      searchQuery: debouncedSearchQuery,
    });
    setPage(1); // Reset to first page when filters are applied
  }, [provinceFilter, districtFilter, schoolTypeFilter, targetFilter, debouncedSearchQuery]);

  useEffect(() => {
    setMounted(true);
  }, []);


  // ============================================
  // DATA FETCHING: Load provinces from external API (ONE source of truth)
  // ============================================
  useEffect(() => {
    const loadProvinces = async () => {
      try {
        const result = await provinceService.getAll({
          limit: 1000,
          offset: 0,
        });

        if (result.success && result.data && Array.isArray(result.data)) {
          // Filter out invalid provinces and map to clean format
          const validProvinces = result.data
            .filter((p: any) => {
              const provinceId = (p.province_id || '').toString().trim();
              const provinceName = (p.province_name || '').toString().trim();
              return provinceId && 
                     provinceId !== 'string' && 
                     provinceId !== 'null' && 
                     provinceId !== 'undefined' &&
                     provinceName && 
                     provinceName !== 'string' && 
                     provinceName !== 'null';
            })
            .map((p: any) => ({
              province_id: p.province_id,
              province_name: p.province_name,
            }))
            .sort((a: { province_id: string; province_name: string }, b: { province_id: string; province_name: string }) => {
              const nameA = (a.province_name || '').toLowerCase();
              const nameB = (b.province_name || '').toLowerCase();
              return nameA.localeCompare(nameB);
            });
          setProvinces(validProvinces);
          
          // Auto-select first province for default data loading
          if (validProvinces.length > 0 && !provinceFilter) {
            const firstProvince = validProvinces[0];
            setProvinceFilter(firstProvince.province_name);
            // Auto-apply initial filters for default data loading
            setAppliedFilters({
              province: firstProvince.province_name,
              district: "",
              schoolType: "",
              target: "",
              searchQuery: "",
            });
            logger.info(`[SCHOOLS] Auto-selected first province: ${firstProvince.province_name}`, 'SCHOOLS');
          }
        }
      } catch (error: any) {
        logger.error('[SCHOOLS] Failed to fetch provinces, using fallback data', 'SCHOOLS', error);
        setProvinceApiError(true);
        // Use fallback provinces when API fails
        setProvinces(FALLBACK_PROVINCES);
        
        // Auto-select first fallback province for default data loading
        if (FALLBACK_PROVINCES.length > 0 && !provinceFilter) {
          setProvinceFilter(FALLBACK_PROVINCES[0].province_name);
          // Auto-apply initial filters for default data loading
          setAppliedFilters({
            province: FALLBACK_PROVINCES[0].province_name,
            district: "",
            schoolType: "",
            target: "",
            searchQuery: "",
          });
          logger.info(`[SCHOOLS] Auto-selected first fallback province: ${FALLBACK_PROVINCES[0].province_name}`, 'SCHOOLS');
        }
      }
    };

    loadProvinces();
  }, []);

  // ============================================
  // HIERARCHICAL FILTERS: Province selection triggers district fetch
  // ============================================
  useEffect(() => {
    // Province selection may only trigger district fetch
    if (!mounted || !provinceFilter || !provinceFilter.trim()) {
      setDistricts([]);
      setDistrictFilter(""); // Clear district when province is cleared
      setSchools([]); // Clear schools when province is cleared
      setTotal(0);
      return;
    }

    // Use province_id from external API (never mix IDs from different sources)
    const province = provinces.find(p => p.province_name === provinceFilter);
    if (!province) {
      logger.warn(`[SCHOOLS] Province not found in API data: ${provinceFilter}`, 'SCHOOLS');
      setDistricts([]);
      setDistrictFilter("");
      return;
    }

    const province_id = province.province_id; // External API province_id only

    // Fetch districts for selected province
    const fetchDistricts = async () => {
      setDistrictLoading(true);
      try {
        const token = getToken();
        if (!token) {
          logger.warn('[SCHOOLS] No token for district fetch', 'SCHOOLS');
          setDistricts([]);
          setDistrictLoading(false);
          return;
        }

        logger.info(`[SCHOOLS] Fetching districts for province: ${province_id}`, 'SCHOOLS');
        
        const result = await districtService.getAll({
          province_id: province_id,
          limit: 10000,
          offset: 0,
        });

        if (!result.success) {
          logger.error(`[SCHOOLS] Failed to fetch districts: ${result.error}`, 'SCHOOLS');
          setDistricts([]);
          setDistrictLoading(false);
          return;
        }

        const districtData = (result.data || []).map(d => ({
          province_id: d.province_id,
          district_name: d.district_name,
        }));

        setDistricts(districtData);
        
        // Auto-select first district for default data loading (only if no district is currently selected)
        if (districtData.length > 0 && !districtFilter) {
          const firstDistrict = districtData[0];
          setDistrictFilter(firstDistrict.district_name);
          // Auto-apply district filter for default data loading
          setAppliedFilters(prev => ({
            ...prev,
            district: firstDistrict.district_name,
          }));
          logger.info(`[SCHOOLS] Auto-selected first district: ${firstDistrict.district_name}`, 'SCHOOLS');
        } else if (districtData.length === 0) {
          // Clear district selection if no districts available
          setDistrictFilter("");
          setAppliedFilters(prev => ({
            ...prev,
            district: "",
          }));
        }
        
        logger.info(`[SCHOOLS] Loaded ${districtData.length} districts for province ${province_id}`, 'SCHOOLS');
      } catch (error: any) {
        logger.error('[SCHOOLS] Error fetching districts', 'SCHOOLS', error);
        setDistricts([]);
      } finally {
        setDistrictLoading(false);
      }
    };

    fetchDistricts();
  }, [mounted, provinceFilter, provinces]);

  // ============================================
  // API CALLS - Optimized with Request Cancellation
  // ============================================

  const fetchSchools = useCallback(async () => {
    // PERFORMANCE OPTIMIZATION: Cache-first strategy for schools
    // Build cache key from applied filters
    const cacheKey = `schools:${appliedFilters.province || 'all'}:${appliedFilters.district || 'all'}:${appliedFilters.searchQuery || ''}`;
    
    // Check cache first (only if no search query to avoid stale results)
    if (!appliedFilters.searchQuery) {
      const cachedSchools = dataCache.get<School[]>(cacheKey);
      if (cachedSchools && Array.isArray(cachedSchools) && cachedSchools.length >= 0) {
        logger.info(`[SCHOOLS] Cache hit: Using cached schools (${cachedSchools.length} schools)`, 'SCHOOLS');
        setSchools(cachedSchools);
        setTotal(cachedSchools.length);
        setLoading(false);
        return;
      }
    }
    
    // Progressive filtering: Fetch schools even without filters
    // If filters are provided, use filtered endpoint; otherwise fetch all schools
    
    // Convert province name to province_id if province filter is provided
    let province_id: string | undefined;
    if (appliedFilters.province && appliedFilters.province.trim()) {
      const province = provinces.find(p => p.province_name === appliedFilters.province);
      if (province) {
        province_id = province.province_id;
      } else {
        logger.warn(`[SCHOOLS] Province not found: ${appliedFilters.province}`, 'SCHOOLS');
      }
    }
    
    const district_name = appliedFilters.district?.trim() || undefined;

    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setLoading(true);

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
      
      let response: Response;
      
      // PERFORMANCE: Use search endpoint only when both province and district are provided
      // Otherwise use list endpoint which is more efficient for partial filters
      if (province_id && district_name) {
        // Both filters provided - use filtered search endpoint
        const params = new URLSearchParams();
        params.append('province_id', province_id);
        params.append('district_name', district_name);
        
        // Add optional search query
        if (appliedFilters.searchQuery && appliedFilters.searchQuery.trim()) {
          params.append('q', appliedFilters.searchQuery.trim());
        }

        response = await fetch(`/api/schools/search?${params.toString()}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          signal: abortController.signal,
          cache: 'no-store',
        });
      } else {
        // No filters or partial filters - use list endpoint (more efficient)
        const params = new URLSearchParams();
        params.append('limit', '1000'); // Fetch a reasonable number
        params.append('offset', '0');
        
        // Use the list endpoint which supports optional filters
        if (province_id) {
          params.append('province_id', province_id);
        }
        if (district_name) {
          params.append('district_name', district_name);
        }
        if (appliedFilters.searchQuery && appliedFilters.searchQuery.trim()) {
          params.append('q', appliedFilters.searchQuery.trim());
        }
        
        const url = `/api/schools/list?${params.toString()}`;

        response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          signal: abortController.signal,
          cache: 'no-store',
        });
      }

      if (!response.ok) {
        // Handle 401 authentication errors - redirect to login
        if (response.status === 401) {
          logger.warn('Authentication expired, redirecting to login', 'SCHOOLS');
          dataCache.clear();
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
          return;
        }
        
        // Do not retry on 400 errors (missing parameters)
        if (response.status === 400) {
          const errorData = await response.json().catch(() => ({}));
          logger.error(`[SCHOOLS] API returned 400 (bad request): ${errorData.error || 'Missing required parameters'}`, 'SCHOOLS');
          if (!abortController.signal.aborted) {
            setSchools([]);
            setTotal(0);
            setLoading(false);
          }
          return;
        }
        
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Check if request was cancelled
      if (abortController.signal.aborted) {
        return;
      }

      // Log the response for debugging
      if (!data.success) {
        // Check for authentication error in response
        if (data.error?.includes('Authentication') || data.error?.includes('401') || data.error?.includes('expired') || data.error?.includes('login')) {
          logger.warn('Authentication expired in response, redirecting to login', 'SCHOOLS');
          dataCache.clear();
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
          return;
        }
        
        // Do not retry on 400 errors (missing parameters)
        if (data.error?.includes('required') || data.error?.includes('province_id') || data.error?.includes('district_name')) {
          logger.error(`[SCHOOLS] API returned error (missing parameters): ${data.error}`, 'SCHOOLS');
          if (!abortController.signal.aborted) {
            setSchools([]);
            setTotal(0);
            setLoading(false);
          }
          return;
        }
        
        logger.error('API returned error', 'SCHOOLS', data.error);
        throw new Error(data.error || 'Failed to fetch schools');
      }

      // Use the data directly from the API - it's already formatted by schoolService
      const fetchedSchools: School[] = data.data || [];

      logger.info(`Fetched ${fetchedSchools.length} schools, count: ${data.count}`, 'SCHOOLS');

      // Double-check request wasn't cancelled
      if (!abortController.signal.aborted) {
        setSchools(fetchedSchools);
        setTotal(data.count || fetchedSchools.length);
        
        // PERFORMANCE: Cache schools data (only if no search query to avoid stale results)
        if (!appliedFilters.searchQuery && fetchedSchools.length > 0) {
          dataCache.set(cacheKey, fetchedSchools, 10 * 60 * 1000); // 10 minutes TTL
          logger.info(`[SCHOOLS] Cached ${fetchedSchools.length} schools for 10 minutes`, 'SCHOOLS');
        }
      }
    } catch (error: any) {
      // Ignore abort errors (cancelled requests)
      if (error.name === 'AbortError') {
        return;
      }
      
      // Check if it's an authentication error
      if (error?.message?.includes('401') || error?.message?.includes('Authentication') || error?.message?.includes('expired')) {
        logger.warn('Authentication expired in error, redirecting to login', 'SCHOOLS');
        dataCache.clear();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
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
  }, [appliedFilters, provinces]);

  // Fetch schools when:
  // 1. Component mounts (initial data load - even with empty filters)
  // 2. Applied filters change (when "Apply Filters" button is clicked or auto-selected)
  // This ensures data always loads and updates when filters are applied
  useEffect(() => {
    if (!mounted) return;
    
    // Wait for provinces to load if we need to convert province name to province_id
    // But if no province filter is applied, we can fetch immediately (all schools)
    if (appliedFilters.province && provinces.length === 0) {
      // Wait for provinces to load so we can convert province name to province_id
      return;
    }
    
    // Fetch schools with applied filters (handles empty filters - shows all schools)
    fetchSchools();
    hasInitialLoadRef.current = true;

    // Cleanup: abort request if component unmount or dependencies change
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, appliedFilters.province, appliedFilters.district, appliedFilters.schoolType, appliedFilters.target, appliedFilters.searchQuery, provinces.length]);
  
  // Ensure initial data load happens even if appliedFilters starts empty
  // This is a fallback to ensure data loads on page load
  useEffect(() => {
    if (!mounted || hasInitialLoadRef.current) return;
    
    // If we haven't loaded data yet and provinces are loaded (or not needed), fetch schools
    if (!appliedFilters.province || provinces.length > 0) {
      // Small delay to ensure other useEffects have run first
      const timer = setTimeout(() => {
        if (!hasInitialLoadRef.current) {
          fetchSchools();
          hasInitialLoadRef.current = true;
        }
      }, 100);
      
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, provinces.length]);

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
        const response = await fetch('/api/provinces?limit=1&offset=0', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          // Handle 401 authentication errors - redirect to login
          if (response.status === 401) {
            logger.warn('Authentication expired, redirecting to login', 'SCHOOLS');
            // Clear any cached data
            dataCache.clear();
            // Redirect to login page
            if (typeof window !== 'undefined') {
              window.location.href = '/login';
            }
            return;
          }
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
          // Check if it's an authentication error
          if (error?.message?.includes('401') || error?.message?.includes('Authentication')) {
            logger.warn('Authentication expired, redirecting to login', 'SCHOOLS');
            if (typeof window !== 'undefined') {
              window.location.href = '/login';
            }
            return;
          }
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

  // Client-side filtering - Apply filters from appliedFilters (not pending filters)
  // This ensures only applied filters affect the displayed data
  const filteredSchools = useMemo(() => {
    // Use schools from API as source data
    const sourceData = schools;
    let filtered = [...sourceData];
    
    // Apply province filter (client-side if not already filtered by API)
    if (appliedFilters.province && appliedFilters.province.trim()) {
      filtered = filtered.filter(s => {
        const provinceName = (s.province_name || '').toString();
        return provinceName === appliedFilters.province;
      });
    }
    
    // Apply district filter (client-side if not already filtered by API)
    if (appliedFilters.district && appliedFilters.district.trim()) {
      filtered = filtered.filter(s => {
        const districtName = (s.district_name || '').toString();
        return districtName === appliedFilters.district;
      });
    }
    
    // Apply search filter (school name) - always client-side
    if (appliedFilters.searchQuery) {
      const query = appliedFilters.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(s => {
        const name = (s.school_name || '').toLowerCase();
        return name.includes(query);
      });
    }
    
    // Apply school type filter - exact match with school_type_h
    // The dropdown shows school_type_h values, so we match exactly
    if (appliedFilters.schoolType) {
      const filterType = appliedFilters.schoolType.trim();
      filtered = filtered.filter(s => {
        const typeH = (s.school_type_h || '').toString();
        // Exact match with school_type_h (case-sensitive match with the dropdown values)
        return typeH === filterType;
      });
    }
    
    // Apply target filter
    if (appliedFilters.target) {
      const isTarget = appliedFilters.target === 'true' || appliedFilters.target === '1';
      filtered = filtered.filter(s => {
        const schoolIsTarget = isTargetSchool(s);
        return isTarget ? schoolIsTarget : !schoolIsTarget;
      });
    }
    
    return filtered;
  }, [schools, appliedFilters, isTargetSchool]);

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

  // Get provinces for dropdown (from external API - ONE source of truth)
  const provinceList = useMemo(() => {
    // Use provinces from external API only (never use constants for API calls)
    return provinces.map(province => province.province_name).sort((a, b) => a.localeCompare(b));
  }, [provinces]);

  // Get unique school types from ALL schools (not filtered)
  // This ensures the dropdown always shows all available school types
  // regardless of other filter selections
  const uniqueSchoolTypes = useMemo(() => {
    const types = new Set<string>();
    schools.forEach(school => {
      if (school.school_type_h) {
        types.add(school.school_type_h);
      }
    });
    return Array.from(types).sort();
  }, [schools]);

  // ============================================
  // HANDLERS
  // ============================================

  // Table columns definition
  const columns: DataTableColumn<School>[] = useMemo(() => [
    { 
      key: 'school_name', 
      label: t.schools?.schoolName || 'School Name',
      render: (value) => value ? <span className="font-khmer">{value}</span> : '-',
    },
    {
      key: 'province_name',
      label: t.schools?.province || 'Province',
      render: (value) => value ? (
        <span className="text-primary font-semibold font-khmer">
          {value}
        </span>
      ) : '-',
    },
    {
      key: 'district_name',
      label: t.schools?.district || 'District',
      render: (value) => value ? <span className="font-khmer">{value}</span> : '-',
    },
    {
      key: 'school_type_h',
      label: t.schools?.schoolType || 'School Type',
      render: (value) => value ? <span className="font-khmer">{value}</span> : '-',
    },
    {
      key: 'is_target',
      label: t.schools?.targetStatus || 'Target Status',
      render: (value, row) => {
        const isTarget = isTargetSchool(row);
        return (
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${language === 'km' ? 'font-khmer' : ''} ${
              isTarget
                ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
            }`}
          >
            {isTarget ? (t.schools?.target || 'Target') : (t.schools?.nonTarget || 'Non-Target')}
          </span>
        );
      },
    },
  ], [t, language, isTargetSchool]);

  return (
    <div className="w-full space-y-6">
      {/* ============================================ */}
      {/* FILTER CONTAINER - Static Header */}
      {/* ============================================ */}
      <div className="w-full mt-1 md:mt-2 lg:mt-3 bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-border shadow-sm">
        {/* Filter Header - Static */}
        <div className="p-6 pb-4">
          <h1 className={`text-xl font-bold tracking-tight text-primary ${language === 'km' ? 'font-khmer' : ''}`}>
            {language === 'km' ? 'តម្រងសាលា' : 'Filter School'}
          </h1>
          <p className={`text-muted-foreground mt-2 text-sm ${language === 'km' ? 'font-khmer' : ''}`}>
            {t.schools?.subtitle || 'View and manage school information'}
          </p>
          
          {/* API Error Notification */}
          {provinceApiError && (
            <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {language === 'km' 
                  ? 'ប្រើប្រាស់ទិន្នន័យថេរដោយសារតែ Province API មិនអាចចូលដំណើរការបាន'
                  : 'Using static province data due to API unavailability'
                }
              </div>
            </div>
          )}
        </div>

        {/* Filter Content */}
        <div className="px-6 pb-6 border-t border-gray-200 dark:border-border pt-6">
          <div className="w-full grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {/* Search Input */}
            <div className="space-y-2">
              <Label
                htmlFor="search"
                className={`text-sm font-medium text-primary ${language === 'km' ? 'font-khmer' : ''}`}
              >
                {t.schools?.searchByName || 'Search by Name'}
              </Label>
              <Input
                id="search"
                placeholder={t.schools?.searchPlaceholder || 'Search school name...'}
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
                {t.schools?.province || 'Province'}
              </Label>
              <select
                id="province-filter"
                value={provinceFilter}
                onChange={(e) => setProvinceFilter(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-khmer"
              >
                <option value="" className="font-khmer">{t.schools?.allProvinces || 'All Provinces'}</option>
                {provinces.sort((a, b) => a.province_name.localeCompare(b.province_name)).map((province) => (
                  <option key={province.province_id} value={province.province_name} className="font-khmer">
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
                {t.schools?.district || 'District'}
              </Label>
              <select
                id="district-filter"
                value={districtFilter}
                onChange={(e) => setDistrictFilter(e.target.value)}
                disabled={!provinceFilter || districtLoading}
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-khmer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="" className="font-khmer">
                  {districtLoading ? (language === 'km' ? 'កំពុងផ្ទុក...' : 'Loading...') : (language === 'km' ? 'សូមជ្រើសស្រុក' : 'Select District')}
                </option>
                {districts.map((district) => (
                  <option key={district.district_name} value={district.district_name} className="font-khmer">
                    {district.district_name}
                  </option>
                ))}
              </select>
            </div>

            {/* School Type Filter */}
            <div className="space-y-2">
              <Label
                htmlFor="school-type-filter"
                className={`text-sm font-medium text-primary ${language === 'km' ? 'font-khmer' : ''}`}
              >
                {t.schools?.schoolType || 'School Type'}
              </Label>
              <select
                id="school-type-filter"
                value={schoolTypeFilter}
                onChange={(e) => setSchoolTypeFilter(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-khmer"
              >
                <option value="" className="font-khmer">{t.schools?.allTypes || 'All Types'}</option>
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
                {t.schools?.targetStatus || 'Target Status'}
              </Label>
              <select
                id="target-filter"
                value={targetFilter}
                onChange={(e) => setTargetFilter(e.target.value)}
                className={`w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${language === 'km' ? 'font-khmer' : ''}`}
              >
                <option value="" className={language === 'km' ? 'font-khmer' : ''}>{t.schools?.allSchools || 'All Schools'}</option>
                <option value="true" className={language === 'km' ? 'font-khmer' : ''}>{t.schools?.targetSchools || 'Target Schools'}</option>
                <option value="false" className={language === 'km' ? 'font-khmer' : ''}>{t.schools?.nonTargetSchools || 'Non-Target Schools'}</option>
              </select>
            </div>

            {/* Apply Filters Button - Performance Optimization */}
            <div className="space-y-2 flex items-end">
              <Button
                onClick={handleApplyFilters}
                disabled={loading || !hasPendingFilters}
                className={`w-full h-[42px] ${language === 'km' ? 'font-khmer' : ''}`}
                variant={hasPendingFilters ? "default" : "outline"}
              >
                {loading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {language === 'km' ? 'កំពុងអនុវត្ត...' : 'Applying...'}
                  </span>
                ) : (
                  <>
                    {hasPendingFilters && (
                      <span className="relative flex h-2 w-2 mr-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
                      </span>
                    )}
                    {language === 'km' ? 'អនុវត្តតម្រង' : 'Apply Filters'}
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Pending Filters Indicator */}
          {hasPendingFilters && (
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-2 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <p className={`text-sm text-blue-800 dark:text-blue-200 ${language === 'km' ? 'font-khmer' : ''}`}>
                  {language === 'km' 
                    ? 'មានការផ្លាស់ប្តូរតម្រងដែលមិនទាន់បានអនុវត្ត។ ចុច "អនុវត្តតម្រង" ដើម្បីអាប់ដេតទិន្នន័យ។'
                    : 'You have pending filter changes. Click "Apply Filters" to update the data.'
                  }
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ============================================ */}
      {/* PAGE HEADER ABOVE TABLE */}
      {/* ============================================ */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className={`text-xl font-bold tracking-tight text-primary ${language === 'km' ? 'font-khmer' : ''}`}>
            {language === 'km' ? 'សាលា' : 'School'}
          </h1>
          <p className={`text-muted-foreground mt-2 text-sm ${language === 'km' ? 'font-khmer' : ''}`}>
            {t.schools?.manageAndView || 'Manage and view schools'} ({effectiveTotal} {t.schools?.total || 'total'})
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
              title={t.common?.loadingData || 'Loading data'}
              description={t.common?.pleaseWait || 'Please wait'}
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
                  {t.common?.showing || 'Showing'} {start}–{end} {t.common?.of || 'of'} {effectiveTotal}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className={language === 'km' ? 'font-khmer' : ''}
                  >
                    {t.common?.prev || 'Previous'}
                  </Button>

                  <div className={`px-3 text-sm text-muted-foreground ${language === 'km' ? 'font-khmer' : ''}`}>
                    {t.common?.page || 'Page'} {page} {t.common?.of || 'of'} {totalPages}
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
                    {t.common?.next || 'Next'}
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
                {t.common?.noData || 'No data found'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}