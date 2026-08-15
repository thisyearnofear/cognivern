'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PlusCircle, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PageState } from '@/components/ui/error-state';
import { formatUsd } from '@/lib/budget-format';
import { useCreditPrograms } from '@/hooks/use-credit-programs';
import { ProgramCreateDialog } from './program-create-dialog';
import type { CreditProgramSummary } from '@/lib/api-client';

export function CreditProgramsPage() {
  const router = useRouter();
  const { data: programs, isLoading, error, mutate } = useCreditPrograms();
  const [createOpen, setCreateOpen] = useState(false);

  if (isLoading && !programs) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-64" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  if (error && !programs) {
    return (
      <PageState
        variant="error"
        title="Could not load credit programs"
        message={error.message}
        action={{ label: 'Retry', onClick: () => mutate() }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sponsored Credits"
        description="Fund one upstream account, provision participants with cvk_ gateway keys, and watch every call land in the ledger. Credits are dead outside the program window — no config needed at the end."
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <PlusCircle /> New program
          </Button>
        }
      />

      {programs && programs.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          No credit programs yet. Create one to fund a cohort — e.g. a hackathon pool of $1,000
          split across 50 participants.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(programs ?? []).map((program) => (
            <ProgramCard
              key={program.id}
              program={program}
              onOpen={() => router.push(`/sponsor/credits/${program.id}`)}
            />
          ))}
        </div>
      )}

      <ProgramCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => {
          setCreateOpen(false);
          mutate();
        }}
      />
    </div>
  );
}

function ProgramCard({ program, onOpen }: { program: CreditProgramSummary; onOpen: () => void }) {
  const participantCount =
    program.poolUsd > 0 ? Math.floor(program.poolUsd / program.baseAllocationUsd) : 0;
  return (
    <button
      onClick={onOpen}
      className="group rounded-xl border bg-card p-5 text-left transition-colors hover:border-primary/40 hover:bg-muted/40"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-medium">{program.name}</h3>
          <p className="truncate text-xs text-muted-foreground">
            {program.sponsorName || 'Unnamed sponsor'} · {program.backend}
          </p>
        </div>
        <StatusBadge status={program.status} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Pool</p>
          <p className="font-medium">{formatUsd(program.poolUsd)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Per person</p>
          <p className="font-medium">{formatUsd(program.baseAllocationUsd)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Cohort</p>
          <p className="font-medium">~{participantCount}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <Badge variant="outline">{program.multipliersMode} multipliers</Badge>
        <span className="flex items-center text-xs text-muted-foreground group-hover:text-foreground">
          Manage <ArrowUpRight className="size-3" />
        </span>
      </div>
    </button>
  );
}
