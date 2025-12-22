"use client";

// Login Page Component
// - Authenticates users with email and password
// - Displays success message after registration
// - Redirects to dashboard on successful login
// - Shows error messages for failed attempts

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { setToken, setUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { useToast } from '@/components/ui/toast';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isRegistered = searchParams.get('registered') === 'true';
  const redirectTo = searchParams.get('redirect') || '/dashboard';
  const { showToast } = useToast();
  
  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Show success toast when redirected from registration
  useEffect(() => {
    if (isRegistered) {
      showToast('Account created successfully! You can now sign in.', 'success');
    }
  }, [isRegistered, showToast]);

  // Handle login submission
  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    
    // Validate inputs
    const username = email.trim();
    if (!username) {
      showToast('Please enter your username', 'error');
      setLoading(false);
      return;
    }
    
    if (!password) {
      showToast('Please enter your password', 'error');
      setLoading(false);
      return;
    }
    
    // Create abort controller for timeout (20 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 20000);
    
    try {
      console.log('[LOGIN] Sending login request...');
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: username, password }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      console.log('[LOGIN] Response received:', res.status, res.statusText);

      // Parse response
      const text = await res.text();
      console.log('[LOGIN] Response text:', text.substring(0, 200));
      
      if (!text) {
        showToast('Empty response from server. Please try again.', 'error');
        setLoading(false);
        return;
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.error('[LOGIN] Parse error:', parseError);
        showToast(`Server error: ${res.status} ${res.statusText}`, 'error');
        setLoading(false);
        return;
      }
      
      // Check for errors
      if (!res.ok || !data.success) {
        const errorMsg = data?.error || data?.message || data?.detail || 'Login failed';
        console.error('[LOGIN] Login failed:', errorMsg);
        showToast(errorMsg, 'error');
        setLoading(false);
        return;
      }

      // Validate token
      const token = data.token;
      if (!token) {
        showToast('Invalid response from server. No authentication token received.', 'error');
        setLoading(false);
        return;
      }

      // Save authentication data
      const user = data.user || { 
        email: username, 
        name: username.split('@')[0], 
        username: username 
      };
      
      setToken(token);
      setUser(user);
      
      // Show success toast
      showToast('Login successful! Redirecting...', 'success');
      
      // Clear loading state
      setLoading(false);
      
      // Redirect to the intended destination or dashboard
      const destination = redirectTo || '/dashboard';
      console.log('[LOGIN] Login successful, redirecting to:', destination);
      
      // Small delay to show toast before redirect
      setTimeout(() => {
        window.location.href = destination;
      }, 500);
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error('[LOGIN] Error:', err);
      
      let errorMsg = 'Network error. Please check your internet connection and try again.';
      
      if (err.name === 'AbortError') {
        errorMsg = 'Request timed out. The server is taking too long to respond. Please try again.';
      } else if (err?.message) {
        errorMsg = err.message;
      }
      
      showToast(errorMsg, 'error');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl ">Login</CardTitle>
          <CardDescription>
            Enter your credentials to access your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Username</Label>
              <Input
                id="email"
                type="text"
                placeholder="Enter username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <div className="text-center text-sm">
            Don't have an account?{' '}
            <Link href="/register" className="text-primary hover:underline font-medium">
              Register here
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
