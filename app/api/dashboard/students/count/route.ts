import { NextRequest, NextResponse } from 'next/server';
import { apiClient } from '@/lib/api/client';
import { logger } from '@/lib/logger';
import { API_CONFIG } from '@/lib/api/config';

/**
 * Dashboard Students Count API Route
 * 
 * Dedicated endpoint for dashboard StatCard "Total Students"
 * - Completely separate from Students page logic
 * - Does NOT depend on Students page filters or pagination
 * - Fetches with limit=1 for performance
 * - Returns ONLY response.count (never results.length)
 * - Independent of user selections or Students page state
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || 
                  request.cookies.get('token')?.value || '';
    
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // For dashboard StatCard, we need the GLOBAL total count (system-wide)
    // Use flat /students/ endpoint with limit=1 to get global count
    // This is safe for dashboard stats (read-only, limit=1, only count field)
    // The flat endpoint returns system-wide total (542,025+ students across all provinces)
    const flatStudentsEndpoint = `${API_CONFIG.EXTERNAL_API_BASE}/api/Base/data/v1/students/`;
    
    // Build query parameters - limit=1 for performance, we only need the count field
    const queryParams = new URLSearchParams();
    queryParams.append('limit', '1'); // limit=1 - fetch minimal data to get count
    queryParams.append('offset', '0');
    
    const url = `${flatStudentsEndpoint}?${queryParams.toString()}`;

    logger.info(`[DASHBOARD] Fetching students count: ${url}`, 'API/DASHBOARD');

    const response = await apiClient.get(url, { token });

    if (!response.success) {
      const errorMsg = response.error || 'Failed to fetch students count';
      logger.error(`[DASHBOARD] Students API error: ${errorMsg}`, 'API/DASHBOARD');
      return NextResponse.json(
        { success: false, error: errorMsg, count: 0 },
        { status: 500 }
      );
    }

    const data = response.data as any;
    
    // STRICT: Use ONLY response.count, NEVER results.length or data.length
    // The count field contains the total count regardless of how many records were fetched
    const count = data?.count ?? data?.total_count ?? 0;
    
    // Verify we're not using array length
    const results = data?.results || data?.data || (Array.isArray(data) ? data : []);
    if (results.length > 0 && count === 0) {
      logger.warn(`[DASHBOARD] API returned ${results.length} results but count=0. Using count=0 (not results.length)`, 'API/DASHBOARD');
    }

    logger.info(`[DASHBOARD] Students count: ${count.toLocaleString()} (from API response.count with limit=1, NOT results.length)`, 'API/DASHBOARD');

    return NextResponse.json({
      success: true,
      count: count, // ONLY return count, never results.length
      // Do NOT return data or results array
    });
  } catch (error: any) {
    logger.error(`[DASHBOARD] Students count API error: ${error.message}`, 'API/DASHBOARD', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch students count', count: 0 },
      { status: 500 }
    );
  }
}

