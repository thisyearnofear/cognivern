'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Loader2,
  Play,
  Pause,
  XCircle,
  Users,
  Wallet,
  Activity,
  FileSearch,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageState } from '@/components/ui/error-state';
import { formatUsd } from '@/lib/budget-format';
import { apiClient, type CreditProgramStatus } from '@/lib/api-client';
import {
  useCreditProgram,
  useCreditProgramFunding,
  useCreditProgramReport,
} from '@/hooks/use-credit-programs';
import { mutate } from 'swr';
import { FundingBanner } from './funding-banner';
import { ParticipantsPanel } from './participants-panel';
import { ActivityFeed } from './activity-feed';
import { ReconcileView } from './reconcile-view';
import { CommitmentsPanel } from './commitments-panel';

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export function CreditProgramDetail({ programId }: { programId: string }) {
  const router = useRouter();
  const { data: programData, isLoading, error } = useCreditProgram(programId);
  const { data: funding, mutate: mutateFunding } = useCreditProgramFunding(programId);
  const { data: report } = useCreditProgramReport(programId);
  const [statusBusy, setStatusBusy] = useState<CreditProgramStatus | null>(null);

  const program = programData?.program;

  const refresh = async () => {
    await mutate(`/api/credit-programs/${programId}`);
    await mutate(`/api/credit-programs/${programId}/report`);
    await mutate(`/api/credit-programs/${programId}/funding`);
    await mutate('/api/credit-programs');
  };

  async function setStatus(status: CreditProgramStatus) {
    if (!program) return;
    setStatusBusy(status);
    try {
      const res = await apiClient.updateCreditProgram(programId, { status });
      if (!res.success) throw new Error(res.error || 'Status change failed');
      toast.success(`Program is now ${status}`);
      await refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Status change failed');
    } finally {
      setStatusBusy(null);
    }
  }

  if (isLoading && !program) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-40" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    );
  }

  if (error && !program) {
    return (
      <PageState
        variant="error"
        title="Could not load this credit program"
        message={error.message}
        action={{ label: 'Back to programs', onClick: () => router.push('/sponsor/credits') }}
      />
    );
  }

  if (!program) return null;

  const totals = report?.totals;

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.push('/sponsor/credits')}
        className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> All programs
      </button>

      <PageHeader
        eyebrow={`${program.sponsorName || 'Unnamed sponsor'} · ${program.backend}`}
        title={program.name}
        action={
          <div className="flex flex-wrap gap-2">
            {program.status === 'active' ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStatus('paused')}
                disabled={statusBusy !== null}
              >
                {statusBusy === 'paused' ? <Loader2 className="animate-spin" /> : <Pause />}
                Pause
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStatus('active')}
                disabled={statusBusy !== null}
              >
                {statusBusy === 'active' ? <Loader2 className="animate-spin" /> : <Play />}
                Activate
              </Button>
            )}
            {program.status !== 'closed' && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setStatus('closed')}
                disabled={statusBusy !== null}
              >
                {statusBusy === 'closed' ? <Loader2 className="animate-spin" /> : <XCircle />}
                Close
              </Button>
            )}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={program.status} />
        <Badge variant="outline">{program.multipliersMode} multipliers</Badge>
        {program.allowedModels.length > 0 && (
          <span className="text-sm text-muted-foreground">
            models: {program.allowedModels.join(', ')}
          </span>
        )}
        {program.endsAt && (
          <span className="text-sm text-muted-foreground">
            ends {new Date(program.endsAt).toLocaleString()}
          </span>
        )}
      </div>

      <FundingBanner funding={funding} onRefresh={() => mutateFunding()} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Pool"
          value={formatUsd(totals?.poolUsd ?? program.poolUsd)}
          hint="configured ledger pool"
        />
        <StatCard
          label="Allocated"
          value={formatUsd(totals?.allocatedUsd)}
          hint="multiplier-applied"
        />
        <StatCard
          label="Consumed"
          value={formatUsd(totals?.consumedUsd)}
          hint="real spend, provider-metered"
        />
        <StatCard
          label="Requests"
          value={String(totals?.requestCount ?? 0)}
          hint={`${totals?.participantCount ?? 0} participant(s)`}
        />
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="participants">Participants</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="reconcile">Reconcile</TabsTrigger>
          <TabsTrigger value="verification">Verification</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <OverviewTab report={report} />
        </TabsContent>

        <TabsContent value="participants" className="space-y-4">
          <ParticipantsPanel programId={programId} programName={program.name} />
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <ActivityFeed programId={programId} />
        </TabsContent>

        <TabsContent value="reconcile" className="space-y-4">
          <ReconcileView programId={programId} />
        </TabsContent>

        <TabsContent value="verification" className="space-y-4">
          <CommitmentsPanel programId={programId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-[0.7rem] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function OverviewTab({
  report,
}: {
  report: Awaited<ReturnType<typeof useCreditProgramReport>>['data'];
}) {
  if (!report) {
    return <Skeleton className="h-64" />;
  }

  const maxModelCost = Math.max(0, ...report.byModel.map((m) => m.costUsd));
  const maxTaskCost = Math.max(0, ...report.byTaskClass.map((t) => t.costUsd));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        <div className="rounded-xl border bg-card p-4">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Activity className="size-3.5 text-muted-foreground" /> Spend by model
          </p>
          <div className="mt-3 space-y-2">
            {report.byModel.length === 0 && (
              <p className="text-xs text-muted-foreground">No spend yet.</p>
            )}
            {report.byModel.map((row) => (
              <div key={row.model}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{row.model}</span>
                  <span className="text-muted-foreground">
                    {formatUsd(row.costUsd)} · {row.requestCount} calls
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{
                      width: `${maxModelCost > 0 ? (row.costUsd / maxModelCost) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <FileSearch className="size-3.5 text-muted-foreground" /> Spend by task class
          </p>
          <div className="mt-3 space-y-2">
            {report.byTaskClass.length === 0 && (
              <p className="text-xs text-muted-foreground">No spend yet.</p>
            )}
            {report.byTaskClass.map((row) => (
              <div key={row.taskClass}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{row.taskClass}</span>
                  <span className="text-muted-foreground">{formatUsd(row.costUsd)}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${maxTaskCost > 0 ? (row.costUsd / maxTaskCost) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-xl border bg-card p-4">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Wallet className="size-3.5 text-muted-foreground" /> Disclosure mix
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(report.disclosureMix).length === 0 && (
              <p className="text-xs text-muted-foreground">No participants yet.</p>
            )}
            {Object.entries(report.disclosureMix).map(([tier, count]) => (
              <span key={tier} className="inline-flex items-center gap-1.5">
                <StatusBadge status={tier} />
                <span className="text-xs text-muted-foreground">{count}</span>
              </span>
            ))}
          </div>
          <p className="mt-2 text-[0.7rem] text-muted-foreground">
            Privacy costs budget under ceiling multipliers; openness earns a bonus under bonus
            multipliers. The tier is the participant&apos;s own choice — the sponsor never sets it.
          </p>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Users className="size-3.5 text-muted-foreground" /> Top consumers
          </p>
          <div className="mt-3 space-y-2">
            {report.participants.length === 0 && (
              <p className="text-xs text-muted-foreground">No participants yet.</p>
            )}
            {report.participants.slice(0, 10).map((participant) => (
              <div
                key={participant.handle}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="truncate font-medium">{participant.handle}</span>
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span>
                    {formatUsd(participant.consumedUsd)} of {formatUsd(participant.allocationUsd)}
                  </span>
                  <span className="w-10 text-right">{pct(participant.utilisation)}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {report.caveats.length > 0 && (
          <div className="rounded-xl border border-dashed p-4 text-[0.7rem] text-muted-foreground">
            <p className="mb-1 font-medium">Caveats</p>
            <ul className="list-inside list-disc space-y-1">
              {report.caveats.map((caveat, index) => (
                <li key={index}>{caveat}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
