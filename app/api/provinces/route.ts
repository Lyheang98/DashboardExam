import { NextRequest, NextResponse } from 'next/server';
import { apiClient, EXTERNAL_ENDPOINTS } from '@/lib/api/client';
import { logger } from '@/lib/logger';

/**
 * Province Name Map (for displaying province names)
 * Since the API may only return province_ID, we need a mapping for names
 * This can be replaced if the API starts returning province_name
 */
const PROVINCE_NAMES: Record<string, string> = {
  "1": "ខេត្តបន្ទាយមានជ័យ",
  "2": "ខេត្តបាត់ដំបង",
  "3": "ខេត្តកំពង់ចាម",
  "4": "ខេត្តកំពង់ឆ្នាំង",
  "5": "ខេត្តកំពង់ស្ពឺ",
  "6": "ខេត្តកំពង់ធំ",
  "7": "ខេត្តកំពត",
  "8": "ខេត្តកណ្ដាល",
  "9": "ខេត្តកោះកុង",
  "10": "ខេត្តក្រចេះ",
  "11": "ខេត្តមណ្ឌលគិរី",
  "12": "រាជធានីភ្នំពេញ",
  "13": "ខេត្តព្រះវិហារ",
  "14": "ខេត្តព្រៃវែង",
  "15": "ខេត្តពោធិ៍សាត់",
  "16": "ខេត្តរតនគិរី",
  "17": "ខេត្តសៀមរាប",
  "18": "ខេត្តព្រះសីហនុ",
  "19": "ខេត្តស្ទឹងត្រែង",
  "20": "ខេត្តស្វាយរៀង",
  "21": "ខេត្តតាកែវ",
  "22": "ខេត្តកែប",
  "23": "ខេត្តប៉ៃលិន",
  "24": "ខេត្តឧត្តរមានជ័យ",
  "25": "ខេត្តត្បូងឃ្មុំ",
};

/**
 * Provinces API Route
 * NOTE: There is NO Province lookup endpoint in the external API
 * Solution: Extract unique provinces from Schools API, then aggregate student counts
 * CRITICAL: Does NOT use Student API - aggregates from Schools (which uses backend aggregation)
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

    // Step 1: Fetch all schools from the API to extract unique provinces
    // This gets us the actual provinces that exist in the database (API-based, not hardcoded)
    logger.info('[PROVINCES] Fetching all schools to extract unique provinces', 'API/PROVINCES');
    
    let allSchoolsUrl = EXTERNAL_ENDPOINTS.SCHOOLS.LIST;
    const schoolsParams = new URLSearchParams();
    schoolsParams.append('limit', '100000'); // Get all schools
    schoolsParams.append('offset', '0');
    allSchoolsUrl += `?${schoolsParams.toString()}`;
    
    const allSchoolsResponse = await apiClient.get(allSchoolsUrl, { token });
    
    if (!allSchoolsResponse.success) {
      const errorMsg = allSchoolsResponse.error || 'Failed to fetch schools';
      logger.error(`[PROVINCES] Failed to fetch schools: ${errorMsg}`, 'API/PROVINCES');
      
      // Check if it's an authentication error
      if (errorMsg.includes('Authentication') || errorMsg.includes('401') || errorMsg.includes('expired') || errorMsg.includes('login')) {
        return NextResponse.json(
          { success: false, error: 'Authentication expired. Please login again.' },
          { status: 401 }
        );
      }
      
      return NextResponse.json(
        { success: false, error: errorMsg },
        { status: 500 }
      );
    }

    const allSchoolsData = allSchoolsResponse.data as any;
    const allSchools = allSchoolsData?.results || allSchoolsData?.data || (Array.isArray(allSchoolsData) ? allSchoolsData : []);
    
    // Step 2: Extract unique provinces from schools data
    const provinceMap = new Map<string, { province_id: string; province_name: string; schools: any[] }>();
    
    for (const school of allSchools) {
      const provinceId = (school.province_ID || school.province_id || '').toString().trim();
      const provinceName = school.province_name || PROVINCE_NAMES[provinceId] || `Province ${provinceId}`;
      
      if (!provinceId) continue;
      
      if (!provinceMap.has(provinceId)) {
        provinceMap.set(provinceId, {
          province_id: provinceId,
          province_name: provinceName,
          schools: [],
        });
      }
      
      provinceMap.get(provinceId)!.schools.push(school);
    }
    
    logger.info(`[PROVINCES] Found ${provinceMap.size} unique provinces from Schools API`, 'API/PROVINCES');
    
    // Step 3: Map provinces (no student count - API doesn't provide it)
    const allProvinces = Array.from(provinceMap.values()).map((province) => {
      // Note: The Schools API does not provide student_count per school
      // So we cannot aggregate student counts for provinces
      logger.info(`[PROVINCES] Province ${province.province_id} (${province.province_name}): ${province.schools.length} schools`, 'API/PROVINCES');
      
      return {
        province_id: province.province_id,
        province_name: province.province_name,
        total_count: 0, // No student count available from API
      };
    });

    // Apply filters if provided
    let filteredProvinces = allProvinces;
    
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

    return NextResponse.json({
      success: true,
      data: paginatedProvinces,
      count: totalCount,
      total_students: 0, // No student count available from API
      next: end < totalCount ? `/api/provinces?limit=${limit}&offset=${end}${province_id ? `&province_id=${province_id}` : ''}${province_name ? `&province_name=${province_name}` : ''}` : null,
      previous: offset > 0 ? `/api/provinces?limit=${limit}&offset=${Math.max(0, offset - limit)}${province_id ? `&province_id=${province_id}` : ''}${province_name ? `&province_name=${province_name}` : ''}` : null,
    });
  } catch (error: any) {
    logger.error(`Provinces API error: ${error.message}`, 'API/PROVINCES', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch provinces' },
      { status: 500 }
    );
  }
}

