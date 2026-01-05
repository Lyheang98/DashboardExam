/**
 * Student Tracker Service - Analytics Logic Layer
 * 
 * Purpose: Track exam participation (NOT ranking)
 * 
 * Business rules:
 * - Exam Taken: Student has at least ONE subject record
 * - Not Exam: Student has ZERO subject records
 * 
 * Responsibilities:
 * - Count exam attempts per student per subject
 * - Calculate:
 *   - totalExamTaken
 *   - totalNotExam
 * - Prepare monthly comparison data
 * 
 * Rules:
 * - Use resultSubjects.service.ts for data
 * - Keep logic isolated from UI
 */

import { logger } from '../../logger';
import { resultSubjectsService, ResultSubject, ResultSubjectsParams } from './resultSubjects.service';

export interface StudentTrackerEntry {
  studentId: string;
  studentName: string;
  school?: string;
  grade?: string;
  subject?: string;
  examAttempts: number; // Number of times student took exam for this subject
  status: 'Exam' | 'Not Exam'; // Exam = has at least one score, Not Exam = zero scores
  // Additional metadata
  lastExamDate?: string;
  firstExamDate?: string;
  averageScore?: number;
  maxScore?: number;
}

export interface StudentTrackerStats {
  totalExamTaken: number; // Students who took at least one exam
  totalNotExam: number; // Students who took zero exams
  totalStudents: number;
}

export interface MonthlyComparisonData {
  month: string; // "January 2024"
  monthNumber: number;
  year: number;
  examTaken: number;
  notExam: number;
  total: number;
  changeFromPrevious?: number; // Percentage change
}

export interface StudentTrackerResponse {
  success: boolean;
  data?: StudentTrackerEntry[];
  stats?: StudentTrackerStats;
  monthlyComparison?: MonthlyComparisonData[];
  count?: number;
  total?: number;
  error?: string;
}

export interface StudentTrackerParams extends ResultSubjectsParams {
  // Grouping options
  groupBySubject?: boolean; // If true, track attempts per subject per student
  includeStats?: boolean; // If true, include aggregated stats
  includeMonthlyComparison?: boolean; // If true, include monthly comparison data
  monthlyComparisonRange?: { startMonth: number; startYear: number; endMonth: number; endYear: number };
}

/**
 * Determine if student took exam (has at least one score)
 */
function hasExamRecord(subjectRecords: ResultSubject[]): boolean {
  return subjectRecords.length > 0;
}

/**
 * Count exam attempts for a student
 */
function countExamAttempts(subjectRecords: ResultSubject[]): number {
  return subjectRecords.length;
}

/**
 * Calculate average score for a student
 */
function calculateAverageScore(subjectRecords: ResultSubject[]): number | undefined {
  const scores = subjectRecords
    .map(r => typeof r.score === 'number' ? r.score : null)
    .filter((score): score is number => score !== null);
  
  if (scores.length === 0) return undefined;
  
  const sum = scores.reduce((acc, score) => acc + score, 0);
  return sum / scores.length;
}

/**
 * Calculate max score for a student
 */
function calculateMaxScore(subjectRecords: ResultSubject[]): number | undefined {
  const scores = subjectRecords
    .map(r => typeof r.score === 'number' ? r.score : null)
    .filter((score): score is number => score !== null);
  
  if (scores.length === 0) return undefined;
  
  return Math.max(...scores);
}

/**
 * Get earliest and latest exam dates
 */
function getExamDateRange(subjectRecords: ResultSubject[]): { first?: string; last?: string } {
  const dates = subjectRecords
    .map(r => r.exam_date)
    .filter((date): date is string => !!date && typeof date === 'string')
    .sort();
  
  return {
    first: dates[0],
    last: dates[dates.length - 1],
  };
}

/**
 * Process result subjects into tracker entries
 */
function processTrackerEntries(
  results: ResultSubject[],
  groupBySubject: boolean = false
): StudentTrackerEntry[] {
  // Group by studentId (and optionally by subject)
  const groupedMap = new Map<string, ResultSubject[]>();
  
  for (const result of results) {
    const studentId = result.student_id || result.id?.toString() || '';
    if (!studentId) continue;
    
    const key = groupBySubject && result.subject
      ? `${studentId}:${result.subject}`
      : studentId;
    
    if (!groupedMap.has(key)) {
      groupedMap.set(key, []);
    }
    groupedMap.get(key)!.push(result);
  }
  
  // Convert to tracker entries
  const entries: StudentTrackerEntry[] = [];
  
  for (const [key, subjectRecords] of groupedMap.entries()) {
    if (subjectRecords.length === 0) continue;
    
    const firstRecord = subjectRecords[0];
    const examAttempts = countExamAttempts(subjectRecords);
    const hasExam = hasExamRecord(subjectRecords);
    const dateRange = getExamDateRange(subjectRecords);
    
    entries.push({
      studentId: firstRecord.student_id || firstRecord.id?.toString() || '',
      studentName: firstRecord.student_name || 
                   firstRecord.student_name_en || 
                   firstRecord.student_name_km || 
                   '',
      school: firstRecord.school_name,
      grade: firstRecord.grade || firstRecord.grade_name,
      subject: groupBySubject ? (firstRecord.subject || firstRecord.subject_name) : undefined,
      examAttempts,
      status: hasExam ? 'Exam' : 'Not Exam',
      firstExamDate: dateRange.first,
      lastExamDate: dateRange.last,
      averageScore: calculateAverageScore(subjectRecords),
      maxScore: calculateMaxScore(subjectRecords),
    });
  }
  
  return entries;
}

