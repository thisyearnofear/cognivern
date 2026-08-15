'use client';

import { useEffect, useRef, useState } from 'react';
import { Activity, ArrowLeft, CalendarClock, CheckCircle2, CircleAlert, Download, ExternalLink, FileCheck, FileText, History, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageState } from '@/components/ui/error-state';
import { MandateContextPanel } from '@/components/capital/mandate-context-panel';
import { apiClient, type AllocationRecommendation, type FundedMandate, type FundedMandateStatement, type MandateContext, type MandateContextSyncHealth, type MandateStatementExport, type OutcomeObservation, type PublishedMandateStatementSummary, type SpendAttributionReport } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

function formatAmount(value: string) {
  if (!/^\d+$/.test(value)) return '—';
  try {
    return BigInt(value).toLocaleString();
  } catch {
    return '—';
  }
}

function formatDuration(value?: number): string {
  if (value == null || !Number.isFinite(value)) return '—';
  if (value < 1000) return `${Math.round(value)}ms`;
  return `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}s`;
}

type ReviewAction = 'select' | 'context' | 'recommendation' | 'statement' | 'publish' | 'done';

interface ReviewProgress {
  activeStep: number;
  title: string;
  description: string;
  action: ReviewAction;
  actionLabel?: string;
}

function getReviewProgress(
  selectedMandateId: string,
  context: MandateContext | null,
  recommendation: AllocationRecommendation | null,
  statement: FundedMandateStatement | null,
  published: PublishedMandateStatementSummary[] | null,
): ReviewProgress {
  if (!selectedMandateId) {
    return {
      activeStep: 0,
      title: 'Choose a mandate to begin',
      description: 'Select a funded mandate to see its governed spend, cited decision history, and next allocation review.',
      action: 'select',
      actionLabel: 'Choose a mandate',
    };
  }
  if (!context) {
    return {
      activeStep: 1,
      title: 'Build the cited decision history',
      description: 'Connect this mandate to its runs, receipts, outcomes, and policy-linked records. This is advisory and never authorizes spend.',
      action: 'context',
      actionLabel: 'Build cited history',
    };
  }
  if (!recommendation) {
    return {
      activeStep: 2,
      title: 'Review the next allocation',
      description: 'Use the cited evidence to generate a bounded recommendation. An operator and the existing policy gate remain required.',
      action: 'recommendation',
      actionLabel: 'Review recommendation',
    };
  }
  if (!statement) {
    return {
      activeStep: 3,
      title: 'Preview the review report',
      description: 'Inspect the read-only capital report before freezing a versioned snapshot for your team.',
      action: 'statement',
      actionLabel: 'Preview review report',
    };
  }
  if (!published || published.length === 0) {
    return {
      activeStep: 3,
      title: 'Freeze the review snapshot',
      description: 'Publish an immutable, hashed version of this report for review. Publishing does not authorize or execute spend.',
      action: 'publish',
      actionLabel: 'Publish review snapshot',
    };
  }
  return {
    activeStep: 4,
    title: 'Review complete',
    description: 'A versioned snapshot is published. Revisit this flow when new governed spend or measured outcomes change the evidence.',
    action: 'done',
  };
}

interface MandateActivity {
  id: string;
  title: string;
  detail: string;
  timestamp: string;
  status: 'success' | 'pending' | 'info';
  runHref?: string;
  transactionHref?: string;
}

