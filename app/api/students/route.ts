import { NextRequest, NextResponse } from 'next/server';
import { apiClient, EXTERNAL_ENDPOINTS } from '@/lib/api/client';
import { logger } from '@/lib/logger';

/**
 * Students API Route
 * Uses Student API with required parameters (province_id, district_name)
 * Returns students with pagination support
 * CRITICAL: Uses STUDENTS API only for student data
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

    const searchParams = request.nextUrl.searchParams;
    // Support both province_id and province_ID (API uses province_ID with capital ID)
    const province_id = searchParams.get('province_ID') || searchParams.get('province_id') || undefined;
    const district_name = searchParams.get('district_name') || undefined;
    // Support both geip_school_ID (exact API field) and school_name (for backward compatibility)
    const geip_school_ID = searchParams.get('geip_school_ID') || searchParams.get('school_name') || undefined;
    const grade = searchParams.get('grade') || undefined;
    const room = searchParams.get('room') || undefined;
    const student_type = searchParams.get('student_type') || undefined;
    const limit = parseInt(searchParams.get('limit') || '25', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    logger.info(`[STUDENTS] API request: province_ID=${province_id || 'all'}, district_name=${district_name || 'all'}, geip_school_ID=${geip_school_ID || 'all'}, grade=${grade || 'all'}, room=${room || 'all'}, student_type=${student_type || 'all'}, limit=${limit}, offset=${offset}`, 'API/STUDENTS');

    // Build URL for external API
    // Base URL: /api/Base/data/v1/students/
    // ALWAYS use query parameters (do NOT use path-based approach)
    // Use exact API field names: province_ID, district_name, geip_school_ID, grade, room, student_type
    const baseUrl = EXTERNAL_ENDPOINTS.STUDENTS.LIST.endsWith('/') 
      ? EXTERNAL_ENDPOINTS.STUDENTS.LIST 
      : `${EXTERNAL_ENDPOINTS.STUDENTS.LIST}/`;
    
    // Always use query parameter approach with exact API field names
    const queryParams = new URLSearchParams();
    // Always include pagination
    queryParams.append('limit', limit.toString());
    queryParams.append('offset', offset.toString());
    
    // Add filters using exact API field names
    if (province_id) queryParams.append('province_ID', province_id); // API uses capital ID
    if (district_name) queryParams.append('district_name', district_name);
    if (geip_school_ID) queryParams.append('geip_school_ID', geip_school_ID); // Exact API field name
    if (grade) queryParams.append('grade', grade);
    if (room) queryParams.append('room', room);
    if (student_type) queryParams.append('student_type', student_type);
    
    const url = `${baseUrl}?${queryParams.toString()}`;

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
      if (response.status === 401) {
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

