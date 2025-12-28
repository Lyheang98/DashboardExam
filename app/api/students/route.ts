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
    
    // This route is deprecated - return error message
    logger.error('[STUDENTS] API request rejected: This route is deprecated. Use hierarchical endpoints via students.service.ts', 'API/STUDENTS');
    return NextResponse.json(
      { 
        success: false, 
        error: 'This route is deprecated. Use hierarchical endpoints: /students/{province}/districts/{district}/... via students.service.ts',
        code: 'ROUTE_DEPRECATED'
      },
      { status: 400 }
    );
  } catch (error: any) {
    logger.error(`Students API error: ${error.message}`, 'API/STUDENTS', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch students' },
      { status: 500 }
    );
  }
}

