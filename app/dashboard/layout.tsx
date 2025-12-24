"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/dashboard/Header";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { getToken } from "@/lib/auth";
import { LanguageProvider } from "@/lib/i18n/context";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Check for token - if not found, redirect to login
    // This is a client-side check in addition to middleware
    const token = getToken();
    if (!token) {
      router.push("/login");
    }
  }, [router]);

  return (
    <LanguageProvider>
      <ErrorBoundary>
        {/* Sidebar (fixed) */}
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* Header (fixed) */}
        <Header 
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)} 
          onMenuOpen={() => setSidebarOpen(true)}
          onMenuClose={() => setSidebarOpen(false)}
        />

        {/* MAIN BODY (ONLY THIS SCROLLS) */}
        <main
          className="
            fixed
            top-16
            left-0
            right-0
            bottom-0
            md:left-64
            overflow-y-auto
            overflow-x-hidden
            bg-muted/30
          "
        >
          <div
            className="
      mx-auto
      w-full
      max-w-7xl
      px-4
      pt-7
      pb-4
      sm:px-6
      sm:pt-6
      sm:pb-6
      md:pl-6
      md:pr-4
      lg:pl-8
      lg:pr-6
    "
          >
            {children}
          </div>
        </main>
      </ErrorBoundary>
    </LanguageProvider>
  );
}
