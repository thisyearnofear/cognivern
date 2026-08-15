'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  FileSearch,
  Network,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { MandateContext } from '@/lib/api-client';

interface MandateContextPanelProps {
  context: MandateContext | null;
  loading: boolean;
  onBuild: () => void;
  onReviewAllocation: () => void;
  recommendationLoading: boolean;
}

function relativeTime(iso: string): string {
  const elapsed = Math.max(0, Date.now() - new Date(iso).getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function syncJobLabel(status: 'queued' | 'processing' | 'failed' | 'completed' | undefined): string {
  if (status === 'processing') return 'Working';
  if (status === 'queued') return 'Queued';
  if (status === 'failed') return 'Needs retry';
  if (status === 'completed') return 'Completed';
  return 'Idle';
}

function sourceCounts(context: MandateContext): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const chunk of context.chunks) {
    const source = chunk.source_type || chunk.source_title || 'evidence';
    counts.set(source, (counts.get(source) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

export function MandateContextPanel({
  context,
  loading,
  onBuild,
  onReviewAllocation,
  recommendationLoading,
}: MandateContextPanelProps) {
  const reduceMotion = useReducedMotion();
  const counts = context ? sourceCounts(context) : [];
  const indexedNodes = context
    ? context.ingested.mandate + context.ingested.outcomes + context.ingested.statements + context.ingested.recommendations + context.ingested.runs
    : 0;
  const graphRelationCount = context
    ? (context.graphContext?.query_paths?.length ?? 0) + (context.graphContext?.chunk_relations?.length ?? 0)
    : 0;
  const syncJob = context?.syncJob;

  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="border-b bg-[linear-gradient(110deg,hsl(var(--muted)/.55),transparent_65%)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
              <Network className="h-4 w-4" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold">Evidence context</h2>
                {context?.enabled && <Badge variant="secondary">Derived review layer</Badge>}
                {context && <Badge variant={context.syncStatus === 'failed' ? 'destructive' : 'outline'}>{context.syncStatus === 'synced' ? 'Up to date' : context.syncStatus === 'pending' ? 'Indexing' : context.syncStatus}</Badge>}
                {syncJob && syncJob.status !== 'completed' && <Badge variant={syncJob.status === 'failed' ? 'destructive' : 'secondary'}>Recovery {syncJobLabel(syncJob.status)}</Badge>}
              </div>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                Cited decision history for this mandate: governed runs, spend, outcomes, and receipts. Review it before considering another allocation.
              </p>
            </div>
          </div>
          {context?.enabled && (
            <Button variant="ghost" size="sm" onClick={onBuild} disabled={loading}>
              <RefreshCw className={loading ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
              Refresh
            </Button>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
      {!context && !loading && (
        <motion.div
          key="empty"
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
          transition={{ duration: 0.22 }}
          className="flex flex-wrap items-center justify-between gap-4 p-5"
        >
          <div className="flex items-start gap-3">
            <FileSearch className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">No cited decision history yet</p>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                Build a workspace-isolated view of what happened, what was measured, and which receipts support this mandate. It is advisory and never authorizes spend.
              </p>
            </div>
          </div>
          <Button size="sm" onClick={onBuild}>
            <FileSearch className="h-3.5 w-3.5" />
            Build cited history
          </Button>
        </motion.div>
      )}

      {loading && (
        <motion.div
          key="loading"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="space-y-3 p-5"
          aria-live="polite"
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Syncing mandate evidence and traversing related records…
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[1, 2, 3].map((item) => <div key={item} className="h-16 animate-pulse rounded-lg bg-muted/50" />)}
          </div>
        </motion.div>
      )}

      {context && !loading && (!context.enabled || context.syncStatus === 'failed') && (
        <motion.div
          key="unavailable"
          initial={reduceMotion ? false : { opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.22 }}
          className="flex items-start gap-3 p-5"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500" />
          <div>
            <p className="text-sm font-medium">Evidence context is unavailable</p>
            <p className="mt-1 text-sm text-muted-foreground">{context.warning || 'HydraDB is not enabled for this workspace.'}</p>
            <p className="mt-2 text-xs text-muted-foreground">This does not affect the Cognivern ledger, policy decisions, or spend execution.</p>
          </div>
        </motion.div>
      )}

      {context?.enabled && !loading && context.syncStatus !== 'failed' && (
        <motion.div
          key="ready"
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="p-5"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.05, duration: 0.22 }}
              className="rounded-lg border bg-background/60 p-3 transition-colors hover:border-primary/30 hover:bg-primary/[.025]"
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Database className="h-3.5 w-3.5" /> Indexed nodes</div>
              <div className="mt-2 text-xl font-semibold tracking-tight">{indexedNodes}</div>
              <div className="mt-1 text-xs text-muted-foreground">mandate, runs, outcomes, decisions, statements</div>
            </motion.div>
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.22 }}
              className="rounded-lg border bg-background/60 p-3 transition-colors hover:border-primary/30 hover:bg-primary/[.025]"
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Network className="h-3.5 w-3.5" /> Graph relations</div>
              <div className="mt-2 text-xl font-semibold tracking-tight">{graphRelationCount}</div>
              <div className="mt-1 text-xs text-muted-foreground">paths and evidence links used in retrieval</div>
            </motion.div>
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15, duration: 0.22 }}
              className="rounded-lg border bg-background/60 p-3 transition-colors hover:border-primary/30 hover:bg-primary/[.025]"
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" /> Review latency</div>
              <div className="mt-2 text-xl font-semibold tracking-tight">{context.metrics.latencyMs}ms</div>
              <div className="mt-1 text-xs text-muted-foreground">thinking-mode retrieval</div>
            </motion.div>
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.22 }}
              className="rounded-lg border bg-background/60 p-3 transition-colors hover:border-primary/30 hover:bg-primary/[.025]"
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 className="h-3.5 w-3.5" /> Last synced</div>
              <div className="mt-2 text-xl font-semibold tracking-tight">{context.lastSyncedAt ? relativeTime(context.lastSyncedAt) : context.syncStatus === 'pending' ? 'Indexing' : 'Not yet'}</div>
              <div className="mt-1 text-xs text-muted-foreground">{context.lastSyncedAt ? `${context.metrics.resultCount} relevant sources returned` : 'Waiting for a searchable context'}</div>
            </motion.div>
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.25, duration: 0.22 }}
              className="rounded-lg border bg-background/60 p-3 transition-colors hover:border-primary/30 hover:bg-primary/[.025]"
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><RefreshCw className="h-3.5 w-3.5" /> Sync recovery</div>
              <div className="mt-2 text-sm font-semibold tracking-tight">{syncJobLabel(syncJob?.status)}</div>
              <div className="mt-1 text-xs text-muted-foreground">{syncJob ? `${syncJob.attempts} attempt${syncJob.attempts === 1 ? '' : 's'} · durable queue` : 'No recovery job recorded'}</div>
            </motion.div>
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.22 }}
              className="rounded-lg border bg-background/60 p-3 transition-colors hover:border-primary/30 hover:bg-primary/[.025]"
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" /> Boundary</div>
              <div className="mt-2 text-sm font-semibold tracking-tight">Advisory only</div>
              <div className="mt-1 text-xs text-muted-foreground">Operator review and policy gate still required</div>
            </motion.div>
          </div>

          {context.warning && context.syncStatus === 'pending' && (
            <div className="mt-4 rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 p-3 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Context is still indexing.</span> {context.warning}
            </div>
          )}
          {syncJob?.status === 'failed' && (
            <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Recovery needs attention.</span> The durable sync has exhausted its attempts. {syncJob.lastError || 'Refresh the context to retry.'}
            </div>
          )}

          {counts.length > 0 && (
            <div className="mt-5 flex flex-wrap items-center gap-2 border-b pb-4">
              <span className="mr-1 text-xs font-medium uppercase tracking-[.12em] text-muted-foreground">Sources</span>
              {counts.map(([source, count], index) => (
                <motion.div
                  key={source}
                  initial={reduceMotion ? false : { opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 + index * 0.04, duration: 0.18 }}
                >
                  <Badge variant="outline" className="transition-colors hover:border-primary/40 hover:bg-primary/5">{source} · {count}</Badge>
                </motion.div>
              ))}
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Decision trail</h3>
              <p className="mt-1 text-sm text-muted-foreground">The most relevant evidence returned for this mandate.</p>
            </div>
            <Button variant="outline" size="sm" onClick={onReviewAllocation} disabled={recommendationLoading}>
              <ShieldCheck className="h-3.5 w-3.5" />
              {recommendationLoading ? 'Reviewing…' : 'Review next allocation'}
            </Button>
          </div>

          <div className="mt-3 space-y-2">
            {context.chunks.slice(0, 6).map((chunk, index) => {
              const provenance = context.provenance[index];
              return (
              <motion.details
                key={chunk.chunk_uuid || chunk.id || index}
                open={index === 0}
                initial={reduceMotion ? false : { opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.28 + index * 0.05, duration: 0.2 }}
                className="group rounded-lg border bg-background/40 transition-colors hover:border-primary/30 hover:bg-primary/[.02]"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
                  <span className="truncate">{chunk.source_title || chunk.source_type || 'HydraDB evidence'}</span>
                  <span className="shrink-0 text-xs font-normal text-muted-foreground">{chunk.relevancy_score != null ? `score ${chunk.relevancy_score.toFixed(2)}` : 'graph source'}</span>
                </summary>
                <div className="border-t px-3 py-3 text-sm leading-6 text-muted-foreground">
                  {chunk.chunk_content || 'No source text returned.'}
                  {provenance && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3 text-xs">
                      <Badge variant="outline">{provenance.kind}</Badge>
                      {provenance.recordId && <span>Record {provenance.recordId}</span>}
                      {provenance.url ? (
                        <a className="inline-flex items-center gap-1 text-primary underline" href={provenance.url} target={provenance.url.startsWith('http') ? '_blank' : undefined} rel={provenance.url.startsWith('http') ? 'noreferrer' : undefined}>
                          Open in Cognivern <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : <span>Source link unavailable</span>}
                    </div>
                  )}
                </div>
              </motion.details>
              );
            })}
            {context.chunks.length === 0 && <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">The evidence index is ready, but no matching source text was returned yet. Refresh after indexing completes, then review the authoritative ledger if the result remains empty.</p>}
          </div>

          <details className="mt-4 text-xs text-muted-foreground">
            <summary className="cursor-pointer font-medium">Advanced evidence details</summary>
            <div className="mt-2 rounded-lg bg-muted/40 p-3 font-mono leading-5">
              <div>mode: {context.metrics.mode}</div>
              <div>reason: {context.metrics.routingReason}</div>
              <div>query: {context.query}</div>
              <div>collection: {context.collection}</div>
            </div>
          </details>
        </motion.div>
      )}
      </AnimatePresence>
    </section>
  );
}
