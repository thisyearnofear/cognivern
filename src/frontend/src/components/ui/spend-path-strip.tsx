"use client";

import { custodyLabel, type CustodyMode } from "@cognivern/shared";

export interface SpendPathStep {
  key: string;
  label: string;
  detail?: string;
  href?: string;
}

/**
 * Compact narrative for a governed spend:
 * Policy → Custody → Settlement → Evidence
 */
export function SpendPathStrip({
  decision,
  custody,
  settlement,
  evidence,
  movesFunds,
  className,
}: {
  decision?: string;
  custody?: CustodyMode | string | null;
  settlement?: { label: string; href?: string } | null;
  evidence?: string | null;
  /** Explicit funds-move flag; renders a funder-readable badge. */
  movesFunds?: boolean | null;
  className?: string;
}) {
  const custodyText =
    typeof custody === "string" &&
    ["vault", "managed_mpc", "hosted_execution", "verified_settlement", "custom"].includes(
      custody,
    )
      ? custodyLabel(custody as CustodyMode)
      : custody || "—";

  const steps: SpendPathStep[] = [
    {
      key: "policy",
      label: "Policy",
      detail: decision || "—",
    },
    {
      key: "custody",
      label: "Custody",
      detail: custodyText,
    },
    {
      key: "settlement",
      label: "Settlement",
      detail: settlement?.label || "—",
      href: settlement?.href,
    },
    {
      key: "evidence",
      label: "Evidence",
      detail: evidence || "CRE",
    },
  ];

  return (
    <div
      className={`rounded-xl border bg-card px-4 py-3 ${className ?? ""}`}
      aria-label="Spend path"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Spend path
        </p>
        {movesFunds !== undefined && movesFunds !== null && (
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              movesFunds
                ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
            }`}
          >
            {movesFunds ? "Moves funds" : "No funds move"}
          </span>
        )}
      </div>
      <ol className="flex flex-wrap items-stretch gap-1 sm:gap-0">
        {steps.map((step, index) => (
          <li
            key={step.key}
            className="flex items-center gap-1 sm:gap-2 min-w-0 flex-1 basis-[40%] sm:basis-0"
          >
            <div className="min-w-0 flex-1 rounded-md bg-muted/50 px-2.5 py-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {step.label}
              </div>
              {step.href ? (
                <a
                  href={step.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium truncate block underline underline-offset-2"
                >
                  {step.detail}
                </a>
              ) : (
                <div className="text-xs font-medium truncate">{step.detail}</div>
              )}
            </div>
            {index < steps.length - 1 && (
              <span
                className="hidden sm:inline text-muted-foreground/60 px-0.5 shrink-0"
                aria-hidden
              >
                →
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
