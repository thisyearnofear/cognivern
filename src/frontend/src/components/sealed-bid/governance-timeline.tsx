"use client";

import { motion } from "motion/react";
import {
  CheckCircle2,
  FileText,
  Gavel,
  ShieldCheck,
  Trophy,
  XCircle,
  Hash,
  Bot,
} from "lucide-react";
import type { GovernanceEvent, GovernanceTimeline } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";

// Event-type → icon + label + accent color. Keeps the timeline visually
// scannable: each event type has a consistent icon and left-border color.
const EVENT_META: Record<
  string,
  { icon: typeof FileText; label: string; border: string; iconColor: string }
> = {
  round_created: {
    icon: FileText,
    label: "Round created",
    border: "border-l-blue-500/60",
    iconColor: "text-blue-500",
  },
  bid_submitted: {
    icon: Gavel,
    label: "Bid submitted",
    border: "border-l-amber-500/60",
    iconColor: "text-amber-500",
  },
  policy_checked: {
    icon: ShieldCheck,
    label: "Policy checked",
    border: "border-l-violet-500/60",
    iconColor: "text-violet-500",
  },
  round_closed: {
    icon: XCircle,
    label: "Round closed",
    border: "border-l-orange-500/60",
    iconColor: "text-orange-500",
  },
  winner_revealed: {
    icon: Trophy,
    label: "Winner revealed",
    border: "border-l-emerald-500/60",
    iconColor: "text-emerald-500",
  },
};

function shortHash(hash: string): string {
  return hash.length > 16 ? `${hash.slice(0, 10)}…${hash.slice(-4)}` : hash;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// Render a single payload field, handling the common shapes from the spec.
function PayloadRow({ k, v }: { k: string; v: unknown }) {
  const label = k
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase());
  let value: string;
  if (v === null || v === undefined) {
    return null;
  } else if (typeof v === "string") {
    // Truncate long hashes / contract IDs.
    value = v.length > 24 ? `${v.slice(0, 12)}…${v.slice(-6)}` : v;
  } else if (typeof v === "number" || typeof v === "boolean") {
    value = String(v);
  } else if (Array.isArray(v)) {
    value = `${v.length} item${v.length === 1 ? "" : "s"}`;
  } else {
    value = JSON.stringify(v);
  }
  return (
    <div className="flex items-baseline gap-2 text-[11px]">
      <span className="text-muted-foreground/70">{label}:</span>
      <span className="font-mono text-foreground/80 truncate">{value}</span>
    </div>
  );
}

function EventCard({ event, index }: { event: GovernanceEvent; index: number }) {
  const meta = EVENT_META[event.eventType] ?? {
    icon: FileText,
    label: event.eventType.replace(/_/g, " "),
    border: "border-l-muted-foreground/40",
    iconColor: "text-muted-foreground",
  };
  const Icon = meta.icon;

  // For policy_checked events, surface allowed + checks prominently.
  const isPolicyCheck = event.eventType === "policy_checked";
  const allowed = event.payload?.allowed as boolean | undefined;
  const checks = event.payload?.checks as
    | { name: string; passed: boolean; detail: string }[]
    | undefined;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, type: "spring", stiffness: 200, damping: 20 }}
      className={`rounded-lg border border-l-4 ${meta.border} bg-card p-3 space-y-2`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className={`h-4 w-4 shrink-0 ${meta.iconColor}`} />
          <span className="text-sm font-medium truncate">{meta.label}</span>
          {isPolicyCheck && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                allowed
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-red-500/10 text-red-600 dark:text-red-400"
              }`}
            >
              {allowed ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <XCircle className="h-3 w-3" />
              )}
              {allowed ? "allowed" : "blocked"}
            </span>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground shrink-0">
          {formatTime(event.timestamp)}
        </span>
      </div>

      {/* Policy check details — the most important payload for judges. */}
      {isPolicyCheck && checks && checks.length > 0 && (
        <div className="space-y-1 pl-6">
          {checks.map((c) => (
            <div key={c.name} className="flex items-start gap-1.5 text-[11px]">
              {c.passed ? (
                <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="h-3 w-3 text-red-500 shrink-0 mt-0.5" />
              )}
              <span className="text-muted-foreground">
                <span className="font-mono text-foreground/70">{c.name}</span>
                {" — "}
                {c.detail}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Generic payload rows for non-policy events. */}
      {!isPolicyCheck &&
        Object.entries(event.payload)
          .filter(([k]) => k !== "checks")
          .slice(0, 4)
          .map(([k, v]) => <PayloadRow key={k} k={k} v={v} />)}

      {/* Tamper-evident hash — the proof property made visible. */}
      <div className="flex items-center gap-1.5 pt-1 border-t border-border/40">
        <Hash className="h-3 w-3 text-muted-foreground/60" />
        <code className="font-mono text-[10px] text-muted-foreground/80">
          {shortHash(event.eventHash)}
        </code>
      </div>
    </motion.div>
  );
}

interface GovernanceTimelineViewProps {
  timeline: GovernanceTimeline | null | undefined;
  isLoading?: boolean;
}

// Tamper-evident governance event timeline for an agent-governed round.
// Renders every CRE run event (round_created → bid_submitted × N →
// policy_checked → round_closed → winner_revealed) in order, each with its
// SHA-256 hash. The hash is computed server-side at record time; a judge
// who wants to verify can re-compute it from the displayed payload + timestamp.
export function GovernanceTimelineView({
  timeline,
  isLoading,
}: GovernanceTimelineViewProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Agent governance timeline</h3>
        </div>
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
      </div>
    );
  }

  if (!timeline || timeline.events.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Agent governance timeline</h3>
        </div>
        <span className="text-[10px] text-muted-foreground">
          run {timeline.runId.slice(0, 12)}… · agent{" "}
          {timeline.agentId.slice(0, 16)}
          {timeline.agentId.length > 16 ? "…" : ""}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Every event in the round&apos;s governance run, hash-signed (SHA-256)
        at record time. Tamper-evident: any modification to a payload, timestamp,
        or runId produces a different hash.
      </p>
      <div className="space-y-2">
        {timeline.events.map((event, i) => (
          <EventCard key={`${event.eventType}-${i}`} event={event} index={i} />
        ))}
      </div>
    </div>
  );
}
