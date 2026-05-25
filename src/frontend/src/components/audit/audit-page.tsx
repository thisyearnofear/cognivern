'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, XCircle, Clock, FileSearch } from 'lucide-react';
import { useAuditLogs } from '@/hooks/use-api';

export function AuditPage() {
  const { data: rawLogs, isLoading, error } = useAuditLogs();

  const logs = Array.isArray(rawLogs)
    ? rawLogs.map((l) => ({
        id: l.id,
        agent: l.agent,
        action: l.actionType,
        desc: l.description,
        decision: l.outcome ?? l.complianceStatus,
        chain: l.chain ?? '—',
        time: new Date(l.timestamp).toLocaleString(),
        latency: l.responseTime ?? l.latency ?? '—',
      }))
    : [];

  const total = logs.length;
  const isRejected = (d: string) => d === 'denied' || d === 'non-compliant';
  const compliance =
    total > 0 ? Math.round((logs.filter((l) => !isRejected(l.decision)).length / total) * 100) : 0;
  const avgLatency =
    total > 0 ? Math.round(logs.reduce((s, l) => s + (parseFloat(l.latency) || 0), 0) / total) : 0;
  const critical = logs.filter((l) => isRejected(l.decision)).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit Logs</h1>
        <p className="text-sm text-muted-foreground mt-1">Complete governance audit trail</p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {isLoading ? (
          [1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-12 w-24" />
              </CardContent>
            </Card>
          ))
        ) : error ? (
          <div className="col-span-4 p-8 text-center text-muted-foreground border rounded-xl">
            <p>Failed to load audit logs</p>
            <p className="text-xs mt-1">The backend may be unavailable</p>
          </div>
        ) : (
          <>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{total}</div>
                <div className="text-xs text-muted-foreground">Total Actions</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{compliance}%</div>
                <div className="text-xs text-muted-foreground">Compliance Rate</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{avgLatency}ms</div>
                <div className="text-xs text-muted-foreground">Avg Response</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{critical}</div>
                <div className="text-xs text-muted-foreground">Critical Issues</div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Log Timeline */}
      {!error && logs.length === 0 && !isLoading ? (
        <div className="p-12 text-center text-muted-foreground border rounded-xl">
          <FileSearch className="h-8 w-8 mx-auto mb-3 opacity-50" />
          <p className="font-medium">No audit logs yet</p>
          <p className="text-sm mt-1">Activity will appear here as agents execute spends</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors"
            >
              <div
                className={`p-2 rounded-lg flex-shrink-0 ${
                  log.decision === 'allowed' || log.decision === 'compliant'
                    ? 'bg-emerald-100 dark:bg-emerald-950'
                    : log.decision === 'denied' || log.decision === 'non-compliant'
                      ? 'bg-red-100 dark:bg-red-950'
                      : 'bg-amber-100 dark:bg-amber-950'
                }`}
              >
                {log.decision === 'allowed' || log.decision === 'compliant' ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : log.decision === 'denied' || log.decision === 'non-compliant' ? (
                  <XCircle className="h-4 w-4 text-red-600" />
                ) : (
                  <Clock className="h-4 w-4 text-amber-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{log.agent}</span>
                  <Badge variant="outline" className="text-xs">
                    {log.action}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{log.chain}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{log.desc}</div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <Badge
                  variant={
                    log.decision === 'allowed' || log.decision === 'compliant'
                      ? 'secondary'
                      : log.decision === 'denied' || log.decision === 'non-compliant'
                        ? 'destructive'
                        : 'outline'
                  }
                >
                  {log.decision}
                </Badge>
                <span className="text-xs text-muted-foreground w-12 text-right font-mono">
                  {log.latency}
                </span>
                <span className="text-xs text-muted-foreground w-24 text-right">{log.time}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
