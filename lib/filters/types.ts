/**
 * Shared Filter Types
 * Single source of truth for filter state across all pages
 */

export interface FilterState {
  provinceId: string; // Maps to backend: province_ID
  districtName: string; // Maps to backend: district_name
  schoolName: string; // Maps to backend: school_name
  searchQuery: string;
}

export interface FilterRequirements {
  requiresProvince: boolean;
  requiresDistrict: boolean;
  requiresSchool: boolean;
}

export interface FilterValidationResult {
  isValid: boolean;
  missingFields: string[];
  errorMessage?: string;
}

export type FilterPageType = 'district' | 'school' | 'student';

export const FILTER_REQUIREMENTS: Record<FilterPageType, FilterRequirements> = {
  district: {
    requiresProvince: true,
    requiresDistrict: false,
    requiresSchool: false,
  },
  school: {
    requiresProvince: true,
    requiresDistrict: true,
    requiresSchool: false,
  },
  student: {
    requiresProvince: true,
    requiresDistrict: true,
    requiresSchool: false, // School is optional - can show all schools in district
  },
};

/**
 * Validate filter state against page requirements
 */
export function validateFilters(
  filters: FilterState,
  pageType: FilterPageType
): FilterValidationResult {
  const requirements = FILTER_REQUIREMENTS[pageType];
  const missingFields: string[] = [];

  if (requirements.requiresProvince && !filters.provinceId) {
    missingFields.push('province');
  }

  if (requirements.requiresDistrict && !filters.districtName) {
    missingFields.push('district');
  }

  if (requirements.requiresSchool && !filters.schoolName) {
    missingFields.push('school');
  }

  const isValid = missingFields.length === 0;

  return {
    isValid,
    missingFields,
    errorMessage: isValid
      ? undefined
      : `Missing required filters: ${missingFields.join(', ')}`,
  };
}

