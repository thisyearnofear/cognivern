'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, ExternalLink, FileText, Loader2, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageState } from '@/components/ui/error-state';
import { apiClient, type FundedMandate, type FundedMandateStatement, type OutcomeObservation, type SpendAttributionReport } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

function formatAmount(value: string) {
  if (!/^\d+$/.test(value)) return '—';
  try {
    return BigInt(value).toLocaleString();
  } catch {
    return '—';
  }
}

export function CapitalPage() {
  const router = useRouter();
  const isConnected = useAuthStore((state) => state.isConnected);
  const [report, setReport] = useState<SpendAttributionReport | null>(null);
  const [mandates, setMandates] = useState<FundedMandate[]>([]);
  const [selectedMandateId, setSelectedMandateId] = useState('');
  const [observations, setObservations] = useState<OutcomeObservation[]>([]);
  const [statement, setStatement] = useState<FundedMandateStatement | null>(null);
  const [statementLoading, setStatementLoading] = useState(false);
  const [statementError, setStatementError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConnected) return;
    Promise.all([
      apiClient.getMandates(),
      apiClient.getSpendAttribution(selectedMandateId || undefined),
      selectedMandateId ? apiClient.getOutcomeObservations(selectedMandateId) : Promise.resolve(null),
    ])
      .then(([mandateResponse, reportResponse, observationResponse]) => {
        setError(null);
        if (mandateResponse.success && mandateResponse.data) setMandates(mandateResponse.data);
        if (!reportResponse.success || !reportResponse.data) throw new Error(reportResponse.error || 'Could not load attribution');
        setReport(reportResponse.data);
        if (observationResponse?.success && observationResponse.data) setObservations(observationResponse.data);
        if (!selectedMandateId) {
          setObservations([]);
          setStatement(null);
        }
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not load attribution'))
      .finally(() => setLoading(false));
  }, [isConnected, selectedMandateId]);

  if (!isConnected) {
    return <PageState variant="empty" title="Sign in to view capital attribution" message="The ledger is scoped to your workspace." />;
  }
  if (loading) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading attribution ledger…</div>;
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

  if (error || !report) {
    return <PageState variant="error" title="Could not load attribution" message={error || 'The attribution report is unavailable.'} action={{ label: 'Retry', onClick: () => window.location.reload() }} />;
  }

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
            <h2 className="font-semibold">Funded mandate context</h2>
            <p className="mt-1 text-sm text-muted-foreground">Filter governed spend without turning observations into causal ROI claims.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {selectedMandateId && <Button variant="outline" size="sm" onClick={loadStatement} disabled={statementLoading}><FileText className="h-3.5 w-3.5" />{statementLoading ? 'Generating…' : 'Preview statement'}</Button>}
            <select
            aria-label="Filter by funded mandate"
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={selectedMandateId}
            onChange={(event) => {
              setSelectedMandateId(event.target.value);
              setStatement(null);
              setStatementError(null);
              setError(null);
            }}
            >
              <option value="">All mandates</option>
              {mandates.map((mandate) => <option key={mandate.id} value={mandate.id}>{mandate.name}</option>)}
            </select>
          </div>
        </div>
        {selectedMandateId && mandates.find((mandate) => mandate.id === selectedMandateId) && (
          <div className="mt-3 rounded-lg bg-muted/40 p-3 text-sm">
            <span className="font-medium">{mandates.find((mandate) => mandate.id === selectedMandateId)?.name}</span>
            <span className="ml-2 text-muted-foreground">{mandates.find((mandate) => mandate.id === selectedMandateId)?.objective}</span>
          </div>
        )}
      </section>

      {statementError && (
        <section className="rounded-xl border border-destructive/40 bg-destructive/5 p-5 text-sm text-destructive">
          {statementError}
        </section>
      )}

      {statement && (
        <section className="rounded-xl border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">Statement candidate</h2>
              <p className="mt-1 text-sm text-muted-foreground">Read-only snapshot for review. It is hashed for integrity, not published or treated as ROI.</p>
            </div>
            <code className="max-w-full truncate rounded bg-muted px-2 py-1 text-[11px] text-muted-foreground" title={statement.contentHash}>sha256:{statement.contentHash}</code>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-muted/40 p-3"><div className="text-lg font-semibold">{statement.performance.evidenceCompleteness.spendRecordCount}</div><div className="text-xs text-muted-foreground">Spend records</div></div>
            <div className="rounded-lg bg-muted/40 p-3"><div className="text-lg font-semibold">{statement.performance.evidenceCompleteness.outcomeCount}</div><div className="text-xs text-muted-foreground">Observed outcomes</div></div>
            <div className="rounded-lg bg-muted/40 p-3"><div className="text-lg font-semibold">{statement.performance.knownUnknowns.length}</div><div className="text-xs text-muted-foreground">Known unknowns</div></div>
          </div>
          {statement.performance.knownUnknowns.length > 0 && <div className="mt-4 rounded-lg border border-dashed p-3 text-sm"><div className="font-medium">Review before allocation decisions</div><ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">{statement.performance.knownUnknowns.map((unknown) => <li key={unknown}>{unknown}</li>)}</ul></div>}
        </section>
      )}

      {selectedMandateId && (
        <section className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">Observed outcomes</h2>
          <p className="mt-1 text-sm text-muted-foreground">Recorded observations are evidence for review, not causal ROI claims.</p>
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
