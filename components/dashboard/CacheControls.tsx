'use client';

import { RefreshCw, Flame, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { dataCache, CACHE_KEYS } from '@/lib/cache/dataCache';
import { useToast } from '@/components/ui/toast';

interface CacheControlsProps {
  onRefresh?: () => void;
  onWarmCache?: () => Promise<void>;
  onClearCache?: () => void;
}

export function CacheControls({ onRefresh, onWarmCache, onClearCache }: CacheControlsProps) {
  const { showToast } = useToast();

  const handleRefresh = () => {
    // Clear cache first, then refresh
    dataCache.clear();
    showToast('Cache cleared. Fetching fresh data...', 'info');
    
    if (onRefresh) {
      onRefresh();
    } else {
      // Force page reload to fetch fresh data
      window.location.reload();
    }
  };

  const handleWarmCache = async () => {
    try {
      showToast('Warming cache... This may take a moment.', 'info');
      
      if (onWarmCache) {
        await onWarmCache();
        showToast('Cache warmed successfully!', 'success');
      } else {
        // Default warm cache behavior - pre-fetch common data
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') || sessionStorage.getItem('token') : null;
        
        if (token) {
          // Pre-fetch schools count
          await fetch('/api/schools', {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
        }
        
        showToast('Cache warmed successfully!', 'success');
      }
    } catch (error) {
      showToast('Failed to warm cache', 'error');
      console.error('Warm cache error:', error);
    }
  };

  const handleClearCache = () => {
    dataCache.clear();
    showToast('Cache cleared successfully', 'success');
    
    // Optionally trigger refresh if callback provided
    if (onClearCache) {
      onClearCache();
    }
  };

  return (
    <div className="flex gap-2 flex-wrap">
      <Button
        onClick={handleRefresh}
        variant="outline"
        size="sm"
        className="border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950"
      >
        <RefreshCw className="w-4 h-4 mr-2" />
        Refresh Data
      </Button>
      
      <Button
        onClick={handleWarmCache}
        variant="outline"
        size="sm"
        className="border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
      >
        <Flame className="w-4 h-4 mr-2" />
        Warm Cache
      </Button>
      
      <Button
        onClick={handleClearCache}
        variant="outline"
        size="sm"
        className="border-orange-500 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950"
      >
        <Trash2 className="w-4 h-4 mr-2" />
        Clear Cache
      </Button>
    </div>
  );
}

