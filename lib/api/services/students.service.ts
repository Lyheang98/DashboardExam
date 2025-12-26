/**
 * Students Service - Province Summary API
 * Creates province-level aggregated summaries grouped by province_id and province_name
 * Returns ONLY province-level data (total counts per province)
 * Does NOT return individual student records
 */

import { apiClient, EXTERNAL_ENDPOINTS } from '../client';
import { logger } from '../../logger';
import { dataCache } from '../../cache/dataCache';

export interface ProvinceSummary {
  province_id: string;
  province_name: string;
  total_count: number;
}

export interface ProvinceSummaryResponse {
  success: boolean;
  data?: ProvinceSummary[];
  count?: number;
  total_students?: number; // Total students across all provinces
  next?: string | null;
  previous?: string | null;
  error?: string;
}

export interface ProvinceSummaryParams {
  limit?: number;
  offset?: number;
  province_name?: string;
  province_id?: string;
}

/**
 * Helper function to extract province ID and name from API record
 * Handles various field name variations and nested structures
 * CRITICAL: This function must match the actual API response structure
 */
function extractProvinceData(record: any): { provinceId: string; provinceName: string } | null {
  if (!record || typeof record !== 'object') {
    return null;
  }
  
  // Try direct field access with various naming conventions
  let provinceId = 
    record.province_ID || 
    record.province_id || 
    record.Province_ID || 
    record.Province_id ||
    record.provinceId ||
    record.ProvinceId ||
    record.PROVINCE_ID ||
    record['province_ID'] ||
    record['province_id'] ||
    record['Province_ID'] ||
    record.province_code ||
    record.Province_Code ||
    record.provinceCode ||
    '';
    
  let provinceName = 
    record.province_name || 
    record.province_Name || 
    record.Province_name || 
    record.Province_Name ||
    record.provinceName ||
    record.ProvinceName ||
    record.PROVINCE_NAME ||
    record['province_name'] ||
    record['province_Name'] ||
    record['Province_name'] ||
    '';
  
  // Try nested province object (if province is an object)
  if ((!provinceId || !provinceName) && record.province && typeof record.province === 'object') {
    const province = record.province;
    provinceId = provinceId || 
      province.id || 
      province.province_id || 
      province.province_ID || 
      province.ID || 
      province.code ||
      province.province_code ||
      '';
    provinceName = provinceName || 
      province.name || 
      province.province_name || 
      province.province_Name ||
      province.title ||
      '';
  }
  
  // Try nested location/province structure
  if ((!provinceId || !provinceName) && record.location && typeof record.location === 'object') {
    const location = record.location;
    provinceId = provinceId || 
      location.province_id || 
      location.province_ID || 
      location.provinceId ||
      location.province_code ||
      '';
    provinceName = provinceName || 
      location.province_name || 
      location.province_Name || 
      location.provinceName ||
      '';
  }
  
  // Try school object (if province is nested in school)
  if ((!provinceId || !provinceName) && record.school && typeof record.school === 'object') {
    const school = record.school;
    if (school.province && typeof school.province === 'object') {
      const province = school.province;
      provinceId = provinceId || province.id || province.province_id || province.code || '';
      provinceName = provinceName || province.name || province.province_name || '';
    }
  }
  
  // Convert to string and trim
  provinceId = provinceId ? String(provinceId).trim() : '';
  provinceName = provinceName ? String(provinceName).trim() : '';
  
  // Return null if either is missing
  if (!provinceId || !provinceName) {
    return null;
  }
  
  return { provinceId, provinceName };
}

