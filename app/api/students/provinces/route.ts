import { NextRequest, NextResponse } from 'next/server';
import { studentsService } from '@/lib/api/services/students.service';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    // Get token from Authorization header or cookie (server-side)
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
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const province_name = searchParams.get('province_name') || undefined;
    const province_id = searchParams.get('province_id') || undefined;

    const params = {
      limit,
      offset,
      ...(province_name && { province_name }),
      ...(province_id && { province_id }),
    };

    const result = await studentsService.getProvinceSummary(token, params);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to create province summary' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data || [],
      count: result.count || 0,
      total_students: result.total_students || 0, // Include total students count
      next: result.next,
      previous: result.previous,
    });
  } catch (error: any) {
    logger.error(`Student provinces API failed: ${error.message}`, 'API/STUDENTS/PROVINCES', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch provinces' },
      { status: 500 }
    );
  }
}

