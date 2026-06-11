"use client";

import { AlertTriangle, RefreshCw, Shield } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col items-center justify-center gap-6 p-6 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-50">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Shield className="h-6 w-6 text-sky-500" />
          Cognivern
        </div>
        <div className="p-4 rounded-full bg-red-50 dark:bg-red-950/30">
          <AlertTriangle className="h-10 w-10 text-red-500" />
        </div>
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--font-space-grotesk)" }}>
            Something went wrong
          </h1>
          <p className="text-stone-500 max-w-md">
            {error?.message || "An unexpected error occurred"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Try again
        </button>
      </body>
    </html>
  );
}
