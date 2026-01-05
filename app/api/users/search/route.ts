import { NextRequest, NextResponse } from 'next/server';
import { usersService } from '@/lib/api';
import { dataCache, CACHE_KEYS } from '@/lib/cache/dataCache';

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

    const searchParams = request.nextUrl.searchParams;
    const params = {
      q: searchParams.get('q') || undefined,
      role: searchParams.get('role') || undefined,
      status: searchParams.get('status') || undefined,
    };

    // Build cache key from search parameters
    const cacheKey = CACHE_KEYS.USERS_SEARCH(JSON.stringify(params));

    // Try to get from cache first (only cache for non-search queries to avoid stale results)
    if (!params.q) {
      const cachedResult = dataCache.get<{ count: number; data: any[] }>(cacheKey);
      if (cachedResult) {
        const response = NextResponse.json({
          success: true,
          count: cachedResult.count || 0,
          data: cachedResult.data || [],
        });
        response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
        return response;
      }
    }

    const result = await usersService.search(token, params);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    // Cache results for 5 minutes (only if not a search query)
    if (!params.q && result.data) {
      dataCache.set(cacheKey, { count: result.count || 0, data: result.data || [] }, 5 * 60 * 1000);
    }

    const response = NextResponse.json({
      success: true,
      count: result.count || 0,
      data: result.data || [],
    });
    
    // Add cache headers (shorter for search queries)
    response.headers.set('Cache-Control', params.q ? 'public, s-maxage=60, stale-while-revalidate=120' : 'public, s-maxage=300, stale-while-revalidate=600');
    
    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Search failed' },
      { status: 500 }
    );
  }
}
