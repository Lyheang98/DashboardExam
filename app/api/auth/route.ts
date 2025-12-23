import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { EXTERNAL_ENDPOINTS } from '@/lib/api/config';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password required' },
        { status: 400 }
      );
    }

    // Django REST Framework token endpoint expects form-urlencoded
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    // Proxy request to external API
    const res = await fetch(EXTERNAL_ENDPOINTS.AUTH.TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });

    const contentType = res.headers.get('content-type');
    let data;

    if (contentType && contentType.includes('application/json')) {
      data = await res.json();
    } else {
      const text = await res.text();
      logger.error('Login failed - non-JSON response', 'AUTH', new Error(text));
      return NextResponse.json(
        { success: false, error: `Server error: ${res.status} ${res.statusText}` },
        { status: res.status || 500 }
      );
    }

    if (!res.ok) {
      const errorMsg = data?.error || data?.message || data?.detail || 'Invalid credentials';
      logger.warn('Login failed', 'AUTH', new Error(errorMsg));
      return NextResponse.json(
        { success: false, error: errorMsg },
        { status: res.status }
      );
    }

    // Extract token from various possible response formats
    const token = data.token || data.access_token || data.access || data.data?.token || data.accessToken;
    
    if (!token) {
      logger.warn('Login failed - no token in response', 'AUTH', new Error(JSON.stringify(data)));
      return NextResponse.json(
        { success: false, error: 'Invalid response from server' },
        { status: 500 }
      );
    }

    logger.info(`User logged in: ${email}`, 'AUTH');
    
    // Create response with token and user data
    const response = NextResponse.json({
      success: true,
      token,
      user: data.user || data.data?.user || { email, name: email.split('@')[0] },
    });

    // Set token in cookie for middleware access (session cookie - expires when browser closes)
    response.cookies.set('token', token, {
      httpOnly: false, // Allow client-side access
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      // No maxAge means it's a session cookie that expires when browser closes
      path: '/',
    });

    return response;
  } catch (error: any) {
    logger.error('Login failed', 'AUTH', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Login failed. Please check your connection.' },
      { status: 500 }
    );
  }
}
