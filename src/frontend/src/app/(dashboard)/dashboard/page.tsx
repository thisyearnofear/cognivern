import { Dashboard } from "@/components/dashboard/dashboard";

// Client-rendered (SWR data fetching in the "use client" tree); prerender the
// shell to CDN, no per-request function needed.

export default function DashboardPage() {
  return <Dashboard />;
}
