import { NextRequest, NextResponse } from 'next/server';
import { apiClient, EXTERNAL_ENDPOINTS } from '@/lib/api/client';
import { logger } from '@/lib/logger';

/**
 * Students API Route
 * 
 * DEPRECATED: This route accepts query params which is unsafe.
 * Frontend should use students.service.ts which calls hierarchical endpoints directly.
 * 
 * This route is kept for backward compatibility but will reject query param requests.
 * All student list queries must use hierarchical endpoints via students.service.ts.
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

    // REJECT query param requests - hierarchical endpoints must be used
    const searchParams = request.nextUrl.searchParams;
    const hasQueryParams = searchParams.has('province_id') || 
                          searchParams.has('province_ID') || 
                          searchParams.has('district_name');
    
    if (hasQueryParams) {
      logger.error('[STUDENTS] API request rejected: Query params not allowed. Use hierarchical endpoints via students.service.ts', 'API/STUDENTS');
      return NextResponse.json(
        { 
          success: false, 
          error: 'Query parameter requests are not allowed. Use hierarchical endpoints: /students/{province}/districts/{district}/... via students.service.ts',
          code: 'QUERY_PARAMS_NOT_ALLOWED'
        },
        { status: 400 }
      );
    }
    
    // Support both geip_school_ID (exact API field) and school_name (for backward compatibility)
    const geip_school_ID = searchParams.get('geip_school_ID') || searchParams.get('school_name') || undefined;
    const grade = searchParams.get('grade') || undefined;
    const room = searchParams.get('room') || undefined;
    const student_type = searchParams.get('student_type') || undefined;
    const limit = parseInt(searchParams.get('limit') || '25', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    logger.info(`[STUDENTS] API request: province_ID=${province_id}, district_name=${district_name}, geip_school_ID=${geip_school_ID || 'all'}, grade=${grade || 'all'}, room=${room || 'all'}, student_type=${student_type || 'all'}, limit=${limit}, offset=${offset}`, 'API/STUDENTS');

    // Build hierarchical endpoint using the DEEPEST possible scope
    // This ensures maximum safety by using the most specific endpoint
    let endpoint: string;
    
    if (province_id && district_name && geip_school_ID && grade && room) {
      // Deepest: All filters available - use BY_ROOM
      endpoint = EXTERNAL_ENDPOINTS.STUDENTS.BY_ROOM(province_id, district_name, geip_school_ID, grade, room);
    } else if (province_id && district_name && geip_school_ID && grade) {
      // Deep: School + Grade - use BY_GRADE
      endpoint = EXTERNAL_ENDPOINTS.STUDENTS.BY_GRADE(province_id, district_name, geip_school_ID, grade);
    } else if (province_id && district_name && geip_school_ID) {
      // Medium: School only - use BY_SCHOOL
      endpoint = EXTERNAL_ENDPOINTS.STUDENTS.BY_SCHOOL(province_id, district_name, geip_school_ID);
    } else {
      // Minimum: Province + District only - use BY_DISTRICT
      endpoint = EXTERNAL_ENDPOINTS.STUDENTS.BY_DISTRICT(province_id, district_name);
    }
    
    // Build query parameters for pagination and optional filters
    const queryParams = new URLSearchParams();
    queryParams.append('limit', limit.toString());
    queryParams.append('offset', offset.toString());
    
    // Add optional filters that are NOT in the path (only query params)
    if (student_type) queryParams.append('student_type', student_type);
    
    const url = `${endpoint}?${queryParams.toString()}`;

    const response = await apiClient.get(url, { token });

    if (!response.success) {
      const errorMsg = response.error || '';
      const isNotFound = errorMsg.includes('Not Found') || 
                         errorMsg.includes('404') || 
                         errorMsg.includes('<!doctype html>');
      
      if (isNotFound) {
        logger.error(`[STUDENTS] Student API endpoint not found: ${url}. The backend API may not be implemented yet.`, 'API/STUDENTS');
        return NextResponse.json(
          { 
            success: false, 
            error: 'Student API endpoint not found. Please ensure the backend API is implemented at: ' + url,
            endpoint: url,
            code: 'ENDPOINT_NOT_FOUND'
          },
          { status: 404 }
        );
      }
      
      // Return 401 if the error is due to authentication
      // Check if error message indicates authentication failure
      if (errorMsg.includes('Authentication') || errorMsg.includes('401') || errorMsg.includes('Unauthorized')) {
        return NextResponse.json(
          { success: false, error: 'Authentication expired. Please login again.' },
          { status: 401 }
        );
      }
      
      logger.error(`Students API failed: ${response.error}`, 'API/STUDENTS');
      return NextResponse.json(
        { success: false, error: response.error || 'Failed to fetch students' },
        { status: 500 }
      );
    }

    const data = response.data as any;
    const students = data?.results || data?.data || (Array.isArray(data) ? data : []);
    const count = data?.count ?? 0; // Use API count, never results.length
    const next = data?.next || null;
    const previous = data?.previous || null;

    logger.info(`[STUDENTS] Successfully fetched ${students.length} students (API count: ${count})`, 'API/STUDENTS');

    return NextResponse.json({
      success: true,
      data: students,
      results: students, // Also include for compatibility
      count: count,
      total_count: count,
      next: next,
      previous: previous,
    });
  } catch (error: any) {
    logger.error(`Students API error: ${error.message}`, 'API/STUDENTS', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch students' },
      { status: 500 }
    );
  }
}

