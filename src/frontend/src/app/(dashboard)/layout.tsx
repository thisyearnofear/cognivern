"use client";

import { usePathname } from "next/navigation";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { DemoBanner } from "@/components/layout/demo-banner";
import { CommandPalette } from "@/components/layout/command-palette";
import { ErrorBoundary } from "@/components/error-boundary";
import { AnimatePresence } from "motion/react";
import { PageTransition } from "@/components/ui/page-transition";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { WelcomeOverlay } from "@/components/ui/welcome-overlay";
import { useDemoSimulator } from "@/hooks/use-demo-simulator";

function DemoSimulator() {
  useDemoSimulator();
  return null;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isOsPage = pathname === "/os";

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="flex flex-col">
        <header className={`flex items-center gap-2 px-4 pt-2 md:hidden ${isOsPage ? "bg-[#0a0a0a]" : ""}`}>
          <SidebarTrigger
            aria-label="Toggle sidebar navigation"
            className={isOsPage ? "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800" : ""}
          />
        </header>
        {isOsPage ? null : <DemoBanner />}
        {isOsPage ? null : <DemoSimulator />}
        <main
          className={`flex-1 overflow-auto ${isOsPage ? "p-0" : "p-4 md:p-6"}`}
        >
          <Breadcrumb />
          <WelcomeOverlay />
          <ErrorBoundary>
            <AnimatePresence mode="wait">
              <PageTransition routeKey={pathname}>
                {children}
              </PageTransition>
            </AnimatePresence>
          </ErrorBoundary>
        </main>
      </SidebarInset>
      <CommandPalette />
    </SidebarProvider>
  );
}
