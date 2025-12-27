import { NextRequest, NextResponse } from 'next/server';
import { schoolService } from '@/lib/api';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    // Get token from Authorization header or cookie
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || 
                  request.cookies.get('token')?.value || '';

    if (!token) {
      logger.warn('Schools search failed: No authentication token', 'API/SCHOOLS/SEARCH');
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const params = {
      q: searchParams.get('q') || undefined,
      province: searchParams.get('province') || undefined,
      district: searchParams.get('district') || undefined,
      school_type: searchParams.get('school_type') || undefined,
      is_target: searchParams.get('is_target') || undefined,
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined,
    };

    logger.info(`Schools search request: ${JSON.stringify(params)}`, 'API/SCHOOLS/SEARCH');

    const result = await schoolService.search(token, params);

    if (!result.success) {
      logger.error(`Schools search failed: ${result.error}`, 'API/SCHOOLS/SEARCH');
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to search schools' },
        { status: 500 }
      );
    }

    logger.info(`Schools search success: ${result.data?.length || 0} schools, count: ${result.count}`, 'API/SCHOOLS/SEARCH');

    return NextResponse.json({
      success: true,
      count: result.count || 0,
      data: result.data || [],
      next: result.next || null,
      previous: result.previous || null,
    });
  } catch (error: any) {
    logger.error(`Schools search error: ${error?.message || 'Unknown error'}`, 'API/SCHOOLS/SEARCH', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Search failed' },
      { status: 500 }
    );
  }
}

