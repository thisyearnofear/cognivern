'use client';

import { Badge } from '@/components/ui/badge';
import { Layers } from 'lucide-react';
import { RAILS, type RailDescriptor, type RailStatus } from '@cognivern/shared';

const roleFor = (r: RailDescriptor): string => {
  switch (r.plane) {
    case 'settlement':
      return 'Settlement';
    case 'execution':
      return 'Execution';
    case 'evidence':
      return 'Evidence';
    case 'decision':
      return 'Confidential Compute';
    default:
      return r.plane;
  }
};

const statusDot = (s: RailStatus): string => {
  switch (s) {
    case 'live':
      return 'bg-emerald-500';
    case 'configured':
      return 'bg-amber-500';
    case 'planned':
      return 'bg-slate-300 dark:bg-slate-600';
  }
};

const statusBadge = (s: RailStatus) => {
  switch (s) {
    case 'live':
      return 'default' as const;
    case 'configured':
      return 'secondary' as const;
    case 'planned':
      return 'outline' as const;
  }
};

/**
 * Collapsed third-layer view of configured rails and their capabilities.
 * Status is as configured in the rail registry (live / configured / planned),
 * not runtime health, so it surfaces capability without exposing probes.
 */
export function RailCapabilities() {
  const rows = [...RAILS].sort((a, b) => {
    const rank = (s: RailStatus) => (s === 'live' ? 0 : s === 'configured' ? 1 : 2);
    return (
      rank(a.status) - rank(b.status) ||
      a.plane.localeCompare(b.plane) ||
      a.displayName.localeCompare(b.displayName)
    );
  });

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <h2
        className="font-semibold flex items-center gap-2"
        style={{ fontFamily: 'var(--font-space-grotesk)' }}
      >
        <Layers className="h-4 w-4 text-sky-500" />
        Rail capabilities
      </h2>
      <p className="text-xs text-muted-foreground">
        Settlement, execution, evidence, and confidential compute rails available to this
        workspace. Status is as configured, not runtime health.
      </p>
      <div className="space-y-2">
        {rows.map((rail) => (
          <div
            key={rail.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2 border-b last:border-0"
          >
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${statusDot(rail.status)}`} />
              <span className="text-sm font-medium">{rail.displayName}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">{roleFor(rail)}</span>
              <Badge variant={statusBadge(rail.status)} className="text-[10px]">
                {rail.status}
              </Badge>
              {rail.capabilities.map((cap) => (
                <Badge key={cap} variant="outline" className="text-[10px] font-normal capitalize">
                  {cap.replace(/_/g, ' ')}
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
