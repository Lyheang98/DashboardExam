import { NextRequest, NextResponse } from 'next/server';
import { schoolService } from '@/lib/api';

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

    // Get total count of schools (target and not target)
    const result = await schoolService.getTotalCount(token);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      total: result.total,
      target: result.target,
      notTarget: result.notTarget,
      geipSchool: result.geipSchool,
      geipAF: result.geipAF,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch schools' },
      { status: 500 }
    );
  }
}

