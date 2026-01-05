import { NextRequest, NextResponse } from 'next/server';
import { apiClient, EXTERNAL_ENDPOINTS } from '@/lib/api/client';
import { logger } from '@/lib/logger';
import { dataCache } from '@/lib/cache/dataCache';
import { PROVINCES } from '@/lib/constants/provinces';

/**
 * Provinces API Route
 * Always returns 200 OK with valid response structure
 * Uses external lookup API when available, falls back to constants on 404
 * Never caches or exposes upstream 404 errors to clients
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
    const limit = parseInt(searchParams.get('limit') || '1000', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const province_name = searchParams.get('province_name') || undefined;
    const province_id = searchParams.get('province_id') || undefined;

    logger.info(`[PROVINCES] API request: limit=${limit}, offset=${offset}`, 'API/PROVINCES');

    // Build cache key (only cache successful API responses)
    const cacheKey = `provinces:${province_id || 'all'}:${province_name || 'all'}`;
    
    // Try to get from cache first (only successful API responses are cached)
    const cachedProvinces = dataCache.get<any[]>(cacheKey);
    if (cachedProvinces && cachedProvinces.length >= 0) {
      logger.info(`[PROVINCES] Using cached provinces data (${cachedProvinces.length} provinces)`, 'API/PROVINCES');
      
      // Apply pagination to cached data
      const totalCount = cachedProvinces.length;
      const start = offset;
      const end = offset + limit;
      const paginatedProvinces = cachedProvinces.slice(start, end);
      
      const cachedResponse = NextResponse.json({
        success: true,
        data: paginatedProvinces,
        count: totalCount,
        total_students: 0,
        next: end < totalCount ? `/api/provinces?limit=${limit}&offset=${end}${province_id ? `&province_id=${province_id}` : ''}${province_name ? `&province_name=${province_name}` : ''}` : null,
        previous: offset > 0 ? `/api/provinces?limit=${limit}&offset=${Math.max(0, offset - limit)}${province_id ? `&province_id=${province_id}` : ''}${province_name ? `&province_name=${province_name}` : ''}` : null,
      });
      
      cachedResponse.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
      return cachedResponse;
    }

    // Build URL for Province lookup API
    let url = EXTERNAL_ENDPOINTS.PROVINCES.LIST;
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());
    if (province_id) params.append('province_id', province_id);
    if (province_name) params.append('province_name', province_name);
    
    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    // Fetch from Province lookup API
    logger.info(`[PROVINCES] Calling external API: ${url}`, 'API/PROVINCES');
    const response = await apiClient.get(url, { token });

    let provinces: any[] = [];
    let useFallback = false;

    if (!response.success) {
      // Detect 404 from upstream API
      const errorMsg = response.error || '';
      const isNotFound = errorMsg.includes('Status: 404') || 
                         errorMsg.includes('404') ||
                         errorMsg.includes('Not Found') || 
                         errorMsg.includes('<!doctype html>');
      
      if (isNotFound) {
        // Log 404 internally but don't expose to client - use fallback instead
        logger.warn(`[PROVINCES] Upstream API returned 404, using constants fallback: ${url}`, 'API/PROVINCES');
        useFallback = true;
      } else {
        // For other errors, log and use fallback as well
        logger.error(`[PROVINCES] API failed, using constants fallback: ${response.error}`, 'API/PROVINCES');
        useFallback = true;
      }
    } else {
      // Parse successful API response
      const data = response.data as any;
      provinces = data?.results || data?.data || (Array.isArray(data) ? data : []);
      
      // Normalize province data from API
      provinces = provinces.map((p: any) => ({
        province_id: p.province_id || p.id || '',
        province_name: p.province_name || p.name || '',
        total_count: p.total_count || p.count || 0,
      })).filter((p: any) => p.province_id && p.province_name);
    }

    // Use constants fallback if API failed or returned empty
    if (useFallback || provinces.length === 0) {
      provinces = PROVINCES.map(p => ({
        province_id: p.province_id,
        province_name: p.province_name,
        total_count: 0,
      }));
      
      // Only cache successful API responses, not fallback data
      // This ensures we retry the API on next request
    } else {
      // Cache successful API responses for 15 minutes
      dataCache.set(cacheKey, provinces, 15 * 60 * 1000);
      logger.info(`[PROVINCES] Cached ${provinces.length} provinces from API for 15 minutes`, 'API/PROVINCES');
    }

    // Apply filters if provided
    let filteredProvinces = provinces;
    
    if (province_id) {
      filteredProvinces = filteredProvinces.filter(p => p.province_id === province_id);
    }
    
    if (province_name) {
      filteredProvinces = filteredProvinces.filter(p => 
        p.province_name.toLowerCase().includes(province_name.toLowerCase())
      );
    }

    // Apply pagination
    const totalCount = filteredProvinces.length;
    const start = offset;
    const end = offset + limit;
    const paginatedProvinces = filteredProvinces.slice(start, end);

    logger.info(`[PROVINCES] Successfully fetched ${filteredProvinces.length} provinces (returning ${paginatedProvinces.length} with pagination)`, 'API/PROVINCES');

    const apiResponse = NextResponse.json({
      success: true,
      data: paginatedProvinces,
      count: totalCount,
      total_students: 0,
      next: end < totalCount ? `/api/provinces?limit=${limit}&offset=${end}${province_id ? `&province_id=${province_id}` : ''}${province_name ? `&province_name=${province_name}` : ''}` : null,
      previous: offset > 0 ? `/api/provinces?limit=${limit}&offset=${Math.max(0, offset - limit)}${province_id ? `&province_id=${province_id}` : ''}${province_name ? `&province_name=${province_name}` : ''}` : null,
    });
    
    // Add cache headers for client-side caching (5 minutes)
    apiResponse.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    
    return apiResponse;
  } catch (error: any) {
    logger.error(`Provinces API error: ${error.message}`, 'API/PROVINCES', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch provinces' },
      { status: 500 }
    );
  }
}

