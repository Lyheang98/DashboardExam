'use client';

import { RefreshCw, Flame, Trash2, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { dataCache, CACHE_KEYS } from '@/lib/cache/dataCache';
import { cacheHandlers } from '@/lib/cache/cacheHandlers';
import { useToast } from '@/components/ui/toast';
import { useState, useEffect } from 'react';

interface DataControlsProps {
  onRefresh?: () => void;
  onWarmCache?: () => Promise<void>;
  onClearCache?: () => void;
}

export function DataControls({ onRefresh, onWarmCache, onClearCache }: DataControlsProps) {
  const { showToast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [hoverColor, setHoverColor] = useState<'blue' | 'green' | 'red' | null>(null);
  const [hoveredItem, setHoveredItem] = useState<'refresh' | 'warm' | 'clear' | null>(null);

  // Prevent hydration mismatch by only rendering on client
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleRefresh = () => {
    showToast('Fetching fresh data...', 'info');
    
    // Try page-specific handler first, then global, then reload
    const globalHandler = cacheHandlers.getRefreshHandler();
    if (onRefresh) {
      onRefresh();
    } else if (globalHandler) {
      globalHandler();
    } else {
      window.location.reload();
    }
  };

  const handleWarmCache = async () => {
    try {
      showToast('Warming cache... This may take a moment.', 'info');
      
      const globalHandler = cacheHandlers.getWarmCacheHandler();
      if (onWarmCache) {
        await onWarmCache();
        showToast('Cache warmed successfully!', 'success');
      } else if (globalHandler) {
        await globalHandler();
        showToast('Cache warmed successfully!', 'success');
      } else {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') || sessionStorage.getItem('token') : null;
        
        if (token) {
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
    
    // Try page-specific handler first, then global
    const globalHandler = cacheHandlers.getClearCacheHandler();
    if (onClearCache) {
      onClearCache();
    } else if (globalHandler) {
      globalHandler();
    }
  };

  // Prevent hydration mismatch - only render on client
  if (!mounted) {
    return (
      <Button 
        variant="ghost" 
        size="icon"
        className="relative group"
        disabled
      >
        <Database className="h-4 w-4 text-muted-foreground" />
        <span className="sr-only">Data Management</span>
      </Button>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon"
          className="relative group"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => {
            setOpen(false);
            setHoverColor(null);
          }}
        >
          <Database 
            className={`h-4 w-4 transition-colors ${
              hoverColor === 'blue' ? 'text-primary' :
              hoverColor === 'green' ? 'text-green-600' :
              hoverColor === 'red' ? 'text-red-600' :
              'text-muted-foreground group-hover:text-primary'
            }`} 
          />
          <span className="sr-only">Data Management</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="w-56"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => {
          setOpen(false);
          setHoverColor(null);
          setHoveredItem(null);
        }}
      >
        <div className="px-3 py-2 text-sm font-normal text-primary border-b mb-1">
          Data Management
        </div>
        <DropdownMenuItem 
          onClick={handleRefresh} 
          className="cursor-pointer text-primary"
          data-hover-color={hoveredItem === 'refresh' ? 'blue' : undefined}
          onMouseEnter={() => {
            setHoverColor('blue');
            setHoveredItem('refresh');
          }}
          onMouseLeave={() => {
            setHoverColor(null);
            setHoveredItem(null);
          }}
        >
          <RefreshCw className="mr-2 h-4 w-4 text-primary shrink-0" />
          <div className="flex flex-col gap-0.5">
            <span className="text-sm text-primary">Refresh Data</span>
            <span className="text-[10px] text-muted-foreground leading-tight">Fetch latest data from server</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={handleWarmCache} 
          className="cursor-pointer text-green-600"
          data-hover-color={hoveredItem === 'warm' ? 'green' : undefined}
          onMouseEnter={() => {
            setHoverColor('green');
            setHoveredItem('warm');
          }}
          onMouseLeave={() => {
            setHoverColor(null);
            setHoveredItem(null);
          }}
        >
          <Flame className="mr-2 h-4 w-4 text-green-600 shrink-0" />
          <div className="flex flex-col gap-0.5">
            <span className="text-sm text-green-600">Warm Cache</span>
            <span className="text-[10px] text-muted-foreground leading-tight">Pre-load data for faster access</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={handleClearCache} 
          className="cursor-pointer text-red-600"
          data-hover-color={hoveredItem === 'clear' ? 'red' : undefined}
          onMouseEnter={() => {
            setHoverColor('red');
            setHoveredItem('clear');
          }}
          onMouseLeave={() => {
            setHoverColor(null);
            setHoveredItem(null);
          }}
        >
          <Trash2 className="mr-2 h-4 w-4 text-red-600 shrink-0" />
          <div className="flex flex-col gap-0.5">
            <span className="text-sm text-red-600">Clear Cache</span>
            <span className="text-[10px] text-muted-foreground leading-tight">Remove cached data</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

