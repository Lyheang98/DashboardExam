/**
 * Leaderboard Service - Business Logic Layer
 * 
 * Purpose: Transform raw result-subject data into leaderboard-ready data
 * 
 * Responsibilities:
 * - Sort students by score (descending)
 * - Calculate rank dynamically
 * - Aggregate scores if needed
 * - Prepare clean data for charts and tables
 * 
 * Rules:
 * - Do NOT call APIs directly in UI
 * - Use resultSubjects.service.ts internally
 * - Return normalized data
 */

import { logger } from '../../logger';
import { resultSubjectsService, ResultSubject, ResultSubjectsParams } from './resultSubjects.service';

export interface LeaderboardEntry {
  studentId: string;
  studentName: string;
  gender?: string;
  grade?: string;
  class?: string;
  room?: string;
  school?: string;
  subject?: string;
  score: number;
  rank: number;
  // Additional fields for aggregation
  examDate?: string;
  examMonth?: number;
  examYear?: number;
}

export interface LeaderboardResponse {
  success: boolean;
  data?: LeaderboardEntry[];
  count?: number;
  total?: number;
  error?: string;
}

export interface LeaderboardParams extends ResultSubjectsParams {
  // Aggregation options
  aggregateByStudent?: boolean; // If true, aggregate multiple scores per student
  aggregateMethod?: 'max' | 'avg' | 'sum'; // How to aggregate (default: max)
  subjectFilter?: string; // Filter by specific subject
}

/**
 * Normalize result subject to leaderboard entry
 */
function normalizeToLeaderboardEntry(
  result: ResultSubject,
  rank: number
): LeaderboardEntry {
  return {
    studentId: result.student_id || result.id?.toString() || '',
    studentName: result.student_name || 
                 result.student_name_en || 
                 result.student_name_km || 
                 '',
    gender: result.gender,
    grade: result.grade || result.grade_name,
    class: result.class || result.room,
    room: result.room || result.class,
    school: result.school_name,
    subject: result.subject || result.subject_name,
    score: typeof result.score === 'number' ? result.score : 0,
    rank,
    examDate: result.exam_date,
    examMonth: result.exam_month,
    examYear: result.exam_year,
  };
}

/**
 * Aggregate multiple scores per student
 */
function aggregateStudentScores(
  entries: LeaderboardEntry[],
  method: 'max' | 'avg' | 'sum' = 'max'
): LeaderboardEntry[] {
  const studentMap = new Map<string, LeaderboardEntry[]>();
  
  // Group by studentId
  for (const entry of entries) {
    const key = entry.studentId;
    if (!studentMap.has(key)) {
      studentMap.set(key, []);
    }
    studentMap.get(key)!.push(entry);
  }
  
  // Aggregate scores
  const aggregated: LeaderboardEntry[] = [];
  for (const [studentId, studentEntries] of studentMap.entries()) {
    if (studentEntries.length === 0) continue;
    
    const baseEntry = studentEntries[0];
    let aggregatedScore: number;
    
    switch (method) {
      case 'max':
        aggregatedScore = Math.max(...studentEntries.map(e => e.score));
        break;
      case 'avg':
        aggregatedScore = studentEntries.reduce((sum, e) => sum + e.score, 0) / studentEntries.length;
        break;
      case 'sum':
        aggregatedScore = studentEntries.reduce((sum, e) => sum + e.score, 0);
        break;
      default:
        aggregatedScore = baseEntry.score;
    }
    
    aggregated.push({
      ...baseEntry,
      score: aggregatedScore,
      // Keep all subjects if multiple
      subject: studentEntries.length > 1 
        ? studentEntries.map(e => e.subject).filter(Boolean).join(', ')
        : baseEntry.subject,
    });
  }
  
  return aggregated;
}

/**
 * Calculate ranks for leaderboard entries
 * Handles ties (same score = same rank)
 */
function calculateRanks(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  // Sort by score descending
  const sorted = [...entries].sort((a, b) => b.score - a.score);
  
  let currentRank = 1;
  let previousScore: number | null = null;
  
  return sorted.map((entry, index) => {
    // If score differs from previous, update rank
    if (previousScore !== null && entry.score !== previousScore) {
      currentRank = index + 1;
    }
    
    previousScore = entry.score;
    
    return {
      ...entry,
      rank: currentRank,
    };
  });
}

