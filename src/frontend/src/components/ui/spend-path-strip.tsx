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
  className,
}: {
  decision?: string;
  custody?: CustodyMode | string | null;
  settlement?: { label: string; href?: string } | null;
  evidence?: string | null;
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
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        Spend path
      </p>
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
