"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Package, Settings } from "lucide-react";
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

  const menuItems = [
    { icon: LayoutDashboard, label: t.sidebar.dashboard, href: "/dashboard" },
    { icon: Users, label: t.sidebar.users, href: "/dashboard/users" },
    { icon: Package, label: t.sidebar.products, href: "/dashboard/products" },
    { icon: Settings, label: t.sidebar.settings, href: "/dashboard/setting" },
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
          <nav className="flex-1 overflow-y-auto space-y-2 p-4">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    className="w-full justify-start gap-2"
                    onClick={onClose}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>
    </>
  );
}
