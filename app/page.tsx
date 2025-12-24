'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { clearToken, getToken } from '@/lib/auth';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Clear any stale tokens on app startup to ensure fresh login
    // This ensures staff must login every time they open the app
    const token = getToken();
    
    // Clear token and cookie to force fresh login
    if (token) {
      clearToken();
      // Also clear cookie explicitly
      if (typeof document !== 'undefined') {
        document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT;';
      }
    }
    
    // Always redirect to login page
    router.push('/login');
  }, [router]);

  return null;
}
