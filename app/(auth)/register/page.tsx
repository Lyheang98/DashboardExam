'use client';

// ==========================================
// REGISTRATION PAGE COMPONENT
// ==========================================
// Purpose: Allow new users to create an account
// Location: /register route
// Features:
//   - Form validation (email, password match, length)
//   - Error handling and display
//   - Success message with redirect to login
//   - Uses logger for debugging

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { logger } from '@/lib/logger';
import { useToast } from '@/components/ui/toast';

export default function RegisterPage() {
  const router = useRouter();
  const { showToast } = useToast();
  
  // Form state - stores all input field values
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  
  // UI state - for loading indicator
  const [loading, setLoading] = useState(false);

  // ==========================================
  // Handle input changes
  // ==========================================
  // Updates form state whenever user types in input field
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    // Spread operator keeps other fields, updates the changed one
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // ==========================================
  // Handle form submission
  // ==========================================
  // Called when user clicks Register button
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // Prevent page reload
    setLoading(true); // Show loading state

    try {
      // Call the registration API endpoint
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData), // Send form data as JSON
      });

      // Parse the response
      const data = await response.json();

      // Check if registration failed
      if (!response.ok) {
        const errorMsg = data.error || 'Registration failed';
        showToast(errorMsg, 'error');
        logger.warn('Registration failed', 'REGISTER', new Error(errorMsg));
        setLoading(false);
        return; // Stop here, don't proceed
      }

      // Registration successful - show success message
      logger.info('User registered successfully', 'REGISTER');
      showToast('Account created successfully! Redirecting to login...', 'success');
      
      // Redirect to login after 1.5 seconds
      setTimeout(() => {
        router.push('/login?registered=true');
      }, 1500);
    } catch (err) {
      showToast('An error occurred. Please try again.', 'error');
      logger.error('Registration error', 'REGISTER', err);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Create Account</CardTitle>
          <CardDescription>
            Sign up to get started with our platform
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="john@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Minimum 3 characters
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Creating Account...' : 'Sign Up'}
              </Button>
            </form>

          <div className="text-center text-sm">
            Already have an account?{' '}
            <Link href="/login" className="text-primary hover:underline font-medium">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
