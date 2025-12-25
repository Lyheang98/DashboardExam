'use client';

import { useLanguage } from '@/lib/i18n/context';
import { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string | ReactNode;
  className?: string;
  variant?: 'top' | 'table';
}

/**
 * Reusable Page Header Component
 * 
 * Displays a consistent page header with:
 * - Smaller title size (text-xl) in primary color (blue) for Khmer text
 * - Smaller subtitle in muted color
 * - Automatic Khmer font application
 * - Proper spacing based on variant
 * 
 * @example
 * ```tsx
 * // Top header (above filters)
 * <PageHeader 
 *   variant="top"
 *   title={language === 'km' ? 'តម្រងសាលា' : 'Filter School'}
 *   subtitle={t.schools.subtitle}
 * />
 * 
 * // Header above table
 * <PageHeader 
 *   variant="table"
 *   title={t.schools.title}
 *   subtitle={`${t.schools.manageAndView} (${total} ${t.schools.total})`}
 * />
 * ```
 */
export function PageHeader({ title, subtitle, className = '', variant = 'top' }: PageHeaderProps) {
  const { language } = useLanguage();

  const containerClass = variant === 'top' ? 'mt-6' : '';
  const titleClass = `text-xl font-bold tracking-tight text-primary ${language === 'km' ? 'font-khmer' : ''}`;
  const subtitleClass = `text-muted-foreground mt-2 text-sm ${language === 'km' ? 'font-khmer' : ''}`;

  return (
    <div className={`${containerClass} ${className}`}>
      <h1 className={titleClass}>
        {title}
      </h1>
      {subtitle && (
        <p className={subtitleClass}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

