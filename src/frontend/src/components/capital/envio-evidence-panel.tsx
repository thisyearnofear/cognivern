"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ExternalLink,
  Loader2,
  RefreshCw,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";

/**
 * Indexed-evidence panel — shows what the Envio HyperIndex project
 * (indexers/envio) has materialized into CRE artifacts, and lets an operator
 * pull a sync on demand. Chain reads stay off the page; this only reflects
 * what the indexer already saw.
 */

type EnvioStatus = {
  enabled: boolean;
  configured: boolean;
  graphqlUrl: string | null;
  lastSyncAt: string | null;
  counts: { settlement: number; identity: number; feedback: number };
};

type IndexedEvent = {
  kind: "settlement" | "identity" | "feedback";
  id: string;
  chainId: number;
  txHash: string;
  blockNumber: number;
  summary: string;
  linkedRunId?: string;
  transactionLink: string;
  indexedAt: string;
};

const KIND_LABEL: Record<IndexedEvent["kind"], string> = {
  settlement: "settlement",
  identity: "identity",
  feedback: "reputation",
};

export function EnvioEvidencePanel() {
  const [status, setStatus] = useState<EnvioStatus | null>(null);
  const [events, setEvents] = useState<IndexedEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [statusRes, eventsRes] = await Promise.all([
      apiClient.getEnvioStatus(),
      apiClient.listEnvioEvents(10),
    ]);
    if (statusRes.success && statusRes.data) setStatus(statusRes.data);
    if (eventsRes.success && eventsRes.data) setEvents(eventsRes.data);
  }, []);

  useEffect(() => {
    // Defer so the effect body doesn't synchronously setState on mount
    // (react-hooks/set-state-in-effect).
    const id = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(id);
  }, [refresh]);

  const handleSync = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiClient.syncEnvio();
      if (!res.success) {
        setError(res.error || "Sync failed.");
        return;
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  // Quiet empty state when the indexer is off — disclosure still explains the rail.
  if (status && !status.enabled) {
    return (
      <p className="text-xs text-muted-foreground">
        Indexer not enabled. Set <code className="font-mono">ENVIO_ENABLED=true</code>{" "}
        and <code className="font-mono">ENVIO_GRAPHQL_URL</code> to materialize
        settlement evidence here.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-3">
        <Button
          size="sm"
          variant="outline"
          onClick={() => void handleSync()}
          disabled={busy || !status?.enabled}
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Sync indexer
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {status && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>
            {status.counts.settlement} settlements · {status.counts.identity}{" "}
            registrations · {status.counts.feedback} feedback
          </span>
          {status.lastSyncAt && (
            <span>
              last sync {new Date(status.lastSyncAt).toLocaleString()}
            </span>
          )}
        </div>
      )}

      {!status && (
        <p className="text-xs text-muted-foreground">Loading indexer status…</p>
      )}

      {events.length > 0 && (
        <div className="divide-y rounded-lg border">
          {events.map((ev) => (
            <div
              key={ev.id}
              className="flex items-center justify-between gap-3 px-3 py-2"
            >
              <div className="min-w-0">
                <div className="text-xs truncate">{ev.summary}</div>
                <div className="text-[10px] text-muted-foreground">
                  chain {ev.chainId} · block {ev.blockNumber}
                  {ev.linkedRunId ? " · linked to run" : ""}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline">{KIND_LABEL[ev.kind]}</Badge>
                <a
                  href={ev.transactionLink}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="View transaction"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
