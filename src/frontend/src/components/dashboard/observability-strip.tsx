'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Radar } from 'lucide-react';

/**
 * One-line observability status strip linking to the Tracing page. Reports
 * whether the OTLP endpoint is configured and reachable so operators know if
 * governance decisions can be traced end-to-end before opening the dashboards.
 */
export function ObservabilityStrip({ onClick }: { onClick: () => void }) {
  const [otelStatus, setOtelStatus] = useState<{
    enabled: boolean;
    reachable: boolean | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/observability/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled) return;
        if (json?.data) {
          setOtelStatus({
            enabled: json.data.enabled,
            reachable: json.data.reachable,
          });
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const tracingLive = otelStatus?.enabled && otelStatus?.reachable === true;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-left hover:border-emerald-500/40 transition-colors"
    >
      <Radar
        className={`h-4 w-4 shrink-0 ${tracingLive ? 'text-emerald-500' : 'text-muted-foreground'}`}
      />
      <span className="text-sm text-foreground/80">
        {loading ? (
          <span className="font-semibold text-foreground">Agent observability</span>
        ) : (
          <>
            <span className="font-semibold text-foreground">Agent observability</span>{' '}
            {tracingLive
              ? '— OTLP endpoint reachable; open Tracing to confirm queryable data'
              : otelStatus?.enabled
                ? '— telemetry configured but endpoint unreachable'
                : '— configure SigNoz to trace governance decisions end-to-end'}
          </>
        )}
      </span>
      <ArrowRight className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
    </button>
  );
}
