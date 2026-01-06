import { NextRequest, NextResponse } from 'next/server';
import { apiClient, EXTERNAL_ENDPOINTS } from '@/lib/api/client';
import { logger } from '@/lib/logger';
import { dataCache, CACHE_KEYS } from '@/lib/cache/dataCache';
import { SCHOOL_CACHE_TTL } from '@/lib/cache/cacheConstants';

/**
 * Schools List API Route
 * Uses School API (aggregation-based)
 * Returns schools with aggregated student_count per school
 * CRITICAL: Does NOT use Student API - relies on backend aggregation (GROUP BY)
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
    // Support both province_id and province_ID (API uses province_ID with capital ID)
    const province_id = searchParams.get('province_id') || searchParams.get('province_ID') || undefined;
    const district_name = searchParams.get('district_name') || undefined;
    const school_name = searchParams.get('school_name') || undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') || '25', 10), 25); // STRICT: limit ≤25
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const q = searchParams.get('q') || undefined; // Search query

    // Progressive filtering: Make province_id and district_name optional
    // If not provided, return all schools (will be filtered client-side if needed)
    // This allows the UI to show data even without filters selected

    // Log request params for debugging
    logger.info(`[SCHOOLS] API request: province_id=${province_id}, district_name=${district_name}, school_name=${school_name}, q=${q}, limit=${limit}, offset=${offset}`, 'API/SCHOOLS');

    // Build cache key from parameters (exclude pagination for cache key)
    const cacheKey = CACHE_KEYS.SCHOOLS_LIST(`${province_id}:${district_name}:${school_name || ''}:${q || ''}`);

    // Try to get from cache first (only if no search query to avoid stale results)
    if (!q) {
      const cachedSchools = dataCache.get<any[]>(cacheKey);
      if (cachedSchools && cachedSchools.length >= 0) {
        logger.info(`[SCHOOLS] Using cached schools data (${cachedSchools.length} schools)`, 'API/SCHOOLS');
        
        // Apply pagination to cached data
        const totalCount = cachedSchools.length;
        const start = offset;
        const end = offset + limit;
        const paginatedSchools = cachedSchools.slice(start, end);
        
        const cachedResponse = NextResponse.json({
          success: true,
          data: paginatedSchools,
          count: totalCount,
          total_students: 0,
          next: end < totalCount ? `/api/schools/list?limit=${limit}&offset=${end}&province_id=${province_id}&district_name=${encodeURIComponent(district_name)}${q ? `&q=${q}` : ''}` : null,
          previous: offset > 0 ? `/api/schools/list?limit=${limit}&offset=${Math.max(0, offset - limit)}&province_id=${province_id}&district_name=${encodeURIComponent(district_name)}${q ? `&q=${q}` : ''}` : null,
        });
        
        cachedResponse.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
        return cachedResponse;
      }
    }

    // Build URL for School API
    // NOTE: The external API uses province_ID (capital ID) according to Swagger docs
    let url = EXTERNAL_ENDPOINTS.SCHOOLS.LIST;
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());
    if (province_id) params.append('province_ID', province_id); // Use capital ID for external API
    if (district_name) params.append('district_name', district_name);
    if (school_name) params.append('school_name', school_name);
    if (q) params.append('search', q); // Schools API uses 'search' parameter, not 'q'
    
    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    // PERFORMANCE: Fetch from School API with timeout to prevent 5-19s waits
    // Add timeout to prevent long waits when upstream API is slow
    const response = await apiClient.get(url, { 
      token,
      timeout: 10000, // 10 second timeout (prevents 5-19s waits)
    });

    if (!response.success) {
      // BEST PRACTICE: Always return 200 OK with empty results, never expose errors
      // This ensures the API is resilient and never fails completely
      const errorMsg = response.error || '';
      const isNotFound = errorMsg.includes('Not Found') || 
                         errorMsg.includes('404') || 
                         errorMsg.includes('<!doctype html>');
      
      if (isNotFound) {
        logger.warn(`[SCHOOLS] School API endpoint not found: ${url}. Returning empty results.`, 'API/SCHOOLS');
      } else {
        logger.error(`[SCHOOLS] Schools API failed: ${response.error}. Returning empty results.`, 'API/SCHOOLS');
      }
      
      // Return 200 OK with empty results (never return 404 or 500)
      return NextResponse.json({
        success: true,
        data: [],
        count: 0,
        total_students: 0,
        next: null,
        previous: null,
      }, { status: 200 });
    }

    const data = response.data as any;
    const schools = data?.results || data?.data || (Array.isArray(data) ? data : []);

    // Map schools to ensure consistent format
    // NOTE: The API returns:
    // - count: total number of schools (pagination count)
    // - geip_school_ID, province_ID, province_name, school_name, school_type_h, school_type_k, etc.
    // - district_name may be empty
    // - student_count is NOT provided by this API endpoint
    const mappedSchools = schools.map((s: any) => ({
      province_id: s.province_ID || s.province_id || s.id,
      province_name: s.province_name || s.province_Name || s.province || '',
      district_name: s.district_name || s.district_Name || '', // May be empty in API
      school_name: s.school_name || s.school_Name || s.name,
      geip_school_ID: s.geip_school_ID || s.geip_school_id || s.id,
      school_type_h: s.school_type_h || s.school_type_H || s.school_type || '',
      school_type_k: s.school_type_k || s.school_type_K || s.school_type_kh || '',
      // NOTE: student_count is NOT available from Schools API
      // If needed, it must be calculated separately or come from a different endpoint
      total_count: s.student_count || s.total_count || 0, // Will be 0 if not provided
    }));

    // Log warning if student_count is not available from the API
    if (mappedSchools.length > 0 && mappedSchools.every((s: any) => !s.total_count || s.total_count === 0)) {
      logger.warn('[SCHOOLS] School API does not provide student_count. The API returns school data but student counts must be calculated separately or fetched from a different endpoint.', 'API/SCHOOLS');
    }
    
    // Log warning if district_name is missing
    if (mappedSchools.some((s: any) => !s.district_name || s.district_name === '')) {
      logger.warn('[SCHOOLS] Some schools have empty district_name. Filtering by district may not work correctly.', 'API/SCHOOLS');
    }

    // Apply search filter if provided (client-side filtering if API doesn't support it)
    let filteredSchools = mappedSchools;
    if (q && !data?.results) {
      filteredSchools = mappedSchools.filter((s: any) => 
        s.school_name?.toLowerCase().includes(q.toLowerCase())
      );
    }

    // Sort by school name (no student count to sort by)
    filteredSchools.sort((a: any, b: any) => {
      const nameA = (a.school_name || '').toLowerCase();
      const nameB = (b.school_name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });

    // Cache the filtered schools (before pagination) using centralized cache constant
    // Only cache if no search query to avoid stale results
    if (!q && filteredSchools.length > 0) {
      dataCache.set(cacheKey, filteredSchools, SCHOOL_CACHE_TTL);
      logger.info(`[SCHOOLS] Cached ${filteredSchools.length} schools for ${SCHOOL_CACHE_TTL / 1000 / 60} minutes`, 'API/SCHOOLS');
    }

    // Apply pagination if needed
    const totalCount = filteredSchools.length;
    const start = offset;
    const end = offset + limit;
    const paginatedSchools = filteredSchools.slice(start, end);

    logger.info(`[SCHOOLS] Successfully fetched ${filteredSchools.length} schools (returning ${paginatedSchools.length} with pagination)`, 'API/SCHOOLS');

    const apiResponse = NextResponse.json({
      success: true,
      data: paginatedSchools,
      count: totalCount,
      total_students: 0, // No student count available from API
      next: end < totalCount ? `/api/schools/list?limit=${limit}&offset=${end}&province_id=${province_id}&district_name=${encodeURIComponent(district_name)}${q ? `&q=${q}` : ''}` : null,
      previous: offset > 0 ? `/api/schools/list?limit=${limit}&offset=${Math.max(0, offset - limit)}&province_id=${province_id}&district_name=${encodeURIComponent(district_name)}${q ? `&q=${q}` : ''}` : null,
    });
    
    // Add cache headers (shorter for search queries)
    apiResponse.headers.set('Cache-Control', q ? 'public, s-maxage=60, stale-while-revalidate=120' : 'public, s-maxage=300, stale-while-revalidate=600');
    
    return apiResponse;
  } catch (error: any) {
    // BEST PRACTICE: Always return 200 OK with empty results, never expose errors
    logger.error(`[SCHOOLS] Schools API error: ${error?.message || 'Unknown error'}. Returning empty results.`, 'API/SCHOOLS', error);
    return NextResponse.json({
      success: true,
      data: [],
      count: 0,
      total_students: 0,
      next: null,
      previous: null,
    }, { status: 200 });
  }
}

