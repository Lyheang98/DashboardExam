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
import { Users, Package, TrendingUp, DollarSign, School } from 'lucide-react';
import { StatCard } from '@/components/dashboard/Statcard';
import { useLanguage } from '@/lib/i18n/context';
import { logger } from '@/lib/logger';
import { getToken } from '@/lib/auth';
import { DashboardUser, DashboardProduct, Granularity } from './types';
import { fetchDashboardData } from './utils';
import { ChartSection } from './components/ChartSection';

// Constants
const AVAILABLE_YEARS = ['2025', '2026', '2027', '2028', '2029', '2030'] as const;
const DEFAULT_GRANULARITY: Granularity = 'Month';
const DEFAULT_YEAR = '2025';

export default function DashboardPage() {
  const { t } = useLanguage();
  
  // State management
  const [users, setUsers] = useState<DashboardUser[]>([]);
  const [products, setProducts] = useState<DashboardProduct[]>([]);
  const [totalSchools, setTotalSchools] = useState<number>(0);
  const [targetSchools, setTargetSchools] = useState<number>(0);
  const [notTargetSchools, setNotTargetSchools] = useState<number>(0);
  const [geipSchools, setGeipSchools] = useState<number>(0);
  const [geipAFSchools, setGeipAFSchools] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [usersGran, setUsersGran] = useState<Granularity>(DEFAULT_GRANULARITY);
  const [productsGran, setProductsGran] = useState<Granularity>(DEFAULT_GRANULARITY);
  const [usersYear, setUsersYear] = useState(DEFAULT_YEAR);
  const [productsYear, setProductsYear] = useState(DEFAULT_YEAR);
  const [mounted, setMounted] = useState(false);

  // Initialize component (hydration safety)
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch dashboard data on mount with cancellation support
  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;
    
    const loadData = async () => {
      try {
        setLoading(true);
        const { users: fetchedUsers, products: fetchedProducts } = await fetchDashboardData(controller.signal);
        
        // Only update state if component is still mounted and request wasn't cancelled
        if (isMounted && !controller.signal.aborted) {
          setUsers(fetchedUsers);
          setProducts(fetchedProducts);
        }
      } catch (error: any) {
        // Don't update state if request was aborted
        if (isMounted && error?.name !== 'AbortError') {
          logger.error('Failed to load dashboard data', 'DASHBOARD', error);
          setUsers([]);
          setProducts([]);
        }
      } finally {
        if (isMounted && !controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadData();

    // Cleanup: cancel request if component unmounts or dependencies change
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  // Fetch schools total count
  useEffect(() => {
    if (!mounted) return; // Wait for component to mount
    
    const controller = new AbortController();
    let isMounted = true;

    const fetchSchoolsCount = async () => {
      try {
        const token = getToken();
        if (!token) {
          logger.warn('No token available for schools fetch', 'DASHBOARD');
          return;
        }

        const response = await fetch('/api/schools', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP error! status: ${response.status}, ${errorText}`);
        }

        const data = await response.json();

        if (isMounted && !controller.signal.aborted) {
          if (data.success) {
            setTotalSchools(data.total || 0);
            setTargetSchools(data.target || 0);
            setNotTargetSchools(data.notTarget || 0);
            setGeipSchools(data.geipSchool || 0);
            setGeipAFSchools(data.geipAF || 0);
            logger.info(`Schools count fetched: Total=${data.total}, Target=${data.target}, NotTarget=${data.notTarget}, GEIP=${data.geipSchool}, GEIP AF=${data.geipAF}`, 'DASHBOARD');
          } else {
            logger.error('Schools API returned error', 'DASHBOARD', new Error(data.error || 'Unknown error'));
            setTotalSchools(0);
            setTargetSchools(0);
            setNotTargetSchools(0);
            setGeipSchools(0);
            setGeipAFSchools(0);
          }
        }
      } catch (error: any) {
        if (isMounted && error?.name !== 'AbortError') {
          logger.error('Failed to fetch schools count', 'DASHBOARD', error);
          setTotalSchools(0);
          setTargetSchools(0);
          setNotTargetSchools(0);
          setGeipSchools(0);
          setGeipAFSchools(0);
        }
      }
    };

    fetchSchoolsCount();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [mounted]);

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

  // Calculate derived statistics (limit data processing for performance)
  const MAX_STATS_ITEMS = 1000; // Only process first 1000 items for stats
  
  const limitedProducts = useMemo(() => {
    return products.slice(0, MAX_STATS_ITEMS);
  }, [products]);

  const averagePrice = useMemo(() => {
    if (limitedProducts.length === 0) return 0;
    const total = limitedProducts.reduce((sum, p) => sum + p.price, 0);
    return total / limitedProducts.length;
  }, [limitedProducts]);

  const inStockCount = useMemo(
    () => limitedProducts.filter((p) => p.stock > 0).length,
    [limitedProducts]
  );

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      {/* Stats Cards - Continuous Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mt-3 mb-4 sm:mb-6">
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
        <StatCard
          title={t.dashboard.totalUsers}
          value={users.length}
          description={t.dashboard.activeUsersFrom}
          icon={Users}
          trend={{ value: 12, isPositive: true }}
        />
        <StatCard
          title={t.dashboard.totalProducts}
          value={products.length}
          description={t.dashboard.productsInInventory}
          icon={Package}
          trend={{ value: 5, isPositive: true }}
        />
        <StatCard
          title={t.dashboard.averagePrice}
          value={`$${averagePrice.toFixed(2)}`}
          description={t.dashboard.averageProductPrice}
          icon={DollarSign}
          trend={{ value: 8, isPositive: true }}
        />
        <StatCard
          title={t.dashboard.inStock}
          value={inStockCount}
          description={t.dashboard.availableProducts}
          icon={TrendingUp}
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

      {/* Products Chart */}
      <ChartSection
        title={t.dashboard.products}
        granularity={productsGran}
        year={productsYear}
        onGranularityChange={setProductsGran}
        onYearChange={setProductsYear}
        monthNames={monthNames}
        availableYears={AVAILABLE_YEARS}
        mounted={mounted}
        color="#ed932b"
        translations={{
          day: t.dashboard.day,
          month: t.dashboard.month,
          year: t.dashboard.year,
        }}
      />
    </div>
  );
}
