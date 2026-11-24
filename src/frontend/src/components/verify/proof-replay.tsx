"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { PublicProof } from "@cognivern/shared";
import { formatUsd } from "@/lib/budget-format";

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

/**
 * Fade-and-rise reveal on first scroll into view — the shared motion
 * primitive for /verify sections. Reduced-motion users get instant render.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.35, delay }}
      className={className}
    >
      {children}
    </motion.div>
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
  options: { value: T; label: string; changed?: boolean }[];
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
            title={option.changed ? "Governance changed this decision" : undefined}
            onClick={() => onChange(option.value)}
            className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              value === option.value
                ? "border-primary/40 bg-primary/10 text-foreground"
                : "border-border bg-muted/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            {option.changed && (
              <span
                aria-hidden
                className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-500 align-middle"
              />
            )}
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
export function ReceiptRow({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-3">
        <Copyable value={value} />
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            View <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </span>
    </div>
  );
}

const PROOF_KIND_LABELS: Record<PublicProof["kind"], string> = {
  "credit-commitment": "Credit commitment",
  "sealed-bid-round": "Sealed-bid round",
  "diligence-report": "Diligence report",
  "sealed-bid-replay": "Sandbox replay",
};

const RECEIPTS_PREVIEW = 4;

/**
 * The shared proof-envelope header every /verify mode opens with: what was
 * asked, under which mandate, what it cost, what was decided, the receipts,
 * and what the proof does not show. The mode's own detail view below stays
 * the full record.
 */
export function ProofSummary({ proof }: { proof: PublicProof }) {
  const hiddenReceipts = proof.receipts.length - RECEIPTS_PREVIEW;
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-semibold text-foreground">{proof.title}</div>
        <span className="rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          {PROOF_KIND_LABELS[proof.kind]}
        </span>
      </div>

      <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Asked
          </dt>
          <dd className="mt-0.5 text-sm text-foreground">{proof.asked}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Mandate
          </dt>
          <dd className="mt-0.5 text-sm text-foreground">
            {proof.mandate.id || proof.mandate.label ? (
              <>
                {proof.mandate.label}
                {proof.mandate.id && (
                  <span className={proof.mandate.label ? "ml-2" : undefined}>
                    <Copyable value={proof.mandate.id} />
                  </span>
                )}
              </>
            ) : (
              "Not recorded for this proof type"
            )}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Spent
          </dt>
          <dd className="mt-0.5 text-sm text-foreground">
            {proof.spent.usd !== null ? (
              <>
                {formatUsd(proof.spent.usd)}
                {proof.spent.note && (
                  <span className="text-muted-foreground"> · {proof.spent.note}</span>
                )}
              </>
            ) : (
              "No USD figure in this record"
            )}
            {proof.spent.capUsd != null &&
              proof.spent.capUsd > 0 &&
              proof.spent.usd !== null && (
                <span className="mt-1.5 block" title={`Spend cap ${formatUsd(proof.spent.capUsd)}`}>
                  <span className="block h-1.5 w-40 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full bg-primary/70"
                      style={{
                        width: `${Math.min(100, (proof.spent.usd / proof.spent.capUsd) * 100)}%`,
                      }}
                    />
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {Math.round((proof.spent.usd / proof.spent.capUsd) * 100)}% of{" "}
                    {formatUsd(proof.spent.capUsd)} cap
                  </span>
                </span>
              )}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Decided
          </dt>
          <dd className="mt-0.5 text-sm text-foreground">
            <span className="font-medium">{proof.decided.outcome}</span>
            {proof.decided.detail && (
              <span className="text-muted-foreground"> · {proof.decided.detail}</span>
            )}
          </dd>
        </div>
      </dl>

      {proof.receipts.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Receipts
          </div>
          <div className="mt-2 space-y-1.5">
            {proof.receipts.slice(0, RECEIPTS_PREVIEW).map((r, i) => (
              <ReceiptRow key={i} label={r.label} value={r.value} href={r.href} />
            ))}
          </div>
          {hiddenReceipts > 0 && (
            <details className="mt-2 text-xs">
              <summary className="cursor-pointer text-primary">
                Show all {proof.receipts.length}
              </summary>
              <div className="mt-2 space-y-1.5">
                {proof.receipts.slice(RECEIPTS_PREVIEW).map((r, i) => (
                  <ReceiptRow key={i} label={r.label} value={r.value} href={r.href} />
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {proof.limits.length > 0 && (
        <details className="mt-4 border-t border-border pt-3 text-xs">
          <summary className="cursor-pointer text-muted-foreground">
            What this does not show
          </summary>
          <ul className="mt-2 space-y-1.5 text-muted-foreground">
            {proof.limits.map((limit, i) => (
              <li key={i}>{limit}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
