/**
 * Dashboard Types
 * 
 * Type definitions for dashboard data structures
 */

export interface DashboardUser {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
}

export type Granularity = 'Day' | 'Month' | 'Year';

export interface ChartDataPoint {
  label: string;
  value: number;
}

