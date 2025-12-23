'use client';

import { useMemo } from 'react';
import { BarChart } from '@/components/dashboard/Chart';
import { GranularityButtons } from '@/components/dashboard/GranularityButtons';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Granularity, ChartDataPoint } from '../types';
import { generateChartSeries } from '../utils';

interface ChartSectionProps {
  title: string;
  granularity: Granularity;
  year: string;
  onGranularityChange: (granularity: Granularity) => void;
  onYearChange: (year: string) => void;
  monthNames: string[];
  availableYears: readonly string[];
  mounted: boolean;
  color?: string;
  translations: {
    day: string;
    month: string;
    year: string;
  };
}

export function ChartSection({
  title,
  granularity,
  year,
  onGranularityChange,
  onYearChange,
  monthNames,
  availableYears,
  mounted,
  color,
  translations,
}: ChartSectionProps) {
  const chartData = useMemo<ChartDataPoint[]>(
    () => generateChartSeries(granularity, year, monthNames),
    [granularity, year, monthNames]
  );

  return (
    <div className="w-full mb-4 sm:mb-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3 sm:gap-0">
        <h2 className="text-lg sm:text-xl font-semibold text-primary">{title}</h2>
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          {mounted ? (
            <Select value={year} onValueChange={onYearChange}>
              <SelectTrigger className="w-20 sm:w-24 text-xs sm:text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map((y) => (
                  <SelectItem key={y} value={y}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="w-20 sm:w-24 h-9 border rounded-md bg-background" />
          )}
          <GranularityButtons
            value={granularity}
            onChange={onGranularityChange}
            translations={translations}
          />
        </div>
      </div>
      <BarChart data={chartData} color={color} />
    </div>
  );
}