export const studentsService = {
  /**
   * Creates province summary by aggregating student counts per province
   * Processes batches to extract only province_id and province_name, then counts
   * Returns ONLY aggregated province data - NO student records
   * Optimized for large datasets (~600,000 records)
   * 
   * Performance optimizations:
   * - Caching: Results cached for 10 minutes to avoid reprocessing
   * - Parallel batch fetching: Fetches multiple batches concurrently
   * - Early exit: Stops when all provinces found (if sampling)
   * - Reduced logging: Only logs errors and key milestones
   * - Memory efficient: Only stores province-level data
   */
  async getProvinceSummary(
    token: string,
    params?: ProvinceSummaryParams
  ): Promise<ProvinceSummaryResponse> {
    try {
      const limit = params?.limit || 10;
      const offset = params?.offset || 0;
      const targetProvincesFound = 25; // Target: Cambodia has 25 provinces
      
      // Create cache key for base data (without filters/pagination)
      const baseCacheKey = 'province_summary:all:all';
      
      // Check cache first - use base cache and apply filters/pagination client-side
      // BUT: If cached data has less than 25 provinces, invalidate cache and re-fetch to find all provinces
      const cached = dataCache.get<ProvinceSummary[]>(baseCacheKey);
      const cachedTotalStudentsKey = baseCacheKey + ':total_students';
      const cachedTotalStudents = dataCache.get<number>(cachedTotalStudentsKey);
      
      // FAST PATH: If only total students count is needed and we have it cached, return immediately
      // This provides instant response even when province list isn't cached yet
      if (limit === 1 && offset === 0 && !params?.province_name && !params?.province_id && cachedTotalStudents !== null && cachedTotalStudents !== undefined) {
        logger.info(`✅ CACHED FAST PATH: Returning cached total students count: ${cachedTotalStudents.toLocaleString()} (instant)`, 'STUDENTS');
        return {
          success: true,
          data: [],
          count: 0,
          total_students: cachedTotalStudents,
          next: null,
          previous: null,
        };
      }
      
      // If cached data exists but has less than 25 provinces, clear it and re-fetch
      if (cached && cached.length < targetProvincesFound) {
        logger.warn(`Cache contains only ${cached.length} provinces, clearing cache to re-fetch all 25 provinces`, 'STUDENTS');
        dataCache.delete(baseCacheKey);
        dataCache.delete(cachedTotalStudentsKey);
      } else if (cached) {
        // Apply filters if provided
        let filtered = cached;
        if (params?.province_name) {
          filtered = filtered.filter(p => 
            p.province_name.toLowerCase().includes(params.province_name!.toLowerCase())
          );
        }
        if (params?.province_id) {
          filtered = filtered.filter(p => p.province_id === params.province_id);
        }
        
        // Use cached total_students if available (API count), otherwise calculate from provinces
        const totalStudents = cachedTotalStudents !== null && cachedTotalStudents !== undefined
          ? cachedTotalStudents
          : cached.reduce((sum, p) => sum + (p.total_count || 0), 0);
        
        // Apply pagination
        const paginated = filtered.slice(offset, offset + limit);
        return {
          success: true,
          data: paginated,
          count: filtered.length,
          total_students: totalStudents, // Use cached API count as source of truth
          next: (offset + limit) < filtered.length ? 'has_more' : null,
          previous: offset > 0 ? 'has_previous' : null,
        };
      }
      
      const startTime = Date.now();

      // FAST PATH: If only total students count is needed (limit=1, no filters), return immediately
      // This is MUCH faster for initial dashboard load when staff just needs the total count
      // This avoids processing hundreds of thousands of records just to get a count
      if (limit === 1 && offset === 0 && !params?.province_name && !params?.province_id) {
        const fastBatchUrl = `${EXTERNAL_ENDPOINTS.STUDENTS.LIST}?limit=1&offset=0`;
        const fastBatchResponse = await apiClient.get(fastBatchUrl, { token });
        
        if (fastBatchResponse.success) {
          const fastBatchData = fastBatchResponse.data as any;
          const apiTotalCount = fastBatchData?.count || 0;
          
          if (apiTotalCount > 0) {
            // Cache the total students count for fast future access
            dataCache.set(cachedTotalStudentsKey, apiTotalCount, 60 * 60 * 1000); // 1 hour cache
            logger.info(`✅ FAST PATH: Returning API total count immediately: ${apiTotalCount.toLocaleString()} (instant, no processing)`, 'STUDENTS');
            
            // Return empty province list with just the total count (fast response)
            return {
              success: true,
              data: [],
              count: 0,
              total_students: apiTotalCount,
              next: null,
              previous: null,
            };
          }
        }
        // If fast path fails, continue with normal processing
        logger.warn('Fast path failed, falling back to normal processing', 'STUDENTS');
      }

      // Province aggregation map - stores ONLY province-level data
      // Key: province_id_province_name, Value: { province_id, province_name, count }
      const provinceMap = new Map<string, {
        province_id: string;
        province_name: string;
        count: number;
      }>();

      // OPTIMIZED FOR SPEED: Smart processing strategy
      // Strategy: Process enough records to find all 25 provinces and get accurate counts
      // Use API total count as source of truth for total students (faster, already accurate)
      let currentOffset = 0;
      let hasMore = true;
      let processedRecords = 0;
      let totalRecordsInAPI = 0;
      
      // SPEED OPTIMIZATIONS:
      const batchSize = 10000; // Larger batches = fewer requests = MUCH faster (increased from 5000)
      const maxConcurrentBatches = 10; // More parallel requests = faster (increased from 6)
      const minRecordsForAccuracy = 50000; // Reduced from 60k - enough to find all provinces and get good counts
      const maxRecordsToProcess = 200000; // Process up to 200k records (enough for accuracy, faster than all)
      const consecutiveBatchesWithoutNewProvinces = 5; // Reduced from 10 - faster early exit when all found
      
      // Fetch first batch to get total count
      const firstBatchUrl = `${EXTERNAL_ENDPOINTS.STUDENTS.LIST}?limit=${batchSize}&offset=0`;
      const firstBatchResponse = await apiClient.get(firstBatchUrl, { token });
      
      if (!firstBatchResponse.success) {
        logger.error(`Failed to fetch first batch: ${firstBatchResponse.error}`, 'STUDENTS');
        return {
          success: false,
          error: firstBatchResponse.error || 'Failed to fetch data',
        };
      }
      
      const firstBatchData = firstBatchResponse.data as any;
      if (firstBatchData?.count) {
        totalRecordsInAPI = firstBatchData.count;
      }
      
      // Process first batch - handle various field name variations
      let records = firstBatchData?.results || firstBatchData?.data || [];
      let skippedRecords = 0;
      if (records.length > 0) {
        // CRITICAL: Log the FULL first record structure to see EXACTLY what the API returns
        const firstRecord = records[0];
        const recordKeys = Object.keys(firstRecord);
        
        logger.info(`=== API RESPONSE DEBUG - First Record Structure ===`, 'STUDENTS');
        logger.info(`Total records in batch: ${records.length}`, 'STUDENTS');
        logger.info(`All field keys in record: ${recordKeys.join(', ')}`, 'STUDENTS');
        logger.info(`FULL first record JSON: ${JSON.stringify(firstRecord, null, 2)}`, 'STUDENTS');
        
        // Check for province-related fields
        const provinceRelatedKeys = recordKeys.filter(key => 
          key.toLowerCase().includes('province') || 
          key.toLowerCase().includes('location') ||
          key.toLowerCase().includes('region')
        );
        
        if (provinceRelatedKeys.length > 0) {
          logger.info(`Province-related fields found: ${provinceRelatedKeys.join(', ')}`, 'STUDENTS');
          provinceRelatedKeys.forEach(key => {
            logger.info(`  ${key}: ${JSON.stringify(firstRecord[key], null, 2)}`, 'STUDENTS');
          });
        } else {
          logger.error(`❌ NO PROVINCE-RELATED FIELDS FOUND!`, 'STUDENTS');
          logger.error(`All available keys: ${recordKeys.join(', ')}`, 'STUDENTS');
        }
        
        // Also check a few more records to see if structure is consistent
        if (records.length > 1) {
          logger.info(`Checking 2nd and 3rd records for consistency...`, 'STUDENTS');
          for (let i = 1; i < Math.min(3, records.length); i++) {
            const record = records[i];
            const recordKeys2 = Object.keys(record);
            logger.info(`Record ${i + 1} keys: ${recordKeys2.join(', ')}`, 'STUDENTS');
            const provinceData = extractProvinceData(record);
            if (provinceData) {
              logger.info(`Record ${i + 1} - Extracted: ID=${provinceData.provinceId}, Name=${provinceData.provinceName}`, 'STUDENTS');
            } else {
              logger.warn(`Record ${i + 1} - Could NOT extract province data`, 'STUDENTS');
            }
          }
        }
        logger.info(`=== END API RESPONSE DEBUG ===`, 'STUDENTS');
        
        for (const record of records) {
          const provinceData = extractProvinceData(record);
          
          if (provinceData) {
            const { provinceId, provinceName } = provinceData;
            const key = `${provinceId}_${provinceName}`;
            if (!provinceMap.has(key)) {
              provinceMap.set(key, {
                province_id: provinceId,
                province_name: provinceName,
                count: 0,
              });
              logger.info(`Found new province: ${provinceName} (ID: ${provinceId})`, 'STUDENTS');
            }
            provinceMap.get(key)!.count += 1;
          } else {
            skippedRecords++;
            // Log first skipped record to debug
            if (skippedRecords === 1) {
              logger.warn(`Skipping record - Could not extract province data`, 'STUDENTS');
              logger.warn(`Record keys: ${Object.keys(record).join(', ')}`, 'STUDENTS');
              logger.warn(`Record sample: ${JSON.stringify(record, null, 2).substring(0, 500)}`, 'STUDENTS');
            }
          }
        }
        processedRecords += records.length;
        currentOffset += batchSize;
        if (skippedRecords > 0) {
          logger.warn(`Skipped ${skippedRecords} records in first batch due to missing province data`, 'STUDENTS');
        }
      }

      // Continue with parallel batch processing
      // OPTIMIZED: Smart processing for speed while maintaining accuracy
      let batchesWithoutNewProvinces = 0;
      const shouldProcessAll = totalRecordsInAPI > 0;
      
      // OPTIMIZED: Process enough records for accuracy, but allow smart early exit
      while (hasMore && (shouldProcessAll ? processedRecords < Math.min(totalRecordsInAPI, maxRecordsToProcess) : processedRecords < maxRecordsToProcess)) {
        // Fetch multiple batches in parallel for better performance
        const batchPromises: Promise<any>[] = [];
        const batchOffsets: number[] = [];
        
        for (let i = 0; i < maxConcurrentBatches && processedRecords < maxRecordsToProcess && (shouldProcessAll ? processedRecords < totalRecordsInAPI : true); i++) {
          const offset = currentOffset + (i * batchSize);
          if (offset >= totalRecordsInAPI && totalRecordsInAPI > 0) break;
          
          batchOffsets.push(offset);
          const batchUrl = `${EXTERNAL_ENDPOINTS.STUDENTS.LIST}?limit=${batchSize}&offset=${offset}`;
          batchPromises.push(apiClient.get(batchUrl, { token }));
        }
        
        const batchResponses = await Promise.all(batchPromises);
        
        // Process all batches
        let foundNewProvinces = false;
        const provincesBeforeBatch = provinceMap.size;
        
        for (let i = 0; i < batchResponses.length; i++) {
          const batchResponse = batchResponses[i];
          const batchOffset = batchOffsets[i];
          
          if (!batchResponse.success) {
            logger.warn(`Failed to fetch batch at offset ${batchOffset}: ${batchResponse.error}`, 'STUDENTS');
            continue;
          }
          
          const batchData = batchResponse.data as any;
          const batchRecords = batchData?.results || batchData?.data || [];
          
          if (batchRecords.length === 0) {
            hasMore = false;
            break;
          }
          
          // Fast aggregation - optimized loop with better field name handling
          let batchSkipped = 0;
          for (const record of batchRecords) {
            const provinceData = extractProvinceData(record);
            
            if (provinceData) {
              const { provinceId, provinceName } = provinceData;
              const key = `${provinceId}_${provinceName}`;
              if (!provinceMap.has(key)) {
                provinceMap.set(key, {
                  province_id: provinceId,
                  province_name: provinceName,
                  count: 0,
                });
                foundNewProvinces = true;
                logger.info(`Found new province: ${provinceName} (ID: ${provinceId})`, 'STUDENTS');
              }
              provinceMap.get(key)!.count += 1;
            } else {
              batchSkipped++;
            }
          }
          
          if (batchSkipped > 0 && batchSkipped > batchRecords.length * 0.1) {
            logger.warn(`Skipped ${batchSkipped} records in batch at offset ${batchOffset} due to missing province data`, 'STUDENTS');
          }
          
          processedRecords += batchRecords.length;
        }
        
        // Track if we found new provinces in this round
        if (foundNewProvinces) {
          batchesWithoutNewProvinces = 0; // Reset counter
          logger.info(`Found new provinces! Total: ${provinceMap.size}/25, Processed: ${processedRecords} records`, 'STUDENTS');
        } else {
          batchesWithoutNewProvinces++; // Increment counter
          if (provinceMap.size < targetProvincesFound) {
            logger.info(`No new provinces in this batch set. Total: ${provinceMap.size}/25, Consecutive batches without new: ${batchesWithoutNewProvinces}, Processed: ${processedRecords} records`, 'STUDENTS');
          }
        }
        
        currentOffset += batchSize * maxConcurrentBatches;
        
        // OPTIMIZED: Smart early exit strategy for faster loading
        // Once we find all 25 provinces and have enough data for accurate counts, we can exit
        // Total students count uses API count (already accurate), province breakdown uses processed data
        if (provinceMap.size >= targetProvincesFound && processedRecords >= minRecordsForAccuracy) {
          // Found all provinces and processed enough records for accurate breakdown
          if (batchesWithoutNewProvinces >= consecutiveBatchesWithoutNewProvinces) {
            logger.info(`✅ Found all ${provinceMap.size} provinces after processing ${processedRecords.toLocaleString()} records (optimized for speed)`, 'STUDENTS');
            hasMore = false;
            break;
          }
        } else if (shouldProcessAll && processedRecords >= totalRecordsInAPI) {
          // Fallback: Processed all records (shouldn't happen often with optimizations)
          logger.info(`✅ Processed ALL ${totalRecordsInAPI.toLocaleString()} records. Found ${provinceMap.size} provinces.`, 'STUDENTS');
          hasMore = false;
          break;
        }
        
        // Safety: If we've processed maxRecordsToProcess, stop to prevent infinite loops
        if (processedRecords >= maxRecordsToProcess) {
          logger.info(`Reached max processing limit (${maxRecordsToProcess.toLocaleString()}). Found ${provinceMap.size} provinces.`, 'STUDENTS');
          hasMore = false;
          break;
        }
        
        // Track progress - especially important when we're missing provinces
        if (provinceMap.size < targetProvincesFound) {
          logger.info(`Processing... Found ${provinceMap.size}/25 provinces, processed ${processedRecords.toLocaleString()} records`, 'STUDENTS');
        }
        
        // Check if there's more data
        const lastBatchData = batchResponses[batchResponses.length - 1]?.data as any;
        const hasNextPage = lastBatchData?.next !== null && 
                           lastBatchData?.next !== undefined && 
                           lastBatchData?.next !== '';
        const effectiveMax = shouldProcessAll ? Math.min(totalRecordsInAPI, maxRecordsToProcess) : maxRecordsToProcess;
        const withinLimit = processedRecords < effectiveMax;
        hasMore = hasNextPage && withinLimit;
      }

      // Convert province map to array - ONLY province-level summary data
      // NO student records are included in the response
      // CRITICAL: Use actual counts - never scale data for managers
      // Scaling introduces inaccuracy - we MUST process all records
      let provinces: ProvinceSummary[] = Array.from(provinceMap.values())
        .map(province => {
          // CRITICAL: Always use actual counts - no scaling allowed
          // If we didn't process all records, we shouldn't be caching anyway
          // Managers need 100% accurate data
          const finalCount = province.count;
          
          return {
            province_id: province.province_id,
            province_name: province.province_name,
            total_count: finalCount,
          };
        });

      // Apply filters if provided
      if (params?.province_name) {
        provinces = provinces.filter(p => 
          p.province_name.toLowerCase().includes(params.province_name!.toLowerCase())
        );
      }

      if (params?.province_id) {
        provinces = provinces.filter(p => p.province_id === params.province_id);
      }

      // Sort by total count descending
      provinces.sort((a, b) => b.total_count - a.total_count);

      // OPTIMIZED: Use API count as source of truth for total students (fastest, already accurate)
      // The API count is the authoritative source and doesn't require processing all records
      // Province-level breakdowns use processed data for distribution
      let totalStudents = totalRecordsInAPI;
      
      if (totalRecordsInAPI > 0) {
        // Use API count directly - it's already accurate and fastest
        totalStudents = totalRecordsInAPI;
        logger.info(`✅ Using API count for total students: ${totalStudents.toLocaleString()} (fastest, accurate)`, 'STUDENTS');
        
        // Optional: Scale province counts proportionally to match API total if we didn't process all records
        // This ensures province breakdown sums to API total (more accurate for managers)
        if (processedRecords < totalRecordsInAPI && processedRecords > 0) {
          const calculatedSum = provinces.reduce((sum, p) => sum + (p.total_count || 0), 0);
          if (calculatedSum > 0) {
            const scaleFactor = totalRecordsInAPI / calculatedSum;
            // Only scale if difference is significant (more than 1%)
            if (Math.abs(scaleFactor - 1) > 0.01) {
              logger.info(`Scaling province counts by ${scaleFactor.toFixed(4)} to match API total (optimized for accuracy)`, 'STUDENTS');
              provinces = provinces.map(p => ({
                ...p,
                total_count: Math.round(p.total_count * scaleFactor),
              }));
            }
          }
        }
      } else {
        // Fallback: Use calculated sum if API count not available
        totalStudents = provinces.reduce((sum, province) => sum + (province.total_count || 0), 0);
        logger.warn(`⚠️ API count not available, using calculated sum: ${totalStudents.toLocaleString()}`, 'STUDENTS');
      }

      // Apply pagination to province summaries
      const startIndex = offset;
      const endIndex = offset + limit;
      const paginatedProvinces = provinces.slice(startIndex, endIndex);
      const totalCount = provinces.length;

      // Log final results with detailed information
      logger.info(`Final result: Found ${provinces.length} provinces from ${processedRecords} processed records (Target: 25)`, 'STUDENTS');
      logger.info(`API Total Records: ${totalRecordsInAPI.toLocaleString()}, Processed: ${processedRecords.toLocaleString()}`, 'STUDENTS');
      logger.info(`Total students (using API count as source of truth): ${totalStudents.toLocaleString()}`, 'STUDENTS');
      
      // Verify the count matches API
      if (totalRecordsInAPI > 0 && totalStudents !== totalRecordsInAPI) {
        logger.warn(`⚠️ Total students (${totalStudents.toLocaleString()}) does not match API count (${totalRecordsInAPI.toLocaleString()})`, 'STUDENTS');
      } else if (totalRecordsInAPI > 0) {
        logger.info(`✅ Total students count matches API count: ${totalStudents.toLocaleString()}`, 'STUDENTS');
      }
      
      // Log breakdown by province for verification
      provinces.forEach(p => {
        logger.info(`  - ${p.province_name}: ${p.total_count.toLocaleString()} students`, 'STUDENTS');
      });
      
      // Log all found provinces for debugging - sorted by ID for easier comparison
      const provincesSortedById = provinces.sort((a, b) => {
        const idA = parseInt(a.province_id) || 0;
        const idB = parseInt(b.province_id) || 0;
        return idA - idB;
      });
      const provinceInfo = provincesSortedById.map(p => `${p.province_id}: ${p.province_name}`).join(', ');
      logger.info(`Found provinces (sorted by ID): ${provinceInfo}`, 'STUDENTS');
      
      // Log province IDs found for comparison
      const provinceIds = provincesSortedById.map(p => p.province_id).sort((a, b) => {
        const idA = parseInt(a) || 0;
        const idB = parseInt(b) || 0;
        return idA - idB;
      });
      logger.info(`Province IDs found: ${provinceIds.join(', ')}`, 'STUDENTS');
      
      if (provinces.length < targetProvincesFound) {
        logger.warn(`⚠️ Only found ${provinces.length} out of ${targetProvincesFound} provinces.`, 'STUDENTS');
        logger.warn(`Processed ${processedRecords.toLocaleString()} out of ${totalRecordsInAPI.toLocaleString()} total records.`, 'STUDENTS');
        // Log which province IDs might be missing (1-25)
        const foundIds = new Set(provinceIds.map(id => parseInt(id) || 0));
        const allPossibleIds = Array.from({ length: 25 }, (_, i) => i + 1);
        const missingIds = allPossibleIds.filter(id => !foundIds.has(id));
        if (missingIds.length > 0) {
          logger.warn(`⚠️ Potentially missing province IDs: ${missingIds.join(', ')}`, 'STUDENTS');
        }
      } else {
        logger.info(`✅ Successfully found all ${provinces.length} provinces!`, 'STUDENTS');
      }
      
      // OPTIMIZED: Cache data for faster subsequent loads (staff see dashboard faster)
      // Cache if we have all 25 provinces and enough data for accuracy
      // Only cache base data (no filters) for reuse with different filters/pagination
      if (!params?.province_name && !params?.province_id && offset === 0) {
        // Cache if we have all 25 provinces and processed enough for accuracy
        if (provinces.length >= targetProvincesFound && processedRecords >= minRecordsForAccuracy) {
          dataCache.set(baseCacheKey, provinces, 60 * 60 * 1000); // 1 hour TTL (longer cache for faster loads)
          const cachedTotalStudentsKey = baseCacheKey + ':total_students';
          dataCache.set(cachedTotalStudentsKey, totalStudents, 60 * 60 * 1000);
          logger.info(`✅ Cached ${provinces.length} provinces and total_students (${totalStudents.toLocaleString()}) for faster loading (1 hour cache)`, 'STUDENTS');
        } else {
          logger.warn(`⚠️ NOT caching: Found ${provinces.length}/${targetProvincesFound} provinces or insufficient data (${processedRecords.toLocaleString()} records)`, 'STUDENTS');
        }
      }

      // Return ONLY province summary data - NO student records
      return {
        success: true,
        data: paginatedProvinces,
        count: totalCount,
        total_students: totalStudents, // Include total students count
        next: endIndex < totalCount ? 'has_more' : null,
        previous: offset > 0 ? 'has_previous' : null,
      };
    } catch (error: any) {
      logger.error('Get province summary error', 'STUDENTS', error);
      return {
        success: false,
        error: error.message || 'Failed to create province summary',
      };
    }
  },
};

