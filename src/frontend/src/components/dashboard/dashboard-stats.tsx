'use client';

import {
  Users,
  Percent,
  ShieldCheck,
  ShieldX,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { ApprovalSparkline } from './approval-sparkline';
import type { AuditLog } from '@cognivern/shared';

interface DashboardStatsProps {
  loading: boolean;
  activeCount: number;
  totalIdentities: number;
  approvalRate: number;
  approvalDelta: number;
  blockedCount: number;
  heldCount: number;
  approvedCount: number;
  decisions: number;
  logs: AuditLog[];
}

/**
 * The three-KPI operational strip: active identities, approval rate, and
 * stopped decisions. Values render immediately with tabular-nums — posture
 * should never wait on a mount animation — and a thin decision-mix bar below
 * the strip shows the approved/held/stopped proportion at a glance.
 */
export function DashboardStats({
  loading,
  activeCount,
  totalIdentities,
  approvalRate,
  approvalDelta,
  blockedCount,
  heldCount,
  approvedCount,
  decisions,
  logs,
}: DashboardStatsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-[72px] rounded-xl bg-card border border-border animate-pulse"
          />
        ))}
      </div>
    );
  }

  const mixTotal = approvedCount + heldCount + blockedCount;

  return (
    <div className="rounded-xl overflow-hidden border border-border bg-border">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-px">
        <div className="bg-card p-5 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950 flex-shrink-0">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div
              className="text-2xl font-bold tabular-nums"
              style={{ fontFamily: 'var(--font-space-grotesk)' }}
            >
              {activeCount}/{totalIdentities}
            </div>
            <div className="text-xs text-muted-foreground">Active identities</div>
          </div>
        </div>

        <div className="bg-card p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950 flex-shrink-0">
              <Percent className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className="text-2xl font-bold tabular-nums"
                  style={{ fontFamily: 'var(--font-space-grotesk)' }}
                >
                  {approvalRate}%
                </span>
                {approvalDelta !== 0 && (
                  <span
                    className={`flex items-center text-[11px] font-medium tabular-nums ${
                      approvalDelta > 0 ? 'text-emerald-600' : 'text-red-500'
                    }`}
                  >
                    {approvalDelta > 0 ? (
                      <TrendingUp className="h-3 w-3 mr-0.5" />
                    ) : (
                      <TrendingDown className="h-3 w-3 mr-0.5" />
                    )}
                    {approvalDelta > 0 ? '+' : ''}
                    {approvalDelta}%
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">Approval Rate</div>
            </div>
          </div>
          <ApprovalSparkline logs={logs} />
        </div>

        <div className="bg-card p-5 flex items-center gap-3">
          <div
            className={`p-2 rounded-lg flex-shrink-0 ${blockedCount > 0 ? 'bg-red-50 dark:bg-red-950' : 'bg-emerald-50 dark:bg-emerald-950'}`}
          >
            {blockedCount > 0 ? (
              <ShieldX className="h-5 w-5 text-red-500" />
            ) : (
              <ShieldCheck className="h-5 w-5 text-emerald-500" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span
                className="text-2xl font-bold tabular-nums"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                {blockedCount}
              </span>
              <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
                {decisions} total
              </span>
            </div>
            <div className="text-xs text-muted-foreground">Stopped decisions</div>
          </div>
        </div>
      </div>

      {/* Decision-mix proportion bar: emerald approved / amber held / crimson
          stopped, computed from the same decision outcomes as the KPIs. */}
      {mixTotal > 0 && (
        <div
          className="flex h-1.5 w-full bg-card"
          role="img"
          aria-label={`Decision mix: ${approvedCount} approved, ${heldCount} held, ${blockedCount} stopped`}
        >
          {approvedCount > 0 && (
            <div
              className="h-full bg-emerald-500/80"
              style={{ width: `${(approvedCount / mixTotal) * 100}%` }}
            />
          )}
          {heldCount > 0 && (
            <div
              className="h-full bg-amber-500/80"
              style={{ width: `${(heldCount / mixTotal) * 100}%` }}
            />
          )}
          {blockedCount > 0 && (
            <div
              className="h-full bg-red-500/80"
              style={{ width: `${(blockedCount / mixTotal) * 100}%` }}
            />
          )}
        </div>
      )}
    </div>
  );
}
