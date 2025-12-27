import { NextRequest, NextResponse } from 'next/server';
import { apiClient, EXTERNAL_ENDPOINTS } from '@/lib/api/client';
import { logger } from '@/lib/logger';
import { studentIndexService } from '@/lib/api/services/studentIndex.service';

/**
 * Base Student Data API
 * Fetches base student data from EXTERNAL_ENDPOINTS.STUDENTS.LIST
 * Initializes the student index service
 * Should be called once to build the index
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

    // Get query parameters for pagination
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '5000', 10), 10000); // Cap at 10k per batch
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const maxRecords = Math.min(parseInt(searchParams.get('maxRecords') || '50000', 10), 100000); // Cap at 100k total

    logger.info(`Fetching base student data: limit=${limit}, offset=${offset}, maxRecords=${maxRecords}`, 'API/STUDENTS/BASE');

    // Fetch base student data in batches (limit to reasonable size to avoid timeout)
    const allRecords: any[] = [];
    let currentOffset = offset;
    let hasMore = true;
    let totalFetched = 0;
    const maxBatches = 20; // Limit number of batches to avoid timeout
    let batchCount = 0;

    try {
      while (hasMore && totalFetched < maxRecords && batchCount < maxBatches) {
        const batchUrl = `${EXTERNAL_ENDPOINTS.STUDENTS.LIST}?limit=${Math.min(limit, 10000)}&offset=${currentOffset}`;
        const response = await apiClient.get(batchUrl, { token });

        if (!response.success) {
          logger.error(`Failed to fetch batch at offset ${currentOffset}: ${response.error}`, 'API/STUDENTS/BASE');
          // If first batch fails, return error
          if (batchCount === 0) {
            return NextResponse.json(
              { success: false, error: response.error || 'Failed to fetch base student data' },
              { status: 500 }
            );
          }
          // If later batch fails, break and use what we have
          break;
        }

        const data = response.data as any;
        const records = data?.results || data?.data || [];

        if (records.length === 0) {
          hasMore = false;
          break;
        }

        allRecords.push(...records);
        totalFetched += records.length;
        currentOffset += limit;
        batchCount++;

        // Check if there's more data
        const hasNextPage = data?.next !== null && 
                           data?.next !== undefined && 
                           data?.next !== '';
        hasMore = hasNextPage && totalFetched < maxRecords;

        logger.info(`Fetched ${records.length} records (total: ${totalFetched}, batch: ${batchCount})`, 'API/STUDENTS/BASE');
      }

      // Initialize the index with fetched records
      if (allRecords.length > 0) {
        try {
          studentIndexService.initializeIndex(allRecords);
          logger.info(`Initialized index with ${allRecords.length} student records`, 'API/STUDENTS/BASE');
        } catch (indexError: any) {
          logger.error(`Failed to initialize index: ${indexError.message}`, 'API/STUDENTS/BASE', indexError);
          // Continue even if index initialization fails, but return warning
          return NextResponse.json({
            success: true,
            count: allRecords.length,
            total_fetched: totalFetched,
            message: `Fetched ${allRecords.length} records but index initialization failed`,
            warning: indexError.message,
          });
        }
      } else {
        // No records fetched
        return NextResponse.json({
          success: false,
          error: 'No student records found',
          count: 0,
          total_fetched: 0,
        }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        count: allRecords.length,
        total_fetched: totalFetched,
        message: `Fetched ${allRecords.length} records and initialized index`,
      });
    } catch (fetchError: any) {
      logger.error(`Error during batch fetching: ${fetchError.message}`, 'API/STUDENTS/BASE', fetchError);
      // If we have some records, still try to initialize index
      if (allRecords.length > 0) {
        try {
          studentIndexService.initializeIndex(allRecords);
          return NextResponse.json({
            success: true,
            count: allRecords.length,
            total_fetched: totalFetched,
            message: `Fetched ${allRecords.length} records (partial) and initialized index`,
          });
        } catch (indexError: any) {
          // If index init also fails, return error
          return NextResponse.json(
            { success: false, error: `Failed to process data: ${fetchError.message}` },
            { status: 500 }
          );
        }
      }
      throw fetchError; // Re-throw to be caught by outer catch
    }
  } catch (error: any) {
    logger.error(`Base student data API failed: ${error.message}`, 'API/STUDENTS/BASE', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch base student data' },
      { status: 500 }
    );
  }
}

