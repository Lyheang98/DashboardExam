import { NextRequest, NextResponse } from 'next/server';
import { apiClient, EXTERNAL_ENDPOINTS } from '@/lib/api/client';
import { logger } from '@/lib/logger';

/**
 * Districts API Route
 * Uses District lookup API (aggregation-based)
 * Returns districts with aggregated student_count per district
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
    const limit = parseInt(searchParams.get('limit') || '10000', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const province_id = searchParams.get('province_id') || undefined;
    const district_name = searchParams.get('district_name') || undefined;
    const q = searchParams.get('q') || undefined; // Search query

    logger.info(`[DISTRICTS] API request: province_id=${province_id || 'all'}, district_name=${district_name || 'all'}, limit=${limit}, offset=${offset}`, 'API/DISTRICTS');

    // Build URL for District lookup API
    // NOTE: According to Swagger docs, the lookup endpoint requires province_id as a PATH parameter
    // Format: /api/Base/data/v1/api/lookup/v1/district/{province_id}/
    let url: string;
    
    let districts: any[] = [];

    if (province_id) {
      // Use lookup endpoint with path parameter (as shown in user's code)
      // Format: /api/Base/data/v1/api/lookup/v1/district/{province_id}/
      url = EXTERNAL_ENDPOINTS.DISTRICTS.LOOKUP(province_id);
      // Add query parameters if needed (limit, offset, etc.)
      const params = new URLSearchParams();
      if (limit) params.append('limit', limit.toString());
      if (offset) params.append('offset', offset.toString());
      if (district_name) params.append('district_name', district_name);
      if (q) params.append('q', q);
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      // Fetch from District lookup API for specific province
      logger.info(`[DISTRICTS] Calling external API: ${url}`, 'API/DISTRICTS');
      const response = await apiClient.get(url, { token });

      if (!response.success) {
        // Check if it's a 404 - the API endpoint doesn't exist yet
        const errorMsg = response.error || '';
        const isNotFound = errorMsg.includes('Not Found') || 
                           errorMsg.includes('404') || 
                           errorMsg.includes('<!doctype html>');
        
        if (isNotFound) {
          logger.warn(`[DISTRICTS] District lookup API endpoint not found: ${url}. Attempting fallback to Schools API.`, 'API/DISTRICTS');
          
          // FALLBACK: Try to get districts from Schools API by fetching schools for this province
          try {
            const schoolsUrl = `${EXTERNAL_ENDPOINTS.SCHOOLS.LIST}?province_ID=${province_id}&limit=10000`;
            logger.info(`[DISTRICTS] Fallback: Fetching schools from ${schoolsUrl}`, 'API/DISTRICTS');
            const schoolsResponse = await apiClient.get(schoolsUrl, { token });
            
            if (schoolsResponse.success && schoolsResponse.data) {
              const schoolsData = schoolsResponse.data as any;
              const schools = schoolsData?.results || schoolsData?.data || (Array.isArray(schoolsData) ? schoolsData : []);
              
              // Extract unique districts from schools
              const districtMap = new Map<string, { province_id: string; district_name: string; total_count: number }>();
              schools.forEach((school: any) => {
                const districtName = (school.district_name || school.district_Name || '').toString().trim();
                if (districtName) {
                  // Deduplicate districts
                  if (!districtMap.has(districtName)) {
                    districtMap.set(districtName, {
                      province_id: province_id!,
                      district_name: districtName,
                      total_count: 0,
                    });
                  }
                }
              });
              
              districts = Array.from(districtMap.values());
              logger.info(`[DISTRICTS] Fallback successful: Extracted ${districts.length} unique districts from ${schools.length} schools`, 'API/DISTRICTS');
            } else {
              logger.error(`[DISTRICTS] Fallback failed: Schools API returned error - ${schoolsResponse.error}`, 'API/DISTRICTS');
            }
          } catch (fallbackError: any) {
            logger.error(`[DISTRICTS] Fallback error: ${fallbackError.message}`, 'API/DISTRICTS', fallbackError);
          }
          
          // If fallback also failed, return error
          if (districts.length === 0) {
            return NextResponse.json(
              { 
                success: false, 
                error: 'District lookup API endpoint not found. Please ensure the backend API is implemented at: ' + url,
                endpoint: url,
                code: 'ENDPOINT_NOT_FOUND'
              },
              { status: 404 }
            );
          }
        } else {
          logger.error(`Districts API failed: ${response.error}`, 'API/DISTRICTS');
          return NextResponse.json(
            { success: false, error: response.error || 'Failed to fetch districts from District API' },
            { status: 500 }
          );
        }
      } else {
        // Response was successful - parse the data
        const data = response.data as any;
        districts = data?.results || data?.data || (Array.isArray(data) ? data : []);
        logger.info(`[DISTRICTS] Received ${districts.length} districts from District API for province ${province_id}`, 'API/DISTRICTS');
        
        // ALWAYS try fallback to Schools API if District API returns empty and province_id is provided
        if (districts.length === 0 && province_id) {
          logger.warn(`[DISTRICTS] District API returned empty results for province ${province_id}. Attempting fallback to Schools API.`, 'API/DISTRICTS');
          
          try {
            // Try calling Schools API directly (bypass internal route which requires district_name)
            // Try with just province_ID first - if API requires district_name, we'll need to fetch all schools
            const schoolsUrl = `${EXTERNAL_ENDPOINTS.SCHOOLS.LIST}?province_ID=${province_id}&limit=10000`;
            logger.info(`[DISTRICTS] Fallback: Fetching schools from ${schoolsUrl}`, 'API/DISTRICTS');
            const schoolsResponse = await apiClient.get(schoolsUrl, { token });
            
            if (schoolsResponse.success && schoolsResponse.data) {
              const schoolsData = schoolsResponse.data as any;
              const schools = schoolsData?.results || schoolsData?.data || (Array.isArray(schoolsData) ? schoolsData : []);
              logger.info(`[DISTRICTS] Fallback: Received ${schools.length} schools from API`, 'API/DISTRICTS');
              
              if (schools.length > 0) {
                // Extract unique districts from schools
                const districtMap = new Map<string, { province_id: string; district_name: string; total_count: number }>();
                schools.forEach((school: any) => {
                  const districtName = (school.district_name || school.district_Name || school.District_name || '').toString().trim();
                  if (districtName && districtName !== 'null' && districtName !== 'undefined') {
                    // Deduplicate districts
                    if (!districtMap.has(districtName)) {
                      districtMap.set(districtName, {
                        province_id: province_id!,
                        district_name: districtName,
                        total_count: 0,
                      });
                    }
                  }
                });
                
                districts = Array.from(districtMap.values());
                logger.info(`[DISTRICTS] Fallback successful: Extracted ${districts.length} unique districts from ${schools.length} schools`, 'API/DISTRICTS');
              } else {
                logger.warn(`[DISTRICTS] Fallback: Schools API returned empty results`, 'API/DISTRICTS');
              }
            } else {
              logger.error(`[DISTRICTS] Fallback failed: Schools API returned error - ${schoolsResponse.error || 'Unknown error'}`, 'API/DISTRICTS');
            }
          } catch (fallbackError: any) {
            logger.error(`[DISTRICTS] Fallback error: ${fallbackError.message}`, 'API/DISTRICTS', fallbackError);
            logger.error(`[DISTRICTS] Fallback stack: ${fallbackError.stack}`, 'API/DISTRICTS');
          }
        }
      }
    } else {
      // If no province_id provided, we need to fetch districts for all provinces
      // Get all provinces first, then fetch districts for each
      logger.info('[DISTRICTS] No province_id provided, fetching districts for all provinces', 'API/DISTRICTS');
      
      // Hardcoded province list (same as in user's code example)
      const PROVINCE_IDS = Array.from({ length: 25 }, (_, i) => String(i + 1));
      
      // Fetch districts for each province
      const districtPromises = PROVINCE_IDS.map(async (pid) => {
        try {
          const lookupUrl = EXTERNAL_ENDPOINTS.DISTRICTS.LOOKUP(pid);
          const response = await apiClient.get(lookupUrl, { token });
          
          if (response.success && response.data) {
            const data = response.data as any;
            const provinceDistricts = data?.results || data?.data || (Array.isArray(data) ? data : []);
            // Ensure each district has province_id
            return provinceDistricts.map((d: any) => ({
              ...d,
              province_id: d.province_id || pid,
            }));
          }
          return [];
        } catch (err) {
          logger.warn(`[DISTRICTS] Failed to fetch districts for province ${pid}: ${err}`, 'API/DISTRICTS');
          return [];
        }
      });

      const allProvinceDistricts = await Promise.all(districtPromises);
      districts = allProvinceDistricts.flat();
      logger.info(`[DISTRICTS] Fetched districts from ${PROVINCE_IDS.length} provinces, total districts: ${districts.length}`, 'API/DISTRICTS');
    }

    // Map districts to ensure consistent format
    // Note: The District API does not provide student_count
    const mappedDistricts = districts.map((d: any) => ({
      province_id: d.province_id || d.province_ID || d.id,
      district_name: d.district_name || d.district_Name || d.name,
      total_count: 0, // No student count available from API
    }));

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

    // Apply pagination if needed
    const totalCount = filteredDistricts.length;
    const start = offset;
    const end = offset + limit;
    const paginatedDistricts = filteredDistricts.slice(start, end);

    logger.info(`[DISTRICTS] Successfully fetched ${filteredDistricts.length} districts (returning ${paginatedDistricts.length} with pagination)`, 'API/DISTRICTS');

    return NextResponse.json({
      success: true,
      count: totalCount,
      results: paginatedDistricts,
      data: paginatedDistricts, // Support both formats
      total_students: 0, // No student count available from API
      next: end < totalCount ? `/api/districts?limit=${limit}&offset=${end}${province_id ? `&province_id=${province_id}` : ''}${q ? `&q=${q}` : ''}` : null,
      previous: offset > 0 ? `/api/districts?limit=${limit}&offset=${Math.max(0, offset - limit)}${province_id ? `&province_id=${province_id}` : ''}${q ? `&q=${q}` : ''}` : null,
    });
  } catch (error: any) {
    logger.error(`Districts API error: ${error.message}`, 'API/DISTRICTS', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch districts' },
      { status: 500 }
    );
  }
}