/**
 * Calculate aggregated statistics
 */
function calculateStats(entries: StudentTrackerEntry[]): StudentTrackerStats {
  const totalExamTaken = entries.filter(e => e.status === 'Exam').length;
  const totalNotExam = entries.filter(e => e.status === 'Not Exam').length;
  const totalStudents = entries.length;
  
  return {
    totalExamTaken,
    totalNotExam,
    totalStudents,
  };
}

/**
 * Generate monthly comparison data
 */
async function generateMonthlyComparison(
  token: string,
  params: StudentTrackerParams & { monthlyComparisonRange: { startMonth: number; startYear: number; endMonth: number; endYear: number } }
): Promise<MonthlyComparisonData[]> {
  const { monthlyComparisonRange, ...baseParams } = params;
  const { startMonth, startYear, endMonth, endYear } = monthlyComparisonRange;
  
  const monthlyData: MonthlyComparisonData[] = [];
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  // Iterate through months
  let currentMonth = startMonth;
  let currentYear = startYear;
  
  while (
    currentYear < endYear ||
    (currentYear === endYear && currentMonth <= endMonth)
  ) {
    try {
      // Fetch data for this month
      const monthParams = {
        ...baseParams,
        month: currentMonth,
        year: currentYear,
        forceMonthlyEndpoint: true, // Always use monthly endpoints for analytics
      };
      
      const response = await resultSubjectsService.getList(token, monthParams);
      
      if (response.success && response.data) {
        // Count unique students who took exams
        const studentIds = new Set(response.data.map(r => r.student_id || r.id?.toString() || '').filter(Boolean));
        const examTaken = studentIds.size;
        
        // Note: NotExam count would require knowing total students in system
        // For now, we only track exam taken
        monthlyData.push({
          month: `${monthNames[currentMonth - 1]} ${currentYear}`,
          monthNumber: currentMonth,
          year: currentYear,
          examTaken,
          notExam: 0, // Would need total student count to calculate
          total: examTaken,
        });
      }
    } catch (error) {
      logger.error(`[STUDENT_TRACKER] Failed to fetch data for ${currentMonth}/${currentYear}`, 'STUDENT_TRACKER', error);
    }
    
    // Move to next month
    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }
  }
  
  // Calculate changes from previous month
  for (let i = 1; i < monthlyData.length; i++) {
    const current = monthlyData[i];
    const previous = monthlyData[i - 1];
    
    if (previous.examTaken > 0) {
      current.changeFromPrevious = ((current.examTaken - previous.examTaken) / previous.examTaken) * 100;
    }
  }
  
  return monthlyData;
}

export const studentTrackerService = {
  /**
   * Get student tracker data
   * 
   * Analytics logic: Tracks exam participation, not ranking
   * 
   * @param token - Authentication token
   * @param params - Filter and pagination parameters
   * @param signal - AbortSignal for request cancellation
   */
  async getTrackerData(
    token: string,
    params: StudentTrackerParams = {},
    signal?: AbortSignal
  ): Promise<StudentTrackerResponse> {
    try {
      // Fetch raw data from resultSubjects service
      // CRITICAL: Force monthly endpoint for Student Tracker (all analytics pages use monthly endpoints)
      const rawResponse = await resultSubjectsService.getList(token, {
        ...params,
        forceMonthlyEndpoint: true, // Always use monthly endpoints for Student Tracker
      }, signal);
      
      if (!rawResponse.success || !rawResponse.data) {
        logger.error(`[STUDENT_TRACKER] Failed to fetch result subjects: ${rawResponse.error}`, 'STUDENT_TRACKER');
        return {
          success: false,
          error: rawResponse.error || 'Failed to fetch tracker data',
        };
      }
      
      // Process into tracker entries
      const entries = processTrackerEntries(
        rawResponse.data,
        params.groupBySubject || false
      );
      
      // Calculate stats if requested
      let stats: StudentTrackerStats | undefined;
      if (params.includeStats) {
        stats = calculateStats(entries);
      }
      
      // Generate monthly comparison if requested
      let monthlyComparison: MonthlyComparisonData[] | undefined;
      if (params.includeMonthlyComparison && params.monthlyComparisonRange) {
        monthlyComparison = await generateMonthlyComparison(token, {
          ...params,
          monthlyComparisonRange: params.monthlyComparisonRange,
        });
      }
      
      // Apply pagination if specified
      let paginatedEntries = entries;
      if (params.limit && params.page) {
        const offset = (params.page - 1) * params.limit;
        paginatedEntries = entries.slice(offset, offset + params.limit);
      } else if (params.limit) {
        paginatedEntries = entries.slice(0, params.limit);
      }
      
      logger.info(`[STUDENT_TRACKER] Generated tracker data with ${paginatedEntries.length} entries (from ${entries.length} total)`, 'STUDENT_TRACKER');
      
      return {
        success: true,
        data: paginatedEntries,
        stats,
        monthlyComparison,
        count: paginatedEntries.length,
        total: entries.length,
      };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        logger.info('[STUDENT_TRACKER] Request cancelled', 'STUDENT_TRACKER');
        return {
          success: false,
          error: 'Request cancelled',
        };
      }
      
      logger.error('[STUDENT_TRACKER] Get tracker data error', 'STUDENT_TRACKER', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch tracker data',
      };
    }
  },
};
