import { NextRequest, NextResponse } from 'next/server';
import { apiClient, EXTERNAL_ENDPOINTS } from '@/lib/api/client';
import { logger } from '@/lib/logger';

/**
 * Schools API Route
 * Uses School API directly (NOT Student API)
 * Returns schools with aggregated student_count per school
 */
export async function GET(request: NextRequest) {
  try {
    // Get token from Authorization header or cookie
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || 
                  request.cookies.get('token')?.value || '';
    
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const province_id = searchParams.get('province_id') || undefined;
    const district_name = searchParams.get('district_name') || undefined;
    const school_name = searchParams.get('school_name') || undefined;
    const limit = parseInt(searchParams.get('limit') || '1000', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const q = searchParams.get('q') || undefined; // Search query

    // Validate required parameters
    if (!province_id) {
      logger.error('[SCHOOLS] Missing required parameter: province_id', 'API/SCHOOLS');
      return NextResponse.json(
        { success: false, error: 'province_id is required' },
        { status: 400 }
      );
    }

    if (!district_name) {
      logger.error('[SCHOOLS] Missing required parameter: district_name', 'API/SCHOOLS');
      return NextResponse.json(
        { success: false, error: 'district_name is required' },
        { status: 400 }
      );
    }

    // Log request params for debugging
    logger.info(`[SCHOOLS] API request: province_id=${province_id}, district_name=${district_name}, school_name=${school_name}, q=${q}, limit=${limit}, offset=${offset}`, 'API/SCHOOLS');

    // Build URL for School API
    let url = EXTERNAL_ENDPOINTS.SCHOOLS.LIST;
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());
    if (province_id) params.append('province_id', province_id);
    if (district_name) params.append('district_name', district_name);
    if (school_name) params.append('school_name', school_name);
    if (q) params.append('q', q);
    
    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    // Fetch from School API (NOT Student API)
    const response = await apiClient.get(url, { token });

    if (!response.success) {
      logger.error(`Schools API failed: ${response.error}`, 'API/SCHOOLS');
      return NextResponse.json(
        { success: false, error: response.error || 'Failed to fetch schools' },
        { status: 500 }
      );
    }

    const data = response.data as any;
    const schools = data?.results || data?.data || (Array.isArray(data) ? data : []);

    // Map schools to ensure consistent format with student_count
    // The School API should return student_count via backend aggregation (GROUP BY)
    const mappedSchools = schools.map((s: any) => ({
      province_id: s.province_id || s.province_ID || s.id,
      district_name: s.district_name || s.district_Name || s.name,
      school_name: s.school_name || s.school_Name || s.name,
      total_count: s.student_count || s.total_count || s.count || 0,
    }));

    // Log warning if student_count is not available from the API
    // The backend should be enhanced to support aggregation with student_count
    if (mappedSchools.some((s: any) => !s.total_count || s.total_count === 0)) {
      logger.warn('[SCHOOLS] School API does not provide student_count. Backend aggregation (GROUP BY) should be enabled.', 'API/SCHOOLS');
    }

    // Apply search filter if provided (client-side filtering if API doesn't support it)
    let filteredSchools = mappedSchools;
    if (q && !data?.results) {
      filteredSchools = mappedSchools.filter((s: any) => 
        s.school_name?.toLowerCase().includes(q.toLowerCase())
      );
    }

    // Sort by total_count descending
    filteredSchools.sort((a: any, b: any) => (b.total_count || 0) - (a.total_count || 0));

    // Apply pagination if needed
    const totalCount = filteredSchools.length;
    const start = offset;
    const end = offset + limit;
    const paginatedSchools = filteredSchools.slice(start, end);

    const totalStudents = filteredSchools.reduce((sum: number, s: any) => sum + (s.total_count || 0), 0);

    logger.info(`[SCHOOLS] Successfully fetched ${filteredSchools.length} schools (returning ${paginatedSchools.length} with pagination)`, 'API/SCHOOLS');

    return NextResponse.json({
      success: true,
      data: paginatedSchools,
      count: totalCount,
      total_students: totalStudents,
      next: end < totalCount ? `/api/schools?limit=${limit}&offset=${end}&province_id=${province_id}&district_name=${encodeURIComponent(district_name)}${q ? `&q=${q}` : ''}` : null,
      previous: offset > 0 ? `/api/schools?limit=${limit}&offset=${Math.max(0, offset - limit)}&province_id=${province_id}&district_name=${encodeURIComponent(district_name)}${q ? `&q=${q}` : ''}` : null,
    });
  } catch (error: any) {
    logger.error(`Schools API error: ${error.message}`, 'API/SCHOOLS', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch schools' },
      { status: 500 }
    );
  }
}

