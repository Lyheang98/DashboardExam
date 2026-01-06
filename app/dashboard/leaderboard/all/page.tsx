"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n/context";
import { Loading } from "@/components/ui/Loading";
import { DataTable, DataTableColumn } from "@/components/dashboard/DataTable";
import { logger } from "@/lib/logger";
import { EXTERNAL_ENDPOINTS } from "@/lib/api/config";
import { apiClient } from "@/lib/api/client";
import { getToken } from "@/lib/auth";
import { getProvinces } from "@/lib/constants/provinces";
import {
  resultSubjectsService,
  ResultSubjectsParams,
} from "@/lib/api/services/resultSubjects.service";
import { studentsService } from "@/lib/api";
import { StudentDetail } from "@/lib/api/services/studentDetail.service";

// Constants for dropdown options
const GRADES = ["7", "8", "9", "10", "11", "12"];

// Type definitions for better type safety
interface LeaderboardParams {
  provinceId?: string;
  provinceName?: string;
  districtName?: string;
  geipSchoolId?: string;
  gradeName?: string;
  room?: string;
  subject?: string;
}

interface ProcessedStudent {
  studentId: string;
  studentName: string;
  gender: string;
  grade: string;
  class: string;
  room: string;
  school: string;
  subjects: Record<
    string,
    {
      score: number | null;
      max_score?: number;
      level?: string;
      result?: string;
    }
  >;
  totalScore: number;
  rank: number;
}

// Use a more flexible type for raw API data
type RawApiData = Record<string, any>;

