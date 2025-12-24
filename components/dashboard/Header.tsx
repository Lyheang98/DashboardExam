"use client";

// Dashboard Header Component
// - Displays user name
// - Mobile menu toggle button
// - Notification bell icon (placeholder)
// - Settings and Logout buttons
// - Sticky header with backdrop blur effect

import { Menu, Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/dashboard/ThemeToggle";
import { LanguageSwitcher } from "@/components/dashboard/LanguageSwitcher";
import { DataControls } from "@/components/dashboard/DataControls";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";
import { clearToken, getUser } from "@/lib/auth";
import { useEffect, useState, useRef } from "react";
import { useToast } from "@/components/ui/toast";
import { useLanguage } from "@/lib/i18n/context";

interface HeaderProps {
  onMenuToggle?: () => void;
  onMenuOpen?: () => void;
  onMenuClose?: () => void;
}

export function Header({ onMenuToggle, onMenuOpen, onMenuClose }: HeaderProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const { t } = useLanguage();
  const [userName, setUserName] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setMounted(true);
    const u = getUser();
    setUserName(u?.name || null);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b" style={{ backgroundColor: 'var(--color-header)', color: 'var(--color-header-foreground)', borderColor: 'var(--color-header-border)' }}>
      <div className="flex h-20 items-center justify-between px-2 md:px-4 lg:px-6">
        {/* LEFT */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Mobile menu */}
          <div
            onMouseEnter={() => {
              if (hoverTimeoutRef.current) {
                clearTimeout(hoverTimeoutRef.current);
              }
              if (onMenuOpen) {
                onMenuOpen();
              }
            }}
            className="shrink-0"
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={onMenuToggle}
              className="md:hidden shrink-0"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>

          {/* Title */}
          <div className="flex-1 min-w-0 pr-2">
            <h1 className="text-base sm:text-xl md:text-2xl font-bold tracking-tight text-primary">
              {t.header.title}
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1 sm:line-clamp-none">
              {t.header.subtitle}
            </p>
          </div>
        </div>

        {/* RIGHT */}
        <div className="flex items-center gap-2 sm:gap-3 md:gap-4 shrink-0">
          {/* Language Switcher */}
          <LanguageSwitcher />
          
          {/* Theme Toggle */}
          <ThemeToggle />
          
          {/* Data Controls */}
          <DataControls />

          {/* User & Settings */}
          {mounted && (
            <DropdownMenu open={settingsOpen} onOpenChange={setSettingsOpen}>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="group transition-colors hover:bg-accent"
                  onMouseEnter={() => setSettingsOpen(true)}
                  onMouseLeave={() => setSettingsOpen(false)}
                >
                  <Settings className="h-4 w-4 transition-colors group-hover:text-primary" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="end" 
                className="w-44"
                onMouseEnter={() => setSettingsOpen(true)}
                onMouseLeave={() => setSettingsOpen(false)}
              >
                {userName && (
                  <>
                    <div className="px-2 py-1 text-xs text-muted-foreground">
                      {t.header.signedInAs}
                    </div>
                    <DropdownMenuItem className="hover:bg-accent/50 transition-colors">{userName}</DropdownMenuItem>
                  </>
                )}
                <DropdownMenuItem className="hover:bg-accent/50 transition-colors">{t.header.help}</DropdownMenuItem>
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
                    
                    // Show error toast (red) and redirect
                    showToast('Logged out successfully', 'error');
                    
                    // Small delay to show toast before redirect
                    setTimeout(() => {
                      router.push("/login");
                    }, 300);
                  }}
                  className="text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/20 transition-colors"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  {t.header.logout}
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