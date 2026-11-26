"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Copy } from "lucide-react";
import { SegmentedControl } from "@/components/primitives/segmented-control";
import { BoundaryBar } from "@/components/primitives/boundary-bar";
import { SealedEnvelope } from "@/components/primitives/sealed-envelope";
import { MOTION_DURATION, MOTION_EASE } from "@/lib/motion-tokens";

/**
 * Canonical public API origin for user-facing snippets (curl examples,
 * copy buttons, docs links). The frontend itself proxies /api/* through
 * Next.js rewrites, but external developers calling from their terminal
 * hit the backend directly — so display strings must point here, not at
 * the Vercel origin or the dead api.cognivern.xyz hostname.
 */
const PUBLIC_API_ORIGIN = "https://api.cognivern.persidian.com";

export type UseCaseKey = "payments" | "procurement" | "ops" | "treasury";

export interface UseCase {
  key: UseCaseKey;
  tab: string;
  /** One line — the visual primitive carries the rest. */
  description: string;
  /** Action payload merged into the shared evaluate call. */
  payload: { type: string; amount: number; currency: string; note: string };
  /** Compact illustrative verdict for that payload. */
  verdict: { decision: "approved" | "held" | "denied"; reasoning: string };
}

export const USE_CASES: UseCase[] = [
  {
    key: "payments",
    tab: "Payments",
    description: "Per-payment limits, approved recipients, unusual requests held for review.",
    payload: { type: "spend", amount: 50, currency: "USDC", note: "pay-approved-vendor" },
    verdict: { decision: "approved", reasoning: "Under $100 auto-approval threshold" },
  },
  {
    key: "procurement",
    tab: "Procurement",
    description: "Confidential vendor selection — competing bids stay sealed until reveal.",
    payload: { type: "spend", amount: 12000, currency: "USDC", note: "vendor-contract-award" },
    verdict: { decision: "held", reasoning: "At or above the $100 review threshold" },
  },
  {
    key: "ops",
    tab: "Ops",
    description: "Routine work proceeds automatically; sensitive changes require the right review.",
    payload: { type: "spend", amount: 80, currency: "USDC", note: "customer-plan-upgrade" },
    verdict: { decision: "approved", reasoning: "Within the agent's limit" },
  },
  {
    key: "treasury",
    tab: "Treasury",
    description: "Strict rules on transfers and treasury moves — without slowing routine work.",
    payload: { type: "spend", amount: 3500, currency: "USDC", note: "transfer-new-protocol" },
    verdict: { decision: "denied", reasoning: "Over the $3000 hard limit" },
  },
];

export function curlForUseCase(uc: UseCase): string {
  return `# Evaluate a spend against the active policy
# Replace $KEY with your workspace API key (x-api-key header)
curl -X POST ${PUBLIC_API_ORIGIN}/api/governance/evaluate \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: $KEY" \\
  -d '{
    "agentId": "demo",
    "action": {
      "type": "${uc.payload.type}",
      "amount": ${uc.payload.amount},
      "currency": "${uc.payload.currency}",
      "note": "${uc.payload.note}"
    }
  }'`;
}

export function verdictJsonForUseCase(uc: UseCase): string {
  return `{
  "allowed": ${uc.verdict.decision === "approved"},
  "decision": "${uc.verdict.decision}",
  "reasoning": "${uc.verdict.reasoning}",
  "auditLogId": "log-demo-…"
}`;
}

/* ─── Mini visual per use case ──────────────────────────────── */

function PaymentsMini() {
  return (
    <div>
      <p className="font-mono text-[11px] tabular-nums text-muted-foreground">Pay a new supplier · 500 USDC</p>
      <BoundaryBar className="mt-3" approveLimit={100} hardLimit={3000} maxDisplay={5000} value={500} compact />
      <p className="mt-2 text-[11px] font-medium text-amber-600 dark:text-amber-400">held for review</p>
    </div>
  );
}

function ProcurementMini() {
  return (
    <div className="grid grid-cols-3 gap-2">
      <SealedEnvelope state="redacted" bidder="Vendor A" className="scale-100" />
      <SealedEnvelope state="redacted" bidder="Vendor B" />
      <SealedEnvelope state="open" bidder="Vendor C" amountUsd={11400} tag="winner" />
    </div>
  );
}

function OpsMini() {
  return (
    <div>
      <p className="font-mono text-[11px] tabular-nums text-muted-foreground">Upgrade a customer plan · 80 USDC</p>
      <BoundaryBar className="mt-3" approveLimit={100} hardLimit={3000} maxDisplay={5000} value={80} compact />
      <p className="mt-2 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">approved within the agent&rsquo;s limit</p>
    </div>
  );
}

