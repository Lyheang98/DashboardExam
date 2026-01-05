/**
 * useStudentTracker Hook
 * 
 * Purpose: React hook for student tracker data
 * 
 * Rules:
 * - Hooks call ONLY studentTracker.service.ts
 * - No API calls inside components
 * - Handle loading + error states
 * - Prevent race conditions
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getToken } from '../auth';
import { studentTrackerService, StudentTrackerParams, StudentTrackerResponse } from '../api/services/studentTracker.service';
import { logger } from '../logger';

export interface UseStudentTrackerReturn {
  data: StudentTrackerResponse['data'];
  stats: StudentTrackerResponse['stats'];
  monthlyComparison: StudentTrackerResponse['monthlyComparison'];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useStudentTracker(params: StudentTrackerParams = {}): UseStudentTrackerReturn {
  const [data, setData] = useState<StudentTrackerResponse['data']>(undefined);
  const [stats, setStats] = useState<StudentTrackerResponse['stats']>(undefined);
  const [monthlyComparison, setMonthlyComparison] = useState<StudentTrackerResponse['monthlyComparison']>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchTrackerData = useCallback(async () => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setLoading(true);
    setError(null);

    try {
      const token = getToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      logger.info('[USE_STUDENT_TRACKER] Fetching tracker data', 'USE_STUDENT_TRACKER');

      const response = await studentTrackerService.getTrackerData(
        token,
        params,
        abortController.signal
      );

      if (abortController.signal.aborted) {
        return;
      }

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch tracker data');
      }

      setData(response.data);
      setStats(response.stats);
      setMonthlyComparison(response.monthlyComparison);
      
      logger.info(`[USE_STUDENT_TRACKER] Fetched ${response.data?.length || 0} tracker entries`, 'USE_STUDENT_TRACKER');
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return;
      }

      const errorMessage = err.message || 'Failed to fetch tracker data';
      logger.error('[USE_STUDENT_TRACKER] Error fetching tracker data', 'USE_STUDENT_TRACKER', err);
      setError(errorMessage);
      setData(undefined);
      setStats(undefined);
      setMonthlyComparison(undefined);
    } finally {
      if (!abortController.signal.aborted) {
        setLoading(false);
      }
    }
  }, [params]); // React will handle object reference changes

  // Fetch on mount and when params change
  useEffect(() => {
    fetchTrackerData();

    // Cleanup: abort request on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchTrackerData]);

  const refetch = useCallback(async () => {
    await fetchTrackerData();
  }, [fetchTrackerData]);

  return {
    data,
    stats,
    monthlyComparison,
    loading,
    error,
    refetch,
  };
}
