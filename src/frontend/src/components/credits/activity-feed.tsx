'use client';

import { EyeOff, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatUsd } from '@/lib/budget-format';
import { useCreditProgramActivity } from '@/hooks/use-credit-programs';

export function ActivityFeed({ programId }: { programId: string }) {
  const { data: activity, isLoading, error } = useCreditProgramActivity(programId);

  if (isLoading && !activity) {
    return <Skeleton className="h-64" />;
  }

  if (error && !activity) {
    return (
      <p className="text-sm text-muted-foreground">Could not load activity: {error.message}</p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        The per-call feed, projected to exactly what this sponsor may see at each participant&apos;s
        tier.
      </p>

      {activity && activity.withheld > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
          <EyeOff className="mt-0.5 size-3.5 shrink-0" />
          <span>
            {activity.withheld} call(s) in this window are from participants on the private tier —
            their spend counts in totals but no per-call detail is recorded. The total is honest;
            the detail is not the whole picture.
          </span>
        </div>
      )}

      {activity && activity.calls.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No calls yet. Share the gateway key with participants:{' '}
          <code className="rounded bg-muted px-1">
            OpenAI(base_url=&quot;https://your-host/v1&quot;, api_key=&quot;cvk_…&quot;)
          </code>
        </p>
      ) : (
        <div className="space-y-1.5">
          {(activity?.calls ?? []).map((call) => (
            <div key={call.id} className="rounded-lg border px-3 py-2 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{call.participant}</span>
                  <StatusBadge status={call.status} />
                  <Badge variant="outline">{call.model}</Badge>
                  {call.teeVerified && <Badge variant="secondary">TEE verified</Badge>}
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <span>{formatUsd(call.costUsd, 6)}</span>
                  <span>{new Date(call.createdAt).toLocaleString()}</span>
                </div>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-[0.7rem] text-muted-foreground">
                <span>
                  {call.inputTokens} in / {call.outputTokens} out
                  {call.cachedTokens > 0 ? ` / ${call.cachedTokens} cached` : ''}
                </span>
                <span>{call.latencyMs}ms</span>
                {call.streamed && <span>streamed</span>}
                {call.trustTier && <span>{call.trustTier}</span>}
                {call.taskClass && <span>· {call.taskClass}</span>}
                {call.projectTag && <span>· {call.projectTag}</span>}
              </div>
              {call.promptExcerpt && (
                <p className="mt-1 line-clamp-2 rounded bg-muted/40 px-2 py-1 text-[0.7rem] text-muted-foreground">
                  <span className="font-medium">prompt:</span> {call.promptExcerpt}
                </p>
              )}
              {call.responseExcerpt && (
                <p className="mt-1 line-clamp-2 rounded bg-muted/40 px-2 py-1 text-[0.7rem] text-muted-foreground">
                  <span className="font-medium">response:</span> {call.responseExcerpt}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {activity && activity.note && (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3 shrink-0" />
          {activity.note}
        </p>
      )}
    </div>
  );
}
