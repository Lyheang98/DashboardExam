'use client';

import { useEffect, useState, useMemo } from 'react';
import { Users, Package, TrendingUp, DollarSign } from 'lucide-react';
import { StatCard } from '@/components/dashboard/Statcard';
import { DataTable } from '@/components/dashboard/DataTable';
import { ThemeToggle } from '@/components/dashboard/ThemeToggle';
import { BarChart, LineChart } from '@/components/dashboard/Chart';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function DashboardPage() {
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usersGran, setUsersGran] = useState<'Day'|'Month'|'Year'>('Month');
  const [productsGran, setProductsGran] = useState<'Day'|'Month'|'Year'>('Month');
  const [usersYear, setUsersYear] = useState('2025');
  const [productsYear, setProductsYear] = useState('2025');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersRes, productsRes] = await Promise.all([
          fetch('https://dummyjson.com/users?limit=10'),
          fetch('https://dummyjson.com/products?limit=10'),
        ]);

        const usersData = await usersRes.json();
        const productsData = await productsRes.json();

        const formattedUsers = (usersData.users || []).map((user: any) => ({
          id: user.id,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          role: user.role || 'User',
          status: user.isActive ? 'Active' : 'Inactive',
        }));

        const formattedProducts = (productsData.products || []).map((product: any) => ({
          id: product.id,
          name: product.title,
          price: product.price,
          category: product.category,
          stock: product.stock,
          status: product.stock > 0 ? 'Available' : 'Out of Stock',
        }));

        setUsers(formattedUsers);
        setProducts(formattedProducts);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  function rand(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }

  function generateSeries(gran: 'Day' | 'Month' | 'Year', year?: string) {
    if (gran === 'Day') {
      const today = new Date()
      const currentDay = today.getDate()
      return Array.from({ length: currentDay }).map((_, i) => ({ label: `${i + 1}`, value: rand(200, 1200) }))
    }
    if (gran === 'Month') {
      const months = ['January','February','March','April','May','June','July','August','September','October','November','December']
      const today = new Date()
      const currentMonth = today.getMonth()
      return months.slice(0, currentMonth + 1).map((m) => ({ label: m, value: rand(7000, 80000) }))
    }
    const years = ['2025','2026','2027','2028','2029','2030']
    const today = new Date()
    const currentYear = today.getFullYear()
    const yearIndex = years.findIndex(y => parseInt(y) === currentYear)
    return years.slice(0, yearIndex >= 0 ? yearIndex + 1 : years.length).map((y) => ({ label: y, value: rand(50000, 500000) }))
  }

  const usersChartData = useMemo(() => generateSeries(usersGran, usersYear), [usersGran, usersYear]);
  const productsChartData = useMemo(() => generateSeries(productsGran, productsYear), [productsGran, productsYear]);

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      {/* Stats Cards - First Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-0 mb-4 sm:mb-5">
        <StatCard
          title="Total Users"
          value={users.length}
          description="Active users from DummyJSON"
          icon={Users}
          trend={{ value: 12, isPositive: true }}
        />
        <StatCard
          title="Total Products"
          value={products.length}
          description="Products in inventory"
          icon={Package}
          trend={{ value: 5, isPositive: true }}
        />
        <StatCard
          title="Average Price"
          value={`$${products.length > 0 ? (products.reduce((sum: number, p: any) => sum + p.price, 0) / products.length).toFixed(2) : '0'}`}
          description="Average product price"
          icon={DollarSign}
          trend={{ value: 8, isPositive: true }}
        />
        <StatCard
          title="In Stock"
          value={products.filter((p: any) => p.stock > 0).length}
          description="Available products"
          icon={TrendingUp}
          trend={{ value: 4, isPositive: true }}
        />
      </div>

      {/* Stats Cards - Second Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 sm:mb-6">
        <StatCard
          title="Schools"
          value={products.filter((p: any) => p.stock > 0).length}
          description="Available products"
          icon={TrendingUp}
          trend={{ value: 4, isPositive: true }}
        />
        <StatCard
          title="Student"
          value={products.filter((p: any) => p.stock > 0).length}
          description="Available products"
          icon={TrendingUp}
          trend={{ value: 4, isPositive: true }}
        />
        <StatCard
          title="Districts"
          value={products.filter((p: any) => p.stock > 0).length}
          description="Available products"
          icon={TrendingUp}
          trend={{ value: 4, isPositive: true }}
        />
        <StatCard
          title="Subjects"
          value={products.filter((p: any) => p.stock > 0).length}
          description="Available products"
          icon={TrendingUp}
          trend={{ value: 4, isPositive: true }}
        />
      </div>
      

      {/* Users chart */}
      <div className="w-full mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3 sm:gap-0">
          <h2 className="text-lg sm:text-xl font-semibold text-primary">Users</h2>
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            {mounted ? (
              <Select value={usersYear} onValueChange={setUsersYear}>
                <SelectTrigger className="w-20 sm:w-24 text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['2025','2026','2027','2028','2029','2030'].map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="w-20 sm:w-24 h-9 border rounded-md bg-background" />
            )}
            <div className="flex space-x-1 sm:space-x-2">
              {(['Day','Month','Year'] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setUsersGran(g)}
                  className={`px-2 sm:px-3 py-1 rounded-md text-xs sm:text-sm transition-colors ${
                    usersGran === g 
                      ? 'bg-primary text-primary-foreground hover:bg-primary/85' 
                      : 'bg-secondary text-secondary-foreground hover:bg-primary/10 hover:text-primary'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : (
          <BarChart data={usersChartData} />
        )}
      </div>

      {/* Products chart */}
      <div className="w-full mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3 sm:gap-0">
          <h2 className="text-lg sm:text-xl font-semibold text-primary">Products</h2>
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            {mounted ? (
              <Select value={productsYear} onValueChange={setProductsYear}>
                <SelectTrigger className="w-20 sm:w-24 text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['2025','2026','2027','2028','2029','2030'].map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="w-20 sm:w-24 h-9 border rounded-md bg-background" />
            )}
            <div className="flex space-x-1 sm:space-x-2">
              {(['Day','Month','Year'] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setProductsGran(g)}
                  className={`px-2 sm:px-3 py-1 rounded-md text-xs sm:text-sm transition-colors ${
                    productsGran === g 
                      ? 'bg-primary text-primary-foreground hover:bg-primary/85' 
                      : 'bg-secondary text-secondary-foreground hover:bg-primary/10 hover:text-primary'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : (
          <BarChart data={productsChartData} color="#ed932b" />
        )}
      </div>
    </div>
  );
}
