'use client';

import { useEffect, useState, useMemo } from 'react';
import { Users, Package, TrendingUp, DollarSign } from 'lucide-react';
import { StatCard } from '@/components/dashboard/Statcard';
import { DataTable } from '@/components/dashboard/DataTable';
import { ThemeToggle } from '@/components/dashboard/ThemeToggle';
import { BarChart, LineChart } from '@/components/dashboard/Chart';

export default function DashboardPage() {
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usersGran, setUsersGran] = useState<'Day'|'Week'|'Month'>('Month');
  const [productsGran, setProductsGran] = useState<'Day'|'Week'|'Month'>('Month');

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

  function generateSeries(gran: 'Day' | 'Week' | 'Month') {
    if (gran === 'Day') {
      return Array.from({ length: 30 }).map((_, i) => ({ label: `${i + 1}`, value: rand(500, 8000) }))
    }
    if (gran === 'Week') {
      return Array.from({ length: 12 }).map((_, i) => ({ label: `W${i + 1}`, value: rand(2000, 20000) }))
    }
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December']
    return months.map((m) => ({ label: m, value: rand(7000, 80000) }))
  }

  const usersChartData = useMemo(() => generateSeries(usersGran), [usersGran]);
  const productsChartData = useMemo(() => generateSeries(productsGran), [productsGran]);

  return (
    <div className="
  p-2
  mt-6 sm:mt-4 lg:mt-3
">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

      {/* Users chart */}
      <div className="mt-6 sm:mt-4 lg:mt-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold mb-4">Users</h2>
          <div className="space-x-2">
            {(['Day','Week','Month'] as const).map((g) => (
              <button
                key={g}
                onClick={() => setUsersGran(g)}
                className={`px-3 py-1 rounded-md text-sm ${usersGran === g ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : (
          <BarChart data={usersChartData} />
        )}
      </div>

      {/* Products chart */}
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold mb-4">Products</h2>
          <div className="space-x-2">
            {(['Day','Week','Month'] as const).map((g) => (
              <button
                key={g}
                onClick={() => setProductsGran(g)}
                className={`px-3 py-1 rounded-md text-sm ${productsGran === g ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : (
          <BarChart data={productsChartData} />
        )}
      </div>
    </div>
  );
}
