import { NextRequest, NextResponse } from 'next/server';
import { apiClient, EXTERNAL_ENDPOINTS } from '@/lib/api/client';
import { logger } from '@/lib/logger';
import { dataCache } from '@/lib/cache/dataCache';
import { PROVINCES } from '@/lib/constants/provinces';
import { PROVINCE_API_CACHE_TTL, PROVINCE_FALLBACK_CACHE_TTL } from '@/lib/cache/cacheConstants';

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

    // Build cache key (cache both API responses and fallback data)
    const cacheKey = `provinces:${province_id || 'all'}:${province_name || 'all'}`;
    const FALLBACK_CACHE_KEY = `provinces:fallback:${province_id || 'all'}:${province_name || 'all'}`;
    
    // STRICT CACHE-FIRST: Check for cached fallback marker first (prevents 15-18s delays)
    // If we've already determined the API is invalid, use fallback immediately
    const cachedFallback = dataCache.get<boolean>(FALLBACK_CACHE_KEY);
    if (cachedFallback === true) {
      logger.info(`[PROVINCES] Using cached fallback marker - API is invalid, skipping slow API call (saved 15-18s)`, 'API/PROVINCES');
      const fallbackProvinces = PROVINCES.map(p => ({
        province_id: p.province_id,
        province_name: p.province_name,
        total_count: 0,
      }));
      
      // Apply filters if provided
      let filteredProvinces = fallbackProvinces;
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
      
      const fallbackResponse = NextResponse.json({
        success: true,
        data: paginatedProvinces,
        count: totalCount,
        total_students: 0,
        next: end < totalCount ? `/api/provinces?limit=${limit}&offset=${end}${province_id ? `&province_id=${province_id}` : ''}${province_name ? `&province_name=${province_name}` : ''}` : null,
        previous: offset > 0 ? `/api/provinces?limit=${limit}&offset=${Math.max(0, offset - limit)}${province_id ? `&province_id=${province_id}` : ''}${province_name ? `&province_name=${province_name}` : ''}` : null,
      });
      
      fallbackResponse.headers.set('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800'); // 24h fresh, 7d stale
      return fallbackResponse;
    }
    
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

    // Fetch from Province lookup API with SHORT TIMEOUT (2 seconds)
    // This prevents 15-18s delays when the endpoint returns 404
    logger.info(`[PROVINCES] Calling external API with 2s timeout: ${url}`, 'API/PROVINCES');
    
    let provinces: any[] = [];
    let useFallback = false;
    let timeoutId: NodeJS.Timeout | null = null;
    
    try {
      // Create abort controller for short timeout
      const abortController = new AbortController();
      timeoutId = setTimeout(() => {
        abortController.abort();
      }, 2000); // 2 second timeout
      
      const response = await apiClient.get(url, { 
        token,
        timeout: 2000, // 2 second timeout (prevents 15-18s delays)
        signal: abortController.signal,
      });
      
      // Clear timeout if request completed
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      
      if (!response.success) {
        // Detect 404 from upstream API
        const errorMsg = response.error || '';
        const isNotFound = errorMsg.includes('Status: 404') || 
                           errorMsg.includes('404') ||
                           errorMsg.includes('Not Found') || 
                           errorMsg.includes('<!doctype html>') ||
                           errorMsg.includes('timeout'); // Also treat timeout as 404 (endpoint is invalid)
        
        if (isNotFound) {
          // Log 404 internally but don't expose to client - use fallback instead
          logger.warn(`[PROVINCES] Upstream API returned 404/timeout, caching fallback marker permanently: ${url}`, 'API/PROVINCES');
          useFallback = true;
          
          // Cache fallback marker PERMANENTLY (7 days) to prevent future API calls
          // This ensures we never try the invalid endpoint again
          dataCache.set(FALLBACK_CACHE_KEY, true, PROVINCE_FALLBACK_CACHE_TTL);
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
    } catch (error: any) {
      // Always clear timeout in catch block
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      
      // Timeout or network error - treat as invalid endpoint
      if (error.name === 'AbortError' || error.message?.includes('timeout')) {
        logger.warn(`[PROVINCES] API timeout (2s), caching fallback marker permanently - endpoint is invalid: ${url}`, 'API/PROVINCES');
        useFallback = true;
        
        // Cache fallback marker PERMANENTLY (7 days) to prevent future API calls
        dataCache.set(FALLBACK_CACHE_KEY, true, PROVINCE_FALLBACK_CACHE_TTL);
      } else {
        logger.error(`[PROVINCES] API error, using constants fallback: ${error.message}`, 'API/PROVINCES');
        useFallback = true;
      }
    } finally {
      // Ensure timeout is always cleared
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }

    // Use constants fallback if API failed or returned empty
    if (useFallback || provinces.length === 0) {
      provinces = PROVINCES.map(p => ({
        province_id: p.province_id,
        province_name: p.province_name,
        total_count: 0,
      }));
      
      // Fallback marker is already cached above (if useFallback is true)
      // This prevents future API calls to the invalid endpoint
      logger.info(`[PROVINCES] Using constants fallback (${provinces.length} provinces) - API endpoint is invalid`, 'API/PROVINCES');
    } else {
      // Cache successful API responses for 15 minutes
      dataCache.set(cacheKey, provinces, PROVINCE_API_CACHE_TTL);
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
    // BEST PRACTICE: Always return 200 OK with fallback data, never expose 500 errors
    // This ensures the API is resilient and never fails completely
    logger.error(`[PROVINCES] Unexpected error, using constants fallback: ${error?.message || 'Unknown error'}`, 'API/PROVINCES', error);
    
    // Use fallback provinces data
    const fallbackProvinces = PROVINCES.map(p => ({
      province_id: p.province_id,
      province_name: p.province_name,
      total_count: 0,
    }));
    
    // Apply pagination
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '1000', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const totalCount = fallbackProvinces.length;
    const start = offset;
    const end = offset + limit;
    const paginatedProvinces = fallbackProvinces.slice(start, end);
    
    // Return 200 OK with fallback data (never return 500)
    const fallbackResponse = NextResponse.json({
      success: true,
      data: paginatedProvinces,
      count: totalCount,
      total_students: 0,
      next: end < totalCount ? `/api/provinces?limit=${limit}&offset=${end}` : null,
      previous: offset > 0 ? `/api/provinces?limit=${limit}&offset=${Math.max(0, offset - limit)}` : null,
    });
    
    fallbackResponse.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return fallbackResponse;
  }
}

