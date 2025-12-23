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
import { Users, Package, TrendingUp, DollarSign } from 'lucide-react';
import { StatCard } from '@/components/dashboard/Statcard';
import { BarChart } from '@/components/dashboard/Chart';
import { GranularityButtons } from '@/components/dashboard/GranularityButtons';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLanguage } from '@/lib/i18n/context';
import { DashboardUser, DashboardProduct, Granularity, ChartDataPoint } from './types';
import { fetchDashboardData, generateChartSeries } from './utils';

// Constants
const AVAILABLE_YEARS = ['2025', '2026', '2027', '2028', '2029', '2030'] as const;
const DEFAULT_GRANULARITY: Granularity = 'Month';
const DEFAULT_YEAR = '2025';

export default function DashboardPage() {
  const { t } = useLanguage();
  
  // State management
  const [users, setUsers] = useState<DashboardUser[]>([]);
  const [products, setProducts] = useState<DashboardProduct[]>([]);
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

  // Fetch dashboard data on mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const { users: fetchedUsers, products: fetchedProducts } = await fetchDashboardData();
      setUsers(fetchedUsers);
      setProducts(fetchedProducts);
      setLoading(false);
    };

    loadData();
  }, []);

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

  // Generate chart data with translations
  const usersChartData = useMemo<ChartDataPoint[]>(
    () => generateChartSeries(usersGran, usersYear, monthNames),
    [usersGran, usersYear, monthNames]
  );

  const productsChartData = useMemo<ChartDataPoint[]>(
    () => generateChartSeries(productsGran, productsYear, monthNames),
    [productsGran, productsYear, monthNames]
  );

  // Calculate derived statistics
  const averagePrice = useMemo(() => {
    if (products.length === 0) return 0;
    const total = products.reduce((sum, p) => sum + p.price, 0);
    return total / products.length;
  }, [products]);

  const inStockCount = useMemo(
    () => products.filter((p) => p.stock > 0).length,
    [products]
  );

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      {/* Stats Cards - First Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-0 mb-4 sm:mb-5">
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

      {/* Stats Cards - Second Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 sm:mb-6">
        <StatCard
          title={t.dashboard.schools}
          value={inStockCount}
          description={t.dashboard.availableProducts}
          icon={TrendingUp}
          trend={{ value: 4, isPositive: true }}
        />
        <StatCard
          title={t.dashboard.student}
          value={inStockCount}
          description={t.dashboard.availableProducts}
          icon={TrendingUp}
          trend={{ value: 4, isPositive: true }}
        />
        <StatCard
          title={t.dashboard.districts}
          value={inStockCount}
          description={t.dashboard.availableProducts}
          icon={TrendingUp}
          trend={{ value: 4, isPositive: true }}
        />
        <StatCard
          title={t.dashboard.subjects}
          value={inStockCount}
          description={t.dashboard.availableProducts}
          icon={TrendingUp}
          trend={{ value: 4, isPositive: true }}
        />
      </div>
      

      {/* Users chart */}
      <div className="w-full mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3 sm:gap-0">
          <h2 className="text-lg sm:text-xl font-semibold text-primary">{t.dashboard.users}</h2>
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            {mounted ? (
              <Select value={usersYear} onValueChange={setUsersYear}>
                <SelectTrigger className="w-20 sm:w-24 text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_YEARS.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="w-20 sm:w-24 h-9 border rounded-md bg-background" />
            )}
            <GranularityButtons
              value={usersGran}
              onChange={setUsersGran}
              translations={{
                day: t.dashboard.day,
                month: t.dashboard.month,
                year: t.dashboard.year,
              }}
            />
          </div>
        </div>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">{t.dashboard.loading}</div>
        ) : (
          <BarChart data={usersChartData} />
        )}
      </div>

      {/* Products chart */}
      <div className="w-full mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3 sm:gap-0">
          <h2 className="text-lg sm:text-xl font-semibold text-primary">{t.dashboard.products}</h2>
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            {mounted ? (
              <Select value={productsYear} onValueChange={setProductsYear}>
                <SelectTrigger className="w-20 sm:w-24 text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_YEARS.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="w-20 sm:w-24 h-9 border rounded-md bg-background" />
            )}
            <GranularityButtons
              value={productsGran}
              onChange={setProductsGran}
              translations={{
                day: t.dashboard.day,
                month: t.dashboard.month,
                year: t.dashboard.year,
              }}
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">{t.dashboard.loading}</div>
        ) : (
          <BarChart data={productsChartData} color="#ed932b" />
        )}
      </div>
    </div>
  );
}
