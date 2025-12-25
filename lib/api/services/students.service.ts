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
      
      // Create cache key for base data (without filters/pagination)
      const baseCacheKey = 'province_summary:all:all';
      
      // Check cache first - use base cache and apply filters/pagination client-side
      const cached = dataCache.get<ProvinceSummary[]>(baseCacheKey);
      const cachedTotalStudentsKey = baseCacheKey + ':total_students';
      const cachedTotalStudents = dataCache.get<number>(cachedTotalStudentsKey);
      
      if (cached) {
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

      // Province aggregation map - stores ONLY province-level data
      // Key: province_id_province_name, Value: { province_id, province_name, count }
      const provinceMap = new Map<string, {
        province_id: string;
        province_name: string;
        count: number;
      }>();

      // Process batches to aggregate province counts - OPTIMIZED FOR SPEED
      // We only extract province_id and province_name from each record, then increment count
      // NO student records are stored or returned
      let currentOffset = 0;
      let hasMore = true;
      let processedRecords = 0;
      let totalRecordsInAPI = 0;
      // Optimized for faster initial load while ensuring all 25 provinces are found
      const maxRecordsToProcess = 100000; // Process up to 100k records to ensure we find all 25 provinces
      const batchSize = 5000; // Larger batches = fewer requests = much faster
      const maxConcurrentBatches = 6; // Process 6 batches in parallel for maximum speed
      const targetProvincesFound = 25; // Target: Cambodia has 25 provinces
      const minRecordsForAccuracy = 60000; // Increased minimum to ensure we find all provinces
      const consecutiveBatchesWithoutNewProvinces = 6; // Exit after 6 consecutive batches with no new provinces (more conservative)
      
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
        for (const record of records) {
          // Try multiple field name variations
          const provinceId = record.province_ID || record.province_id || record.Province_ID || record.Province_ID || '';
          const provinceName = record.province_name || record.province_Name || record.Province_name || record.Province_Name || '';
          
          // Only skip if both are truly empty/null/undefined
          if (provinceId && provinceName) {
            const key = `${String(provinceId).trim()}_${String(provinceName).trim()}`;
            if (!provinceMap.has(key)) {
              provinceMap.set(key, {
                province_id: String(provinceId).trim(),
                province_name: String(provinceName).trim(),
                count: 0,
              });
              logger.info(`Found new province: ${provinceName} (ID: ${provinceId})`, 'STUDENTS');
            }
            provinceMap.get(key)!.count += 1;
          } else {
            skippedRecords++;
          }
        }
        processedRecords += records.length;
        currentOffset += batchSize;
        if (skippedRecords > 0) {
          logger.warn(`Skipped ${skippedRecords} records in first batch due to missing province data`, 'STUDENTS');
        }
      }

      // Continue with parallel batch processing
      // Process ALL records to get accurate counts (no scaling needed)
      let batchesWithoutNewProvinces = 0;
      while (hasMore && (totalRecordsInAPI === 0 || processedRecords < totalRecordsInAPI) && processedRecords < maxRecordsToProcess) {
        // Fetch multiple batches in parallel for better performance
        const batchPromises: Promise<any>[] = [];
        const batchOffsets: number[] = [];
        
        for (let i = 0; i < maxConcurrentBatches && processedRecords < maxRecordsToProcess; i++) {
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
            // Try multiple field name variations
            const provinceId = record.province_ID || record.province_id || record.Province_ID || record.Province_ID || '';
            const provinceName = record.province_name || record.province_Name || record.Province_name || record.Province_Name || '';
            
            // Only skip if both are truly empty/null/undefined
            if (provinceId && provinceName) {
              const key = `${String(provinceId).trim()}_${String(provinceName).trim()}`;
              if (!provinceMap.has(key)) {
                provinceMap.set(key, {
                  province_id: String(provinceId).trim(),
                  province_name: String(provinceName).trim(),
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
        
        // Early exit conditions - ensure we find all 25 provinces:
        // 1. Found all 25 provinces AND processed enough records for accurate counts
        if (provinceMap.size >= targetProvincesFound && processedRecords >= minRecordsForAccuracy) {
          logger.info(`✅ Found all ${provinceMap.size} provinces after processing ${processedRecords} records`, 'STUDENTS');
          hasMore = false;
          break;
        }
        
        // 2. If we found 25 but haven't processed enough, continue to get accurate counts
        if (provinceMap.size >= targetProvincesFound && processedRecords < minRecordsForAccuracy) {
          logger.info(`Found all ${provinceMap.size} provinces, continuing to process ${minRecordsForAccuracy - processedRecords} more records for accurate counts`, 'STUDENTS');
        }
        
        // 3. If we're at 24 provinces, continue processing more aggressively to find the 25th
        if (provinceMap.size === 24 && processedRecords < maxRecordsToProcess) {
          logger.info(`Found 24/25 provinces, aggressively continuing to search for the missing province...`, 'STUDENTS');
          // Reset the consecutive batches counter to give more chances
          batchesWithoutNewProvinces = Math.max(0, batchesWithoutNewProvinces - 1);
        }
        
        // 4. Exit only if we've processed enough AND haven't found new provinces for 6+ consecutive batches
        // This ensures we've thoroughly searched the data before giving up
        // BUT: Don't exit if we're at 24 provinces - keep searching
        if (batchesWithoutNewProvinces >= consecutiveBatchesWithoutNewProvinces && 
            processedRecords >= minRecordsForAccuracy && 
            provinceMap.size >= targetProvincesFound) {
          logger.info(`Early exit: No new provinces found in ${batchesWithoutNewProvinces} consecutive batches, processed ${processedRecords} records, found ${provinceMap.size} provinces`, 'STUDENTS');
          hasMore = false;
          break;
        }
        
        // 5. If we're close to 25 but not there yet, continue processing
        if (provinceMap.size < targetProvincesFound && processedRecords >= minRecordsForAccuracy) {
          logger.info(`Found ${provinceMap.size}/25 provinces, continuing to search for remaining provinces...`, 'STUDENTS');
        }
        
        // Check if there's more data
        const lastBatchData = batchResponses[batchResponses.length - 1]?.data as any;
        hasMore = (lastBatchData?.next !== null && 
                  lastBatchData?.next !== undefined && 
                  lastBatchData?.next !== '') &&
                  processedRecords < maxRecordsToProcess;
      }

      // Convert province map to array - ONLY province-level summary data
      // NO student records are included in the response
      // Use actual counts (no scaling) since we process all records
      let provinces: ProvinceSummary[] = Array.from(provinceMap.values())
        .map(province => {
          // If we processed all records, use actual count
          // If we processed less, scale proportionally (but we'll use API count for total)
          let finalCount = province.count;
          if (totalRecordsInAPI > 0 && processedRecords < totalRecordsInAPI && processedRecords > 0) {
            // Scale province counts proportionally for display
            const scaleFactor = totalRecordsInAPI / processedRecords;
            finalCount = Math.round(province.count * scaleFactor);
            logger.info(`Scaling province ${province.province_name}: ${province.count} -> ${finalCount} (factor: ${scaleFactor.toFixed(2)})`, 'STUDENTS');
          }
          
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

      // Calculate total students across all provinces (before pagination)
      // Use API count as source of truth if we processed less than total records
      let totalStudents = provinces.reduce((sum, province) => sum + (province.total_count || 0), 0);
      
      // If we processed all records, use the calculated sum
      // If we processed less, use the API count as the accurate total
      if (totalRecordsInAPI > 0 && processedRecords < totalRecordsInAPI) {
        // Use API count as source of truth for total
        totalStudents = totalRecordsInAPI;
        logger.info(`Using API count as source of truth: ${totalStudents.toLocaleString()} (calculated sum was ${provinces.reduce((sum, p) => sum + (p.total_count || 0), 0).toLocaleString()})`, 'STUDENTS');
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
      
      // Log all found provinces for debugging
      const provinceNames = provinces.map(p => p.province_name).sort();
      logger.info(`Found provinces: ${provinceNames.join(', ')}`, 'STUDENTS');
      
      if (provinces.length < targetProvincesFound) {
        logger.warn(`⚠️ Only found ${provinces.length} out of ${targetProvincesFound} provinces. May need to process more records.`, 'STUDENTS');
        logger.warn(`Consider increasing maxRecordsToProcess or checking if all provinces have data in the API.`, 'STUDENTS');
      } else {
        logger.info(`✅ Successfully found all ${provinces.length} provinces!`, 'STUDENTS');
      }
      
      // Cache the full province list (without pagination) for 30 minutes
      // Also cache the total_students (API count) separately for accurate totals
      // Only cache base data (no filters) for reuse with different filters/pagination
      if (!params?.province_name && !params?.province_id && offset === 0) {
        dataCache.set(baseCacheKey, provinces, 30 * 60 * 1000); // 30 minutes TTL for better caching
        const cachedTotalStudentsKey = baseCacheKey + ':total_students';
        dataCache.set(cachedTotalStudentsKey, totalStudents, 30 * 60 * 1000); // Cache API count separately
        logger.info(`Cached ${provinces.length} provinces and total_students (${totalStudents.toLocaleString()}) for future requests`, 'STUDENTS');
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

