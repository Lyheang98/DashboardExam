"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Package, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import Image from "next/image";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: Users, label: "Users Account and Right", href: "/dashboard/users" },
  { icon: Package, label: "Products", href: "/dashboard/products" },
  { icon: Settings, label: "Settings", href: "/dashboard/setting" },
];

export function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const pathname = usePathname();

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
              <Image src="/images/MoEYS logo.png" alt="MoEYS" width={48} height={48} />
              <Image src="/images/FOED logo.PNG" alt="FOED" width={36} height={36} />
              <Image src="/images/world bank.png" alt="World Bank" width={48} height={48} />
              <Image src="/images/IMG_5840.PNG" alt="Partner" width={38} height={40} />
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
