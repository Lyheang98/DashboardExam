import { NextRequest, NextResponse } from 'next/server';
import { searchAndFilterUsers, StoredUser } from '@/lib/storage';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    const role = searchParams.get('role') || undefined;
    const status = searchParams.get('status') || undefined;

    const users = await searchAndFilterUsers(query, { role, status });
    const safeUsers = users.map(({ password: _password, ...user }: StoredUser) => user);

    return NextResponse.json({
      success: true,
      count: safeUsers.length,
      data: safeUsers,
    });
  } catch (error) {
    logger.error('User search failed', 'API/USERS/SEARCH', error);
    return NextResponse.json(
      { success: false, error: 'Search failed' },
      { status: 500 }
    );
  }
}
