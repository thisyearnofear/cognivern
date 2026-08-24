'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Users,
  Percent,
  ShieldCheck,
  ShieldX,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { ApprovalSparkline } from './approval-sparkline';
import { useCountUp } from '@/hooks/use-count-up';
import type { AuditLog } from '@cognivern/shared';

interface DashboardStatsProps {
  loading: boolean;
  activeCount: number;
  totalIdentities: number;
  approvalRate: number;
  approvalDelta: number;
  blockedCount: number;
  decisions: number;
  logs: AuditLog[];
}

/**
 * The three-KPI operational strip: active identities, approval rate, and
 * stopped decisions. Self-contained — it owns the intersection observer and
 * count-up animations so the parent only supplies raw values.
 */
export function DashboardStats({
  loading,
  activeCount,
  totalIdentities,
  approvalRate,
  approvalDelta,
  blockedCount,
  decisions,
  logs,
}: DashboardStatsProps) {
  const statsRef = useRef<HTMLDivElement>(null);
  const [statsVisible, setStatsVisible] = useState(false);

  useEffect(() => {
    if (!statsRef.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setStatsVisible(true);
      },
      { threshold: 0.3 },
    );
    obs.observe(statsRef.current);
    return () => obs.disconnect();
  }, []);

  const animatedApprovalRate = useCountUp(approvalRate, 2000, statsVisible);
  const animatedBlocked = useCountUp(blockedCount, 2000, statsVisible);
  const animatedActive = useCountUp(activeCount, 2000, statsVisible);

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

  return (
    <div ref={statsRef}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-border rounded-xl overflow-hidden">
        <div className="bg-card p-5 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950 flex-shrink-0">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div
              className="text-2xl font-bold"
              style={{ fontFamily: 'var(--font-space-grotesk)' }}
            >
              {statsVisible ? `${animatedActive}/${totalIdentities}` : '—'}
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
                  className="text-2xl font-bold"
                  style={{ fontFamily: 'var(--font-space-grotesk)' }}
                >
                  {statsVisible ? `${animatedApprovalRate}%` : '—'}
                </span>
                {approvalDelta !== 0 && (
                  <span
                    className={`flex items-center text-[11px] font-medium ${
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
                className="text-2xl font-bold"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                {statsVisible ? animatedBlocked : '—'}
              </span>
              <span className="text-[11px] font-medium text-muted-foreground">
                {decisions} total
              </span>
            </div>
            <div className="text-xs text-muted-foreground">Stopped decisions</div>
          </div>
        </div>
      </div>
    </div>
  );
}
