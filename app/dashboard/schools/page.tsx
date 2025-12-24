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
import { DataTable, DataTableColumn } from "@/components/dashboard/DataTable";
import { logger } from "@/lib/logger";
import { useLanguage } from "@/lib/i18n/context";
import { getToken } from "@/lib/auth";
import { Loading } from "@/components/ui/Loading";

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
  const { t } = useLanguage();
  // ============================================
  // STATE MANAGEMENT
  // ============================================

  // Data state
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Pagination state
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [total, setTotal] = useState(0);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [provinceFilter, setProvinceFilter] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [schoolTypeFilter, setSchoolTypeFilter] = useState("");
  const [targetFilter, setTargetFilter] = useState("");

  // ============================================
  // PERFORMANCE OPTIMIZATION: Search Debouncing
  // ============================================

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // ============================================
  // API CALLS
  // ============================================

  const fetchSchools = async () => {
    setLoading(true);

    try {
      const token = getToken();
      if (!token) {
        logger.warn('No token available for schools fetch', 'SCHOOLS');
        setSchools([]);
        setTotal(0);
        setLoading(false);
        return;
      }

      const params = new URLSearchParams();
      if (debouncedSearchQuery) params.append("q", debouncedSearchQuery);
      if (provinceFilter) params.append("province", provinceFilter);
      if (districtFilter) params.append("district", districtFilter);
      if (schoolTypeFilter) params.append("school_type", schoolTypeFilter);
      if (targetFilter) params.append("is_target", targetFilter);
      // No limit param - the service will fetch all schools using pagination

      const response = await fetch(`/api/schools/search?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Log the response for debugging
      if (!data.success) {
        logger.error('API returned error', 'SCHOOLS', data.error);
        throw new Error(data.error || 'Failed to fetch schools');
      }

      // Use the data directly from the API - it's already formatted by schoolsService
      const allSchools: School[] = data.data || [];

      logger.info(`Fetched ${allSchools.length} schools, count: ${data.count}`, 'SCHOOLS');

      setSchools(allSchools);
      // Use the count from API which should be the accurate total (1825)
      // If count is not provided, use the length of returned schools
      setTotal(data.count || allSchools.length);
    } catch (error) {
      logger.error("Failed to fetch schools", "SCHOOLS", error);
      setSchools([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (mounted) {
      fetchSchools();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchQuery, provinceFilter, districtFilter, schoolTypeFilter, targetFilter, mounted]);

  // ============================================
  // COMPUTED VALUES (Memoized)
  // ============================================

  const paginatedSchools = useMemo(
    () => schools.slice((page - 1) * perPage, page * perPage),
    [schools, page, perPage]
  );

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / perPage)),
    [total, perPage]
  );

  const start = useMemo(
    () => (total === 0 ? 0 : (page - 1) * perPage + 1),
    [total, page, perPage]
  );

  const end = useMemo(
    () => Math.min(page * perPage, total),
    [page, perPage, total]
  );

  // Get unique provinces with counts for filters
  const provinceList = useMemo(() => {
    const provinceCounts = new Map<string, number>();
    schools.forEach(school => {
      if (school.province_name) {
        const count = provinceCounts.get(school.province_name) || 0;
        provinceCounts.set(school.province_name, count + 1);
      }
    });
    return Array.from(provinceCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [schools]);

  const uniqueSchoolTypes = useMemo(() => {
    const types = new Set<string>();
    schools.forEach(school => {
      if (school.school_type_h) types.add(school.school_type_h);
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
      label: 'School Name',
      render: (value) => value ? <span className="font-khmer">{value}</span> : '-',
    },
    {
      key: 'province_name',
      label: 'Province',
      render: (value) => value ? <span className="font-khmer">{value}</span> : '-',
    },
    {
      key: 'district_name',
      label: 'District',
      render: (value) => value ? <span className="font-khmer">{value}</span> : '-',
    },
    {
      key: 'school_type_h',
      label: 'School Type',
      render: (value) => value ? <span className="font-khmer">{value}</span> : '-',
    },
    {
      key: 'is_target',
      label: 'Target Status',
      render: (value, row) => {
        const isTarget = row.is_target === true || row.target === true;
        return (
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              isTarget
                ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
            }`}
          >
            {isTarget ? "Target" : "Non-Target"}
          </span>
        );
      },
    },
  ], []);

  return (
    <div className="space-y-6">
      {/* ============================================ */}
      {/* SEARCH AND FILTERS SECTION */}
      {/* ============================================ */}
      <div className="
  bg-white dark:bg-slate-900
  rounded-lg
  border border-gray-200 dark:border-slate-700
  p-6 shadow-sm
  mt-6 sm:mt-4 lg:mt-3
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
              className="text-sm font-medium text-gray-700 dark:text-gray-300 font-khmer"
            >
              Search by Name
            </Label>
            <Input
              id="search"
              placeholder="Search schools..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full font-khmer"
            />
          </div>

          {/* Province Filter */}
          <div className="space-y-2">
            <Label
              htmlFor="province-filter"
              className="text-sm font-medium text-gray-700 dark:text-gray-300 font-khmer"
            >
              Province
            </Label>
            <select
              id="province-filter"
              value={provinceFilter}
              onChange={(e) => setProvinceFilter(e.target.value)}
              className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-khmer"
            >
              <option value="" className="font-khmer">All Provinces</option>
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
              className="text-sm font-medium text-gray-700 dark:text-gray-300 font-khmer"
            >
              District
            </Label>
            <Input
              id="district-filter"
              placeholder="Filter by district..."
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className="w-full font-khmer"
            />
          </div>

          {/* School Type Filter */}
          <div className="space-y-2">
            <Label
              htmlFor="school-type-filter"
              className="text-sm font-medium text-gray-700 dark:text-gray-300 font-khmer"
            >
              School Type
            </Label>
            <select
              id="school-type-filter"
              value={schoolTypeFilter}
              onChange={(e) => setSchoolTypeFilter(e.target.value)}
              className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-khmer"
            >
              <option value="" className="font-khmer">All Types</option>
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
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Target Status
            </Label>
            <select
              id="target-filter"
              value={targetFilter}
              onChange={(e) => setTargetFilter(e.target.value)}
              className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Schools</option>
              <option value="true">Target Schools</option>
              <option value="false">Non-Target Schools</option>
            </select>
          </div>
        </div>
      </div>

      {/* ============================================ */}
      {/* PAGE HEADER */}
      {/* ============================================ */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Schools
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage and view all schools ({total} total)
          </p>
        </div>
      </div>

      {/* ============================================ */}
      {/* LOADING STATE OR DATA TABLE */}
      {/* ============================================ */}
      {loading ? (
        <Loading
          title="Loading schools..."
          description="Please wait while we fetch the data"
          showSkeleton={true}
        />
      ) : (
        <>
          {/* Data Table */}
          <DataTable<School>
            columns={columns}
            data={paginatedSchools}
          />

          {/* ============================================ */}
          {/* PAGINATION CONTROLS */}
          {/* ============================================ */}
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Showing {start}–{end} of {total}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>

              <div className="px-3 text-sm">
                Page {page} of {totalPages}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>

              <select
                value={perPage}
                onChange={(e) => {
                  setPerPage(Number(e.target.value));
                  setPage(1);
                }}
                className="ml-2 rounded border bg-background px-2 py-1 text-sm"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

