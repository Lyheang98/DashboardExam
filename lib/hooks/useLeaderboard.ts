/**
 * useLeaderboard Hook
 * 
 * Purpose: React hook for leaderboard data
 * 
 * Rules:
 * - Hooks call ONLY leaderboard.service.ts
 * - No API calls inside components
 * - Handle loading + error states
 * - Prevent race conditions
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getToken } from '../auth';
import { leaderboardService, LeaderboardParams, LeaderboardResponse } from '../api/services/leaderboard.service';
import { logger } from '../logger';

export interface UseLeaderboardReturn {
  data: LeaderboardResponse['data'];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  stats: {
    count: number;
    total: number;
  };
  response: LeaderboardResponse | null;
}

export function useLeaderboard(params: LeaderboardParams = {}): UseLeaderboardReturn {
  const [data, setData] = useState<LeaderboardResponse['data']>(undefined);
  const [response, setResponse] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchLeaderboard = useCallback(async () => {
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

      logger.info('[USE_LEADERBOARD] Fetching leaderboard data', 'USE_LEADERBOARD');

      const response = await leaderboardService.getLeaderboard(
        token,
        params,
        abortController.signal
      );

      if (abortController.signal.aborted) {
        return;
      }

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch leaderboard');
      }

      setData(response.data);
      setResponse(response);
      logger.info(`[USE_LEADERBOARD] Fetched ${response.data?.length || 0} leaderboard entries`, 'USE_LEADERBOARD');
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return;
      }

      const errorMessage = err.message || 'Failed to fetch leaderboard';
      logger.error('[USE_LEADERBOARD] Error fetching leaderboard', 'USE_LEADERBOARD', err);
      setError(errorMessage);
      setData(undefined);
      setResponse(null);
    } finally {
      if (!abortController.signal.aborted) {
        setLoading(false);
      }
    }
  }, [params]); // React will handle object reference changes

  // Fetch on mount and when params change
  useEffect(() => {
    fetchLeaderboard();

    // Cleanup: abort request on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchLeaderboard]);

  const refetch = useCallback(async () => {
    await fetchLeaderboard();
  }, [fetchLeaderboard]);

  return {
    data,
    loading,
    error,
    refetch,
    stats: {
      count: response?.count || data?.length || 0,
      total: response?.total || data?.length || 0,
    },
    response,
  };
}
