"use client";

import { usePathname } from "next/navigation";
import { ChevronRight, LayoutDashboard } from "lucide-react";
import { ALL_NAV_ITEMS } from "@/lib/nav-items";

const PARENT_GROUPS: Record<string, string> = {
  "/policies": "Governance",
  "/agents": "Governance",
  "/governance": "Governance",
  "/audit": "History",
  "/runs": "History",
  "/integrate": "Developer",
  "/os": "Developer",
  "/settings": "",
};

function getPageInfo(pathname: string) {
  // Exact match against nav items
  for (const item of ALL_NAV_ITEMS) {
    if (pathname === item.href || pathname.startsWith(item.href + "/")) {
      // Match parent group by first path segment (e.g., /governance/check → /governance)
      const firstSegment = "/" + item.href.split("/").filter(Boolean)[0];
      return {
        label: item.label,
        href: item.href,
        parentLabel: PARENT_GROUPS[firstSegment] || "",
      };
    }
  }

  // Fallback for sub-pages like /agents/xxx, /runs/xxx, /policies/xxx
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length >= 2) {
    const parentPath = "/" + segments[0];
    const parentItem = ALL_NAV_ITEMS.find((i) => i.href === parentPath);
    if (parentItem) {
      return {
        label: segments[1].charAt(0).toUpperCase() + segments[1].slice(1),
        href: pathname,
        parentLabel: parentItem.label,
        parentHref: parentItem.href,
      };
    }
  }

  // Fallback
  const segment = segments[segments.length - 1] || "dashboard";
  return {
    label: segment.charAt(0).toUpperCase() + segment.slice(1),
    href: pathname,
    parentLabel: "",
  };
}

export function Breadcrumb() {
  const pathname = usePathname();

  // Don't show breadcrumbs on the root dashboard page
  if (pathname === "/dashboard" || pathname === "/os") return null;

  const info = getPageInfo(pathname);

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground/60 mb-4">
      <a
        href="/dashboard"
        className="flex items-center gap-1 hover:text-foreground transition-colors"
      >
        <LayoutDashboard className="h-3 w-3" />
        Dashboard
      </a>
      {info.parentLabel && (
        <>
          <ChevronRight className="h-3 w-3" />
          {info.parentHref ? (
            <a
              href={info.parentHref}
              className="hover:text-foreground transition-colors"
            >
              {info.parentLabel}
            </a>
          ) : (
            <span>{info.parentLabel}</span>
          )}
        </>
      )}
      <ChevronRight className="h-3 w-3" />
      {info.href !== pathname ? (
        <a
          href={info.href}
          className="hover:text-foreground transition-colors"
        >
          {info.label}
        </a>
      ) : (
        <span className="text-foreground/80 font-medium truncate max-w-[200px]">
          {info.label}
        </span>
      )}
    </nav>
  );
}