/**
 * Filter entries by subject if subjectFilter is provided
 */
function filterBySubject(
  entries: LeaderboardEntry[],
  subjectFilter?: string
): LeaderboardEntry[] {
  if (!subjectFilter || !subjectFilter.trim()) {
    return entries;
  }
  
  const subjectLower = subjectFilter.trim().toLowerCase();
  return entries.filter(entry => {
    const entrySubject = (entry.subject || '').toLowerCase();
    return entrySubject.includes(subjectLower);
  });
}

export const leaderboardService = {
  /**
   * Get leaderboard data
   * 
   * Business logic: Sorts by score, calculates ranks, aggregates if needed
   * 
   * @param token - Authentication token
   * @param params - Filter and pagination parameters
   * @param signal - AbortSignal for request cancellation
   */
  async getLeaderboard(
    token: string,
    params: LeaderboardParams = {},
    signal?: AbortSignal
  ): Promise<LeaderboardResponse> {
    try {
      // Fetch raw data from resultSubjects service
      // CRITICAL: Force monthly endpoint for Leaderboard (all analytics pages use monthly endpoints)
      const rawResponse = await resultSubjectsService.getList(token, {
        ...params,
        forceMonthlyEndpoint: true, // Always use monthly endpoints for Leaderboard
      }, signal);
      
      if (!rawResponse.success) {
        logger.error(`[LEADERBOARD] Failed to fetch result subjects: ${rawResponse.error}`, 'LEADERBOARD');
        return {
          success: false,
          error: rawResponse.error || 'Failed to fetch leaderboard data',
        };
      }
      
      // Ensure data is an array (should already be normalized by resultSubjects service)
      const rawData = Array.isArray(rawResponse.data) ? rawResponse.data : [];
      
      // Note: Subject and room filtering is now done client-side in the page component
      // for exact matching and validation that filter values exist in the data
      let filteredResults = rawData;
      
      // Normalize to leaderboard entries
      let entries = filteredResults.map((result, index) => 
        normalizeToLeaderboardEntry(result, index + 1)
      );
      
      // Aggregate by student if requested
      if (params.aggregateByStudent) {
        entries = aggregateStudentScores(entries, params.aggregateMethod || 'max');
      }
      
      // Calculate ranks (after aggregation if needed)
      entries = calculateRanks(entries);
      
      // Apply pagination if specified
      let paginatedEntries = entries;
      if (params.limit && params.page) {
        const offset = (params.page - 1) * params.limit;
        paginatedEntries = entries.slice(offset, offset + params.limit);
      } else if (params.limit) {
        paginatedEntries = entries.slice(0, params.limit);
      }
      
      logger.info(`[LEADERBOARD] Generated leaderboard with ${paginatedEntries.length} entries (from ${entries.length} total)`, 'LEADERBOARD');
      
      return {
        success: true,
        data: paginatedEntries,
        count: paginatedEntries.length,
        total: entries.length,
      };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        logger.info('[LEADERBOARD] Request cancelled', 'LEADERBOARD');
        return {
          success: false,
          error: 'Request cancelled',
        };
      }
      
      logger.error('[LEADERBOARD] Get leaderboard error', 'LEADERBOARD', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch leaderboard',
      };
    }
  },

  /**
   * Get leaderboard aggregated by month
   * 
   * @param token - Authentication token
   * @param params - Filter parameters (must include month and year)
   * @param signal - AbortSignal for request cancellation
   */
  async getMonthlyLeaderboard(
    token: string,
    params: LeaderboardParams & { month: number; year: number },
    signal?: AbortSignal
  ): Promise<LeaderboardResponse> {
    return this.getLeaderboard(token, params, signal);
  },

  /**
   * Get overall leaderboard (all time)
   * 
   * @param token - Authentication token
   * @param params - Filter parameters
   * @param signal - AbortSignal for request cancellation
   */
  async getAllTimeLeaderboard(
    token: string,
    params: LeaderboardParams = {},
    signal?: AbortSignal
  ): Promise<LeaderboardResponse> {
    // Don't include month/year filters for all-time
    const { month, year, ...allTimeParams } = params;
    return this.getLeaderboard(token, allTimeParams, signal);
  },
};
