"use client";

import { custodyLabel, type CustodyMode } from "@cognivern/shared";
import { cn } from "@/lib/utils";

export interface SpendPathStep {
  key: string;
  label: string;
  detail?: string;
  href?: string;
}

type NodeTone = "emerald" | "amber" | "red" | "sky" | "muted";

const TONE_DOT: Record<NodeTone, string> = {
  emerald: "border-emerald-500 bg-emerald-500",
  amber: "border-amber-500 bg-amber-500",
  red: "border-red-500 bg-red-500",
  sky: "border-sky-500 bg-sky-500",
  muted: "border-muted-foreground/40 bg-transparent",
};

/** Semantic dot color for the policy node follows the decision verdict. */
function policyTone(decision?: string): NodeTone {
  if (!decision || decision === "—") return "muted";
  const d = decision.toLowerCase();
  if (d.includes("denied") || d.includes("stop") || d.includes("fail")) return "red";
  if (d.includes("held") || d.includes("pause") || d.includes("review") || d.includes("running")) return "amber";
  return "emerald";
}

/**
 * Compact narrative for a governed spend as a connected node-and-wire rail:
 * Policy → Custody → Settlement → Evidence, with semantic status dots
 * instead of boxed tiles and ASCII arrows.
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

  const nodes: Array<SpendPathStep & { tone: NodeTone }> = [
    {
      key: "policy",
      label: "Policy",
      detail: decision || "—",
      tone: policyTone(decision),
    },
    {
      key: "custody",
      label: "Custody",
      detail: custodyText,
      tone: custody && custodyText !== "—" ? "sky" : "muted",
    },
    {
      key: "settlement",
      label: "Settlement",
      detail: settlement?.label || "—",
      href: settlement?.href,
      tone: settlement ? "sky" : "muted",
    },
    {
      key: "evidence",
      label: "Evidence",
      detail: evidence || "CRE",
      tone: "emerald",
    },
  ];

  return (
    <div
      className={`rounded-xl border bg-card px-4 py-3 ${className ?? ""}`}
      aria-label="Spend path"
    >
      <div className="mb-2.5 flex items-center justify-between gap-2">
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
      <ol className="flex items-start">
        {nodes.map((node, index) => (
          <li key={node.key} className="flex min-w-0 flex-1 items-start last:flex-none">
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className={cn("h-2.5 w-2.5 shrink-0 rounded-full border-2", TONE_DOT[node.tone])}
                />
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {node.label}
                </span>
              </div>
              {node.href ? (
                <a
                  href={node.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block max-w-full truncate pl-4 text-xs font-medium underline underline-offset-2"
                >
                  {node.detail}
                </a>
              ) : (
                <span className="block max-w-full truncate pl-4 text-xs font-medium">
                  {node.detail}
                </span>
              )}
            </div>
            {index < nodes.length - 1 && (
              <span
                aria-hidden="true"
                className="mx-2 mt-[5px] h-px min-w-3 flex-1 bg-border"
              />
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
