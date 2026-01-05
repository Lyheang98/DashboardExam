"use client";

// Login Page Component
// - Authenticates users with email and password
// - Displays success message after registration
// - Redirects to dashboard on successful login
// - Shows error messages for failed attempts

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { setToken, setUser, getToken, clearToken } from '@/lib/auth';
import { useToast } from '@/components/ui/toast';
import { OptimizedImage } from '@/components/ui/optimized-image';
import { IMAGE_PATHS } from '@/lib/images';

function LoginPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const isRegistered = searchParams.get('registered') === 'true';
  const redirectTo = searchParams.get('redirect') || '/dashboard';
  const { showToast } = useToast();
  
  // Form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  
  // Refs for cleanup
  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Don't auto-redirect on login page - let user login fresh
  // Middleware will handle redirect if they have a valid token
  useEffect(() => {
    // Clear any stale tokens to ensure fresh login
    const token = getToken();
    if (token) {
      // Clear token to force fresh login
      clearToken();
      if (typeof document !== 'undefined') {
        document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT;';
      }
    }
  }, []);

  // Load saved credentials on mount
  useEffect(() => {
    const savedEmail = localStorage.getItem('rememberedEmail');
    const savedPassword = localStorage.getItem('rememberedPassword');
    const savedRememberMe = localStorage.getItem('rememberMe') === 'true';
    
    if (savedEmail && savedPassword && savedRememberMe) {
      setUsername(savedEmail);
      setPassword(savedPassword);
      setRememberMe(true);
    }
  }, []);

  // Show success toast when redirected from registration
  useEffect(() => {
    if (isRegistered) {
      showToast('Account created! Please sign in.', 'success');
    }
  }, [isRegistered, showToast]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Abort any pending requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort('Component unmounted');
      }
      // Clear any pending timeouts
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Handle login submission
  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    
    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      showToast('Please enter your username', 'error');
      setLoading(false);
      return;
    }
    
    if (!password) {
      showToast('Please enter your password', 'error');
      setLoading(false);
      return;
    }
    
    // Abort any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort('New login attempt started');
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    const timeoutId = setTimeout(() => {
      controller.abort('Request timeout after 20 seconds');
    }, 20000);
    timeoutRef.current = timeoutId;
    
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedUsername, password }),
        signal: controller.signal,
      });

      // Clear timeout on successful response
      clearTimeout(timeoutId);
      timeoutRef.current = null;
      
      const text = await res.text();
      
      if (!text) {
        showToast('Server error. Please try again.', 'error');
        setLoading(false);
        return;
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        showToast(`Server error: ${res.status} ${res.statusText}`, 'error');
        setLoading(false);
        return;
      }
      
      if (!res.ok || !data.success) {
        const errorMsg = data?.error || data?.message || data?.detail || 'Login failed';
        showToast(errorMsg, 'error');
        setLoading(false);
        return;
      }

      const token = data.token;
      if (!token) {
        showToast('Invalid response. No token received.', 'error');
        setLoading(false);
        return;
      }

      // Extract and store refresh token if available
      const refreshToken = data.refresh_token;
      if (refreshToken && typeof window !== 'undefined') {
        sessionStorage.setItem('refresh_token', refreshToken);
      }

      // Extract role from response (for permissions caching)
      const role = data.role || 'user';
      
      // Store minimal user data (email and role only - no preloading)
      const user = { 
        email: trimmedUsername, 
        name: trimmedUsername.split('@')[0],
        role: role
      };
      
      setToken(token);
      setUser(user);
      
      // Cache permissions for fast access
      try {
        sessionStorage.setItem('user_permissions', JSON.stringify({
          role,
          timestamp: Date.now(),
        }));
      } catch (error) {
        // Ignore storage errors
      }
      
      if (rememberMe) {
        localStorage.setItem('rememberedEmail', trimmedUsername);
        localStorage.setItem('rememberedPassword', password);
        localStorage.setItem('rememberMe', 'true');
      } else {
        localStorage.removeItem('rememberedEmail');
        localStorage.removeItem('rememberedPassword');
        localStorage.removeItem('rememberMe');
      }
      
      // Show success toast
      showToast('Login successful!', 'success');
      
      // Clear loading state
      setLoading(false);
      
      // Redirect to the intended destination or dashboard using Next.js router
      const destination = redirectTo || '/dashboard';
      console.log('[LOGIN] Login successful, redirecting to:', destination);
      
      // Quick redirect (toast will show briefly)
      setTimeout(() => {
        router.push(destination);
      }, 300);
    } catch (err: any) {
      // Always clear timeout in catch block
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      // Clear abort controller ref if this was the current request
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      
      // Check if this is a timeout or abort error
      // Handle both Error objects and string errors
      const errorName = err?.name || '';
      const errorMessage = typeof err === 'string' ? err : (err?.message || err?.toString() || '');
      const errorString = String(err).toLowerCase();
      
      const isAbortError = errorName === 'AbortError' || errorName === 'DOMException';
      const isTimeout = errorMessage.toLowerCase().includes('timeout') || 
                       errorMessage.toLowerCase().includes('request timeout') ||
                       errorMessage.toLowerCase().includes('20 seconds') ||
                       errorString.includes('timeout');
      
      if (isAbortError || isTimeout) {
        // Timeout detected - show user-friendly message (don't log to console)
        showToast('Request timed out. Please check your connection and try again.', 'error');
        setLoading(false);
        return; // Exit early - don't log or process further
      }
      
      // Only log non-abort, non-timeout errors
      console.error('[LOGIN] Error:', err);
      
      let errorMsg = 'Network error. Please try again.';
      if (err?.message) {
        errorMsg = err.message;
      }
      
      showToast(errorMsg, 'error');
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 min-h-screen overflow-hidden">
      <div className="fixed inset-0 z-0">
        <OptimizedImage
          src={IMAGE_PATHS.promotional.version2}
          alt="MOEYS EDTECH Version 2.0 Background"
          fill
          sizes="100vw"
          objectFit="cover"
          priority
          className="object-cover blur-[3px]"
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-black/40 to-black/60" />
      </div>

      <div className="relative z-10 min-h-screen grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-1 xl:gap-2">
        <div className="flex items-center justify-center p-4 sm:p-6 lg:p-6 xl:p-8 order-1 lg:order-1">
          <div className="w-full max-w-md xl:max-w-lg">
            <div className="space-y-4 sm:space-y-5 lg:space-y-6 text-center">
              <div className="flex flex-col items-center gap-3 sm:gap-4 lg:gap-5 justify-center">
                <div className="flex items-center justify-center gap-3 sm:gap-4 lg:gap-5 flex-wrap">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 relative shrink-0">
                    <OptimizedImage
                      src={IMAGE_PATHS.logos.moeys}
                      alt="MoEYS Logo"
                      fill
                      className="opacity-90 object-contain"
                    />
                  </div>
                  <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 relative shrink-0">
                    <OptimizedImage
                      src={IMAGE_PATHS.logos.foed}
                      alt="FOED Logo"
                      fill
                      className="opacity-90 object-contain"
                    />
                  </div>
                  <div className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 relative shrink-0">
                    <OptimizedImage
                      src={IMAGE_PATHS.logos.worldBank}
                      alt="World Bank Logo"
                      fill
                      className="opacity-90 object-contain"
                    />
                  </div>
                  <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 relative shrink-0">
                    <OptimizedImage
                      src={IMAGE_PATHS.logos.partner}
                      alt="Partner Logo"
                      fill
                      className="opacity-90 object-contain"
                    />
                  </div>
                </div>
                
                <div className="text-white/80">
                  <p className="font-semibold text-xl sm:text-base lg:text-lg xl:text-xl 2xl:text-2xl whitespace-nowrap">
                    Ministry of Education, Youth and Sport
                  </p>
                  <p className="text-sm sm:text-sm lg:text-base xl:text-lg mt-1">
                    MoEYS EdTech Dashboard
                  </p>
                </div>
              </div>
              <div className="pt-3 sm:pt-4 lg:pt-5 border-t border-white/20">
                <p className="text-white/70 text-xs sm:text-xs lg:text-sm xl:text-sm leading-relaxed px-2">
                  Copyright © {new Date().getFullYear()} Ministry of Education, Youth and Sport (MoEYS)
                </p>
                <p className="text-white/60 text-xs sm:text-xs lg:text-sm xl:text-sm mt-2 px-2">
                  All rights reserved. Powered by GEIP EdTech FOEDRUPP
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center p-4 sm:p-6 lg:p-6 xl:p-8 order-2 lg:order-2">
          <div className="w-full max-w-md">
            <Card className="border-2 shadow-xl bg-card/95 backdrop-blur-sm">
              <CardHeader className="space-y-2 text-center">
                <CardTitle className="text-xl sm:text-2xl font-bold">Login</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Enter your credentials to access your account
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 sm:space-y-6">
                <form onSubmit={submit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username" className="text-sm font-medium">
                      Username
                    </Label>
                    <Input
                      id="username"
                      type="text"
                      placeholder="Enter username"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={loading}
                      className="text-sm sm:text-base"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-medium">
                      Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={loading}
                        className="text-sm sm:text-base pr-10"
                        aria-describedby="password-toggle-description"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setShowPassword((prev) => !prev);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setShowPassword((prev) => !prev);
                          }
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={loading}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        aria-pressed={showPassword}
                        tabIndex={0}
                      >
                        {showPassword ? (
                          <Eye className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <EyeOff className="h-4 w-4" aria-hidden="true" />
                        )}
                      </button>
                      <span id="password-toggle-description" className="sr-only">
                        {showPassword ? 'Password is visible' : 'Password is hidden'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="remember"
                      checked={rememberMe}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setRememberMe(checked);
                        if (!checked) {
                          // Clear saved credentials when unchecked
                          localStorage.removeItem('rememberedEmail');
                          localStorage.removeItem('rememberedPassword');
                          localStorage.removeItem('rememberMe');
                        }
                      }}
                      disabled={loading}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">
                      Remember me
                    </Label>
                  </div>

                  <Button className="w-full text-sm sm:text-base" type="submit" disabled={loading}>
                    {loading ? 'Signing in...' : 'Sign In'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginPageContent />
    </Suspense>
  );
}