function TreasuryMini() {
  return (
    <div>
      <p className="font-mono text-[11px] tabular-nums text-muted-foreground">Move $2,000 to a new protocol</p>
      <BoundaryBar className="mt-3" approveLimit={100} hardLimit={1500} maxDisplay={3000} value={2000} compact />
      <p className="mt-2 text-[11px] font-medium text-red-600 dark:text-red-400">blocked by policy</p>
    </div>
  );
}

const MINIS: Record<UseCaseKey, () => React.JSX.Element> = {
  payments: PaymentsMini,
  procurement: ProcurementMini,
  ops: OpsMini,
  treasury: TreasuryMini,
};

/**
 * Band 4 — developer API and use-case switcher merged into one split
 * showcase: the tab swaps the mini artifact on the left and the curl +
 * verdict on the right in sync.
 */
export function UseCaseApi() {
  const [activeKey, setActiveKey] = useState<UseCaseKey>("payments");
  const [copyFeedback, setCopyFeedback] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduceMotion = useReducedMotion();

  const uc = USE_CASES.find((u) => u.key === activeKey) ?? USE_CASES[0];
  const Mini = MINIS[uc.key];
  const curl = curlForUseCase(uc);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const handleCopyCurl = () => {
    navigator.clipboard.writeText(curl);
    setCopyFeedback(true);
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => setCopyFeedback(false), 2000);
  };

  return (
    <section id="use-cases" className="border-t border-border bg-muted/30 scroll-mt-24">
      <div className="max-w-5xl mx-auto px-6 py-20">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <span
            className="text-xs font-semibold text-primary uppercase tracking-widest"
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
            Use cases &amp; API
          </span>
          <h2
            className="text-3xl font-bold text-foreground mt-3"
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
            Delegate the work you already understand
          </h2>
          <p className="text-muted-foreground mt-3 max-w-md mx-auto text-sm">
            One check before any consequential action — for builders, ops, and finance teams.
          </p>
        </motion.div>

        <div className="mb-6 flex justify-center">
          <SegmentedControl
            id="landing-usecases"
            label="Use case"
            options={USE_CASES.map((u) => ({ value: u.key, label: u.tab }))}
            value={activeKey}
            onChange={setActiveKey}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Left: mini visual artifact */}
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={uc.key}
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: MOTION_DURATION.fast, ease: MOTION_EASE.out }}
                className="p-5"
              >
                <Mini />
                <p className="mt-4 border-t border-border pt-3 text-sm text-muted-foreground">
                  {uc.description}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Right: synced curl + verdict */}
          <div id="api" className="scroll-mt-24">
            <div className="rounded-xl border border-border bg-[#0A0A0A] dark:bg-black overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
                <span className="text-[11px] text-white/40 font-medium">bash</span>
                <button
                  onClick={handleCopyCurl}
                  aria-label="Copy curl command"
                  className="relative flex h-5 min-w-5 items-center justify-end text-white/40 hover:text-white/80 transition-colors"
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {copyFeedback ? (
                      <motion.span
                        key="copied"
                        initial={reduceMotion ? false : { opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={reduceMotion ? undefined : { opacity: 0, scale: 0.8 }}
                        transition={{ duration: MOTION_DURATION.micro }}
                        className="text-emerald-400 text-xs"
                      >
                        Copied!
                      </motion.span>
                    ) : (
                      <motion.span
                        key="copy"
                        initial={reduceMotion ? false : { opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={reduceMotion ? undefined : { opacity: 0, scale: 0.8 }}
                        transition={{ duration: MOTION_DURATION.micro }}
                        className="flex items-center"
                      >
                        <Copy size={14} />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
              </div>
              <pre
                className="p-4 text-xs leading-relaxed text-white/80 overflow-x-auto"
                style={{ fontFamily: "var(--font-jetbrains-mono, var(--font-geist-mono))" }}
              >
                {curl}
              </pre>
            </div>

            <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5">
              <div className="text-[11px] text-emerald-500 font-semibold mb-1.5">
                Illustrative response — {uc.verdict.decision}:
              </div>
              <pre
                className="text-[11px] text-foreground/70 leading-relaxed overflow-x-auto"
                style={{ fontFamily: "var(--font-jetbrains-mono, var(--font-geist-mono))" }}
              >
                {verdictJsonForUseCase(uc)}
              </pre>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Purchased evidence, public receipts:{" "}
          <Link
            href="/verify?report=supplier-diligence"
            className="text-primary hover:underline"
          >
            inspect a governed run — no login →
          </Link>{" "}
          ·{" "}
          <a
            href="https://github.com/thisyearnofear/cognivern/blob/main/docs/DEV.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            architecture →
          </a>
        </p>
      </div>
    </section>
  );
}
