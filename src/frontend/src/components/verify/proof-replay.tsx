"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/**
 * Shared primitives for the /verify "replay" surfaces — the controls and
 * receipt lines every public proof mode uses. Small, dumb components; the
 * mode components own state.
 */

/** Copy-to-clipboard hash/id row (moved out of verify-client/round-verify). */
export function Copyable({
  value,
  truncate = true,
}: {
  value: string;
  truncate?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-xs">
      <span title={value}>
        {truncate ? `${value.slice(0, 12)}…${value.slice(-8)}` : value}
      </span>
      <button
        type="button"
        aria-label="Copy"
        className="text-muted-foreground hover:text-foreground"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* clipboard unavailable */
          }
        }}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
    </span>
  );
}

/** A labelled group of mutually exclusive buttons; wraps on small screens. */
export function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div role="group" aria-label={label} className="mt-1.5 flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              value === option.value
                ? "border-primary/40 bg-primary/10 text-foreground"
                : "border-border bg-muted/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Polite live-region one-liner summarising the current replay state. */
export function ReplayStatus({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="status"
      aria-live="polite"
      className="text-sm text-muted-foreground"
    >
      {children}
    </p>
  );
}

/** One labelled receipt line with a copyable hash/id. */
export function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <Copyable value={value} />
    </div>
  );
}
