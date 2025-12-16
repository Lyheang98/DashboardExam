import { NextRequest, NextResponse } from 'next/server';
import { getUserByEmail } from '@/lib/storage';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password required' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await getUserByEmail(cleanEmail);

    if (!user) {
      logger.warn('Login attempt with invalid email', 'AUTH', new Error(cleanEmail));
      return NextResponse.json(
        { success: false, error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    if (user.password !== password) {
      logger.warn('Login attempt with invalid password', 'AUTH', new Error(cleanEmail));
      return NextResponse.json(
        { success: false, error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    logger.info(`User logged in: ${cleanEmail}`, 'AUTH');
    return NextResponse.json({
      success: true,
      token: `demo-token-${Date.now()}`,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    logger.error('Login failed', 'AUTH', error);
    return NextResponse.json(
      { success: false, error: 'Login failed' },
      { status: 500 }
    );
  }
}
