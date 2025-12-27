import { NextRequest, NextResponse } from 'next/server';
import { apiClient, EXTERNAL_ENDPOINTS } from '@/lib/api/client';
import { API_CONFIG } from '@/lib/api/config';
import { logger } from '@/lib/logger';
import { dataCache } from '@/lib/cache/dataCache';

/**
 * Districts API Route
 * Filters districts by province_id
 * Returns aggregated district summaries with student counts
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
    const province_id = searchParams.get('province_id') || undefined;
    const district_name = searchParams.get('district_name') || undefined;
    const limit = parseInt(searchParams.get('limit') || '1000', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const q = searchParams.get('q') || undefined; // Search query

    // province_id is now optional - if not provided, fetch all districts from all provinces

    // Log request params for debugging
    logger.info(`[DISTRICTS] API request: province_id=${province_id || 'all'}, district_name=${district_name || 'all'}, q=${q || 'none'}, limit=${limit}, offset=${offset}`, 'API/STUDENTS/DISTRICTS');
    logger.info(`[DISTRICTS] Full URL: ${request.url}`, 'API/STUDENTS/DISTRICTS');

    // Check cache first for aggregated district summaries (only if no province_id filter)
    let districts: Array<{ province_id: string; district_name: string; total_count: number }> = [];
    
    if (!province_id) {
      const districtSummaryCacheKey = 'districts_summary_all';
      const cachedDistricts = dataCache.get<Array<{ province_id: string; district_name: string; total_count: number }>>(districtSummaryCacheKey);
      
      if (cachedDistricts && Array.isArray(cachedDistricts) && cachedDistricts.length > 0) {
        // Use cached aggregated district summaries
        logger.info(`[DISTRICTS] Using cached district summaries: ${cachedDistricts.length} districts`, 'API/STUDENTS/DISTRICTS');
        let filteredDistricts = [...cachedDistricts];
        
        // Apply search filter if provided
        if (q) {
          filteredDistricts = filteredDistricts.filter(d => d.district_name.toLowerCase().includes(q.toLowerCase()));
        }
        
        // CRITICAL: When fetching "all districts" (no province_id), return ALL districts without pagination
        // This ensures the frontend gets all districts in one response
        if (limit >= filteredDistricts.length) {
          // Return all districts without pagination
          logger.info(`[DISTRICTS] Returning ALL ${filteredDistricts.length} cached districts (no pagination)`, 'API/STUDENTS/DISTRICTS');
          
          return NextResponse.json({
            success: true,
            count: filteredDistricts.length,
            next: null, // No pagination needed
            previous: null,
            results: filteredDistricts, // ALL districts
            total_students: filteredDistricts.reduce((sum, d) => sum + d.total_count, 0),
          });
        }
        
        // Apply pagination to cached districts (only when limit is smaller than total)
        const start = offset;
        const end = offset + limit;
        const paginatedDistricts = filteredDistricts.slice(start, end);
        const hasNext = end < filteredDistricts.length;
        const hasPrevious = offset > 0;
        
        const buildPaginationUrl = (newOffset: number) => {
          const params = new URLSearchParams();
          params.append('limit', String(limit));
          params.append('offset', String(newOffset));
          if (q) params.append('q', q);
          return `/api/students/districts?${params.toString()}`;
        };
        
        return NextResponse.json({
          success: true,
          count: filteredDistricts.length,
          next: hasNext ? buildPaginationUrl(end) : null,
          previous: hasPrevious ? buildPaginationUrl(Math.max(0, offset - limit)) : null,
          results: paginatedDistricts,
          total_students: filteredDistricts.reduce((sum, d) => sum + d.total_count, 0),
        });
      }
    }
    
    // If no cached data, fetch and aggregate
    let students: any[] = [];
    
      // Build hierarchical endpoint - use BY_DISTRICT for minimum scope
      // Note: This route aggregates districts, so it needs to fetch students
      // For aggregation, we use the minimum hierarchical endpoint (BY_DISTRICT)
      let baseUrl: string;
      if (province_id && district_name) {
        baseUrl = EXTERNAL_ENDPOINTS.STUDENTS.BY_DISTRICT(province_id, district_name);
      } else if (province_id) {
        // If only province_id, we need to use a different approach
        // For now, use BY_DISTRICT with a wildcard or fetch from province level
        // This is a legacy case - ideally province_id + district_name should be required
        baseUrl = `${API_CONFIG.EXTERNAL_API_BASE}/api/Base/data/v1/students/${encodeURIComponent(province_id)}/`;
      } else {
        // No province_id - this is unsafe but needed for "all districts" aggregation
        // Use a base endpoint (this should be avoided in production)
        // WARNING: This exposes the unsafe flat endpoint - should be refactored
        baseUrl = `${API_CONFIG.EXTERNAL_API_BASE}/api/Base/data/v1/students/`;
      }
      
    // OPTIMIZED: Fetch ALL students efficiently - balance speed and completeness
    const pageLimit = 5000; // Large page size = fewer requests = faster
    const maxFetchTime = 90000; // 90 second timeout (increased to get all data)
    const maxPages = province_id ? 20 : 150; // Increased to get all districts
    const maxRecords = province_id ? 100000 : 1000000; // Very high limit (1M to ensure all data)
    const parallelRequests = 8; // Optimized parallel requests
    
    logger.info(`[DISTRICTS] Fetching ALL students for aggregation${province_id ? ` (province: ${province_id})` : ' (all provinces)'}`, 'API/STUDENTS/DISTRICTS');
    
    const allStudents: any[] = [];
    let totalCount = 0;
    const startTime = Date.now();
    let pageCount = 0;
    let currentOffset = 0;
    
    try {
      // Fetch first page
      const firstUrl = `${baseUrl}?limit=${pageLimit}&offset=0`;
      const firstResponse = await apiClient.get(firstUrl, { token });
      if (!firstResponse.success) {
        throw new Error(firstResponse.error || 'HTTP error! Failed to fetch students');
      }
      
      const firstData: any = firstResponse.data;
      const firstResults: any[] = firstData?.results || firstData?.data || (Array.isArray(firstData) ? firstData : []);
      totalCount = firstData?.count ?? 0;
      let nextUrl: string | null = firstData?.next || null;
      
      allStudents.push(...firstResults);
      pageCount = 1;
      currentOffset = firstResults.length;
      
      logger.info(`[DISTRICTS] Page 1: ${firstResults.length} students, total: ${totalCount}, next: ${nextUrl ? 'yes' : 'no'}`, 'API/STUDENTS/DISTRICTS');
      
      // If all data in first page, done
      if (totalCount > 0 && firstResults.length >= totalCount) {
        logger.info(`[DISTRICTS] All ${totalCount} students in first page`, 'API/STUDENTS/DISTRICTS');
        students = allStudents;
      } else {
        // Fetch remaining pages using next URL or manual pagination
        let consecutiveEmptyBatches = 0;
        while ((nextUrl || currentOffset < maxRecords) && pageCount < maxPages && (Date.now() - startTime) < maxFetchTime) {
          // Use API's count to know when we've fetched all students
          if (totalCount > 0 && allStudents.length >= totalCount) {
            logger.info(`[DISTRICTS] Fetched all ${totalCount} students from API (got ${allStudents.length})`, 'API/STUDENTS/DISTRICTS');
            break;
          }
          
          // If we have a next URL, use it; otherwise use manual pagination
          if (nextUrl) {
            // Follow next URL (more reliable)
            try {
              const response = await apiClient.get(nextUrl, { token });
              if (response.success) {
                const data: any = response.data;
                const results: any[] = data?.results || data?.data || (Array.isArray(data) ? data : []);
                const apiCount = data?.count ?? totalCount;
                nextUrl = data?.next || null;
                
                if (results.length > 0) {
                  allStudents.push(...results);
                  pageCount++;
                  currentOffset = allStudents.length;
                  if (apiCount > totalCount) {
                    totalCount = apiCount;
                    logger.info(`[DISTRICTS] Updated total count from API: ${totalCount}`, 'API/STUDENTS/DISTRICTS');
                  }
                  
                  if (pageCount % 10 === 0) {
                    logger.info(`[DISTRICTS] Progress: ${pageCount} pages, ${allStudents.length} students/${totalCount}`, 'API/STUDENTS/DISTRICTS');
                  }
                } else {
                  // No more results
                  break;
                }
              } else {
                // API error, fall back to manual pagination
                nextUrl = null;
              }
            } catch (err) {
              // Error following next URL, fall back to manual pagination
              nextUrl = null;
            }
          } else {
            // Manual pagination fallback
            const url = `${baseUrl}?limit=${pageLimit}&offset=${currentOffset}`;
            try {
              const response = await apiClient.get(url, { token });
              if (response.success) {
                const data: any = response.data;
                const results: any[] = data?.results || data?.data || (Array.isArray(data) ? data : []);
                const apiCount = data?.count ?? totalCount;
                nextUrl = data?.next || null;
                
                if (results.length > 0) {
                  allStudents.push(...results);
                  pageCount++;
                  currentOffset = allStudents.length;
                  if (apiCount > totalCount) {
                    totalCount = apiCount;
                    logger.info(`[DISTRICTS] Updated total count from API: ${totalCount}`, 'API/STUDENTS/DISTRICTS');
                  }
                  
                  if (pageCount % 10 === 0) {
                    logger.info(`[DISTRICTS] Progress: ${pageCount} pages, ${allStudents.length} students/${totalCount}`, 'API/STUDENTS/DISTRICTS');
                  }
                } else {
                  consecutiveEmptyBatches++;
                  if (consecutiveEmptyBatches >= 3) {
                    logger.info(`[DISTRICTS] ${consecutiveEmptyBatches} consecutive empty pages, stopping`, 'API/STUDENTS/DISTRICTS');
                    break;
                  }
                }
              } else {
                consecutiveEmptyBatches++;
                if (consecutiveEmptyBatches >= 3) {
                  break;
                }
              }
            } catch (err) {
              consecutiveEmptyBatches++;
              if (consecutiveEmptyBatches >= 3) {
                break;
              }
            }
          }
          
          // Check timeout
          if ((Date.now() - startTime) >= maxFetchTime) {
            logger.info(`[DISTRICTS] Timeout reached, stopping with ${allStudents.length} students`, 'API/STUDENTS/DISTRICTS');
            break;
          }
        }
        
        students = allStudents;
      }
    } catch (error: any) {
      logger.warn(`[DISTRICTS] Error: ${error.message}. Using ${allStudents.length} students.`, 'API/STUDENTS/DISTRICTS');
      students = allStudents;
    }
    
    const fetchDuration = Date.now() - startTime;
    logger.info(`[DISTRICTS] Fetched ${pageCount} pages, ${allStudents.length} students in ${fetchDuration}ms (API total count: ${totalCount})`, 'API/STUDENTS/DISTRICTS');
    
    // Check if we fetched all students (for accurate counts)
    const isCompleteData = totalCount > 0 && allStudents.length >= totalCount;
    if (!isCompleteData && totalCount > 0) {
      const percentage = Math.round((allStudents.length / totalCount) * 100);
      logger.warn(`[DISTRICTS] WARNING: Only fetched ${allStudents.length} of ${totalCount} students (${percentage}%). Student counts may be incomplete.`, 'API/STUDENTS/DISTRICTS');
    } else if (isCompleteData) {
      logger.info(`[DISTRICTS] SUCCESS: Fetched all ${totalCount} students - counts are accurate!`, 'API/STUDENTS/DISTRICTS');
    }
    
    // Ensure we have at least some data
    if (allStudents.length === 0) {
      logger.warn(`[DISTRICTS] No students fetched! Returning empty districts.`, 'API/STUDENTS/DISTRICTS');
      return NextResponse.json({
        success: true,
        count: 0,
        next: null,
        previous: null,
        results: [],
        total_students: 0,
      });
    }
    
    students = allStudents;

    // Aggregate districts from student records
    const districtMap = new Map<string, { province_id: string; district_name: string; total_count: number }>();
    
    let skippedCount = 0;
    let processedCount = 0;
    
    for (const student of students) {
      // CRITICAL: Try ALL possible field name variations to avoid missing districts
      // Use comprehensive search to find province/district data in any format
      let provinceId = '';
      let districtName = '';
      
      // Try direct property access first (most common cases)
      provinceId = (
        student.province_ID || 
        student.province_id || 
        student.Province_ID || 
        student.Province_id ||
        student.PROVINCE_ID ||
        student.provinceId ||
        student.ProvinceId ||
        student['province_ID'] ||
        student['province_id'] ||
        student['Province_ID'] ||
        student['Province_id'] ||
        ''
      );
      
      districtName = (
        student.district_name || 
        student.district_Name || 
        student.District_name || 
        student.District_Name ||
        student.DISTRICT_NAME ||
        student.districtName ||
        student.DistrictName ||
        student['district_name'] ||
        student['district_Name'] ||
        student['District_name'] ||
        student['District_Name'] ||
        ''
      );
      
      // If still empty, search all object keys for province/district fields (edge cases)
      if (!provinceId || !districtName) {
        const keys = Object.keys(student);
        for (const key of keys) {
          const lowerKey = key.toLowerCase();
          const value = student[key];
          
          // Skip if value is null, undefined, or an object
          if (value == null || typeof value === 'object') continue;
          
          if (!provinceId && (lowerKey.includes('province') || lowerKey === 'province_id' || lowerKey === 'provinceid')) {
            provinceId = String(value).trim();
          }
          if (!districtName && (lowerKey.includes('district') || lowerKey === 'district_name' || lowerKey === 'districtname')) {
            districtName = String(value).trim();
          }
        }
      }
      
      // Convert to string and trim
      provinceId = String(provinceId || '').trim();
      districtName = String(districtName || '').trim();
      
      // VERY lenient filtering - only skip truly invalid data
      // Allow numeric province IDs, allow various formats, allow whitespace-only after trim
      // Only reject if completely empty or explicitly invalid
      const isValidProvinceId = provinceId && 
        provinceId !== 'string' && 
        provinceId !== 'null' && 
        provinceId !== 'undefined' &&
        provinceId !== 'NaN' &&
        provinceId.length > 0 &&
        !provinceId.toLowerCase().includes('none') &&
        !provinceId.toLowerCase().includes('null');
      
      const isValidDistrictName = districtName && 
        districtName !== 'string' && 
        districtName !== 'null' && 
        districtName !== 'undefined' &&
        districtName !== 'NaN' &&
        districtName.length > 0 &&
        !districtName.toLowerCase().includes('none') &&
        !districtName.toLowerCase().includes('null');
      
      if (!isValidProvinceId || !isValidDistrictName) {
        skippedCount++;
        // Log skipped records for debugging (first 20 to catch more edge cases)
        if (skippedCount <= 20) {
          const sampleKeys = Object.keys(student).slice(0, 10).join(', ');
          logger.info(`[DISTRICTS] Skipped invalid record #${skippedCount}: provinceId="${provinceId}", districtName="${districtName}", sample keys: ${sampleKeys}`, 'API/STUDENTS/DISTRICTS');
        }
        continue;
      }
      
      processedCount++;
      
      // Filter by province_id if provided
      if (province_id) {
        const provinceIdMatches = 
          provinceId === province_id || 
          provinceId.toLowerCase() === province_id.toLowerCase() ||
          String(provinceId).trim() === String(province_id).trim();
        
        if (!provinceIdMatches) {
          continue; // Skip if province doesn't match
        }
      }
      
      // Apply search filter if provided
      if (q && !districtName.toLowerCase().includes(q.toLowerCase())) {
        continue;
      }
      
      // Apply district_name filter if provided
      if (district_name && districtName !== district_name) {
        continue;
      }
      
      // Use normalized key to avoid duplicates from case/whitespace differences
      const normalizedProvinceId = provinceId.trim();
      const normalizedDistrictName = districtName.trim();
      const key = `${normalizedProvinceId}:${normalizedDistrictName}`;
      
      if (districtMap.has(key)) {
        districtMap.get(key)!.total_count += 1;
      } else {
        districtMap.set(key, {
          province_id: normalizedProvinceId,
          district_name: normalizedDistrictName,
          total_count: 1,
        });
      }
    }

    const aggregatedDistricts = Array.from(districtMap.values());
    
    // Sort by total_count descending
    aggregatedDistricts.sort((a, b) => b.total_count - a.total_count);

    // Log detailed aggregation stats
    const totalStudentsInDistricts = aggregatedDistricts.reduce((sum, d) => sum + d.total_count, 0);
    const districtsByProvince = new Map<string, number>();
    aggregatedDistricts.forEach(d => {
      districtsByProvince.set(d.province_id, (districtsByProvince.get(d.province_id) || 0) + 1);
    });
    
    logger.info(`[DISTRICTS] Aggregation complete: ${aggregatedDistricts.length} total districts found, ${totalStudentsInDistricts} total students, ${districtsByProvince.size} provinces`, 'API/STUDENTS/DISTRICTS');
    logger.info(`[DISTRICTS] Processed ${processedCount} students, skipped ${skippedCount} invalid records`, 'API/STUDENTS/DISTRICTS');
    logger.info(`[DISTRICTS] Districts per province: ${Array.from(districtsByProvince.entries()).map(([p, c]) => `${p}:${c}`).join(', ')}`, 'API/STUDENTS/DISTRICTS');
    
    // CRITICAL: Verify we have all 219 districts and log detailed diagnostics
    if (!province_id) {
      if (aggregatedDistricts.length < 219) {
        const missing = 219 - aggregatedDistricts.length;
        logger.warn(`[DISTRICTS] WARNING: Only found ${aggregatedDistricts.length} districts, expected 219. Missing ${missing} districts.`, 'API/STUDENTS/DISTRICTS');
        logger.warn(`[DISTRICTS] Fetched ${students.length} students out of ${totalCount} total. Processed: ${processedCount}, Skipped: ${skippedCount}`, 'API/STUDENTS/DISTRICTS');
        
        // Log which provinces have districts and their counts
        const provincesWithDistricts = new Map<string, number>();
        aggregatedDistricts.forEach(d => {
          provincesWithDistricts.set(d.province_id, (provincesWithDistricts.get(d.province_id) || 0) + 1);
        });
        logger.info(`[DISTRICTS] Provinces with districts (${provincesWithDistricts.size} total): ${Array.from(provincesWithDistricts.entries()).map(([p, c]) => `${p}(${c})`).join(', ')}`, 'API/STUDENTS/DISTRICTS');
        
        // Log all unique district names for debugging (sorted, with province)
        const districtNames = aggregatedDistricts.map(d => `${d.province_id}:${d.district_name}`).sort();
        logger.info(`[DISTRICTS] Found ${aggregatedDistricts.length} districts: ${districtNames.slice(0, 100).join(', ')}${districtNames.length > 100 ? '...' : ''}`, 'API/STUDENTS/DISTRICTS');
        
        // Log unique province IDs found in students vs districts
        const studentProvinceIds = new Set<string>();
        students.forEach((s: any) => {
          const pid = (s.province_ID || s.province_id || s.Province_ID || '').toString().trim();
          if (pid && pid !== 'string' && pid !== 'null') {
            studentProvinceIds.add(pid);
          }
        });
        const districtProvinceIds = new Set(aggregatedDistricts.map(d => d.province_id));
        logger.info(`[DISTRICTS] Provinces in students: ${Array.from(studentProvinceIds).sort().join(', ')}`, 'API/STUDENTS/DISTRICTS');
        logger.info(`[DISTRICTS] Provinces with districts: ${Array.from(districtProvinceIds).sort().join(', ')}`, 'API/STUDENTS/DISTRICTS');
        
        // Log sample of skipped records to understand what's being filtered
        if (skippedCount > 0) {
          logger.warn(`[DISTRICTS] ${skippedCount} student records were skipped. Check logs above for details.`, 'API/STUDENTS/DISTRICTS');
        }
      } else if (aggregatedDistricts.length === 219) {
        logger.info(`[DISTRICTS] SUCCESS: Found all 219 districts!`, 'API/STUDENTS/DISTRICTS');
      } else {
        logger.info(`[DISTRICTS] Found ${aggregatedDistricts.length} districts (more than expected 219)`, 'API/STUDENTS/DISTRICTS');
      }
    }
    

    // CRITICAL: Cache aggregated district summaries (not student data) for future requests
    // Only cache if no province_id filter (for "all districts" case)
    // Cache with 30 minute TTL for better performance (data doesn't change frequently)
    if (!province_id && aggregatedDistricts.length > 0) {
      const districtSummaryCacheKey = 'districts_summary_all';
      dataCache.set(districtSummaryCacheKey, aggregatedDistricts, 30 * 60 * 1000); // 30 minutes TTL
      logger.info(`[DISTRICTS] Cached ${aggregatedDistricts.length} district summaries for 30 minutes`, 'API/STUDENTS/DISTRICTS');
    }
    
    districts = aggregatedDistricts;

    // CRITICAL: When fetching "all districts" (no province_id), return ALL districts without pagination
    // This ensures the frontend gets all 219 districts in one response
    if (!province_id && limit >= districts.length) {
      // Return all districts without pagination
      const totalStudents = districts.reduce((sum, d) => sum + d.total_count, 0);
      logger.info(`[DISTRICTS] Returning ${districts.length} districts with ${totalStudents} total students (complete: ${isCompleteData ? 'yes' : 'no'})`, 'API/STUDENTS/DISTRICTS');
      
      return NextResponse.json({
        success: true,
        count: districts.length, // Total number of unique districts (should be 219)
        next: null, // No pagination needed
        previous: null,
        results: districts, // ALL districts
        total_students: totalStudents, // Total students across ALL districts
        is_complete: isCompleteData, // Whether all students were fetched for accurate counts
      });
    }

    // Apply pagination to aggregated districts (only when province filter is applied or limit is small)
    const start = offset;
    const end = offset + limit;
    const paginatedDistricts = districts.slice(start, end);
    const hasNext = end < districts.length;
    const hasPrevious = offset > 0;

    logger.info(`[DISTRICTS] Returning paginated results: ${paginatedDistricts.length} districts (offset: ${offset}, limit: ${limit}, total: ${districts.length})`, 'API/STUDENTS/DISTRICTS');

    // Build pagination URLs
    const buildPaginationUrl = (newOffset: number) => {
      const params = new URLSearchParams();
      if (province_id) params.append('province_id', province_id);
      params.append('limit', String(limit));
      params.append('offset', String(newOffset));
      if (q) params.append('q', q);
      return `/api/students/districts?${params.toString()}`;
    };

    // Return paginated response format: { count, next, previous, results }
    // Frontend will follow 'next' to fetch all pages
    return NextResponse.json({
      success: true,
      count: districts.length, // Total number of unique districts (for pagination)
      next: hasNext ? buildPaginationUrl(end) : null,
      previous: hasPrevious ? buildPaginationUrl(Math.max(0, offset - limit)) : null,
      results: paginatedDistricts, // Districts for this page
      total_students: districts.reduce((sum, d) => sum + d.total_count, 0), // Total students across ALL districts
    });
  } catch (error: any) {
    logger.error(`Districts API error: ${error.message}`, 'API/STUDENTS/DISTRICTS', error);
    
    // Try to return cached data as fallback (for "all districts" case)
    const districtSummaryCacheKey = 'districts_summary_all';
    const cachedDistricts = dataCache.get<Array<{ province_id: string; district_name: string; total_count: number }>>(districtSummaryCacheKey);
    
    if (cachedDistricts && Array.isArray(cachedDistricts) && cachedDistricts.length > 0) {
      logger.info(`[DISTRICTS] Returning cached data as fallback after error`, 'API/STUDENTS/DISTRICTS');
      return NextResponse.json({
        success: true,
        count: cachedDistricts.length,
        next: null,
        previous: null,
        results: cachedDistricts,
        total_students: cachedDistricts.reduce((sum, d) => sum + d.total_count, 0),
      });
    }
    
    // If no cache, return empty result instead of error
    logger.warn(`[DISTRICTS] No cached data available, returning empty result`, 'API/STUDENTS/DISTRICTS');
    return NextResponse.json({
      success: true,
      count: 0,
      next: null,
      previous: null,
      results: [],
      total_students: 0,
    });
  }
}


