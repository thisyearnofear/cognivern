"use client";

import { useState } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Link as LinkIcon,
  Database,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLedgerIntegrity } from "@/hooks/use-api";
import { useAuthStore } from "@/stores/auth-store";
import { apiClient, type CreLedgerVerifyResponse } from "@/lib/api-client";
import type { CreAnchorStatus } from "@/lib/api-client";

function shortHash(hash: string): string {
  if (!hash) return "—";
  return hash.length > 16 ? `${hash.slice(0, 10)}…${hash.slice(-4)}` : hash;
}

const ANCHOR_STATUS_META: Record<
  CreAnchorStatus,
  { label: string; className: string }
> = {
  verified: {
    label: "verified",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  mismatch: {
    label: "mismatch",
    className: "bg-destructive/10 text-destructive",
  },
  unavailable: {
    label: "unavailable",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  disabled: {
    label: "disabled",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  no_expected_hash: {
    label: "no expected hash",
    className: "bg-muted text-muted-foreground",
  },
  no_retrieval_key: {
    label: "no retrieval key",
    className: "bg-muted text-muted-foreground",
  },
};

function AnchorBadge({
  kind,
  status,
}: {
  kind: "0G" | "Filecoin";
  status: CreAnchorStatus;
}) {
  const meta = ANCHOR_STATUS_META[status];
  return (
    <span className="inline-flex items-center gap-1 text-[11px]">
      <span className="text-muted-foreground/70">{kind}:</span>
      <span
        className={cn(
          "rounded px-1.5 py-0.5 font-medium",
          meta.className,
        )}
      >
        {meta.label}
      </span>
    </span>
  );
}

function SummaryPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "verified" | "mismatch" | "unavailable" | "skipped";
}) {
  const toneClass =
    tone === "verified"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "mismatch" && value > 0
        ? "text-destructive"
        : tone === "unavailable" && value > 0
          ? "text-amber-600 dark:text-amber-400"
          : "text-foreground/80";
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 text-[11px]">
      <span className="text-muted-foreground/70">{label}</span>
      <span className={cn("font-mono font-medium", toneClass)}>{value}</span>
    </span>
  );
}

export function LedgerIntegrityCard() {
  const token = useAuthStore((s) => s.token);
  const { data, isLoading } = useLedgerIntegrity();

  const [deep, setDeep] = useState<CreLedgerVerifyResponse | null>(null);
  const [deepLoading, setDeepLoading] = useState(false);
  const [deepError, setDeepError] = useState<string | null>(null);

  async function runDeep() {
    setDeepLoading(true);
    setDeepError(null);
    try {
      const res = await apiClient.verifyLedger(true);
      if (res.data) {
        setDeep(res.data);
      } else {
        setDeepError(res.error || "Deep verification failed");
      }
    } catch (err) {
      setDeepError(err instanceof Error ? err.message : "Deep verification failed");
    } finally {
      setDeepLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="rounded-lg border border-border bg-muted/20 p-3 text-[11px] text-muted-foreground">
        <span className="font-semibold text-foreground/80">
          Ledger Integrity
        </span>{" "}
        — sign in to independently verify the audit ledger and storage anchors.
      </div>
    );
  }

  const valid = data?.valid ?? true;

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">
            Ledger Integrity
          </span>
          {isLoading && !data ? (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          ) : valid ? (
            <Badge
              variant="secondary"
              className="gap-1 text-[10px] text-emerald-600 dark:text-emerald-400"
            >
              <ShieldCheck className="h-3 w-3" /> Verified
            </Badge>
          ) : (
            <Badge variant="destructive" className="gap-1 text-[10px]">
              <ShieldAlert className="h-3 w-3" /> Tampered
            </Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="xs"
          onClick={runDeep}
          disabled={deepLoading}
        >
          {deepLoading ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" /> Verifying…
            </>
          ) : (
            "Run deep verification"
          )}
        </Button>
      </div>

      {data && (
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <Database className="h-3 w-3 flex-shrink-0 text-teal-500" />
            <span className="text-muted-foreground">Chain:</span>
            <span className="font-mono text-foreground/80">
              {data.chain.entries} entries
            </span>
            <span className="text-muted-foreground/50">·</span>
            <span className="text-muted-foreground">head</span>
            <code className="font-mono text-foreground/70">
              {shortHash(data.chain.headHash)}
            </code>
            {!data.chain.valid && (
              <span className="text-destructive">
                broken @ seq {data.chain.brokenAtSeq}: {data.chain.reason}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <LinkIcon className="h-3 w-3 flex-shrink-0 text-blue-500" />
            <span className="text-muted-foreground">Store:</span>
            <span className="font-mono text-foreground/80">
              {data.store.runs} runs
            </span>
            {data.store.tamperedRuns.length > 0 && (
              <span className="text-destructive">
                tampered: {data.store.tamperedRuns.join(", ")}
              </span>
            )}
            {data.store.unchainedRuns.length > 0 && (
              <span
                className="text-muted-foreground/70"
                title="These runs predate the ledger and are not chained."
              >
                unchained: {data.store.unchainedRuns.length}
              </span>
            )}
          </div>
        </div>
      )}

      {deepError && (
        <div className="text-[11px] text-destructive">{deepError}</div>
      )}

      {deep?.anchorSummary && (
        <div className="space-y-2 border-t border-border/60 pt-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <SummaryPill label="checked" value={deep.anchorSummary.checked} />
            <SummaryPill
              label="verified"
              value={deep.anchorSummary.verified}
              tone="verified"
            />
            <SummaryPill
              label="mismatch"
              value={deep.anchorSummary.mismatch}
              tone="mismatch"
            />
            <SummaryPill
              label="unavailable"
              value={deep.anchorSummary.unavailable}
              tone="unavailable"
            />
            <SummaryPill
              label="skipped"
              value={deep.anchorSummary.skipped}
              tone="skipped"
            />
          </div>

          {deep.anchors && deep.anchors.length > 0 && (
            <div className="space-y-1">
              {deep.anchors.map((a) => (
                <div
                  key={a.runId}
                  className="flex flex-wrap items-center gap-2 text-[11px]"
                >
                  <code className="font-mono text-muted-foreground/70">
                    {shortHash(a.runId)}
                  </code>
                  {a.zeroG && <AnchorBadge kind="0G" status={a.zeroG} />}
                  {a.filecoin && (
                    <AnchorBadge kind="Filecoin" status={a.filecoin} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
