'use client';

/**
 * Dashboard Page Component
 * 
 * Main dashboard view displaying statistics, charts, and data visualizations.
 * Features:
 * - Real-time data fetching from external APIs
 * - Interactive charts with time granularity filters
 * - Responsive stat cards
 * - Multi-language support
 * 
 * @example
 * ```tsx
 * <DashboardPage />
 * ```
 */

import { useEffect, useState, useMemo } from 'react';
import { School, GraduationCap } from 'lucide-react';
import { StatCard } from '@/components/dashboard/Statcard';
import { DataControls } from '@/components/dashboard/DataControls';
import { useLanguage } from '@/lib/i18n/context';
import { logger } from '@/lib/logger';
import { getToken } from '@/lib/auth';
import { dataCache, CACHE_KEYS } from '@/lib/cache/dataCache';
import { cacheHandlers } from '@/lib/cache/cacheHandlers';
import { Granularity } from './types';
import { ChartSection } from './components/ChartSection';
import { getProvinces } from '@/lib/constants/provinces';

// Constants
const AVAILABLE_YEARS = ['2025', '2026', '2027', '2028', '2029', '2030'] as const;
const DEFAULT_GRANULARITY: Granularity = 'Month';
const DEFAULT_YEAR = '2025';

export default function DashboardPage() {
  const { t } = useLanguage();
  
  // State management
  const [totalSchools, setTotalSchools] = useState<number>(0);
  const [targetSchools, setTargetSchools] = useState<number>(0);
  const [notTargetSchools, setNotTargetSchools] = useState<number>(0);
  const [geipSchools, setGeipSchools] = useState<number>(0);
  const [geipAFSchools, setGeipAFSchools] = useState<number>(0);
  const [totalStudents, setTotalStudents] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0); // Force refresh trigger
  const [usersGran, setUsersGran] = useState<Granularity>(DEFAULT_GRANULARITY);
  const [usersYear, setUsersYear] = useState(DEFAULT_YEAR);
  const [mounted, setMounted] = useState(false);

  // Initialize component (hydration safety)
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch ALL dashboard data in parallel for better performance
  useEffect(() => {
    if (!mounted) return; // Wait for component to mount
    
    const controller = new AbortController();
    let isMounted = true;

    const fetchAllDashboardData = async (forceRefresh = false) => {
      try {
        setLoading(true);
        const token = getToken();
        if (!token) {
          logger.warn('No token available for dashboard fetch', 'DASHBOARD');
          setLoading(false);
          return;
        }

        // Check cache first (unless force refresh)
        const schoolsCacheKey = CACHE_KEYS.SCHOOLS_COUNT;
        const studentsCacheKey = 'dashboard:total_students_count';
        
        const cachedSchools = !forceRefresh ? dataCache.get<{
          total: number;
          target: number;
          notTarget: number;
          geipSchool: number;
          geipAF: number;
        }>(schoolsCacheKey) : null;
        
        const cachedStudents = !forceRefresh ? dataCache.get<number>(studentsCacheKey) : null;

        // Prepare parallel fetch promises
        const fetchPromises: Promise<any>[] = [];

        // Fetch schools (only if not cached)
        let schoolsPromise: Promise<any> | null = null;
        if (!cachedSchools) {
          schoolsPromise = fetch('/api/schools', {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            signal: controller.signal,
          })
            .then(async (response) => {
              if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status}, ${errorText}`);
              }
              return response.json();
            })
            .then((data) => {
              if (data.success) {
                const schoolsData = {
                  total: data.total || 0,
                  target: data.target || 0,
                  notTarget: data.notTarget || 0,
                  geipSchool: data.geipSchool || 0,
                  geipAF: data.geipAF || 0,
                };
                // Cache for 5 minutes
                dataCache.set(schoolsCacheKey, schoolsData, 5 * 60 * 1000);
                return schoolsData;
              }
              throw new Error(data.error || 'Unknown error');
            })
            .catch((error) => {
              if (error?.name !== 'AbortError') {
                logger.error('Failed to fetch schools count', 'DASHBOARD', error);
              }
              return { total: 0, target: 0, notTarget: 0, geipSchool: 0, geipAF: 0 };
            });
          fetchPromises.push(schoolsPromise);
        }

        // Fetch students (only if not cached)
        let studentsPromise: Promise<any> | null = null;
        if (!cachedStudents) {
          studentsPromise = fetch(`/api/dashboard/students/count`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            signal: controller.signal,
          })
            .then(async (response) => {
              if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
              }
              return response.json();
            })
            .then((data) => {
              if (data.success && data.count !== undefined) {
                const total = data.count || 0;
                // Cache for 30 minutes
                dataCache.set(studentsCacheKey, total, 30 * 60 * 1000);
                return total;
              }
              throw new Error('Dashboard API did not return count field');
            })
            .catch((error) => {
              if (error?.name !== 'AbortError') {
                logger.error('Failed to fetch total students count', 'DASHBOARD', error);
              }
              return 0;
            });
          fetchPromises.push(studentsPromise);
        }

        // Execute all fetches in parallel
        const results = await Promise.allSettled(fetchPromises);

        // Only update state if component is still mounted and request wasn't cancelled
        if (!isMounted || controller.signal.aborted) {
          return;
        }

        // Process results
        let resultIndex = 0;

        // Process schools
        if (cachedSchools) {
          setTotalSchools(cachedSchools.total);
          setTargetSchools(cachedSchools.target);
          setNotTargetSchools(cachedSchools.notTarget);
          setGeipSchools(cachedSchools.geipSchool);
          setGeipAFSchools(cachedSchools.geipAF);
          logger.info('Using cached schools count', 'DASHBOARD');
        } else if (schoolsPromise) {
          const schoolsResult = results[resultIndex];
          if (schoolsResult?.status === 'fulfilled') {
            const schoolsData = schoolsResult.value;
            setTotalSchools(schoolsData.total);
            setTargetSchools(schoolsData.target);
            setNotTargetSchools(schoolsData.notTarget);
            setGeipSchools(schoolsData.geipSchool);
            setGeipAFSchools(schoolsData.geipAF);
            logger.info(`Schools count fetched: Total=${schoolsData.total}`, 'DASHBOARD');
          }
          resultIndex++;
        }

        // Process students
        if (cachedStudents !== null && cachedStudents !== undefined) {
          setTotalStudents(cachedStudents);
          logger.info(`Using cached total students count: ${cachedStudents.toLocaleString()}`, 'DASHBOARD');
        } else if (studentsPromise) {
          const studentsResult = results[resultIndex];
          if (studentsResult?.status === 'fulfilled') {
            const studentsCount = studentsResult.value;
            setTotalStudents(studentsCount);
            logger.info(`Total students count: ${studentsCount.toLocaleString()}`, 'DASHBOARD');
          }
        }

        setLoading(false);
      } catch (error: any) {
        if (isMounted && error?.name !== 'AbortError') {
          logger.error('Failed to load dashboard data', 'DASHBOARD', error);
          setTotalSchools(0);
          setTargetSchools(0);
          setNotTargetSchools(0);
          setGeipSchools(0);
          setGeipAFSchools(0);
          setTotalStudents(0);
        }
        setLoading(false);
      }
    };

    fetchAllDashboardData();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [mounted, refreshKey]);

  // Handler for refresh button
  const handleRefresh = () => {
    // Clear cache first
    dataCache.delete(CACHE_KEYS.SCHOOLS_COUNT);
    dataCache.delete('dashboard:total_students_count');
    // Trigger re-fetch with force refresh
    setRefreshKey(prev => prev + 1);
  };

  // Handler for warm cache button
  const handleWarmCache = async () => {
    const token = getToken();
    if (!token) return;

    try {
      // Pre-fetch schools count
      const response = await fetch('/api/schools', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          dataCache.set(CACHE_KEYS.SCHOOLS_COUNT, {
            total: data.total || 0,
            target: data.target || 0,
            notTarget: data.notTarget || 0,
            geipSchool: data.geipSchool || 0,
            geipAF: data.geipAF || 0,
          }, 5 * 60 * 1000);
        }
      }
    } catch (error) {
      console.error('Warm cache error:', error);
    }
  };

  // Handler for clear cache button
  const handleClearCache = () => {
    // Clear all cache
    dataCache.clear();
    // Trigger refresh to fetch fresh data immediately
    setRefreshKey(prev => prev + 1);
  };

  // Register handlers globally so Header can access them
  useEffect(() => {
    cacheHandlers.setRefreshHandler(handleRefresh);
    cacheHandlers.setWarmCacheHandler(handleWarmCache);
    cacheHandlers.setClearCacheHandler(handleClearCache);

    return () => {
      cacheHandlers.clearHandlers();
    };
  }, [refreshKey]); // Re-register when refreshKey changes

  // Get translated month names
  const monthNames = useMemo(
    () => [
      t.dashboard.months.january,
      t.dashboard.months.february,
      t.dashboard.months.march,
      t.dashboard.months.april,
      t.dashboard.months.may,
      t.dashboard.months.june,
      t.dashboard.months.july,
      t.dashboard.months.august,
      t.dashboard.months.september,
      t.dashboard.months.october,
      t.dashboard.months.november,
      t.dashboard.months.december,
    ],
    [t]
  );


  return (
    <div className="w-full max-w-full overflow-x-hidden">
      {/* Stats Cards - Continuous Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mt-3 mb-4 sm:mb-6">
        <StatCard
          title="Total Students"
          value={totalStudents.toLocaleString()}
          description="25 Provinces"
          icon={GraduationCap}
          trend={{ value: 4, isPositive: true }}
        />
        <StatCard
          title={t.dashboard.schools}
          value={totalSchools}
          description="Total schools"
          icon={School}
          trend={{ value: 4, isPositive: true }}
        />
        <StatCard
          title="Target Schools"
          value={targetSchools}
          description="Target schools count"
          icon={School}
          trend={{ value: 4, isPositive: true }}
        />
        <StatCard
          title="Non-Target Schools"
          value={notTargetSchools}
          description="Non-target schools count"
          icon={School}
          trend={{ value: 4, isPositive: true }}
        />
        <StatCard
          title="GEIP Schools"
          value={geipSchools}
          description="GEIP schools count"
          icon={School}
          trend={{ value: 4, isPositive: true }}
        />
        <StatCard
          title="GEIP AF Schools"
          value={geipAFSchools}
          description="GEIP AF schools count"
          icon={School}
          trend={{ value: 4, isPositive: true }}
        />
      </div>
      

      {/* Users Chart */}
      <ChartSection
        title={t.dashboard.users}
        granularity={usersGran}
        year={usersYear}
        onGranularityChange={setUsersGran}
        onYearChange={setUsersYear}
        monthNames={monthNames}
        availableYears={AVAILABLE_YEARS}
        mounted={mounted}
        translations={{
          day: t.dashboard.day,
          month: t.dashboard.month,
          year: t.dashboard.year,
        }}
      />
    </div>
  );
}
