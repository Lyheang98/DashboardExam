'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

interface ProvinceData {
  province_id: string;
  province_name: string;
  total_count: number;
}

export default function ProvincePage() {
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(true); // Show loading initially
  const [provinces, setProvinces] = useState<ProvinceData[]>([]);
  const [allProvinces, setAllProvinces] = useState<ProvinceData[]>([]); // Store all provinces for total calculation
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalStudents, setTotalStudents] = useState(0); // Total students from API
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [provinceIdQuery, setProvinceIdQuery] = useState('');
  const [debouncedProvinceId, setDebouncedProvinceId] = useState('');
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const provinceIdTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const allProvincesAbortControllerRef = useRef<AbortController | null>(null);

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

  // Fetch all provinces for total calculation (without pagination/filters)
  const fetchAllProvinces = useCallback(async () => {
    // Cancel previous request if still pending
    if (allProvincesAbortControllerRef.current) {
      allProvincesAbortControllerRef.current.abort();
    }
    
    // Create new abort controller for this request
    const abortController = new AbortController();
    allProvincesAbortControllerRef.current = abortController;
    
    try {
      const token = getToken();
      if (!token) {
        return;
      }

      // Fetch all provinces without pagination or filters for accurate total
      const response = await fetch(`/api/students/provinces?limit=1000&offset=0`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal: abortController.signal,
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success && result.data && Array.isArray(result.data)) {
        setAllProvinces(result.data);
        // Update total students from API response if available
        if (result.total_students !== undefined) {
          setTotalStudents(result.total_students);
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return;
      }
      logger.error('Failed to fetch all provinces for total', 'PROVINCE', error);
    }
  }, []);

  // Fetch provinces - optimized with request cancellation and error handling
  const fetchProvinces = useCallback(async () => {
    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    
    try {
      setLoading(true);
      const token = getToken();
      if (!token) {
        logger.warn('No token available for province fetch', 'PROVINCE');
        setLoading(false);
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

      if (result.success) {
        if (result.data && Array.isArray(result.data)) {
          setProvinces(result.data);
          setTotal(result.count || result.data.length);
          // Use total_students from API if available
          if (result.total_students !== undefined) {
            setTotalStudents(result.total_students);
          }
        } else {
          setProvinces([]);
          setTotal(0);
          setTotalStudents(0);
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
      setProvinces([]);
      setTotal(0);
    } finally {
      if (!abortController.signal.aborted) {
        setLoading(false);
      }
    }
  }, [page, perPage, debouncedSearch, debouncedProvinceId]);

  // Fetch all provinces once on mount and when filters change (for accurate total)
  useEffect(() => {
    fetchAllProvinces();
    
    return () => {
      if (allProvincesAbortControllerRef.current) {
        allProvincesAbortControllerRef.current.abort();
      }
    };
  }, [fetchAllProvinces, debouncedSearch, debouncedProvinceId]);

  useEffect(() => {
    // Set loading to true only when actually fetching
    setLoading(true);
    fetchProvinces();
    
    // Cleanup: abort request if component unmounts or dependencies change
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchProvinces]);

  // Calculate total students - use API value if available, otherwise sum from all provinces
  const displayTotalStudents = useMemo(() => {
    if (totalStudents > 0) {
      return totalStudents; // Use API value if available
    }
    // Fallback: calculate from all provinces
    if (allProvinces.length > 0) {
      return allProvinces.reduce((sum, province) => sum + (province.total_count || 0), 0);
    }
    // Last fallback: calculate from current page provinces
    return provinces.reduce((sum, province) => sum + (province.total_count || 0), 0);
  }, [totalStudents, allProvinces, provinces]);

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
      <div className="flex items-start justify-between">
        <div>
          <h1 className={`text-3xl font-bold tracking-tight ${language === 'km' ? 'font-khmer' : ''}`}>
            Province
          </h1>
          <p className={`text-muted-foreground mt-2 ${language === 'km' ? 'font-khmer' : ''}`}>
            View student counts aggregated by province
          </p>
        </div>
        {/* Small attractive card for total students */}
        <Card className="w-auto min-w-[110px] border-primary/20 bg-primary/5 dark:bg-primary/10">
          <CardContent className="p-2.5">
            <div className={`text-sm font-bold text-primary ${language === 'km' ? 'font-khmer' : ''}`}>
              {loading ? '...' : displayTotalStudents.toLocaleString()}
            </div>
            <p className={`text-[10px] text-muted-foreground mt-0.5 leading-tight ${language === 'km' ? 'font-khmer' : ''}`}>
              Total Students
            </p>
            <p className={`text-[9px] text-muted-foreground/70 mt-0.5 ${language === 'km' ? 'font-khmer' : ''}`}>
              25 Provinces
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters Card */}
      <Card>
        <CardHeader>
          <CardTitle className={language === 'km' ? 'font-khmer' : ''}>
            Filters
          </CardTitle>
          <CardDescription className={language === 'km' ? 'font-khmer' : ''}>
            Search and filter provinces
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search" className={language === 'km' ? 'font-khmer' : ''}>
                Search Province Name
              </Label>
              <Input
                id="search"
                placeholder="Search by province name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={language === 'km' ? 'font-khmer' : ''}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="provinceId" className={language === 'km' ? 'font-khmer' : ''}>
                Search Province ID
              </Label>
              <Input
                id="provinceId"
                placeholder="Search by province ID..."
                value={provinceIdQuery}
                onChange={(e) => setProvinceIdQuery(e.target.value)}
                className={language === 'km' ? 'font-khmer' : ''}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table Card */}
      <Card>
        <CardHeader>
          <CardTitle className={language === 'km' ? 'font-khmer' : ''}>
            Provinces
          </CardTitle>
          <CardDescription className={language === 'km' ? 'font-khmer' : ''}>
            Showing {provinces.length} of {total} provinces
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Loading />
          ) : provinces.length > 0 ? (
            <>
              <DataTable
                data={provinces}
                columns={provinceColumns}
              />
              
              {/* Pagination */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                {/* Left: Showing X-Y of Z */}
                <div className="text-sm text-muted-foreground">
                  Showing {((page - 1) * perPage) + 1}–{Math.min(page * perPage, total)} of {total}
                </div>
                
                {/* Right: Previous, Page X of Y, Next, Items per page */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1 || loading}
                  >
                    Previous
                  </Button>
                  
                  <div className="px-3 text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages || loading}
                  >
                    Next
                  </Button>
                  
                  <Select
                    value={perPage.toString()}
                    onValueChange={(value) => {
                      setPerPage(parseInt(value, 10));
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="w-20 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p className={language === 'km' ? 'font-khmer' : ''}>
                No provinces found
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
