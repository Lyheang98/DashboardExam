import { NextRequest, NextResponse } from 'next/server';
import { schoolService } from '@/lib/api';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  // Always return 200 OK with normalized response structure
  // Do NOT throw errors - normalize all responses
  
  // Get token from Authorization header or cookie
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '') || 
                request.cookies.get('token')?.value || '';
  
  if (!token) {
    logger.warn('Schools search failed: No authentication token', 'API/SCHOOLS/SEARCH');
    return NextResponse.json(
      { success: true, data: [], count: 0 },
      { status: 200 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  
  // REQUIRED: province_id and district_name must be provided
  const province_id = searchParams.get('province_id') || searchParams.get('province') || undefined;
  const district_name = searchParams.get('district_name') || searchParams.get('district') || undefined;
  
  // Validate required parameters - return empty results instead of error
  if (!province_id || !district_name) {
    logger.warn(`Schools search: Missing required parameters - province_id: ${!!province_id}, district_name: ${!!district_name}`, 'API/SCHOOLS/SEARCH');
    return NextResponse.json(
      { success: true, data: [], count: 0 },
      { status: 200 }
    );
  }
  
  const params = {
    q: searchParams.get('q') || undefined,
    province: province_id, // Map to province for backward compatibility
    district: district_name, // Map to district for backward compatibility
    province_id: province_id, // Also include province_id
    district_name: district_name, // Also include district_name
    school_type: searchParams.get('school_type') || undefined,
    is_target: searchParams.get('is_target') || undefined,
    page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : undefined,
    limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined,
    offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined,
  };

  logger.info(`Schools search request: ${JSON.stringify(params)}`, 'API/SCHOOLS/SEARCH');

  try {
    const result = await schoolService.search(token, params);

    if (!result.success) {
      logger.warn(`Schools search failed, returning empty results: ${result.error}`, 'API/SCHOOLS/SEARCH');
      return NextResponse.json(
        { success: true, data: [], count: 0 },
        { status: 200 }
      );
    }

    logger.info(`Schools search success: ${result.data?.length || 0} schools, count: ${result.count}`, 'API/SCHOOLS/SEARCH');

    return NextResponse.json(
      { 
        success: true,
        data: result.data || [], 
        count: result.count || 0,
        next: result.next || null,
        previous: result.previous || null
      },
      { status: 200 }
    );
  } catch (error: any) {
    // Do NOT throw - normalize error to empty results with proper format
    logger.error(`Schools search error, returning empty results: ${error?.message || 'Unknown error'}`, 'API/SCHOOLS/SEARCH', error);
    return NextResponse.json(
      { success: true, data: [], count: 0 },
      { status: 200 }
    );
  }
}

