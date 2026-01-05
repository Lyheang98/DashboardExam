'use client';

import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
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
import { districtService, provinceService } from '@/lib/api';
import { dataCache } from '@/lib/cache/dataCache';

interface DistrictData {
  province_id: string;
  district_name: string;
  total_count: number;
}

/**
 * DISTRICT PAGE - Province-dependent district list
 * 
 * Requirements:
 * - Districts must NOT load by default
 * - Staff must select a province first before any district data is fetched
 * - District API should be called only when provinceId is selected
 * - No fallback or aggregation across provinces
 * - If no province is selected, show empty state
 */
export default function DistrictPage() {
  const { t, language } = useLanguage();
  
  // ============================================
  // CENTRALIZED FILTER STATE
  // ============================================
  const {
    filters,
    setProvinceId,
    setSearchQuery,
    isValid,
  } = useFilterState({ pageType: 'district' });
  
  // ============================================
  // STATE: Data & UI
  // ============================================
  const [allDistricts, setAllDistricts] = useState<DistrictData[]>([]); // District summaries for selected province
  const [totalCount, setTotalCount] = useState<number>(0); // Total count from API
  const [loading, setLoading] = useState(false);
  const [provinces, setProvinces] = useState<Array<{ province_id: string; province_name: string }>>([]);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [searchQuery, setSearchQueryLocal] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [hasInitialFetch, setHasInitialFetch] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // ============================================
  // REFS: Debouncing & Request Management
  // ============================================
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const previousProvinceIdRef = useRef<string | null>(null);

  // ============================================
  // MOUNT: Initialize component
  // ============================================
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // ============================================
  // DEBOUNCING: Search query
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

  // Sync local search with filter state
  useEffect(() => {
    setSearchQuery(debouncedSearch);
  }, [debouncedSearch, setSearchQuery]);
  
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
              // Sort by province name alphabetically
              const nameA = (a.province_name || '').toLowerCase();
              const nameB = (b.province_name || '').toLowerCase();
              return nameA.localeCompare(nameB);
            });
          setProvinces(validProvinces);
        }
      } catch (error: any) {
        logger.error('Failed to fetch provinces', 'DISTRICT', error);
      }
    };

    loadProvinces();
  }, []);

  // ============================================
  // NORMALIZE API RESPONSE: Handle different response shapes
  // ============================================
  const normalizeDistrictResponse = useCallback((response: any): DistrictData[] => {
    // Handle different response shapes
    if (Array.isArray(response)) {
      // Response is directly an array
      return response;
    }
    
    if (response && typeof response === 'object') {
      // Response is an object, check for different property names
      if (Array.isArray(response.data)) {
        return response.data;
      }
      
      if (Array.isArray(response.results)) {
        return response.results;
      }
      
      // Check if the response itself is a district object
      if (response.province_id && response.district_name) {
        return [response];
      }
    }
    
    // Default to empty array if no valid data found
    return [];
  }, []);

  // ============================================
  // DATA FETCHING: Fetch districts ONLY when province is selected
  // ============================================
  useEffect(() => {
    // Only fetch after component is mounted
    if (!mounted) {
      return;
    }

    // Get current province ID
    const currentProvinceId = filters.provinceId?.trim() || '';
    
    // If no province is selected, clear districts and return
    if (!currentProvinceId) {
      setAllDistricts([]);
      setTotalCount(0);
      setHasInitialFetch(false);
      setLoading(false);
      previousProvinceIdRef.current = null;
      return;
    }

    // If the same province is already selected, don't refetch
    if (previousProvinceIdRef.current === currentProvinceId) {
      return;
    }

    // Update the previous province ID ref
    previousProvinceIdRef.current = currentProvinceId;

    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create a new abort controller
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setLoading(true);

    const fetchDistricts = async () => {
      try {
        // Check cache first
        const cacheKey = `districts:${currentProvinceId}`;
        const cachedDistricts = dataCache.get<DistrictData[]>(cacheKey);
        
        // Only use cache if it contains valid data (not empty)
        if (cachedDistricts && Array.isArray(cachedDistricts) && cachedDistricts.length > 0) {
          logger.info(`[DISTRICT] Using cached districts for province: ${currentProvinceId} (${cachedDistricts.length} districts)`, 'DISTRICT');
          setAllDistricts(cachedDistricts);
          setTotalCount(cachedDistricts.length);
          setHasInitialFetch(true);
          setLoading(false);
          setPage(1); // Reset to first page when province changes
          return;
        }
        
        // Fetch districts for the selected province
        logger.info(`[DISTRICT] Fetching districts for province: ${currentProvinceId}`, 'DISTRICT');
        
        const result = await districtService.getAll({
          province_id: currentProvinceId,
          limit: 10000,
          offset: 0,
        });

        // Check if request was aborted
        if (abortController.signal.aborted) {
          return;
        }

        // Normalize the response to handle different shapes
        const normalizedDistricts = normalizeDistrictResponse(result);
        
        if (!result.success) {
          logger.error(`[DISTRICT] District API failed: ${result.error}`, 'DISTRICT');
          setAllDistricts([]);
          setTotalCount(0);
          setHasInitialFetch(true);
          setLoading(false);
          return;
        }

        logger.info(`[DISTRICT] Fetched ${normalizedDistricts.length} districts for province ${currentProvinceId}`, 'DISTRICT');

        // Check if we have valid data
        if (!Array.isArray(normalizedDistricts)) {
          logger.warn(`[DISTRICT] Invalid districts data returned from service`, 'DISTRICT');
          setAllDistricts([]);
          setTotalCount(0);
          setHasInitialFetch(true);
          setLoading(false);
          return;
        }

        // Only cache if we have valid data (not empty)
        if (normalizedDistricts.length > 0) {
          // Cache district results (30 minutes TTL)
          dataCache.set(cacheKey, normalizedDistricts, 30 * 60 * 1000);
          logger.info(`[DISTRICT] Cached ${normalizedDistricts.length} districts for province ${currentProvinceId}`, 'DISTRICT');
        }

        setAllDistricts(normalizedDistricts);
        setTotalCount(normalizedDistricts.length);
        setHasInitialFetch(true);
        setPage(1); // Reset to first page when province changes
        
        logger.info(`[DISTRICT] Loaded ${normalizedDistricts.length} districts for province ${currentProvinceId}`, 'DISTRICT');
      } catch (error: any) {
        // Ignore abort errors
        if (error.name === 'AbortError') {
          return;
        }
        
        logger.error('[DISTRICT] Failed to fetch districts', 'DISTRICT', error);
        setAllDistricts([]);
        setTotalCount(0);
        setHasInitialFetch(true);
        setLoading(false);
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchDistricts();

    // Cleanup function
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [mounted, filters.provinceId, normalizeDistrictResponse]);

  // ============================================
  // MEMOIZED COMPUTATIONS: Client-Side Filtering & Pagination
  // ============================================
  const filteredDistricts = useMemo(() => {
    let filtered = [...allDistricts];
    
    // Apply client-side search filter
    if (debouncedSearch && debouncedSearch.trim()) {
      const searchLower = debouncedSearch.toLowerCase().trim();
      filtered = filtered.filter(district =>
        district.district_name?.toLowerCase().includes(searchLower)
      );
    }
    
    return filtered;
  }, [allDistricts, debouncedSearch]);

  // Client-side pagination
  const paginatedDistricts = useMemo(() => {
    const start = (page - 1) * perPage;
    const end = start + perPage;
    return filteredDistricts.slice(start, end);
  }, [filteredDistricts, page, perPage]);

  // CRITICAL: Use filteredDistricts.length for pagination totals (after filters)
  const totalFiltered = useMemo(() => filteredDistricts.length, [filteredDistricts]);
  const totalPages = useMemo(() => Math.ceil(totalFiltered / perPage), [totalFiltered, perPage]);

  // ============================================
  // TABLE COLUMNS
  // ============================================
  const districtColumns: DataTableColumn<DistrictData>[] = useMemo(() => [
    {
      key: 'province_id',
      label: 'Province ID',
      render: (value) => (
        <span className="text-sm font-sans">{value || 'N/A'}</span>
      ),
    },
    {
      key: 'district_name',
      label: 'District Name',
      render: (value) => (
        <span className="font-semibold text-primary font-khmer">
          {value || 'Unknown'}
        </span>
      ),
    },
  ], []);

  // ============================================
  // EMPTY STATE LOGIC
  // ============================================
  // Show empty state when:
  // - Not loading
  // - No districts data after filtering
  // - We've attempted to fetch (hasInitialFetch is true) OR no province is selected
  const showEmptyState = !loading && filteredDistricts.length === 0 && (hasInitialFetch || !filters.provinceId);
  
  // Show "No districts found for this province" when:
  // - Empty state is true and we've attempted to fetch (hasInitialFetch is true)
  const showNoDataFound = showEmptyState && hasInitialFetch;
  
  // Show "Please select a province to view districts" when:
  // - Empty state is true and no province is selected
  const showSelectProvince = showEmptyState && !filters.provinceId;

  return (
    <div className="w-full space-y-6">
      {/* ============================================ */}
      {/* FILTER CONTAINER - Static Header */}
      {/* ============================================ */}
      <div className="w-full mt-1 md:mt-2 lg:mt-3 bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-border shadow-sm">
        {/* Filter Header - Static */}
        <div className="p-6 pb-4">
          <h1 className={`text-xl font-bold tracking-tight text-primary ${language === 'km' ? 'font-khmer' : ''}`}>
            {language === 'km' ? 'តម្រងស្រុក' : 'Filter District'}
          </h1>
          <p className={`text-muted-foreground mt-2 text-sm ${language === 'km' ? 'font-khmer' : ''}`}>
            {language === 'km' 
              ? 'មើលចំនួនសិស្សដែលបានបូកសរុបតាមស្រុក'
              : 'View student counts aggregated by district'
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
    lg:grid-cols-2"
          >
            {/* Province Filter - Required */}
            <div className="space-y-2">
              <Label
                htmlFor="province-filter"
                className={`text-sm font-medium text-primary ${language === 'km' ? 'font-khmer' : ''}`}
              >
                {language === 'km' ? 'ខេត្ត' : 'Province'}
              </Label>
              <select
                id="province-filter"
                value={filters.provinceId || 'all'}
                onChange={(e) => {
                  setProvinceId(e.target.value === 'all' ? '' : e.target.value);
                  setPage(1); // Reset pagination when filter changes
                }}
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-khmer"
              >
                <option value="all" className="font-khmer">
                  {language === 'km' ? 'សូមជ្រើសរើសខេត្ត' : 'Select Province'}
                </option>
                {provinces.map((province) => (
                  <option key={province.province_id} value={province.province_id} className="font-khmer">
                    {province.province_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Input */}
            <div className="space-y-2">
                <Label
                  htmlFor="search"
                  className={`text-sm font-medium text-primary ${language === 'km' ? 'font-khmer' : ''}`}
                >
                  {language === 'km' ? 'ស្វែងរក' : 'Search'}
                </Label>
                <Input
                  id="search"
                  placeholder={language === 'km' ? 'ស្វែងរកតាមឈ្មោះស្រុក...' : 'Search by district name...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQueryLocal(e.target.value)}
                  disabled={!filters.provinceId}
                  className={`w-full ${language === 'km' ? 'font-khmer' : ''}`}
                />
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
            {language === 'km' ? 'ស្រុក' : 'District'}
          </h1>
          <p className={`text-muted-foreground mt-2 text-sm ${language === 'km' ? 'font-khmer' : ''}`}>
            {language === 'km' 
              ? `${t.common.showing} ${totalFiltered} ${language === 'km' ? 'ស្រុក' : 'districts'}`
              : `${t.common.showing} ${totalFiltered} districts`
            }
          </p>
        </div>
      </div>

      {/* Table Card - Full Width */}
      <div className="w-full
  bg-white dark:bg-card
  rounded-lg
  border border-gray-200 dark:border-border
  p-6 shadow-sm
">
          {loading ? (
            <Loading language={language} />
          ) : paginatedDistricts.length > 0 ? (
            <>
              <DataTable
                data={paginatedDistricts}
                columns={districtColumns}
                getRowKey={(row, index) => `${row.province_id}:${row.district_name}:${index}`}
              />
              
              {/* Pagination */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className={`text-sm text-muted-foreground ${language === 'km' ? 'font-khmer' : ''}`}>
                  {t.common.showing} {totalFiltered === 0 ? 0 : ((page - 1) * perPage) + 1}–{Math.min(page * perPage, totalFiltered)} {t.common.of} {totalFiltered}
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1 || loading}
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
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages || loading}
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
                      <SelectItem value="10" className={language === 'km' ? 'font-khmer' : ''}>10</SelectItem>
                      <SelectItem value="25" className={language === 'km' ? 'font-khmer' : ''}>25</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          ) : showSelectProvince ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className={language === 'km' ? 'font-khmer' : ''}>
                {language === 'km' ? 'សូមជ្រើសរើសខេត្តដើម្បីមើលស្រុក' : 'Please select a province to view districts'}
              </p>
            </div>
          ) : showNoDataFound ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className={language === 'km' ? 'font-khmer' : ''}>
                {language === 'km' ? 'រកមិនឃើញស្រុកសម្រាប់ខេត្តនេះ' : 'No districts found for this province'}
              </p>
            </div>
          ) : null}
      </div>
    </div>
  );
}