export default function LeaderboardAllPage() {
  const { t, language } = useLanguage();

  // Filter Inputs
  const [provinceId, setProvinceId] = useState<string>("");
  const [districtName, setDistrictName] = useState<string>("");
  const [geipSchoolId, setGeipSchoolId] = useState<string>("");
  const [gradeFilter, setGradeFilter] = useState<string>("");
  const [roomFilter, setRoomFilter] = useState<string>("");
  const [subjectFilter, setSubjectFilter] = useState<string>("");

  // Applied Filters
  const [appliedFilters, setAppliedFilters] =
    useState<LeaderboardParams | null>(null);

  // Data
  const [rawApiData, setRawApiData] = useState<RawApiData[]>([]); // Store raw API data
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAppliedFilters, setHasAppliedFilters] = useState(false);

  // Dropdown Options
  const [provinces] = useState<
    Array<{ province_id: string; province_name: string }>
  >(getProvinces());
  const [districts, setDistricts] = useState<
    Array<{ province_id: string; district_name: string }>
  >([]);
  const [schools, setSchools] = useState<
    Array<{
      province_id: string;
      district_name: string;
      school_name: string;
      geip_school_ID: string;
    }>
  >([]);
  const [schoolLoading, setSchoolLoading] = useState(false);
  const [roomOptions, setRoomOptions] = useState<string[]>([]); // Room options from student data
  const [subjectOptions, setSubjectOptions] = useState<string[]>([]); // Subject options from API data

  // Pagination
  const [page, setPage] = useState(1);
  const perPage = 25;
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load Districts
  useEffect(() => {
    if (!provinceId) {
      setDistricts([]);
      setDistrictName("");
      setSchools([]);
      setGeipSchoolId("");
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
          const districtsData =
            data?.results || data?.data || (Array.isArray(data) ? data : []);
          const uniqueDistricts = districtsData
            .map((d: any) => ({
              province_id: d.province_id || d.province_ID || provinceId,
              district_name: d.district_name || d.district_Name || d.name || "",
            }))
            .filter((d: any) => d.district_name && d.district_name.trim())
            .sort((a: any, b: any) =>
              a.district_name.localeCompare(b.district_name)
            );

          setDistricts(uniqueDistricts);
        }
      } catch (error: any) {
        logger.error(
          `[LEADERBOARD] Failed to fetch districts`,
          "LEADERBOARD",
          error
        );
        setDistricts([]);
      }
    };

    loadDistricts();
  }, [provinceId]);

  // Load Schools
  useEffect(() => {
    if (!provinceId || !districtName) {
      setSchools([]);
      setGeipSchoolId("");
      return;
    }

    const loadSchools = async () => {
      setSchoolLoading(true);
      try {
        const token = getToken();
        if (!token) return;

        const lookupUrl = EXTERNAL_ENDPOINTS.SCHOOLS_LOOKUP.LIST(
          provinceId,
          districtName
        );
        const response = await apiClient.get(lookupUrl, { token });

        if (response.success) {
          const data = response.data as any;
          const schoolsData =
            data?.results || data?.data || (Array.isArray(data) ? data : []);
          
          // Helper function to sanitize school IDs
          const sanitizeSchoolId = (id: string): string => {
            return String(id)
              .trim()
              .replace(/-+$/, '') // Remove trailing hyphens
              .replace(/^\d+-/, (match) => match.slice(0, -1)) // Handle "4-" pattern
              .trim();
          };

          const uniqueSchools = schoolsData
            .map((s: any) => {
              const rawSchoolId =
                s.geip_school_ID ||
                s.geip_school_id ||
                s.school_id ||
                s.school_ID ||
                s.id ||
                "";
              
              const sanitizedId = sanitizeSchoolId(rawSchoolId);
              
              // Log suspicious school IDs for debugging
              if (rawSchoolId !== sanitizedId && rawSchoolId) {
                logger.warn(
                  `[LEADERBOARD] School ID sanitized: "${rawSchoolId}" → "${sanitizedId}"`,
                  "LEADERBOARD"
                );
              }
              
              return {
                province_id: s.province_id || s.province_ID || provinceId,
                district_name: s.district_name || s.district_Name || districtName,
                school_name: s.school_name || s.school_Name || s.name || "",
                geip_school_ID: sanitizedId,
              };
            })
            .filter((s: any) => s.school_name && s.school_name.trim() && s.geip_school_ID)
            .sort((a: any, b: any) =>
              a.school_name.localeCompare(b.school_name)
            );

          setSchools(uniqueSchools);
        }
      } catch (error: any) {
        logger.error(
          `[LEADERBOARD] Failed to fetch schools`,
          "LEADERBOARD",
          error
        );
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
        const result = await studentsService.getList(token, {
          provinceId: provinceId.trim(),
          districtId: districtName.trim(),
          schoolId: geipSchoolId.trim(),
          grade: gradeFilter.trim(),
          page: 1,
          size: 100, // Fetch enough to get all unique rooms
        });

        if (!result.success || !result.data) {
          setRoomOptions([]);
          return;
        }

        // Extract unique room values from response
        const uniqueRooms = new Set<string>();
        result.data.forEach((student: StudentDetail) => {
          const room =
            student.room || student.class || student.class_name || "";
          if (room && room.toString().trim()) {
            uniqueRooms.add(room.toString().trim());
          }
        });

        const sortedRooms = Array.from(uniqueRooms).sort();
        setRoomOptions(sortedRooms);
      } catch (error: any) {
        logger.info(
          `[LEADERBOARD] No room data available for Grade ${gradeFilter} - Room dropdown will be empty`,
          "LEADERBOARD"
        );
        setRoomOptions([]);
      }
    };

    loadRoomOptions();
  }, [provinceId, districtName, geipSchoolId, gradeFilter]);

  // Fetch Leaderboard using the resultSubjectsService
  const fetchLeaderboard = useCallback(
    async (filters: LeaderboardParams, pageNum: number) => {
      // Validate required filters
      if (
        !filters.provinceId ||
        !filters.provinceName ||
        !filters.districtName ||
        !filters.geipSchoolId ||
        !filters.gradeName
      ) {
        if (process.env.NODE_ENV === "development") {
          logger.warn(
            `[LEADERBOARD] Missing required filters for fetch`,
            "LEADERBOARD"
          );
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

      try {
        const token = getToken();
        if (!token) {
          throw new Error("Authentication required");
        }

        // Use the resultSubjectsService with proper parameters
        const response = await resultSubjectsService.getList(
          token,
          {
            provinceName: filters.provinceName, // Use province NAME, not ID
            districtName: filters.districtName,
            geipSchoolId: filters.geipSchoolId,
            gradeName: filters.gradeName,
            room: filters.room, // Optional
            page: pageNum,
            limit: 10000, // Large limit to get all results
            forceMonthlyEndpoint: false, // Use regular hierarchical endpoints
          },
          abortController.signal
        );

        logger.info(
          `[LEADERBOARD] Service response: ${response.success ? "success" : "failed"}`,
          "LEADERBOARD"
        );

        if (!response.success) {
          const errorMessage = response.error || "Failed to fetch leaderboard";
          logger.error(
            `[LEADERBOARD] Service error: ${errorMessage}`,
            "LEADERBOARD"
          );
          setError(errorMessage);
          setRawApiData([]);
          return;
        }

        const rawData = response.data || [];

        // Extract unique subjects from the raw data
        const allSubjects = new Set<string>();
        rawData.forEach((row: any) => {
          if (
            row &&
            typeof row === "object" &&
            row.subjects &&
            typeof row.subjects === "object"
          ) {
            Object.keys(row.subjects).forEach((subjectName) => {
              allSubjects.add(subjectName);
            });
          }
        });

        setSubjectOptions(Array.from(allSubjects).sort());
        setRawApiData(rawData);
        setError(null);
      } catch (error: any) {
        if (error.name === "AbortError") {
          return;
        }
        const errorMessage = error.message || "Failed to fetch leaderboard";
        logger.error(
          "[LEADERBOARD] Failed to fetch leaderboard",
          "LEADERBOARD",
          error
        );
        setError(errorMessage);
        setRawApiData([]);
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    },
    [provinces]
  );

  // Apply Filters
  const handleApplyFilters = useCallback(() => {
    // Validate REQUIRED filters
    if (!provinceId || !districtName || !geipSchoolId || !gradeFilter) {
      if (process.env.NODE_ENV === "development") {
        logger.warn(
          `[LEADERBOARD] Apply Filters clicked but required filters missing`,
          "LEADERBOARD"
        );
      }
      setError(null);
      return;
    }

    const province = provinces.find((p) => p.province_id === provinceId);

    // Create filter snapshot
    const filterSnapshot: LeaderboardParams = {
      provinceId: provinceId ? String(provinceId) : undefined,
      provinceName: province?.province_name,
      districtName: districtName.trim(),
      geipSchoolId: geipSchoolId.trim().replace(/-+$/, ''), // Sanitize: remove trailing hyphens
      gradeName: gradeFilter.trim(),
      // Room filter is OPTIONAL
      ...(roomFilter && roomFilter.trim() && { room: roomFilter.trim() }),
      // Subject filter is OPTIONAL - but only apply it after initial fetch
      // We'll handle subject filtering client-side
    };

    // Set state BEFORE calling fetch
    setAppliedFilters(filterSnapshot);
    setHasAppliedFilters(true);
    setPage(1);
    setError(null);
    setRawApiData([]);

    // Trigger fetch with snapshot
    fetchLeaderboard(filterSnapshot, 1);
  }, [
    provinceId,
    districtName,
    geipSchoolId,
    gradeFilter,
    roomFilter,
    provinces,
    fetchLeaderboard,
  ]);

  // Apply subject filter when it changes (client-side filtering)
  useEffect(() => {
    if (hasAppliedFilters && subjectFilter) {
      // Update applied filters to include subject
      setAppliedFilters((prev) =>
        prev ? { ...prev, subject: subjectFilter.trim() } : null
      );
    } else if (hasAppliedFilters && !subjectFilter) {
      // Remove subject filter if cleared
      setAppliedFilters((prev) => {
        if (prev) {
          const { subject, ...rest } = prev;
          return rest;
        }
        return null;
      });
    }
  }, [subjectFilter, hasAppliedFilters]);

  // Pagination - only fetch if page changes and filters are applied
  useEffect(() => {
    if (appliedFilters && page > 1) {
      fetchLeaderboard(appliedFilters, page);
    }
  }, [page, appliedFilters, fetchLeaderboard]);

  // Clear Filters
  const handleClearFilters = useCallback(() => {
    setProvinceId("");
    setDistrictName("");
    setGeipSchoolId("");
    setGradeFilter("");
    setRoomFilter("");
    setSubjectFilter("");
    setAppliedFilters(null);
    setHasAppliedFilters(false);
    setRawApiData([]);
    setPage(1);
    setError(null);
    setDistricts([]);
    setSchools([]);
    setSubjectOptions([]);
  }, []);

  // Process and aggregate raw API data by studentId
  const leaderboardData = useMemo((): ProcessedStudent[] => {
    if (!rawApiData || !Array.isArray(rawApiData) || rawApiData.length === 0)
      return [];

    let filtered = rawApiData;

    // Apply room/class filter with exact matching
    if (appliedFilters?.room && appliedFilters.room.trim()) {
      const filterRoom = appliedFilters.room.trim();
      filtered = filtered.filter((row: any) => {
        if (!row || typeof row !== "object") return false;
        const entryRoom = (row.room || row.class || "").toString().trim();
        return entryRoom === filterRoom;
      });
    }

    // Process rows: API returns one row per student with subjects object
    const studentMap = new Map<string, ProcessedStudent>();

    filtered.forEach((row: any) => {
      // Skip invalid rows
      if (!row || typeof row !== "object") return;

      const studentId =
        row.student_ID || row.student_id || row.id?.toString() || "";
      if (!studentId) return;

      // Get or create student entry
      if (!studentMap.has(studentId)) {
        const firstName = row.first_name || "";
        const lastName = row.last_name || "";
        const fullName =
          firstName && lastName
            ? `${firstName} ${lastName}`.trim()
            : row.student_name ||
              row.student_name_en ||
              row.student_name_km ||
              "";

        studentMap.set(studentId, {
          studentId,
          studentName: fullName,
          gender: row.gender || "",
          grade: row.grade || row.grade_name || "",
          class: row.room || row.class || "", // Renamed: class now uses room value
          room: row.room || row.class || "", // Keep room for consistency
          school: row.school_name || "",
          subjects: {},
          totalScore: 0,
          rank: 0,
        });
      }

      const student = studentMap.get(studentId)!;

      // Process subjects
      if (row.subjects && typeof row.subjects === "object") {
        Object.entries(row.subjects).forEach(([subjectName, subjectData]) => {
          if (!subjectData) return;

          // Skip if subject filter is applied and this is not the selected subject
          if (
            appliedFilters?.subject &&
            subjectName !== appliedFilters.subject
          ) {
            return;
          }

          let score: number | null = null;
          let maxScore: number | undefined;
          let level: string | undefined;
          let result: string | undefined;

          // Handle different subjectData formats
          if (typeof subjectData === "number") {
            score = subjectData;
          } else if (typeof subjectData === "object" && subjectData !== null) {
            // Safely extract score
            if (
              "score" in subjectData &&
              typeof subjectData.score === "number"
            ) {
              score = subjectData.score;
            }

            // Safely extract max_score
            if (
              "max_score" in subjectData &&
              typeof subjectData.max_score === "number"
            ) {
              maxScore = subjectData.max_score;
            }

            // Safely extract level
            if (
              "level" in subjectData &&
              typeof subjectData.level === "string"
            ) {
              level = subjectData.level;
            }

            // Safely extract result
            if (
              "result" in subjectData &&
              typeof subjectData.result === "string"
            ) {
              result = subjectData.result;
            }
          }

          // Only update subject data if we have a valid score or if this subject hasn't been processed yet
          if (!student.subjects[subjectName] || score !== null) {
            // Update subject data with proper type checking
            const subjectInfo: {
              score: number | null;
              max_score?: number;
              level?: string;
              result?: string;
            } = {
              score,
            };

            // Only add optional properties if they exist
            if (maxScore !== undefined) {
              subjectInfo.max_score = maxScore;
            }
            if (level !== undefined) {
              subjectInfo.level = level;
            }
            if (result !== undefined) {
              subjectInfo.result = result;
            }

            student.subjects[subjectName] = subjectInfo;

            // Only add to total score if score is not null
            if (score !== null) {
              student.totalScore += score;
            }
          }
        });
      }
    });

    // Filter out students without any valid scores
    const studentsWithScores = Array.from(studentMap.values()).filter(
      (student) =>
        Object.values(student.subjects).some(
          (subject) => subject.score !== null
        )
    );

    // Sort and assign ranks
    const sorted = studentsWithScores.sort(
      (a, b) => b.totalScore - a.totalScore
    );
    sorted.forEach((student, index) => {
      student.rank = index + 1;
    });

    return sorted;
  }, [rawApiData, appliedFilters?.room, appliedFilters?.subject]);

  // Extract all unique subject names from leaderboard data
  const displaySubjectColumns = useMemo(() => {
    if (!leaderboardData.length) return [];

    // If subject filter is applied, only show that subject
    if (appliedFilters?.subject) {
      return [appliedFilters.subject];
    }

    // Otherwise show all subjects
    const subjectSet = new Set<string>();
    leaderboardData.forEach((student) => {
      Object.keys(student.subjects).forEach((subjectName) => {
        subjectSet.add(subjectName);
      });
    });

    return Array.from(subjectSet).sort();
  }, [leaderboardData, appliedFilters?.subject]);

  // Table Columns: Base columns + dynamic subject columns
  const columns: DataTableColumn<ProcessedStudent>[] = useMemo(() => {
    const baseColumns: DataTableColumn<ProcessedStudent>[] = [
      {
        key: "studentId",
        label: language === "km" ? "លេខសម្គាល់សិស្ស" : "Student ID",
      },
      {
        key: "studentName",
        label: language === "km" ? "ឈ្មោះសិស្ស" : "Student Name",
      },
      { key: "gender", label: language === "km" ? "ភេទ" : "Gender" },
      { key: "grade", label: language === "km" ? "ថ្នាក់" : "Grade" },
      { key: "class", label: language === "km" ? "បន្ទប់" : "Class" },
      { key: "school", label: language === "km" ? "សាលា" : "School" },
    ];

    // Add dynamic subject columns
    const subjectCols: DataTableColumn<ProcessedStudent>[] =
      displaySubjectColumns.map((subjectName) => ({
        key: `subject_${subjectName}` as any,
        label: subjectName,
        render: (value: any, row: ProcessedStudent) => {
          const subjectData = row.subjects[subjectName];
          const score = subjectData?.score;

          if (score === null || score === undefined) {
            return (
              <span className="text-gray-400 dark:text-gray-500 italic">
                {language === "km" ? "មិនមាន" : "N/A"}
              </span>
            );
          }

          return (
            <span
              className={
                score > 0
                  ? "text-gray-900 dark:text-gray-100"
                  : "text-red-600 dark:text-red-400"
              }
            >
              {score}
            </span>
          );
        },
      }));

    return [...baseColumns, ...subjectCols];
  }, [language, displaySubjectColumns]);

  const totalPages = Math.ceil(leaderboardData.length / perPage);
  const pageData = useMemo(() => {
    const start = (page - 1) * perPage;
    const end = start + perPage;
    return leaderboardData.slice(start, end);
  }, [leaderboardData, page, perPage]);

  const canApplyFilters =
    provinceId && districtName && geipSchoolId && gradeFilter;

  // Helper function to safely get translation values
  const getTranslation = (key: string, fallback: string) => {
    try {
      const keys = key.split(".");
      let value: any = t;
      for (const k of keys) {
        value = value?.[k];
      }
      return value || fallback;
    } catch (e) {
      return fallback;
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Filter Container */}
      <div className="w-full mt-1 md:mt-2 lg:mt-3 bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-border shadow-sm">
        <div className="p-6 pb-4">
          <h1
            className={`text-xl font-bold tracking-tight text-primary ${
              language === "km" ? "font-khmer" : ""
            }`}
          >
            {language === "km" ? "តម្រងកំពូល" : "Filter Leaderboard"}
          </h1>
          <p
            className={`text-muted-foreground mt-2 text-sm ${
              language === "km" ? "font-khmer" : ""
            }`}
          >
            {language === "km"
              ? "មើលលំដាប់ចំណាត់ថ្នាក់សិស្ស"
              : "View student rankings"}
          </p>
        </div>

        <div className="px-6 pb-6 border-t border-gray-200 dark:border-border pt-6">
          <div className="w-full grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {/* Province Filter */}
            <div className="space-y-2">
              <Label
                htmlFor="province-filter"
                className={`text-sm font-medium text-primary ${
                  language === "km" ? "font-khmer" : ""
                }`}
              >
                {language === "km" ? "ខេត្ត" : "Province"}{" "}
                <span className="text-red-500">*</span>
              </Label>
              <select
                id="province-filter"
                value={provinceId}
                onChange={(e) => setProvinceId(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-khmer"
              >
                <option value="" className="font-khmer">
                  {language === "km" ? "ជ្រើសខេត្ត..." : "Select province..."}
                </option>
                {provinces.map((province) => (
                  <option
                    key={province.province_id}
                    value={province.province_id}
                    className="font-khmer"
                  >
                    {province.province_name}
                  </option>
                ))}
              </select>
            </div>

            {/* District Filter */}
            <div className="space-y-2">
              <Label
                htmlFor="district-filter"
                className={`text-sm font-medium text-primary ${
                  language === "km" ? "font-khmer" : ""
                }`}
              >
                {language === "km" ? "ស្រុក" : "District"}{" "}
                <span className="text-red-500">*</span>
              </Label>
              <select
                id="district-filter"
                value={districtName}
                onChange={(e) => setDistrictName(e.target.value)}
                disabled={!provinceId}
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-khmer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="" className="font-khmer">
                  {language === "km" ? "ជ្រើសស្រុក..." : "Select district..."}
                </option>
                {districts.map((district) => (
                  <option
                    key={`${district.province_id}:${district.district_name}`}
                    value={district.district_name}
                    className="font-khmer"
                  >
                    {district.district_name}
                  </option>
                ))}
              </select>
            </div>

            {/* School Filter */}
            <div className="space-y-2">
              <Label
                htmlFor="school-filter"
                className={`text-sm font-medium text-primary ${
                  language === "km" ? "font-khmer" : ""
                }`}
              >
                {language === "km" ? "សាលា" : "School"}{" "}
                <span className="text-red-500">*</span>
              </Label>
              <select
                id="school-filter"
                value={geipSchoolId}
                onChange={(e) => setGeipSchoolId(e.target.value)}
                disabled={!provinceId || !districtName || schoolLoading}
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-khmer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="" className="font-khmer">
                  {schoolLoading
                    ? language === "km"
                      ? "កំពុងផ្ទុក..."
                      : "Loading..."
                    : language === "km"
                    ? "ជ្រើសសាលា..."
                    : "Select school..."}
                </option>
                {schools.map((school) => (
                  <option
                    key={`${school.province_id}:${school.district_name}:${school.geip_school_ID}`}
                    value={school.geip_school_ID}
                    className="font-khmer"
                  >
                    {school.school_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Grade Filter */}
            <div className="space-y-2">
              <Label
                htmlFor="grade-filter"
                className={`text-sm font-medium text-primary ${
                  language === "km" ? "font-khmer" : ""
                }`}
              >
                {language === "km" ? "ថ្នាក់" : "Grade"}{" "}
                <span className="text-red-500">*</span>
              </Label>
              <select
                id="grade-filter"
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value)}
                disabled={!geipSchoolId}
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-khmer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="" className="font-khmer">
                  {language === "km" ? "ជ្រើសថ្នាក់..." : "Select grade..."}
                </option>
                {GRADES.map((grade) => (
                  <option key={grade} value={grade} className="font-khmer">
                    {language === "km" ? `ថ្នាក់ទី${grade}` : `Grade ${grade}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Class Filter */}
            <div className="space-y-2">
              <Label
                htmlFor="room-filter"
                className={`text-sm font-medium text-primary ${
                  language === "km" ? "font-khmer" : ""
                }`}
              >
                {language === "km" ? "បន្ទប់" : "Class"}
              </Label>
              <select
                id="room-filter"
                value={roomFilter}
                onChange={(e) => setRoomFilter(e.target.value)}
                disabled={!gradeFilter}
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-khmer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="" className="font-khmer">
                  {language === "km" ? "ជ្រើសបន្ទប់..." : "Select class..."}
                </option>
                {roomOptions.map((room) => (
                  <option key={room} value={room} className="font-khmer">
                    {room}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Subject Filter and Buttons */}
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4 items-end">
            {/* Subject Filter */}
            <div className="space-y-2">
              <Label
                htmlFor="subject-filter"
                className={`text-sm font-medium text-primary ${
                  language === "km" ? "font-khmer" : ""
                }`}
              >
                {language === "km" ? "មុខវិជ្ជា" : "Subject"}
              </Label>
              <select
                id="subject-filter"
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                disabled={!hasAppliedFilters}
                className="w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-khmer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="" className="font-khmer">
                  {language === "km"
                    ? "ជ្រើសមុខវិជ្ជា..."
                    : "Select subject..."}
                </option>
                {subjectOptions.map((subject) => (
                  <option key={subject} value={subject} className="font-khmer">
                    {subject}
                  </option>
                ))}
              </select>
            </div>

            {/* Clear Filters */}
            <Button
              variant="outline"
              onClick={handleClearFilters}
              disabled={loading}
              className={`w-full h-10 ${language === "km" ? "font-khmer" : ""}`}
            >
              {language === "km" ? "លុបតម្រង" : "Clear Filters"}
            </Button>

            {/* Apply Filters */}
            <Button
              onClick={handleApplyFilters}
              disabled={loading || !canApplyFilters}
              className={`w-full h-10 ${language === "km" ? "font-khmer" : ""}`}
            >
              {loading
                ? language === "km"
                  ? "កំពុងផ្ទុក..."
                  : "Loading..."
                : language === "km"
                ? "តម្រង"
                : "Apply Filters"}
            </Button>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="w-full bg-white dark:bg-card rounded-lg border border-gray-200 dark:border-border shadow-sm">
        <div className="p-6">
          <h1
            className={`text-xl font-bold tracking-tight text-primary mb-4 ${
              language === "km" ? "font-khmer" : ""
            }`}
          >
            {language === "km" ? "កំពូល" : "Leaderboard"}
          </h1>

          {loading ? (
            <Loading language={language} showSkeleton />
          ) : error ? (
            <div className="text-center py-12">
              <p
                className={`text-red-500 font-medium ${
                  language === "km" ? "font-khmer" : ""
                }`}
              >
                {language === "km" ? "កំហុស" : "Error"}
              </p>
              <p
                className={`text-muted-foreground mt-2 text-sm ${
                  language === "km" ? "font-khmer" : ""
                }`}
              >
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
                className={`mt-4 ${language === "km" ? "font-khmer" : ""}`}
              >
                {language === "km" ? "ព្យាយាមម្តងទៀត" : "Try Again"}
              </Button>
            </div>
          ) : !hasAppliedFilters ? (
            // INIT state: Before Apply Filters is clicked
            <div className="text-center py-12 text-muted-foreground">
              <p
                className={`text-lg font-medium mb-2 ${
                  language === "km" ? "font-khmer" : ""
                }`}
              >
                {language === "km"
                  ? "សូមជ្រើសតម្រងដើម្បីមើលកំពូល"
                  : "Select Filters to View Leaderboard"}
              </p>
              <p className={`text-sm ${language === "km" ? "font-khmer" : ""}`}>
                {language === "km"
                  ? 'សូមជ្រើសខេត្ត ស្រុក សាលា និងថ្នាក់ (ត្រូវការ) បន្ទាប់មកចុច "តម្រង"'
                  : 'Please select Province, District, School, and Grade (required), then click "Apply Filters"'}
              </p>
            </div>
          ) : leaderboardData.length === 0 ? (
            // EMPTY state: After Apply Filters, fetch succeeded, but zero records
            <div className="text-center py-12 text-muted-foreground">
              <p
                className={`text-lg font-medium mb-2 ${
                  language === "km" ? "font-khmer" : ""
                }`}
              >
                {language === "km"
                  ? "មិនមានទិន្នន័យកំពូល"
                  : "No leaderboard data available"}
              </p>
              <p className={`text-sm ${language === "km" ? "font-khmer" : ""}`}>
                {appliedFilters?.room
                  ? language === "km"
                    ? "មិនមានលទ្ធផលប្រឡងសម្រាប់បន្ទប់ដែលបានជ្រើស។ សូមលុបតម្រងបន្ទប់ ឬជ្រើសបន្ទប់ផ្សេង។"
                    : "There are no exam results for the selected class. Try removing the class filter or selecting a different class."
                  : language === "km"
                  ? "មិនមានលទ្ធផលប្រឡងសម្រាប់តម្រងដែលបានជ្រើស។ សូមព្យាយាមជ្រើសតម្រងផ្សេង។"
                  : "There are no exam results for the selected filters. Please try selecting different filters."}
              </p>
            </div>
          ) : pageData.length > 0 ? (
            <>
              <DataTable
                data={pageData}
                columns={columns}
                getRowKey={(row, index) => row.studentId || `row-${index}`}
              />

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div
                  className={`text-sm text-muted-foreground ${
                    language === "km" ? "font-khmer" : ""
                  }`}
                >
                  {getTranslation("common.showing", "Showing")}{" "}
                  {(page - 1) * perPage + 1}–
                  {Math.min(page * perPage, leaderboardData.length)}{" "}
                  {getTranslation("common.of", "of")} {leaderboardData.length}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1 || loading || totalPages === 0}
                    className={language === "km" ? "font-khmer" : ""}
                  >
                    {getTranslation("common.prev", "Previous")}
                  </Button>

                  <div
                    className={`px-3 text-sm text-muted-foreground ${
                      language === "km" ? "font-khmer" : ""
                    }`}
                  >
                    {getTranslation("common.page", "Page")} {page}{" "}
                    {getTranslation("common.of", "of")} {totalPages || 1}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages || loading || totalPages === 0}
                    className={language === "km" ? "font-khmer" : ""}
                  >
                    {getTranslation("common.next", "Next")}
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