function buildMandateActivity(
  selectedMandateId: string,
  report: SpendAttributionReport,
  observations: OutcomeObservation[],
  context: MandateContext | null,
  statement: FundedMandateStatement | null,
  published: PublishedMandateStatementSummary[] | null,
): MandateActivity[] {
  const events: MandateActivity[] = report.records
    .filter((record) => !selectedMandateId || record.mandateId === selectedMandateId)
    .map((record) => ({
      id: `run-${record.runId}-${record.allocationId}`,
      title: record.status === 'consumed' ? 'Governed spend completed' : `Spend ${record.status}`,
      detail: `${record.agentId} · ${record.asset} · ${formatAmount(record.consumedAmount)} consumed${record.outcome ? ` · ${record.outcome}` : ''}`,
      timestamp: record.recordedAt,
      status: record.status === 'consumed' ? 'success' : record.status === 'held' || record.status === 'uncertain' ? 'pending' : 'info',
      runHref: `/runs/${encodeURIComponent(record.runId)}`,
      ...(record.transactionLink ? { transactionHref: record.transactionLink } : {}),
    }));

  events.push(...observations.map((observation) => ({
    id: `outcome-${observation.id}`,
    title: observation.confidence === 'independently_verified' ? 'Measured result independently verified' : 'Measured result recorded',
    detail: `${observation.value} ${observation.unit} · ${observation.source}`,
    timestamp: observation.observedAt,
    status: observation.confidence === 'independently_verified' ? ('success' as const) : ('info' as const),
  })));

  if (context) {
    events.push({
      id: `context-${context.syncedAt}`,
      title: context.syncStatus === 'synced' ? 'Cited history refreshed' : 'Cited history accepted for indexing',
      detail: `${context.metrics.resultCount} relevant sources · ${context.metrics.latencyMs}ms retrieval`,
      timestamp: context.lastSyncedAt || context.syncedAt,
      status: context.syncStatus === 'synced' ? 'success' : 'pending',
    });
  }

  if (statement) {
    events.push({
      id: `statement-${statement.statementId}`,
      title: 'Review report generated',
      detail: `${statement.performance.evidenceCompleteness.spendRecordCount} spend records · ${statement.performance.evidenceCompleteness.outcomeCount} measured results`,
      timestamp: statement.generatedAt,
      status: 'info',
    });
  }

  if (published) {
    events.push(...published.map((snapshot) => ({
      id: `snapshot-${snapshot.id}`,
      title: `Review snapshot v${snapshot.version} published`,
      detail: 'Immutable, hashed report available for review',
      timestamp: snapshot.publishedAt,
      status: 'success' as const,
    })));
  }

  return events
    .filter((event) => Number.isFinite(new Date(event.timestamp).getTime()))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function CapitalPage() {
  const router = useRouter();
  const isConnected = useAuthStore((state) => state.isConnected);
  const [report, setReport] = useState<SpendAttributionReport | null>(null);
  const [mandates, setMandates] = useState<FundedMandate[]>([]);
  const [syncHealth, setSyncHealth] = useState<MandateContextSyncHealth | null>(null);
  const [syncHealthLoading, setSyncHealthLoading] = useState(false);
  const [selectedMandateId, setSelectedMandateId] = useState('');
  const selectedMandateIdRef = useRef('');
  const [newMandateName, setNewMandateName] = useState('');
  const [newMandateObjective, setNewMandateObjective] = useState('');
  const [creatingMandate, setCreatingMandate] = useState(false);
  const [createMandateError, setCreateMandateError] = useState<string | null>(null);
  const [observations, setObservations] = useState<OutcomeObservation[]>([]);
  const [statement, setStatement] = useState<FundedMandateStatement | null>(null);
  const [statementLoading, setStatementLoading] = useState(false);
  const [statementError, setStatementError] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<AllocationRecommendation | null>(null);
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);
  const [context, setContext] = useState<MandateContext | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);
  const [published, setPublished] = useState<PublishedMandateStatementSummary[] | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishedError, setPublishedError] = useState<string | null>(null);
  const [exported, setExported] = useState<MandateStatementExport | null>(null);
  const [exportingStatementId, setExportingStatementId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConnected) return;
    let active = true;
    apiClient.getMandates()
      .then((response) => {
        if (!active) return;
        if (!response.success || !response.data) throw new Error(response.error || 'Could not load mandates');
        setError(null);
        setMandates(response.data);
        // With exactly one mandate, jump straight into its review so the cited
        // evidence history is visible without an extra click.
        if (response.data.length === 1 && !selectedMandateIdRef.current) {
          selectedMandateIdRef.current = response.data[0].id;
          setSelectedMandateId(response.data[0].id);
        }
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Could not load mandates');
      });

    // Health is operational context, not a prerequisite for the authoritative
    // attribution ledger. Keep it independently fail-open and refresh it only
    // on page entry or explicit operator action.
    apiClient.getMandateSyncHealth()
      .then((response) => {
        if (active && response.success && response.data) setSyncHealth(response.data);
      })
      .catch(() => {
        if (active) setSyncHealth(null);
      });

    return () => {
      active = false;
    };
  }, [isConnected]);

  useEffect(() => {
    if (!isConnected) return;
    let active = true;

    const loadMandateData = async () => {
      try {
        const [reportResponse, observationResponse, publishedResponse] = await Promise.all([
          apiClient.getSpendAttribution(selectedMandateId || undefined),
          selectedMandateId ? apiClient.getOutcomeObservations(selectedMandateId) : Promise.resolve(null),
          selectedMandateId ? apiClient.listPublishedStatements(selectedMandateId) : Promise.resolve(null),
        ]);
        if (!active) return;
        if (!reportResponse.success || !reportResponse.data) throw new Error(reportResponse.error || 'Could not load attribution');
        setError(null);
        setReport(reportResponse.data);
        setLoading(false);
        if (observationResponse?.success && observationResponse.data) setObservations(observationResponse.data);
        if (publishedResponse?.success && publishedResponse.data) setPublished(publishedResponse.data);
        if (!selectedMandateId) {
          setObservations([]);
          setStatement(null);
          setPublished(null);
          setExported(null);
        }
      } catch (reason) {
        if (active) {
          setLoading(false);
          setError(reason instanceof Error ? reason.message : 'Could not load attribution');
        }
      }
    };

    void loadMandateData();
    return () => {
      active = false;
    };
  }, [isConnected, selectedMandateId]);

  if (!isConnected) {
    return <PageState variant="empty" title="Sign in to view capital attribution" message="The ledger is scoped to your workspace." />;
  }
  if (loading) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading attribution ledger…</div>;
  }
  async function createMandate() {
    const name = newMandateName.trim();
    const objective = newMandateObjective.trim();
    if (!name || !objective) {
      setCreateMandateError('Add a name and objective so the mandate has a clear decision boundary.');
      return;
    }
    setCreatingMandate(true);
    setCreateMandateError(null);
    try {
      const response = await apiClient.createMandate({ name, objective, status: 'active' });
      if (!response.success || !response.data) throw new Error(response.error || 'Could not create mandate');
      setMandates((current) => [response.data!, ...current]);
      setSelectedMandateId(response.data.id);
      setNewMandateName('');
      setNewMandateObjective('');
    } catch (reason) {
      setCreateMandateError(reason instanceof Error ? reason.message : 'Could not create mandate');
    } finally {
      setCreatingMandate(false);
    }
  }

  async function refreshSyncHealth() {
    setSyncHealthLoading(true);
    try {
      const response = await apiClient.getMandateSyncHealth();
      if (!response.success || !response.data) throw new Error(response.error || 'Could not refresh evidence sync health');
      setSyncHealth(response.data);
    } catch {
      // Health is supplementary; keep the existing state and do not interrupt
      // attribution or policy review when the derived index is unavailable.
    } finally {
      setSyncHealthLoading(false);
    }
  }

  async function loadStatement() {
    if (!selectedMandateId) return;
    setStatementLoading(true);
    setStatementError(null);
    try {
      const response = await apiClient.getMandateStatement(selectedMandateId);
      if (!response.success || !response.data) throw new Error(response.error || 'Could not generate statement');
      setStatement(response.data);
    } catch (reason) {
      setStatementError(reason instanceof Error ? reason.message : 'Could not generate statement');
    } finally {
      setStatementLoading(false);
    }
  }

  async function publishStatement() {
    if (!selectedMandateId) return;
    setPublishing(true);
    setPublishedError(null);
    setExported(null);
    try {
      const response = await apiClient.publishMandateStatement(selectedMandateId);
      if (!response.success || !response.data) throw new Error(response.error || 'Could not publish statement');
      const list = await apiClient.listPublishedStatements(selectedMandateId);
      if (!list.success || !list.data) throw new Error(list.error || 'Could not reload published statements');
      setPublished(list.data);
    } catch (reason) {
      setPublishedError(reason instanceof Error ? reason.message : 'Could not publish statement');
    } finally {
      setPublishing(false);
    }
  }

  async function exportStatement(statementId: string) {
    if (!selectedMandateId) return;
    setExportingStatementId(statementId);
    setPublishedError(null);
    try {
      const response = await apiClient.exportPublishedStatement(selectedMandateId, statementId);
      if (!response.success || !response.data) throw new Error(response.error || 'Could not export statement');
      setExported(response.data);
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${statementId}-redacted.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setPublishedError(reason instanceof Error ? reason.message : 'Could not export statement');
    } finally {
      setExportingStatementId(null);
    }
  }

  async function loadRecommendation() {
    if (!selectedMandateId) return;
    setRecommendationLoading(true);
    setRecommendationError(null);
    try {
      const response = await apiClient.getMandateRecommendation(selectedMandateId);
      if (!response.success || !response.data) throw new Error(response.error || 'Could not generate recommendation');
      setRecommendation(response.data);
    } catch (reason) {
      setRecommendationError(reason instanceof Error ? reason.message : 'Could not generate recommendation');
    } finally {
      setRecommendationLoading(false);
    }
  }

  async function loadContext() {
    if (!selectedMandateId) return;
    setContextLoading(true);
    setContextError(null);
    try {
      const response = await apiClient.getMandateContext(selectedMandateId);
      if (!response.success || !response.data) throw new Error(response.error || 'Could not build mandate context');
      setContext(response.data);
    } catch (reason) {
      setContextError(reason instanceof Error ? reason.message : 'Could not build mandate context');
    } finally {
      setContextLoading(false);
    }
  }

  const selectedMandate = mandates.find((mandate) => mandate.id === selectedMandateId);
  const review = getReviewProgress(selectedMandateId, context, recommendation, statement, published);
  const reviewStages = ['Choose mandate', 'Build evidence', 'Review recommendation', 'Publish snapshot'];
  const reviewBusy = (review.action === 'context' && contextLoading) || (review.action === 'recommendation' && recommendationLoading) || (review.action === 'statement' && statementLoading) || (review.action === 'publish' && publishing);
  function runReviewAction() {
    if (review.action === 'select') {
      document.getElementById('capital-mandate-select')?.focus();
    } else if (review.action === 'context') {
      void loadContext();
    } else if (review.action === 'recommendation') {
      void loadRecommendation();
    } else if (review.action === 'statement') {
      void loadStatement();
    } else if (review.action === 'publish') {
      void publishStatement();
    }
  }

  if (error || !report) {
    return <PageState variant="error" title="Could not load attribution" message={error || 'The attribution report is unavailable.'} action={{ label: 'Retry', onClick: () => window.location.reload() }} />;
  }

  const activity = buildMandateActivity(selectedMandateId, report, observations, context, statement, published);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard')}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agentic capital</h1>
          <p className="mt-1 text-sm text-muted-foreground">A first attribution ledger for governed agent spend, shown in asset base units.</p>
        </div>
      </div>

      <section className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Review a mandate</h2>
            <p className="mt-1 text-sm text-muted-foreground">Follow the review path from governed spend to cited evidence and an operator-approved decision.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {selectedMandateId && <Button variant="outline" size="sm" onClick={loadStatement} disabled={statementLoading}><FileText className="h-3.5 w-3.5" />{statementLoading ? 'Generating…' : 'Preview statement'}</Button>}
            <select
            id="capital-mandate-select"
            aria-label="Filter by funded mandate"
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={selectedMandateId}
            onChange={(event) => {
              setSelectedMandateId(event.target.value);
              setStatement(null);
              setStatementError(null);
              setRecommendation(null);
              setRecommendationError(null);
              setContext(null);
              setContextError(null);
              setPublished(null);
              setPublishedError(null);
              setExported(null);
              setError(null);
            }}
            >
              <option value="">All mandates</option>
              {mandates.map((mandate) => <option key={mandate.id} value={mandate.id}>{mandate.name}</option>)}
            </select>
          </div>
        </div>
        {selectedMandate && (
          <div className="mt-3 rounded-lg bg-muted/40 p-3 text-sm">
            <span className="font-medium">{selectedMandate.name}</span>
            <span className="ml-2 text-muted-foreground">{selectedMandate.objective}</span>
          </div>
        )}
      </section>

      {mandates.length === 0 && (
        <section aria-label="Create spending mandate" className="rounded-xl border border-primary/25 bg-primary/[.035] p-5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><ShieldCheck className="h-4 w-4" /></div>
            <div className="min-w-0">
              <h2 className="font-semibold">Create your first spending mandate</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">Give the work a name and objective first. You can add agents, budgets, policies, and success measures after the review loop is established.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm">
              <span className="font-medium">Mandate name</span>
              <input className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm" placeholder="e.g. Acquire qualified customers" value={newMandateName} onChange={(event) => setNewMandateName(event.target.value)} />
            </label>
            <label className="space-y-1.5 text-sm sm:col-span-2">
              <span className="font-medium">Objective</span>
              <textarea className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="What should governed agent spend accomplish?" value={newMandateObjective} onChange={(event) => setNewMandateObjective(event.target.value)} />
            </label>
          </div>
          {createMandateError && <p className="mt-3 text-sm text-destructive">{createMandateError}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button onClick={() => void createMandate()} disabled={creatingMandate}>
              {creatingMandate ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileCheck className="h-3.5 w-3.5" />}
              {creatingMandate ? 'Creating…' : 'Create mandate'}
            </Button>
            <span className="text-xs text-muted-foreground">Creation does not move funds; it establishes the review boundary.</span>
          </div>
        </section>
      )}

      {selectedMandate && (
        <section aria-label="Selected mandate summary" className="rounded-xl border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-lg font-semibold">{selectedMandate.name}</h2>
                <Badge variant={selectedMandate.status === 'active' ? 'secondary' : 'outline'}>{selectedMandate.status}</Badge>
              </div>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{selectedMandate.objective}</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5" /> Updated {new Date(selectedMandate.updatedAt).toLocaleDateString()}
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-muted/40 p-3">
              <div className="text-xs text-muted-foreground">Budget position</div>
              <div className="mt-2 space-y-1 text-sm">
                {Object.entries(selectedMandate.budget.byAsset).map(([asset, budget]) => (
                  <div key={asset} className="flex items-center justify-between gap-3">
                    <span className="font-medium">{asset}</span>
                    <span className="text-muted-foreground">{formatAmount(budget.consumedAmount)} / {formatAmount(budget.authorizedAmount)} used</span>
                  </div>
                ))}
                {Object.keys(selectedMandate.budget.byAsset).length === 0 && <span className="text-muted-foreground">No budget recorded</span>}
              </div>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <div className="text-xs text-muted-foreground">Agents covered</div>
              <div className="mt-2 text-xl font-semibold">{selectedMandate.agentIds.length}</div>
              <div className="mt-1 text-xs text-muted-foreground">authorized identities for this mandate</div>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <div className="text-xs text-muted-foreground">Success measures</div>
              <div className="mt-2 text-xl font-semibold">{selectedMandate.successMetrics.length}</div>
              <div className="mt-1 text-xs text-muted-foreground">results this review should track</div>
            </div>
          </div>
        </section>
      )}

      <section aria-label="Guided mandate review" className="rounded-xl border border-primary/20 bg-primary/[.025] p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold">Guided review</h2>
              <Badge variant="secondary">{review.activeStep === 4 ? 'Complete' : `Step ${review.activeStep + 1} of 4`}</Badge>
            </div>
            <p className="mt-2 text-sm font-medium">{review.title}</p>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{review.description}</p>
          </div>
          {review.action !== 'done' && (
            <Button size="sm" variant={review.action === 'select' ? 'outline' : 'default'} onClick={runReviewAction} disabled={reviewBusy}>
              {reviewBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {review.action === 'context' && !reviewBusy && <FileText className="h-3.5 w-3.5" />}
              {review.action === 'recommendation' && !reviewBusy && <ShieldCheck className="h-3.5 w-3.5" />}
              {review.action === 'statement' && !reviewBusy && <FileText className="h-3.5 w-3.5" />}
              {review.action === 'publish' && !reviewBusy && <FileCheck className="h-3.5 w-3.5" />}
              {reviewBusy ? `${review.action === 'context' ? 'Building' : review.action === 'recommendation' ? 'Reviewing' : review.action === 'statement' ? 'Generating' : 'Publishing'}…` : review.actionLabel}
            </Button>
          )}
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          {reviewStages.map((stage, index) => {
            const complete = index < review.activeStep;
            const active = index === review.activeStep && review.activeStep < 4;
            return (
              <div key={stage} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${active ? 'border-primary/40 bg-background font-medium text-foreground' : complete ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300' : 'border-transparent bg-background/50 text-muted-foreground'}`}>
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px]">{complete ? '✓' : index + 1}</span>
                <span>{stage}</span>
              </div>
            );
          })}
        </div>
      </section>

      {syncHealth && (
        <section aria-label="Evidence sync health" className="rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary"><Activity className="h-4 w-4" /></div>
              <div>
                <h2 className="font-semibold">Evidence sync health</h2>
                <p className="mt-1 text-sm text-muted-foreground">Workspace-wide recovery for the derived mandate context layer. It never authorizes spend.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {syncHealth.latestUpdatedAt && <span className="text-xs text-muted-foreground" title={new Date(syncHealth.latestUpdatedAt).toLocaleString()}>Updated {new Date(syncHealth.latestUpdatedAt).toLocaleTimeString()}</span>}
              <Button variant="ghost" size="sm" onClick={refreshSyncHealth} disabled={syncHealthLoading} aria-label="Refresh evidence sync health">
                <RefreshCw className={syncHealthLoading ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
                Refresh
              </Button>
              <Badge variant={!syncHealth.enabled ? 'outline' : syncHealth.failed > 0 ? 'destructive' : syncHealth.needsAttention ? 'secondary' : syncHealth.queued + syncHealth.processing > 0 ? 'secondary' : 'outline'}>
                {!syncHealth.enabled ? 'HydraDB disabled' : syncHealth.failed > 0 ? `${syncHealth.failed} needs attention` : syncHealth.needsAttention ? 'Recovery is getting stale' : syncHealth.queued + syncHealth.processing > 0 ? 'Recovery active' : syncHealth.totalJobs === 0 ? 'No queued work' : 'Queue healthy'}
              </Badge>
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {([
              ['Queued', String(syncHealth.queued)],
              ['Processing', String(syncHealth.processing)],
              ['Completed', String(syncHealth.completed)],
              ['Failed', String(syncHealth.failed)],
              ['Retries', String(syncHealth.retryCount)],
              ['Last sync', formatDuration(syncHealth.lastSyncLatencyMs)],
            ] as const).map(([label, value]) => (
              <div key={label} className="rounded-lg bg-muted/40 px-3 py-2">
                <div className="text-lg font-semibold">{value}</div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
          {syncHealth.oldestPendingAt && <p className="mt-3 text-xs text-muted-foreground">Oldest active recovery: {new Date(syncHealth.oldestPendingAt).toLocaleString()} · age {formatDuration(syncHealth.oldestPendingAgeMs)} · attention threshold {formatDuration(syncHealth.pendingAgeAlertMs)}</p>}
          {syncHealth.needsAttention && <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-muted-foreground">Derived evidence recovery needs attention. The authoritative ledger and policy path remain operational; inspect the selected mandate or retry after HydraDB recovers.</p>}
        </section>
      )}

      {statementError && (
        <section className="rounded-xl border border-destructive/40 bg-destructive/5 p-5 text-sm text-destructive">
          {statementError}
        </section>
      )}

      {recommendationError && (
        <section className="rounded-xl border border-destructive/40 bg-destructive/5 p-5 text-sm text-destructive">
          {recommendationError}
        </section>
      )}

      {contextError && (
        <section className="rounded-xl border border-destructive/40 bg-destructive/5 p-5 text-sm text-destructive">
          {contextError}
        </section>
      )}

      {publishedError && (
        <section className="rounded-xl border border-destructive/40 bg-destructive/5 p-5 text-sm text-destructive">
          {publishedError}
        </section>
      )}

      {recommendation && (
        <section id="recommendation" className="rounded-xl border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">Next allocation review</h2>
              <p className="mt-1 text-sm text-muted-foreground">Advisory only. Nothing is executed automatically; any new spend goes through the governance boundary.</p>
            </div>
            <Badge variant={recommendation.recommendation.stance === 'consider_next_allocation' ? 'secondary' : 'outline'}>{recommendation.recommendation.stance === 'consider_next_allocation' ? 'Consider next allocation' : 'Hold'}</Badge>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg bg-muted/40 p-3"><div className="text-lg font-semibold">{Math.round(recommendation.evidenceCompleteness.score * 100)}%</div><div className="text-xs text-muted-foreground">Evidence completeness</div></div>
            <div className="rounded-lg bg-muted/40 p-3"><div className="text-lg font-semibold">{recommendation.evidenceCompleteness.verifiedOutcomeCount}</div><div className="text-xs text-muted-foreground">Measured results</div></div>
            <div className="rounded-lg bg-muted/40 p-3"><div className="text-lg font-semibold">{recommendation.evidenceCompleteness.verifiedSpendRecordCount}</div><div className="text-xs text-muted-foreground">Receipt-backed spends</div></div>
            <div className="rounded-lg bg-muted/40 p-3"><div className="text-lg font-semibold">{Object.entries(recommendation.operationalMetrics.costPerObservedOutcomeByAsset).map(([asset, cost]) => `${asset}: ${formatAmount(cost)}`).join(' · ') || '—'}</div><div className="text-xs text-muted-foreground">Cost per verified outcome (base units, mandate-wide)</div></div>
          </div>
          {recommendation.evidenceCompleteness.blockers.length > 0 && (
            <div className="mt-4 rounded-lg border border-dashed p-3 text-sm">
              <div className="font-medium">Evidence blockers</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">{recommendation.evidenceCompleteness.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul>
            </div>
          )}
          <div className="mt-4 space-y-1 text-sm text-muted-foreground">
            {recommendation.recommendation.reasoning.map((reason) => <p key={reason}>• {reason}</p>)}
          </div>
        </section>
      )}

      {selectedMandateId && (
        <MandateContextPanel
          context={context}
          loading={contextLoading}
          onBuild={loadContext}
          onReviewAllocation={loadRecommendation}
          recommendationLoading={recommendationLoading}
        />
      )}

      {selectedMandateId && (
        <section aria-label="Mandate activity" className="rounded-xl border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary"><History className="h-4 w-4" /></div>
              <div>
                <h2 className="font-semibold">What changed</h2>
                <p className="mt-1 text-sm text-muted-foreground">A single view of governed spend, measured results, evidence refreshes, and review snapshots.</p>
              </div>
            </div>
            <Badge variant="outline">{activity.length} event{activity.length === 1 ? '' : 's'}</Badge>
          </div>
          {activity.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No activity has been recorded for this mandate yet. Start with a governed spend or build its cited history.</div>
          ) : (
            <ol className="mt-5 space-y-4">
              {activity.slice(0, 10).map((event, index) => {
                const EventIcon = event.status === 'success' ? CheckCircle2 : event.status === 'pending' ? CircleAlert : History;
                return (
                  <li key={event.id} className="relative pl-8">
                    {index < Math.min(activity.length, 10) - 1 && <span className="absolute left-[0.9rem] top-7 h-[calc(100%+1rem)] w-px bg-border" aria-hidden="true" />}
                    <span className={`absolute left-0 top-0 flex h-7 w-7 items-center justify-center rounded-full border bg-background ${event.status === 'success' ? 'border-emerald-500/30 text-emerald-600' : event.status === 'pending' ? 'border-amber-500/30 text-amber-600' : 'border-border text-muted-foreground'}`}>
                      <EventIcon className="h-3.5 w-3.5" />
                    </span>
                    <div className="rounded-lg border bg-background/50 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-medium">{event.title}</div>
                          <div className="mt-1 text-sm text-muted-foreground">{event.detail}</div>
                        </div>
                        <time className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground" dateTime={event.timestamp} title={new Date(event.timestamp).toLocaleString()}>
                          <CalendarClock className="h-3 w-3" /> {new Date(event.timestamp).toLocaleDateString()}
                        </time>
                      </div>
                      {(event.runHref || event.transactionHref) && (
                        <div className="mt-3 flex flex-wrap gap-3 border-t pt-2 text-xs">
                          {event.runHref && <a className="inline-flex items-center gap-1 text-primary underline" href={event.runHref}>Open governed run <ExternalLink className="h-3 w-3" /></a>}
                          {event.transactionHref && <a className="inline-flex items-center gap-1 text-primary underline" href={event.transactionHref} target="_blank" rel="noreferrer">Open receipt <ExternalLink className="h-3 w-3" /></a>}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          {activity.length > 10 && <p className="mt-4 text-xs text-muted-foreground">Showing the 10 most recent events. Use the Runs and Audit pages for the complete record.</p>}
        </section>
      )}

      {statement && (
        <section id="statement" className="rounded-xl border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">Review report</h2>
              <p className="mt-1 text-sm text-muted-foreground">Read-only statement candidate for review. It is hashed for integrity, not published or treated as ROI.</p>
            </div>
            <code className="max-w-full truncate rounded bg-muted px-2 py-1 text-[11px] text-muted-foreground" title={statement.contentHash}>sha256:{statement.contentHash}</code>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg bg-muted/40 p-3"><div className="text-lg font-semibold">{statement.performance.evidenceCompleteness.spendRecordCount}</div><div className="text-xs text-muted-foreground">Spend records</div></div>
            <div className="rounded-lg bg-muted/40 p-3"><div className="text-lg font-semibold">{statement.performance.evidenceCompleteness.outcomeCount}</div><div className="text-xs text-muted-foreground">Observed outcomes</div></div>
            <div className="rounded-lg bg-muted/40 p-3"><div className="text-lg font-semibold">{statement.performance.evidenceCompleteness.cleanverseVerifiedSpendRecordCount ?? 0}</div><div className="text-xs text-muted-foreground">Cleanverse-verified spends</div></div>
            <div className="rounded-lg bg-muted/40 p-3"><div className="text-lg font-semibold">{statement.capital.cleanverseVerifiedShareOfConsumed != null ? `${(Number(statement.capital.cleanverseVerifiedShareOfConsumed) / 100).toFixed(0)}%` : '—'}</div><div className="text-xs text-muted-foreground">Verified share of consumed</div></div>
          </div>
          {statement.performance.knownUnknowns.length > 0 && <div className="mt-4 rounded-lg border border-dashed p-3 text-sm"><div className="font-medium">Review before allocation decisions</div><ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">{statement.performance.knownUnknowns.map((unknown) => <li key={unknown}>{unknown}</li>)}</ul></div>}
        </section>
      )}

      {selectedMandateId && (
        <section className="rounded-xl border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">Review snapshots</h2>
              <p className="mt-1 text-sm text-muted-foreground">Freeze a versioned review report. Exports are redacted; publishing does not authorize or execute spend.</p>
            </div>
            <Button variant="outline" size="sm" onClick={publishStatement} disabled={publishing}><FileCheck className="h-3.5 w-3.5" />{publishing ? 'Publishing…' : 'Publish snapshot'}</Button>
          </div>
          {published === null ? (
            <p className="mt-4 text-sm text-muted-foreground">Loading published snapshots…</p>
          ) : published.length === 0 ? (
            <p className="mt-4 py-4 text-sm text-muted-foreground">No review snapshots yet. Publish one to freeze a versioned, hashed report for your team.</p>
          ) : (
            <div className="mt-4 divide-y">
              {published.map((item) => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium">v{item.version} · {new Date(item.publishedAt).toLocaleString()}</div>
                    <code className="block max-w-full truncate text-[11px] text-muted-foreground" title={item.contentHash}>sha256:{item.contentHash}</code>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => exportStatement(item.id)} disabled={exportingStatementId === item.id}><Download className="h-3.5 w-3.5" />{exportingStatementId === item.id ? 'Exporting…' : 'Export redacted'}</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {exported && (
            <div className="mt-4 rounded-lg border border-dashed p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-medium">Redacted export ready</div>
                <div className="text-xs text-muted-foreground">original sha256:{exported.originalContentHash.slice(0, 12)}… → redacted sha256:{exported.contentHash.slice(0, 12)}…</div>
              </div>
              <p className="mt-2 text-muted-foreground">Internal sources, notes, and evidence references are stripped; capital, mandate framing, and hashes are preserved. The JSON download was triggered in your browser.</p>
            </div>
          )}
        </section>
      )}

      {selectedMandateId && (
        <section id="outcomes" className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">Measured results</h2>
          <p className="mt-1 text-sm text-muted-foreground">Recorded outcomes support review; they are evidence, not causal ROI claims.</p>
          <div className="mt-4 divide-y">
            {observations.map((observation) => (
              <div key={observation.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <div className="font-medium">{observation.value} {observation.unit}</div>
                  <div className="text-xs text-muted-foreground">{observation.source} · {new Date(observation.observedAt).toLocaleString()}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{observation.kind === 'verified_external_state' ? 'Verified external state' : 'Observed'}</Badge>
                  <Badge variant="secondary">{observation.confidence.replaceAll('_', ' ')}</Badge>
                </div>
              </div>
            ))}
            {observations.length === 0 && <p className="py-4 text-sm text-muted-foreground">No outcomes recorded for this mandate yet.</p>}
          </div>
        </section>
      )}

      <div className="grid gap-px overflow-hidden rounded-xl bg-border sm:grid-cols-3">
        {([
          ['Attribution records', report.totalRecords],
          ['Consumed outcomes', report.counts.consumed],
          ['Held / uncertain', report.counts.held + report.counts.uncertain],
        ] as const).map(([label, value]) => (
          <div key={label} className="bg-card p-5">
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>

      <section className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-500" /><h2 className="font-semibold">By asset</h2></div>
        <div className="mt-4 space-y-2">
          {Object.entries(report.totalsByAsset).map(([asset, totals]) => (
            <div key={asset} className="grid gap-2 rounded-lg border p-3 text-sm sm:grid-cols-4 sm:items-center">
              <span className="font-medium">{asset}</span>
              <span><span className="text-muted-foreground">Allocated </span>{formatAmount(totals.allocatedAmount)}</span>
              <span><span className="text-muted-foreground">Consumed </span>{formatAmount(totals.consumedAmount)}</span>
              <span><span className="text-muted-foreground">Pending </span>{formatAmount(totals.pendingAmount)}</span>
            </div>
          ))}
          {Object.keys(report.totalsByAsset).length === 0 && <p className="text-sm text-muted-foreground">No allocations recorded yet.</p>}
        </div>
      </section>

      <section className="rounded-xl border bg-card p-5">
        <h2 className="font-semibold">Attribution records</h2>
        <p className="mt-1 text-sm text-muted-foreground">Each row connects an allocation to a governed intent and its execution evidence.</p>
        <div className="mt-4 divide-y">
          {report.records.map((record) => (
            <div key={`${record.runId}-${record.allocationId}`} className="grid gap-2 py-3 text-sm lg:grid-cols-[1.2fr_1fr_0.8fr_1fr_auto] lg:items-center">
              <div><div className="font-medium">{record.agentId}</div><code className="text-[11px] text-muted-foreground">{record.mandateId ? `${record.mandateId} · ` : ''}{record.allocationId}</code></div>
              <div className="text-muted-foreground">{record.asset} · {formatAmount(record.consumedAmount)} consumed</div>
              <Badge variant={record.status === 'consumed' ? 'secondary' : 'outline'}>{record.status}</Badge>
              <div className="text-xs text-muted-foreground">{record.outcome || 'No outcome recorded'}</div>
              {record.transactionLink ? <a className="inline-flex items-center gap-1 text-xs text-primary underline" href={record.transactionLink} target="_blank" rel="noreferrer">Receipt <ExternalLink className="h-3 w-3" /></a> : <span className="text-xs text-muted-foreground">No receipt</span>}
            </div>
          ))}
          {report.records.length === 0 && <p className="py-4 text-sm text-muted-foreground">No records yet.</p>}
        </div>
      </section>
    </div>
  );
}
