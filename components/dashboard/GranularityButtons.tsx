/**
 * Granularity Buttons Component
 * 
 * A reusable button group for selecting time granularity (Day, Month, Year).
 * 
 * @example
 * ```tsx
 * <GranularityButtons
 *   value="Month"
 *   onChange={setGranularity}
 *   translations={{ day: 'Day', month: 'Month', year: 'Year' }}
 * />
 * ```
 */

import { Granularity } from '@/app/dashboard/types';

interface GranularityButtonsProps {
  /** Current selected granularity */
  value: Granularity;
  /** Callback when granularity changes */
  onChange: (granularity: Granularity) => void;
  /** Translated labels for granularity options */
  translations: {
    day: string;
    month: string;
    year: string;
  };
}

const GRANULARITY_OPTIONS: Granularity[] = ['Day', 'Month', 'Year'];

export function GranularityButtons({
  value,
  onChange,
  translations,
}: GranularityButtonsProps) {
  const getLabel = (granularity: Granularity): string => {
    switch (granularity) {
      case 'Day':
        return translations.day;
      case 'Month':
        return translations.month;
      case 'Year':
        return translations.year;
      default:
        return granularity;
    }
  };

  return (
    <div className="flex space-x-1 sm:space-x-2">
      {GRANULARITY_OPTIONS.map((granularity) => {
        const isActive = value === granularity;
        
        return (
          <button
            key={granularity}
            onClick={() => onChange(granularity)}
            className={`px-2 sm:px-3 py-1 rounded-md text-xs sm:text-sm transition-colors ${
              isActive
                ? 'bg-primary text-primary-foreground hover:bg-primary/85'
                : 'bg-secondary text-secondary-foreground hover:bg-primary/10 hover:text-primary'
            }`}
            aria-pressed={isActive}
            aria-label={`Select ${granularity} granularity`}
          >
            {getLabel(granularity)}
          </button>
        );
      })}
    </div>
  );
}

