'use client';

import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { DemoBanner } from '@/components/layout/demo-banner';
import { CommandPalette } from '@/components/layout/command-palette';
import { ErrorBoundary } from '@/components/error-boundary';
import { useDemoSimulator } from '@/hooks/use-demo-simulator';

function DemoSimulator() {
  useDemoSimulator();
  return null;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="flex flex-col">
        <header className="flex items-center gap-2 px-4 pt-2 md:hidden">
          <SidebarTrigger aria-label="Toggle sidebar navigation" />
        </header>
        <DemoBanner />
        <DemoSimulator />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </SidebarInset>
      <CommandPalette />
    </SidebarProvider>
  );
}
