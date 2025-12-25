"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Settings, ChevronDown, School, GraduationCap, MapPin, Building2, Heart, Map } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { IMAGE_PATHS, IMAGE_CONFIG } from "@/lib/images";
import { useLanguage } from "@/lib/i18n/context";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);
  const [isDataExpanded, setIsDataExpanded] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-expand settings menu when on any settings page
  useEffect(() => {
    if (pathname.startsWith("/dashboard/setting")) {
      setIsSettingsExpanded(true);
    }
  }, [pathname]);

  // Auto-expand data menu when on any data pages
  useEffect(() => {
    if (pathname.startsWith("/dashboard/student")) {
      setIsDataExpanded(true);
    }
  }, [pathname]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  const menuItems = [
    { icon: LayoutDashboard, label: t.sidebar.dashboard, href: "/dashboard" },
    { icon: School, label: t.sidebar.schools, href: "/dashboard/schools" },
  ];

  const dataMenuItems = [
    { id: 'province', icon: MapPin, label: 'Province', href: '/dashboard/student/province' },
    { id: 'district', icon: Map, label: 'District', href: '/dashboard/student/district' },
    { id: 'school', icon: Building2, label: 'School', href: '/dashboard/student/school' },
    { id: 'disability', icon: Heart, label: 'Disability', href: '/dashboard/student/disability' },
    { id: 'students', icon: GraduationCap, label: 'Students', href: '/dashboard/student/students' },
  ];

  const settingsMenuItems = [
    { id: 'aboutUs', label: t.settings.aboutUs, href: '/dashboard/setting/about-us' },
    { id: 'contactUs', label: t.settings.contactUs, href: '/dashboard/setting/contact-us' },
    { id: 'howToUse', label: t.header.howToUse, href: '/dashboard/setting/how-to-use' },
    { id: 'privacyPolicy', label: t.settings.privacyPolicy, href: '/dashboard/setting/privacy-policy' },
    { id: 'termsConditions', label: t.settings.termsConditions, href: '/dashboard/setting/terms-conditions' },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-16 left-0 z-40 w-64 border-r bg-card",
          "h-[calc(100vh-4rem)]",
          "transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full",
          "md:translate-x-0"
        )}
        onMouseEnter={() => {
          if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
          }
        }}
        onMouseLeave={() => {
          // Only close on mobile (when sidebar can be hidden)
          // On desktop (md:), sidebar is always visible so we don't need to close it
          if (typeof window !== 'undefined' && window.innerWidth < 768) {
            hoverTimeoutRef.current = setTimeout(() => {
              onClose?.();
            }, 200);
          }
        }}
      >
        <div className="flex h-full flex-col">
          {/* Sidebar Header */}
          <div className="flex h-20 items-center justify-center border-b px-4 mt-3">
            <div className="flex items-center gap-4">
              <OptimizedImage
                src={IMAGE_PATHS.logos.moeys}
                alt="MoEYS Logo"
                width={IMAGE_CONFIG.sizes.logo.width}
                height={IMAGE_CONFIG.sizes.logo.height}
                priority
              />
              <OptimizedImage
                src={IMAGE_PATHS.logos.foed}
                alt="FOED Logo"
                width={IMAGE_CONFIG.sizes.logoSmall.width}
                height={IMAGE_CONFIG.sizes.logoSmall.height}
                priority
              />
              <OptimizedImage
                src={IMAGE_PATHS.logos.worldBank}
                alt="World Bank Logo"
                width={IMAGE_CONFIG.sizes.logo.width}
                height={IMAGE_CONFIG.sizes.logo.height}
                priority
              />
              <OptimizedImage
                src={IMAGE_PATHS.logos.partner}
                alt="Partner Logo"
                width={38}
                height={40}
                priority
              />
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto space-y-1 p-4">
            {menuItems.map((item) => {
              const Icon = item.icon;

              return (
                <Link key={item.href} href={item.href} prefetch={true}>
                  <Button
                    variant="ghost"
                    className={cn(
                      "w-full justify-start gap-3 h-10 px-3",
                      "hover:bg-primary/10 hover:text-primary",
                      "dark:hover:bg-primary/10 dark:hover:text-primary",
                      "transition-colors duration-200"
                    )}
                    onClick={onClose}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="text-sm">{item.label}</span>
                  </Button>
                </Link>
              );
            })}

            {/* Data Management with Dropdown */}
            <div 
              className="space-y-0"
              onMouseEnter={() => {
                if (hoverTimeoutRef.current) {
                  clearTimeout(hoverTimeoutRef.current);
                }
                setIsDataExpanded(true);
              }}
              onMouseLeave={() => {
                hoverTimeoutRef.current = setTimeout(() => {
                  setIsDataExpanded(false);
                }, 200);
              }}
            >
              <Button
                variant="ghost"
                onClick={() => setIsDataExpanded(!isDataExpanded)}
                onMouseEnter={() => {
                  if (hoverTimeoutRef.current) {
                    clearTimeout(hoverTimeoutRef.current);
                  }
                  setIsDataExpanded(true);
                }}
                onMouseLeave={() => {
                  hoverTimeoutRef.current = setTimeout(() => {
                    setIsDataExpanded(false);
                  }, 200);
                }}
                className={cn(
                  "w-full justify-between h-10 px-3 gap-3",
                  "hover:bg-primary/10 hover:text-primary",
                  "dark:hover:bg-primary/10 dark:hover:text-primary",
                  "transition-colors duration-200"
                )}
              >
                <div className="flex items-center gap-3">
                  <GraduationCap className="h-4 w-4 shrink-0" />
                  <span className="text-sm">Student</span>
                </div>
                <ChevronDown className={cn(
                  "h-4 w-4 shrink-0 transition-transform duration-200 ease-in-out",
                  isDataExpanded && "rotate-180"
                )} />
              </Button>

              {/* Data Management Submenu */}
              {isDataExpanded && (
                <div 
                  className="ml-6 space-y-0.5 mt-0 animate-in fade-in slide-in-from-top-2 duration-200"
                  onMouseEnter={() => {
                    if (hoverTimeoutRef.current) {
                      clearTimeout(hoverTimeoutRef.current);
                    }
                    setIsDataExpanded(true);
                  }}
                  onMouseLeave={() => {
                    hoverTimeoutRef.current = setTimeout(() => {
                      setIsDataExpanded(false);
                    }, 200);
                  }}
                >
                  {dataMenuItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link key={item.id} href={item.href} prefetch={true}>
                        <button
                          onClick={onClose}
                          className={cn(
                            "w-full text-left h-9 px-3 rounded-md text-sm flex items-center gap-3",
                            "transition-colors duration-200 ease-in-out",
                            "hover:bg-primary/5 hover:text-primary text-muted-foreground dark:text-muted-foreground"
                          )}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          <span>{item.label}</span>
                        </button>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Settings with Dropdown */}
            <div 
              className="space-y-0"
              onMouseEnter={() => {
                if (hoverTimeoutRef.current) {
                  clearTimeout(hoverTimeoutRef.current);
                }
                setIsSettingsExpanded(true);
              }}
              onMouseLeave={() => {
                hoverTimeoutRef.current = setTimeout(() => {
                  setIsSettingsExpanded(false);
                }, 200);
              }}
            >
              <Button
                variant="ghost"
                onClick={() => setIsSettingsExpanded(!isSettingsExpanded)}
                onMouseEnter={() => {
                  if (hoverTimeoutRef.current) {
                    clearTimeout(hoverTimeoutRef.current);
                  }
                  setIsSettingsExpanded(true);
                }}
                onMouseLeave={() => {
                  hoverTimeoutRef.current = setTimeout(() => {
                    setIsSettingsExpanded(false);
                  }, 200);
                }}
                className={cn(
                  "w-full justify-between h-10 px-3 gap-3",
                  "hover:bg-primary/10 hover:text-primary",
                  "dark:hover:bg-primary/10 dark:hover:text-primary",
                  "transition-colors duration-200"
                )}
              >
                <div className="flex items-center gap-3">
                  <Settings className="h-4 w-4 shrink-0" />
                  <span className="text-sm">{t.sidebar.settings}</span>
                </div>
                <ChevronDown className={cn(
                  "h-4 w-4 shrink-0 transition-transform duration-200 ease-in-out",
                  isSettingsExpanded && "rotate-180"
                )} />
              </Button>

              {/* Settings Submenu */}
              {isSettingsExpanded && (
                <div 
                  className="ml-6 space-y-0.5 mt-0 animate-in fade-in slide-in-from-top-2 duration-200"
                  onMouseEnter={() => {
                    if (hoverTimeoutRef.current) {
                      clearTimeout(hoverTimeoutRef.current);
                    }
                    setIsSettingsExpanded(true);
                  }}
                  onMouseLeave={() => {
                    hoverTimeoutRef.current = setTimeout(() => {
                      setIsSettingsExpanded(false);
                    }, 200);
                  }}
                >
                  {settingsMenuItems.map((item) => {
                    return (
                      <Link key={item.id} href={item.href} prefetch={true}>
                        <button
                          onClick={onClose}
                          className={cn(
                            "w-full text-left h-9 px-3 rounded-md text-sm",
                            "transition-colors duration-200 ease-in-out",
                            "hover:bg-primary/5 hover:text-primary text-muted-foreground dark:text-muted-foreground"
                          )}
                        >
                          {item.label}
                        </button>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </nav>
        </div>
      </aside>
    </>
  );
}
