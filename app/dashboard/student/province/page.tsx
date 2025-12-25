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
import { getToken } from '@/lib/auth';
import { Loading } from '@/components/ui/Loading';
import { DataTable, DataTableColumn } from '@/components/dashboard/DataTable';
import { logger } from '@/lib/logger';
import { dataCache } from '@/lib/cache/dataCache';

interface ProvinceData {
  province_id: string;
  province_name: string;
  total_count: number;
}

export default function ProvincePage() {
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(true); // Show loading initially
  const [provinces, setProvinces] = useState<ProvinceData[]>([]);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalStudents, setTotalStudents] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [provinceIdQuery, setProvinceIdQuery] = useState('');
  const [debouncedProvinceId, setDebouncedProvinceId] = useState('');
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const provinceIdTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Debounce search by province name - reduced to 300ms for faster response
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1); // Reset to first page on search
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Debounce search by province ID - reduced to 300ms for faster response
  useEffect(() => {
    if (provinceIdTimeoutRef.current) {
      clearTimeout(provinceIdTimeoutRef.current);
    }
    provinceIdTimeoutRef.current = setTimeout(() => {
      setDebouncedProvinceId(provinceIdQuery);
      setPage(1); // Reset to first page on search
    }, 300);

    return () => {
      if (provinceIdTimeoutRef.current) {
        clearTimeout(provinceIdTimeoutRef.current);
      }
    };
  }, [provinceIdQuery]);

  // Fetch provinces - optimized with request cancellation and error handling
  const fetchProvinces = useCallback(async () => {
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
    const minLoadingTime = 300; // Minimum loading time for smooth UX
    
    try {
      const token = getToken();
      if (!token) {
        logger.warn('No token available for province fetch', 'PROVINCE');
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
        return;
      }

      const offset = (page - 1) * perPage;
      const params = new URLSearchParams({
        limit: perPage.toString(),
        offset: offset.toString(),
      });

      if (debouncedSearch) {
        params.append('province_name', debouncedSearch);
      }

      if (debouncedProvinceId) {
        params.append('province_id', debouncedProvinceId);
      }

      const response = await fetch(`/api/students/provinces?${params.toString()}`, {
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

      const result = await response.json();

      // Check if request was cancelled
      if (abortController.signal.aborted) {
        return;
      }

      if (result.success) {
        if (result.data && Array.isArray(result.data)) {
          // Ensure minimum loading time for smooth UX
          const elapsedTime = Date.now() - startTime;
          const remainingTime = Math.max(0, minLoadingTime - elapsedTime);
          await new Promise(resolve => setTimeout(resolve, remainingTime));

          // Double-check request wasn't cancelled during wait
          if (!abortController.signal.aborted) {
            setProvinces(result.data);
            setTotal(result.count || result.data.length);
            // Also update total students if available in response
            if (result.total_students !== undefined) {
              setTotalStudents(result.total_students);
            }
          }
        } else {
          if (!abortController.signal.aborted) {
            setProvinces([]);
            setTotal(0);
          }
        }
      } else {
        throw new Error(result.error || 'Failed to fetch data');
      }
    } catch (error: any) {
      // Ignore abort errors (cancelled requests)
      if (error.name === 'AbortError') {
        return;
      }
      logger.error('Failed to fetch provinces', 'PROVINCE', error);
      if (!abortController.signal.aborted) {
        setProvinces([]);
        setTotal(0);
      }
    } finally {
      if (!abortController.signal.aborted) {
        setLoading(false);
      }
    }
  }, [page, perPage, debouncedSearch, debouncedProvinceId]);

  useEffect(() => {
    // Set loading to true only when actually fetching
    setLoading(true);
    fetchProvinces();
    
    // Cleanup: abort request if component unmount or dependencies change
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchProvinces]);

  // Fetch total students count from 25 provinces (if not already fetched from API response)
  useEffect(() => {
    if (totalStudents > 0) return; // Skip if already have the value from API response
    
    const controller = new AbortController();
    let isMounted = true;

    const fetchTotalStudents = async () => {
      try {
        const token = getToken();
        if (!token) {
          logger.warn('No token available for students fetch', 'PROVINCE');
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
            // Cache for 30 minutes
            dataCache.set(cacheKey, total, 30 * 60 * 1000);
            logger.info(`Total students fetched: ${total}`, 'PROVINCE');
          } else {
            setTotalStudents(0);
          }
        }
      } catch (error: any) {
        if (isMounted && error?.name !== 'AbortError') {
          logger.error('Failed to fetch total students', 'PROVINCE', error);
          setTotalStudents(0);
        }
      }
    };

    fetchTotalStudents();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [totalStudents]);

  // Table columns
  const provinceColumns: DataTableColumn<ProvinceData>[] = [
    {
      key: 'province_id',
      label: 'Province ID',
      render: (value) => (
        <span className="font-mono text-sm">{value || 'N/A'}</span>
      ),
    },
    {
      key: 'province_name',
      label: 'Province Name',
      render: (value) => (
        <span className="font-semibold text-primary font-khmer">
          {value || 'Unknown'}
        </span>
      ),
    },
    {
      key: 'total_count',
      label: 'Total Students',
      render: (value) => (
        <span className="font-medium text-primary">
          {typeof value === 'number' ? value.toLocaleString() : '0'}
        </span>
      ),
    },
  ];

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mt-6">
        <h1 className={`text-xl font-bold tracking-tight text-primary ${language === 'km' ? 'font-khmer' : ''}`}>
          {language === 'km' ? 'តម្រងខេត្ត' : 'Filter Province'}
        </h1>
        <p className={`text-muted-foreground mt-2 text-sm ${language === 'km' ? 'font-khmer' : ''}`}>
          {language === 'km' 
            ? 'មើលចំនួនសិស្សដែលបានបូកសរុបតាមខេត្ត'
            : 'View student counts aggregated by province'
          }
        </p>
      </div>

      {/* Filters Card */}
      <Card>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search" className={`text-sm font-medium text-primary ${language === 'km' ? 'font-khmer' : ''}`}>
                {language === 'km' ? 'ស្វែងរកឈ្មោះខេត្ត' : 'Search Province Name'}
              </Label>
              <Input
                id="search"
                placeholder={language === 'km' ? 'ស្វែងរកតាមឈ្មោះខេត្ត...' : 'Search by province name...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full font-khmer"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="provinceId" className={`text-sm font-medium text-primary ${language === 'km' ? 'font-khmer' : ''}`}>
                {language === 'km' ? 'ស្វែងរកលេខសម្គាល់ខេត្ត' : 'Search Province ID'}
              </Label>
              <Input
                id="provinceId"
                placeholder={language === 'km' ? 'ស្វែងរកតាមលេខសម្គាល់ខេត្ត...' : 'Search by province ID...'}
                value={provinceIdQuery}
                onChange={(e) => setProvinceIdQuery(e.target.value)}
                className="w-full font-khmer"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ============================================ */}
      {/* PAGE HEADER ABOVE TABLE */}
      {/* ============================================ */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className={`text-xl font-bold tracking-tight text-primary ${language === 'km' ? 'font-khmer' : ''}`}>
            {language === 'km' ? 'ខេត្ត' : 'Province'}
          </h1>
          <p className={`text-muted-foreground mt-2 text-sm ${language === 'km' ? 'font-khmer' : ''}`}>
            {language === 'km' 
              ? `${t.common.showing} ${totalStudents.toLocaleString()} ${language === 'km' ? 'សិស្ស' : 'students'} ${language === 'km' ? 'នៅក្នុង' : 'in'} 25 ${language === 'km' ? 'ខេត្ត' : 'provinces'}`
              : `${t.common.showing} ${totalStudents.toLocaleString()} students in 25 provinces`
            }
          </p>
        </div>
      </div>

      {/* Table Card */}
      <Card>
        <CardContent>
          {loading ? (
            <Loading language={language} />
          ) : provinces.length > 0 ? (
            <>
              <DataTable
                data={provinces}
                columns={provinceColumns}
              />
              
              {/* Pagination */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                {/* Left: Showing X-Y of Z */}
                <div className={`text-sm text-muted-foreground ${language === 'km' ? 'font-khmer' : ''}`}>
                  {t.common.showing} {((page - 1) * perPage) + 1}–{Math.min(page * perPage, total)} {t.common.of} {total}
                </div>
                
                {/* Right: Previous, Page X of Y, Next, Items per page */}
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
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p className={language === 'km' ? 'font-khmer' : ''}>
                {language === 'km' ? 'រកមិនឃើញខេត្ត' : 'No provinces found'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
