"use client";

// Dashboard Header Component
// - Displays user name
// - Mobile menu toggle button
// - Notification bell icon (placeholder)
// - Settings and Logout buttons
// - Sticky header with backdrop blur effect

import { Menu, Bell, Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/dashboard/ThemeToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";
import { clearToken, getUser } from "@/lib/auth";
import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/toast";

interface HeaderProps {
  onMenuToggle?: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [userName, setUserName] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const u = getUser();
    setUserName(u?.name || null);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b bg-background">
      <div className="flex h-20 items-center justify-between px-4 md:px-6">
        {/* LEFT */}
        <div className="flex items-center gap-3 flex-1">
          {/* Mobile menu */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuToggle}
            className="md:hidden shrink-0"
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Title */}
          <div className="flex-1 min-w-0">
            <h1 className="truncate text-base sm:text-xl md:text-2xl font-bold tracking-tight">
              MoEYS EdTech Dashboard
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1 sm:line-clamp-none">
              Monitor and manage your educational platform
            </p>
          </div>
        </div>

        {/* RIGHT */}
        <div className="flex items-center gap-2 sm:gap-3 md:gap-4 shrink-0">
          {/* Notification */}
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-destructive" />
          </Button>
          <div>
             <ThemeToggle />
          </div>
          

          {/* User & Settings */}
          {mounted && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Settings className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                {userName && (
                  <>
                    <div className="px-2 py-1 text-xs text-muted-foreground">
                      Signed in as
                    </div>
                    <DropdownMenuItem>{userName}</DropdownMenuItem>
                  </>
                )}
                <DropdownMenuItem>Help</DropdownMenuItem>
                <DropdownMenuItem
                  onClick={async () => {
                    // Clear local storage first
                    clearToken();
                    
                    // Try to clear cookie via API (non-blocking)
                    try {
                      const response = await fetch('/api/auth/logout', { 
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                      });
                      
                      if (!response.ok) {
                        throw new Error('Logout API failed');
                      }
                    } catch (error) {
                      // Log error but don't block logout
                      console.error('Logout API error:', error);
                    }
                    
                    // Show info toast and redirect (info is best practice for logout)
                    showToast('Logged out successfully', 'info');
                    
                    // Small delay to show toast before redirect
                    setTimeout(() => {
                      router.push("/login");
                    }, 300);
                  }}
                  className="text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {!mounted && (
            <Button variant="ghost" size="icon">
              <Settings className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}