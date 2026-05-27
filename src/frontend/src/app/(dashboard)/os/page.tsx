"use client";

import { Suspense } from "react";
import { OsShell } from "@/components/os/os-shell";

export default function OsPage() {
  return (
    <Suspense fallback={<OsBootFallback />}>
      <OsShell />
    </Suspense>
  );
}

function OsBootFallback() {
  return (
    <div className="h-full w-full bg-[#0a0a0a] flex items-center justify-center">
      <div className="font-mono text-green-500 text-sm animate-pulse">
        cognivern os: loading kernel...
      </div>
    </div>
  );
}
