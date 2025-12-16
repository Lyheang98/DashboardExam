'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: Array<{ value: string | number; label: string }>;
}

export function Select({ 
  label, 
  options, 
  className,
  ...props 
}: SelectProps) {
  return (
    <div className="relative inline-block w-full">
      <select
        className={cn(
          'appearance-none w-full px-3 py-2 pr-8 rounded-md border border-gray-300 dark:border-slate-600',
          'bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100',
          'hover:border-gray-400 dark:hover:border-slate-500',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
          'cursor-pointer transition-colors',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          className
        )}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 dark:text-gray-400 pointer-events-none" />
    </div>
  );
}
