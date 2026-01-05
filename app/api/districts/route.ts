import { NextRequest, NextResponse } from 'next/server';
import { apiClient, EXTERNAL_ENDPOINTS } from '@/lib/api/client';
import { logger } from '@/lib/logger';
import { dataCache } from '@/lib/cache/dataCache';

/**
 * Districts API Route
 * Single source of truth: Uses District lookup API only
 * Returns districts with aggregated student_count per district
 * 404 from lookup API means "no districts found" - returns empty array (200 OK)
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
    const limit = parseInt(searchParams.get('limit') || '10000', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const province_id = searchParams.get('province_id') || undefined;
    const district_name = searchParams.get('district_name') || undefined;
    const q = searchParams.get('q') || undefined; // Search query

    logger.info(`[DISTRICTS] API request: province_id=${province_id || 'all'}, district_name=${district_name || 'all'}, limit=${limit}, offset=${offset}`, 'API/DISTRICTS');

    // Validate required parameter
    if (!province_id) {
      logger.error('[DISTRICTS] Missing required parameter: province_id', 'API/DISTRICTS');
      return NextResponse.json(
        { success: false, error: 'province_id is required for districts API' },
        { status: 400 }
      );
    }

    // Build cache key (only cache successful responses, including empty arrays)
    const cacheKey = `districts:${province_id}:${district_name || 'all'}:${q || 'all'}`;
    
    // Try to get from cache first
    const cachedDistricts = dataCache.get<any[]>(cacheKey);
    if (cachedDistricts !== null && cachedDistricts !== undefined) {
      logger.info(`[DISTRICTS] Using cached districts data (${cachedDistricts.length} districts)`, 'API/DISTRICTS');
      
      // Apply pagination to cached data
      const totalCount = cachedDistricts.length;
      const start = offset;
      const end = offset + limit;
      const paginatedDistricts = cachedDistricts.slice(start, end);
      
      const response = NextResponse.json({
        success: true,
        count: totalCount,
        results: paginatedDistricts,
        data: paginatedDistricts,
        total_students: 0,
        next: end < totalCount ? `/api/districts?limit=${limit}&offset=${end}${province_id ? `&province_id=${province_id}` : ''}${q ? `&q=${q}` : ''}` : null,
        previous: offset > 0 ? `/api/districts?limit=${limit}&offset=${Math.max(0, offset - limit)}${province_id ? `&province_id=${province_id}` : ''}${q ? `&q=${q}` : ''}` : null,
      });
      
      response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
      return response;
    }

    // Build URL for District lookup API
    // Format: /api/Base/data/v1/api/lookup/v1/district/{province_id}/
    let url = EXTERNAL_ENDPOINTS.DISTRICTS.LOOKUP(province_id);
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());
    if (district_name) params.append('district_name', district_name);
    if (q) params.append('q', q);
    
    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    // Fetch from District lookup API
    logger.info(`[DISTRICTS] Calling external API: ${url}`, 'API/DISTRICTS');
    const apiResponse = await apiClient.get(url, { token });

    let districts: any[] = [];

    if (!apiResponse.success) {
      // Detect 404 from lookup API - this means "no districts found" for this province
      const errorMsg = apiResponse.error || '';
      const isNotFound = errorMsg.includes('Status: 404') || 
                         errorMsg.includes('404') ||
                         errorMsg.includes('Not Found') || 
                         errorMsg.includes('<!doctype html>');
      
      if (isNotFound) {
        // 404 from lookup endpoint means no districts found - return empty array (not an error)
        logger.info(`[DISTRICTS] No districts found for province_id: ${province_id} (404 from lookup API)`, 'API/DISTRICTS');
        districts = []; // Empty array for "no districts found"
      } else {
        // For actual server errors (not 404), log and return empty array gracefully
        logger.error(`[DISTRICTS] District API error (non-404), returning empty array: ${apiResponse.error}`, 'API/DISTRICTS');
        districts = []; // Return empty array instead of error
      }
    } else {
      // Parse successful API response
      const data = apiResponse.data as any;
      districts = data?.results || data?.data || (Array.isArray(data) ? data : []);
      logger.info(`[DISTRICTS] Received ${districts.length} districts from District API for province ${province_id}`, 'API/DISTRICTS');
    }
    
    // Map districts to ensure consistent format
    // Note: The District API does not provide student_count
    const mappedDistricts = districts.map((d: any) => ({
      province_id: d.province_id || d.province_ID || d.id || province_id,
      district_name: d.district_name || d.district_Name || d.name,
      total_count: 0, // No student count available from API
    })).filter((d: any) => d.district_name); // Filter out invalid entries

    // Apply search filter if provided (client-side filtering if API doesn't support it)
    let filteredDistricts = mappedDistricts;
    if (q) {
      filteredDistricts = mappedDistricts.filter((d: any) => 
        d.district_name?.toLowerCase().includes(q.toLowerCase())
      );
    }
    
    // Apply district_name filter if provided
    if (district_name) {
      filteredDistricts = filteredDistricts.filter((d: any) => 
        d.district_name?.toLowerCase().includes(district_name.toLowerCase())
      );
    }

    // Cache districts (including empty arrays) for 15 minutes
    // This prevents repeated API calls for provinces with no districts
    dataCache.set(cacheKey, filteredDistricts, 15 * 60 * 1000);
    logger.info(`[DISTRICTS] Cached ${filteredDistricts.length} districts for 15 minutes`, 'API/DISTRICTS');

    // Apply pagination if needed
    const totalCount = filteredDistricts.length;
    const start = offset;
    const end = offset + limit;
    const paginatedDistricts = filteredDistricts.slice(start, end);

    logger.info(`[DISTRICTS] Successfully fetched ${filteredDistricts.length} districts (returning ${paginatedDistricts.length} with pagination)`, 'API/DISTRICTS');

    const httpResponse = NextResponse.json({
      success: true,
      count: totalCount,
      results: paginatedDistricts,
      data: paginatedDistricts, // Support both formats
      total_students: 0, // No student count available from API
      next: end < totalCount ? `/api/districts?limit=${limit}&offset=${end}${province_id ? `&province_id=${province_id}` : ''}${q ? `&q=${q}` : ''}` : null,
      previous: offset > 0 ? `/api/districts?limit=${limit}&offset=${Math.max(0, offset - limit)}${province_id ? `&province_id=${province_id}` : ''}${q ? `&q=${q}` : ''}` : null,
    });
    
    // Add cache headers for client-side caching (5 minutes)
    httpResponse.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    
    return httpResponse;
  } catch (error: any) {
    logger.error(`Districts API error: ${error.message}`, 'API/DISTRICTS', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch districts' },
      { status: 500 }
    );
  }
}

