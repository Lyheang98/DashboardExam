import { NextRequest, NextResponse } from 'next/server';
import { getUserByEmail, createUser } from '@/lib/storage';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const { name, email, password, confirmPassword } = await request.json();

    if (!name || !email || !password || !confirmPassword) {
      return NextResponse.json(
        { success: false, error: 'All fields required' },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { success: false, error: 'Passwords do not match' },
        { status: 400 }
      );
    }

    if (password.length < 3) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 3 characters' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const existingUser = await getUserByEmail(cleanEmail);
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'Email already in use' },
        { status: 409 }
      );
    }

    const newUser = await createUser({
      name,
      email: cleanEmail,
      password,
      role: 'user',
      status: 'active',
    });

    logger.info(`New user registered: ${cleanEmail}`, 'REGISTER');
    return NextResponse.json({
      success: true,
      message: 'Account created successfully',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
      },
    });
  } catch (error) {
    logger.error('Registration failed', 'REGISTER', error);
    return NextResponse.json(
      { success: false, error: 'Registration failed' },
      { status: 500 }
    );
  }
}
