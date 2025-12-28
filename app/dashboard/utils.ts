/**
 * Dashboard Utilities
 * 
 * Helper functions for dashboard data processing and chart generation
 */

import { ChartDataPoint, Granularity, DashboardUser } from './types';
import { logger } from '@/lib/logger';

/**
 * Generates a random number between min and max (inclusive)
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Random integer between min and max
 */
export function generateRandomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Gets the current month names array (translated)
 * This is a placeholder - should be passed from translations
 */
function getMonthNames(): string[] {
  // This will be replaced with actual translations in the component
  return [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
}

/**
 * Generates chart data series based on granularity
 * @param granularity - Time granularity (Day, Month, Year)
 * @param year - Optional year filter
 * @param monthNames - Array of translated month names
 * @returns Array of chart data points
 */
export function generateChartSeries(
  granularity: Granularity,
  year?: string,
  monthNames?: string[]
): ChartDataPoint[] {
  const months = monthNames || getMonthNames();
  const today = new Date();

  if (granularity === 'Day') {
    const currentDay = today.getDate();
    return Array.from({ length: currentDay }, (_, i) => ({
      label: `${i + 1}`,
      value: generateRandomNumber(200, 1200),
    }));
  }

  if (granularity === 'Month') {
    const currentMonth = today.getMonth();
    return months
      .slice(0, currentMonth + 1)
      .map((month) => ({
        label: month,
        value: generateRandomNumber(7000, 80000),
      }));
  }

  // Year granularity
  const years = ['2025', '2026', '2027', '2028', '2029', '2030'];
  const currentYear = today.getFullYear();
  const yearIndex = years.findIndex((y) => parseInt(y) === currentYear);
  
  return years
    .slice(0, yearIndex >= 0 ? yearIndex + 1 : years.length)
    .map((y) => ({
      label: y,
      value: generateRandomNumber(50000, 500000),
    }));
}

/**
 * Formats external API user data to DashboardUser format
 * @param user - Raw user data from API
 * @returns Formatted DashboardUser object
 */
export function formatUserData(user: {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role?: string;
  isActive?: boolean;
}): DashboardUser {
  return {
    id: user.id,
    name: `${user.firstName} ${user.lastName}`,
    email: user.email,
    role: user.role || 'User',
    status: user.isActive ? 'Active' : 'Inactive',
  };
}

/**
 * Fetches dashboard data from external APIs
 * @param signal - Optional AbortSignal for request cancellation
 * @returns Promise resolving to users array
 */
export async function fetchDashboardData(signal?: AbortSignal): Promise<{
  users: DashboardUser[];
}> {
  try {
    const usersRes = await fetch('https://dummyjson.com/users?limit=10', { signal });

    if (!usersRes.ok) {
      throw new Error('Failed to fetch dashboard data');
    }

    const usersData = await usersRes.json();

    const users: DashboardUser[] = (usersData.users || []).map(formatUserData);

    return { users };
  } catch (error: any) {
    // Don't log error if request was aborted
    if (error?.name !== 'AbortError') {
      logger.error('Failed to fetch dashboard data', 'DASHBOARD', error);
    }
    return { users: [] };
  }
}

