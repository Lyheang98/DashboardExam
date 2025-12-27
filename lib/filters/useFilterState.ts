/**
 * Filter State Hook
 * Centralized filter state management with cascading behavior
 * Ensures consistent filter logic across all pages
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { FilterState, FilterPageType, validateFilters, FILTER_REQUIREMENTS } from './types';
import { logger } from '../logger';

export interface UseFilterStateOptions {
  pageType: FilterPageType;
  onFilterChange?: (filters: FilterState) => void;
}

export interface UseFilterStateReturn {
  filters: FilterState;
  setProvinceId: (id: string) => void;
  setDistrictName: (name: string) => void;
  setSchoolName: (name: string) => void;
  setSearchQuery: (query: string) => void;
  resetFilters: () => void;
  isValid: boolean;
  validation: ReturnType<typeof validateFilters>;
  canFilter: boolean;
}

/**
 * Centralized filter state management hook
 * Handles cascading dropdown behavior and validation
 */
export function useFilterState(options: UseFilterStateOptions): UseFilterStateReturn {
  const { pageType, onFilterChange } = options;
  const requirements = FILTER_REQUIREMENTS[pageType];

  const [filters, setFilters] = useState<FilterState>({
    provinceId: '',
    districtName: '',
    schoolName: '',
    searchQuery: '',
  });

  // Validate filters
  const validation = useMemo(() => validateFilters(filters, pageType), [filters, pageType]);
  const isValid = validation.isValid;
  const canFilter = isValid;

  // Cascading behavior: Province change resets district and school
  const setProvinceId = useCallback((id: string) => {
    logger.info(`[FILTER_STATE] Province changed: ${id}`, 'FILTERS');
    setFilters((prev) => {
      const newFilters = {
        ...prev,
        provinceId: id,
        districtName: '', // Reset district
        schoolName: '', // Reset school
      };
      onFilterChange?.(newFilters);
      return newFilters;
    });
  }, [onFilterChange]);

  // Cascading behavior: District change resets school
  const setDistrictName = useCallback((name: string) => {
    logger.info(`[FILTER_STATE] District changed: ${name}`, 'FILTERS');
    setFilters((prev) => {
      // Only allow district change if province is selected
      if (!prev.provinceId) {
        logger.warn('[FILTER_STATE] Cannot set district without province', 'FILTERS');
        return prev;
      }
      const newFilters = {
        ...prev,
        districtName: name,
        schoolName: '', // Reset school
      };
      onFilterChange?.(newFilters);
      return newFilters;
    });
  }, [onFilterChange]);

  const setSchoolName = useCallback((name: string) => {
    logger.info(`[FILTER_STATE] School changed: ${name}`, 'FILTERS');
    setFilters((prev) => {
      // Only allow school change if province and district are selected
      if (!prev.provinceId || !prev.districtName) {
        logger.warn('[FILTER_STATE] Cannot set school without province and district', 'FILTERS');
        return prev;
      }
      const newFilters = {
        ...prev,
        schoolName: name,
      };
      onFilterChange?.(newFilters);
      return newFilters;
    });
  }, [onFilterChange]);

  const setSearchQuery = useCallback((query: string) => {
    setFilters((prev) => {
      const newFilters = {
        ...prev,
        searchQuery: query,
      };
      onFilterChange?.(newFilters);
      return newFilters;
    });
  }, [onFilterChange]);

  const resetFilters = useCallback(() => {
    logger.info('[FILTER_STATE] Resetting all filters', 'FILTERS');
    const emptyFilters: FilterState = {
      provinceId: '',
      districtName: '',
      schoolName: '',
      searchQuery: '',
    };
    setFilters(emptyFilters);
    onFilterChange?.(emptyFilters);
  }, [onFilterChange]);

  // Log filter state changes for debugging
  useEffect(() => {
    logger.info(`[FILTER_STATE] Current filters: ${JSON.stringify(filters)}, isValid: ${isValid}`, 'FILTERS');
  }, [filters, isValid]);

  return {
    filters,
    setProvinceId,
    setDistrictName,
    setSchoolName,
    setSearchQuery,
    resetFilters,
    isValid,
    validation,
    canFilter,
  };
}

