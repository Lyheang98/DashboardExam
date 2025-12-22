import { NextRequest, NextResponse } from 'next/server';
import { usersService } from '@/lib/api';

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

    const searchParams = request.nextUrl.searchParams;
    const params = {
      q: searchParams.get('q') || undefined,
      role: searchParams.get('role') || undefined,
      status: searchParams.get('status') || undefined,
    };

    const result = await usersService.search(token, params);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      count: result.count || 0,
      data: result.data || [],
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Search failed' },
      { status: 500 }
    );
  }
}
