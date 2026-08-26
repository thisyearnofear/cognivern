'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  Activity,
  FileSearch,
  ArrowRight,
  ChevronDown,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageState } from '@/components/ui/error-state';
import { decisionLabel } from '@/lib/decision-language';
import type { DecisionFilter } from './decision-chart';

export interface ActivityItem {
  id: string;
  agent: string;
  action: string;
  amount: string;
  time: string;
  status: string;
}

const ACTIVITY_PAGE_SIZE = 5;

interface RecentActivityProps {
  loading: boolean;
  error: boolean;
  items: ActivityItem[];
  totalCount: number;
  decisionFilter: DecisionFilter;
  onClearFilter: () => void;
  onRetry: () => void;
}

/**
 * The dashboard's recent-activity feed with progressive disclosure: shows the
 * first five rows and expands on demand. Cross-filtering from the decision
 * donut is surfaced as a removable badge.
 */
export function RecentActivity({
  loading,
  error,
  items,
  totalCount,
  decisionFilter,
  onClearFilter,
  onRetry,
}: RecentActivityProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);

  const visible = expanded ? items : items.slice(0, ACTIVITY_PAGE_SIZE);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold">Recent Activity</h2>
          {decisionFilter && (
            <Badge variant="secondary" className="text-xs capitalize">
              {decisionLabel(decisionFilter)} only
            </Badge>
          )}
          {items.length !== totalCount && (
            <span className="text-xs text-muted-foreground">
              {items.length} of {totalCount}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            router.push(decisionFilter ? `/audit?status=${decisionFilter}` : '/audit')
          }
        >
          {decisionFilter
            ? `View ${decisionFilter === 'denied' ? 'stopped' : decisionFilter}`
            : 'View All'}
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <PageState
          variant="error"
          title="Could not load activity"
          message="Recent governance decisions are unavailable right now."
          action={{ label: 'Retry', onClick: onRetry }}
        />
      ) : items.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground border rounded-xl">
          <p>{decisionFilter ? `No ${decisionFilter} decisions` : 'No activity yet'}</p>
          {decisionFilter && (
            <Button variant="ghost" size="sm" className="mt-2" onClick={onClearFilter}>
              Clear filter
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-border divide-y divide-border">
          {visible.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() =>
                router.push(`/audit?id=${encodeURIComponent(item.id)}`)
              }
              className="flex w-full cursor-pointer flex-col justify-between gap-2 p-3 text-left text-sm transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:flex-row sm:items-center sm:gap-0"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`p-1.5 rounded-md flex-shrink-0 ${
                    item.status === 'approved'
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600'
                      : item.status === 'denied'
                        ? 'bg-red-100 dark:bg-red-950 text-red-600'
                        : 'bg-blue-100 dark:bg-blue-950 text-blue-600'
                  }`}
                  aria-label={`Decision: ${decisionLabel(item.status)}`}
                >
                  {item.status === 'approved' ? (
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : item.status === 'denied' ? (
                    <Activity className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <FileSearch className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="font-medium truncate">{item.agent}</div>
                  <div className="text-muted-foreground text-xs truncate">{item.action}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 sm:ml-4 pl-8 sm:pl-0">
                <span className="font-mono text-xs">{item.amount}</span>
                <Badge
                  variant={
                    item.status === 'approved'
                      ? 'secondary'
                      : item.status === 'denied'
                        ? 'destructive'
                        : 'outline'
                  }
                  className="text-xs"
                >
                  {decisionLabel(item.status)}
                </Badge>
                <span className="text-xs text-muted-foreground">{item.time}</span>
              </div>
            </button>
          ))}
          {items.length > ACTIVITY_PAGE_SIZE && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="w-full p-2.5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
              />
              {expanded ? 'Show less' : `Show ${items.length - ACTIVITY_PAGE_SIZE} more`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
