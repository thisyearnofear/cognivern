'use client';

import { Clock, FileSearch, ShieldCheck, XCircle } from 'lucide-react';

interface AuditMetricsProps {
  loading: boolean;
  total: number;
  compliance: number;
  avgLatency: number | string;
  critical: number;
}

/**
 * The audit page's four-metric strip: total actions, compliance rate, average
 * response, and critical issues. Renders skeleton cells while loading and
 * nothing on error (the page-level error state covers that case).
 */
export function AuditMetrics({ loading, total, compliance, avgLatency, critical }: AuditMetricsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-[72px] rounded-xl border border-border animate-pulse bg-card"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border rounded-xl overflow-hidden">
      <div className="bg-card p-4 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950 flex-shrink-0">
          <FileSearch className="h-5 w-5 text-primary" />
        </div>
        <div>
          <div
            className="text-2xl font-bold"
            style={{ fontFamily: 'var(--font-space-grotesk)' }}
          >
            {total}
          </div>
          <div className="text-xs text-muted-foreground">Total Actions</div>
        </div>
      </div>
      <div className="bg-card p-4 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950 flex-shrink-0">
          <ShieldCheck className="h-5 w-5 text-emerald-500" />
        </div>
        <div>
          <div
            className="text-2xl font-bold"
            style={{ fontFamily: 'var(--font-space-grotesk)' }}
          >
            {compliance}%
          </div>
          <div className="text-xs text-muted-foreground">Compliance Rate</div>
        </div>
      </div>
      <div className="bg-card p-4 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950 flex-shrink-0">
          <Clock className="h-5 w-5 text-slate-500" />
        </div>
        <div>
          <div
            className="text-2xl font-bold"
            style={{ fontFamily: 'var(--font-space-grotesk)' }}
          >
            {avgLatency}ms
          </div>
          <div className="text-xs text-muted-foreground">Avg Response</div>
        </div>
      </div>
      <div className="bg-card p-4 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950 flex-shrink-0">
          <XCircle className="h-5 w-5 text-red-500" />
        </div>
        <div>
          <div
            className="text-2xl font-bold"
            style={{ fontFamily: 'var(--font-space-grotesk)' }}
          >
            {critical}
          </div>
          <div className="text-xs text-muted-foreground">Critical Issues</div>
        </div>
      </div>
    </div>
  );
}
