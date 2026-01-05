"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/lib/i18n/context";
import { Loading } from "@/components/ui/Loading";
import { DataTable, DataTableColumn } from "@/components/dashboard/DataTable";
import { logger } from "@/lib/logger";
import { provinceService } from "@/lib/api";

interface ProvinceData {
  province_id: string;
  province_name: string;
  total_count: number;
}

/**
 * OPTIMIZED PROVINCE PAGE
 *
 * Performance optimizations:
 * - Fetches ALL province data once and caches in memory
 * - Pagination is client-side only (no API refetch)
 * - Filters are applied client-side using memoized computations
 * - Same data source for stat cards and table
 * - No refetch on language change or UI-only state updates
 */
export default function ProvincePage() {
  const { t, language } = useLanguage();

  // ============================================
  // STATE: Data (fetched once, cached in memory)
  // ============================================
  const [allProvinces, setAllProvinces] = useState<ProvinceData[]>([]); // Full province summary (cached)
  const [loading, setLoading] = useState(true); // Initial load only
  const [isInitialLoad, setIsInitialLoad] = useState(true); // Track if we've loaded data

  // ============================================
  // STATE: UI Only (pagination, filters)
  // ============================================
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [provinceIdQuery, setProvinceIdQuery] = useState("");
  const [debouncedProvinceId, setDebouncedProvinceId] = useState("");

  // ============================================
  // REFS: Debouncing & Request Management
  // ============================================
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const provinceIdTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasFetchedRef = useRef<boolean>(false); // Track if we've fetched data (prevents refetch)

  // ============================================
  // DEBOUNCING: Search filters (UI-only, no API call)
  // ============================================
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

  // ============================================
  // DATA FETCHING: Fetch ALL provinces once (no pagination params)
  // ============================================
  // Fetch data only once on mount
  useEffect(() => {
    if (hasFetchedRef.current) {
      logger.info("Using cached province data in memory", "PROVINCE");
      return;
    }

    hasFetchedRef.current = true;
    setLoading(true);

    const fetchData = async () => {
      try {
        const result = await provinceService.getAll({
          limit: 1000,
          offset: 0,
        });

        if (result.success && Array.isArray(result.data)) {
          setAllProvinces(result.data);
          logger.info(`Loaded ${result.data.length} provinces`, "PROVINCE");
        } else {
          logger.warn("Province API returned no data", "PROVINCE");
          setAllProvinces([]);
        }
      } catch (error) {
        logger.error("Failed to fetch provinces", "PROVINCE", error);
        setAllProvinces([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);
  // Empty deps - only fetch once on mount

  // ============================================
  // MEMOIZED COMPUTATIONS: Client-side filtering & pagination
  // ============================================

  // Filter provinces based on search queries (client-side only)
  const filteredProvinces = useMemo(() => {
    let filtered = [...allProvinces];

    // Apply province name filter
    if (debouncedSearch) {
      const searchLower = debouncedSearch.toLowerCase();
      filtered = filtered.filter((p) =>
        p.province_name.toLowerCase().includes(searchLower)
      );
    }

    // Apply province ID filter
    if (debouncedProvinceId) {
      const idLower = debouncedProvinceId.toLowerCase();
      filtered = filtered.filter((p) =>
        p.province_id.toLowerCase().includes(idLower)
      );
    }

    return filtered;
  }, [allProvinces, debouncedSearch, debouncedProvinceId]);

  // Paginate filtered provinces (client-side only)
  const paginatedProvinces = useMemo(() => {
    const start = (page - 1) * perPage;
    const end = start + perPage;
    return filteredProvinces.slice(start, end);
  }, [filteredProvinces, page, perPage]);

  // Total count for pagination (from filtered data)
  const totalFiltered = useMemo(
    () => filteredProvinces.length,
    [filteredProvinces]
  );

  // Total pages
  const totalPages = useMemo(
    () => Math.ceil(totalFiltered / perPage),
    [totalFiltered, perPage]
  );

  // ============================================
  // TABLE COLUMNS: Memoized to prevent recreation
  // ============================================
  const provinceColumns: DataTableColumn<ProvinceData>[] = useMemo(
    () => [
      {
        key: "province_id",
        label: "Province ID",
        render: (value) => (
          <span className="text-sm font-sans">{value || "N/A"}</span>
        ),
      },
      {
        key: "province_name",
        label: "Province Name",
        render: (value) => (
          <span className="font-semibold text-primary font-khmer">
            {value || "Unknown"}
          </span>
        ),
      },
    ],
    []
  ); // Empty deps - columns don't change

  return (
    <div className="w-full space-y-6">
      {/* ============================================ */}
      {/* FILTER CONTAINER - Static Header */}
      {/* ============================================ */}
      <div className="w-full mt-1 md:mt-2 lg:mt-3 bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-border shadow-sm">
        {/* Filter Header - Static */}
        <div className="p-6 pb-4">
          <h1
            className={`text-xl font-bold tracking-tight text-primary ${
              language === "km" ? "font-khmer" : ""
            }`}
          >
            {language === "km" ? "តម្រងខេត្ត" : "Filter Province"}
          </h1>
          <p
            className={`text-muted-foreground mt-2 text-sm ${
              language === "km" ? "font-khmer" : ""
            }`}
          >
            {language === "km"
              ? "មើលចំនួនសិស្សដែលបានបូកសរុបតាមខេត្ត"
              : "View student counts aggregated by province"}
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
            {/* Search by Name */}
            <div className="space-y-2">
              <Label
                htmlFor="search"
                className={`text-sm font-medium text-primary ${
                  language === "km" ? "font-khmer" : ""
                }`}
              >
                {language === "km" ? "ស្វែងរកតាមឈ្មោះ" : "Search by Name"}
              </Label>
              <Input
                id="search"
                placeholder={
                  language === "km"
                    ? "ស្វែងរកតាមឈ្មោះខេត្ត..."
                    : "Search by province name..."
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full ${language === "km" ? "font-khmer" : ""}`}
              />
            </div>

            {/* Search by ID */}
            <div className="space-y-2">
              <Label
                htmlFor="province-id-search"
                className={`text-sm font-medium text-primary ${
                  language === "km" ? "font-khmer" : ""
                }`}
              >
                {language === "km" ? "ស្វែងរកតាមលេខសម្គាល់" : "Search by ID"}
              </Label>
              <Input
                id="province-id-search"
                placeholder={
                  language === "km"
                    ? "ស្វែងរកតាមលេខសម្គាល់ខេត្ត..."
                    : "Search by province ID..."
                }
                value={provinceIdQuery}
                onChange={(e) => setProvinceIdQuery(e.target.value)}
                className={`w-full ${language === "km" ? "font-khmer" : ""}`}
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
          <h1
            className={`text-xl font-bold tracking-tight text-primary ${
              language === "km" ? "font-khmer" : ""
            }`}
          >
            {language === "km" ? "ខេត្ត" : "Province"}
          </h1>
          <p
            className={`text-muted-foreground mt-2 text-sm ${
              language === "km" ? "font-khmer" : ""
            }`}
          >
            {language === "km"
              ? `${t.common.showing} ${filteredProvinces.length} ${
                  language === "km" ? "ខេត្ត" : "provinces"
                }`
              : `${t.common.showing} ${filteredProvinces.length} provinces`}
          </p>
        </div>
      </div>

      {/* Table Card - Full Width */}
      <div
        className="w-full
  bg-white dark:bg-card
  rounded-lg
  border border-gray-200 dark:border-border
  p-6 shadow-sm
"
      >
        {loading ? (
          <Loading language={language} />
        ) : paginatedProvinces.length > 0 ? (
          <>
            <DataTable data={paginatedProvinces} columns={provinceColumns} />

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              {/* Left: Showing X-Y of Z */}
              <div
                className={`text-sm text-muted-foreground ${
                  language === "km" ? "font-khmer" : ""
                }`}
              >
                {t.common.showing}{" "}
                {totalFiltered === 0 ? 0 : (page - 1) * perPage + 1}–
                {Math.min(page * perPage, totalFiltered)} {t.common.of}{" "}
                {totalFiltered}
              </div>

              {/* Right: Previous, Page X of Y, Next, Items per page */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1 || loading}
                  className={language === "km" ? "font-khmer" : ""}
                >
                  {t.common.prev}
                </Button>

                <div
                  className={`px-3 text-sm text-muted-foreground ${
                    language === "km" ? "font-khmer" : ""
                  }`}
                >
                  {t.common.page} {page} {t.common.of} {totalPages}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || loading}
                  className={language === "km" ? "font-khmer" : ""}
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
                  <SelectTrigger
                    className={`w-20 h-9 ${
                      language === "km" ? "font-khmer" : ""
                    }`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      value="10"
                      className={language === "km" ? "font-khmer" : ""}
                    >
                      10
                    </SelectItem>
                    <SelectItem
                      value="25"
                      className={language === "km" ? "font-khmer" : ""}
                    >
                      25
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p className={language === "km" ? "font-khmer" : ""}>
              {language === "km" ? "រកមិនឃើញខេត្ត" : "No provinces found"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
