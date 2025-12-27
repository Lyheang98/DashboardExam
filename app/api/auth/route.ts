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

    // Extract refresh token if available
    const refreshToken = data.refresh_token || data.refresh || data.data?.refresh_token || data.refreshToken;

    logger.info(`User logged in: ${email}`, 'AUTH');
    
    // Create response with token and user data
    const response = NextResponse.json({
      success: true,
      token,
      refresh_token: refreshToken || null, // Include refresh token if available
      user: data.user || data.data?.user || { email, name: email.split('@')[0] },
    });

    // Set token in cookie for middleware access
    // Use session cookie - expires when browser/tab closes (no maxAge)
    // This ensures users must login again after closing the browser
    response.cookies.set('token', token, {
      httpOnly: false, // Allow client-side access (for consistency with sessionStorage)
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      // No maxAge = session cookie that expires when browser closes
      // This ensures no persistent login - users must login again after closing browser
    });
    
    // Also store refresh token in cookie for server-side token refresh
    if (refreshToken) {
      response.cookies.set('refresh_token', refreshToken, {
        httpOnly: false, // Allow client-side access
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });
    }

    return response;
  } catch (error: any) {
    logger.error('Login failed', 'AUTH', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Login failed. Please check your connection.' },
      { status: 500 }
    );
  }
}
