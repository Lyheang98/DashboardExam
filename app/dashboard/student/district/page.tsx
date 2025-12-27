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

interface DistrictData {
  province_id: string;
  district_name: string;
  total_count: number;
}

/**
 * DISTRICT PAGE - Matches Students page behavior
 * 
 * Requirements:
 * - Requires: provinceId ONLY
 * - Auto-fetches when province is selected (no button click needed)
 * - Shows empty state before province selection
 * - Uses client-side pagination after fetching all districts
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
  const [allDistricts, setAllDistricts] = useState<DistrictData[]>([]); // All district summaries fetched once
  const [totalCount, setTotalCount] = useState<number>(0); // Total count from API
  const [loading, setLoading] = useState(false);
  const [provinces, setProvinces] = useState<Array<{ province_id: string; province_name: string }>>([]);
  const [provinceDistrictCounts, setProvinceDistrictCounts] = useState<Map<string, number>>(new Map());
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
  // INITIAL FETCH: Fetch districts ONCE on mount (no filters)
  // CRITICAL: Fetch all districts once, then filter client-side
  // ============================================
  useEffect(() => {
    // Only fetch after component is mounted
    if (!mounted) {
      return;
    }

    // Skip if already fetched
    if (hasInitialFetch) {
      return;
    }

    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setLoading(true);

    const fetchAllDistricts = async () => {
      try {
        // Use DistrictService to fetch all districts
        logger.info(`[DISTRICT] Fetching all districts (no filters)`, 'FILTERS');
        
        const result = await districtService.getAll({
          limit: 10000,
          offset: 0,
        });

        if (abortController.signal.aborted) {
          return;
        }

        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch districts');
        }

        const allDistrictsData = result.data || [];
        
        logger.info(`[DISTRICT] Fetched ${allDistrictsData.length} districts (API count: ${result.count || 0})`, 'FILTERS');

        // Check if we have valid data
        if (!Array.isArray(allDistrictsData) || allDistrictsData.length === 0) {
          logger.warn(`[DISTRICT] No districts returned from service`, 'FILTERS');
          setAllDistricts([]);
          setTotalCount(0);
          setHasInitialFetch(true);
          setProvinceDistrictCounts(new Map());
          return;
        }

        setAllDistricts(allDistrictsData);
        setTotalCount(result.count || allDistrictsData.length);
        setHasInitialFetch(true);
        
        // Calculate district counts per province for dropdown display
        const countsMap = new Map<string, number>();
        allDistrictsData.forEach((district: DistrictData) => {
          const provinceId = (district.province_id || '').trim();
          if (provinceId && provinceId !== 'string' && provinceId !== 'null' && provinceId.length > 0) {
            countsMap.set(provinceId, (countsMap.get(provinceId) || 0) + 1);
          }
        });
        setProvinceDistrictCounts(countsMap);
        
        logger.info(`[DISTRICT] Calculated district counts for ${countsMap.size} provinces`, 'FILTERS');
      } catch (error: any) {
        if (error.name === 'AbortError') {
          return; // Request was cancelled, ignore
        }
        logger.error('[DISTRICT] Failed to fetch districts', 'FILTERS', error);
        setAllDistricts([]);
        setTotalCount(0);
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchAllDistricts();
  }, [mounted, hasInitialFetch]);



  // ============================================
  // MEMOIZED COMPUTATIONS: Client-Side Filtering & Pagination
  // CRITICAL: allDistricts contains ALL districts, filtering and pagination are client-side
  // ============================================
  const filteredDistricts = useMemo(() => {
    let filtered = [...allDistricts];
    
    // Apply province filter (if selected)
    if (filters.provinceId) {
      filtered = filtered.filter(district => 
        district.province_id === filters.provinceId
      );
    }
    
    // Apply client-side search filter
    if (debouncedSearch && debouncedSearch.trim()) {
      const searchLower = debouncedSearch.toLowerCase().trim();
      filtered = filtered.filter(district =>
        district.district_name?.toLowerCase().includes(searchLower)
      );
    }
    
    return filtered;
  }, [allDistricts, filters.provinceId, debouncedSearch]);

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
  const showEmptyState = !loading && filteredDistricts.length === 0 && hasInitialFetch;
  
  // Show "No districts found" when:
  // - Empty state is true and we've attempted to fetch
  const showNoDataFound = showEmptyState;

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="mt-6">
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
    lg:grid-cols-2"
        >
          {/* Province Filter */}
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
              onChange={(e) => setProvinceId(e.target.value === 'all' ? '' : e.target.value)}
              className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-khmer"
            >
              <option value="all" className="font-khmer">
                {language === 'km' ? 'ខេត្តទាំងអស់' : 'All Provinces'}
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
              className={`w-full ${language === 'km' ? 'font-khmer' : ''}`}
            />
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
          ) : showNoDataFound ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className={language === 'km' ? 'font-khmer' : ''}>
                {language === 'km' ? 'រកមិនឃើញស្រុក' : 'No districts found'}
              </p>
            </div>
          ) : null}
      </div>
    </div>
  );
}

