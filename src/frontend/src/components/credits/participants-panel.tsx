'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Copy,
  KeyRound,
  Loader2,
  Lock,
  Unlock,
  UserX,
  ScrollText,
  PlusCircle,
  Pencil,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatUsd } from '@/lib/budget-format';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { apiClient, type CreditProgramParticipant, type CreditLedgerEntry } from '@/lib/api-client';
import { useCreditProgramParticipants } from '@/hooks/use-credit-programs';
import { mutate } from 'swr';
import { ProvisionDialog } from './provision-dialog';

export function ParticipantsPanel({
  programId,
  programName,
}: {
  programId: string;
  programName: string;
}) {
  const { data: participants, isLoading, error } = useCreditProgramParticipants(programId);
  const [provisionOpen, setProvisionOpen] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [topUpUsd, setTopUpUsd] = useState('');
  const [topUpBusy, setTopUpBusy] = useState(false);

  const [adjustTarget, setAdjustTarget] = useState<CreditProgramParticipant | null>(null);
  const [adjustValue, setAdjustValue] = useState('');
  const [adjustBusy, setAdjustBusy] = useState(false);

  const [rotateTarget, setRotateTarget] = useState<CreditProgramParticipant | null>(null);
  const [rotatedKey, setRotatedKey] = useState<string | null>(null);
  const [rotateBusy, setRotateBusy] = useState(false);

  const [ledgerTarget, setLedgerTarget] = useState<CreditProgramParticipant | null>(null);
  const [ledger, setLedger] = useState<CreditLedgerEntry[] | null>(null);
  const [ledgerBusy, setLedgerBusy] = useState(false);

  const [copied, setCopied] = useState<string | null>(null);

  const key = () => `/api/credit-programs/${programId}/participants`;

  async function handleTopUp(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(topUpUsd);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a positive amount');
      return;
    }
    setTopUpBusy(true);
    try {
      const res = await apiClient.topUpCreditProgram(programId, amount);
      if (!res.success) throw new Error(res.error || 'Top-up failed');
      toast.success(
        `Topped up ${res.data?.toppedUp ?? 0} active participant(s) by $${amount.toFixed(2)} base each`,
      );
      setTopUpOpen(false);
      setTopUpUsd('');
      await mutate(key());
      await mutate(`/api/credit-programs/${programId}/report`);
      await mutate(`/api/credit-programs/${programId}/funding`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Top-up failed');
    } finally {
      setTopUpBusy(false);
    }
  }

  async function handleAdjust(e: React.FormEvent) {
    e.preventDefault();
    if (!adjustTarget) return;
    const value = Number(adjustValue);
    if (!Number.isFinite(value) || value < 0) {
      toast.error('Enter a non-negative base allocation');
      return;
    }
    setAdjustBusy(true);
    try {
      const res = await apiClient.setCreditParticipantAllocation(programId, adjustTarget.id, value);
      if (!res.success) throw new Error(res.error || 'Adjustment failed');
      toast.success(`${adjustTarget.handle}'s base allocation set to $${value.toFixed(2)}`);
      setAdjustTarget(null);
      await mutate(key());
      await mutate(`/api/credit-programs/${programId}/report`);
      await mutate(`/api/credit-programs/${programId}/funding`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Adjustment failed');
    } finally {
      setAdjustBusy(false);
    }
  }

  async function handleRotate() {
    if (!rotateTarget) return;
    setRotateBusy(true);
    try {
      const res = await apiClient.rotateCreditParticipantKey(programId, rotateTarget.id);
      if (!res.success) throw new Error(res.error || 'Rotation failed');
      setRotatedKey(res.data?.gatewayKey ?? '');
      await mutate(key());
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Rotation failed');
    } finally {
      setRotateBusy(false);
    }
  }

  async function handleStatus(
    target: CreditProgramParticipant,
    status: 'active' | 'suspended' | 'revoked',
  ) {
    try {
      const res = await apiClient.setCreditParticipantStatus(programId, target.id, status);
      if (!res.success) throw new Error(res.error || 'Status change failed');
      toast.success(`${target.handle} is now ${status}`);
      await mutate(key());
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Status change failed');
    }
  }

  async function openLedger(target: CreditProgramParticipant) {
    setLedgerTarget(target);
    setLedger(null);
    setLedgerBusy(true);
    try {
      const res = await apiClient.getCreditParticipantLedger(programId, target.id);
      if (!res.success) throw new Error(res.error || 'Ledger failed');
      setLedger(res.data?.entries ?? []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Ledger failed');
      setLedgerTarget(null);
    } finally {
      setLedgerBusy(false);
    }
  }

  async function copyKey(key: string) {
    try {
      await navigator.clipboard.writeText(key);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error(`New key: ${key}`);
    }
  }

  if (isLoading && !participants) {
    return <Skeleton className="h-64" />;
  }

  if (error && !participants) {
    return (
      <p className="text-sm text-muted-foreground">Could not load participants: {error.message}</p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {participants?.length ?? 0} participant{(participants?.length ?? 0) === 1 ? '' : 's'} ·
          the allocation shown is base × tier multiplier, so it can rise when a participant opens
          up.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setTopUpOpen(true)}>
            <PlusCircle /> Top up all
          </Button>
          <Button size="sm" onClick={() => setProvisionOpen(true)}>
            <KeyRound /> Provision
          </Button>
        </div>
      </div>

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Handle</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Allocated</TableHead>
              <TableHead className="text-right">Consumed</TableHead>
              <TableHead className="text-right">Available</TableHead>
              <TableHead className="text-right">Calls</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(participants ?? []).map((participant) => (
              <TableRow key={participant.id}>
                <TableCell>
                  <div>
                    <p className="font-medium">{participant.handle}</p>
                    {participant.keyPrefix && (
                      <p className="text-[0.65rem] text-muted-foreground">
                        key {participant.keyPrefix}…
                        {participant.lastUsedAt
                          ? ` · last used ${new Date(participant.lastUsedAt).toLocaleString()}`
                          : ''}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <StatusBadge status={participant.disclosureTier} />
                </TableCell>
                <TableCell>
                  <StatusBadge status={participant.status} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatUsd(participant.allocationUsd)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatUsd(participant.consumedUsd)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatUsd(participant.availableUsd)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {participant.usage.requestCount}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Ledger"
                      onClick={() => openLedger(participant)}
                    >
                      <ScrollText />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Adjust allocation"
                      onClick={() => {
                        setAdjustTarget(participant);
                        setAdjustValue('');
                      }}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Rotate key"
                      onClick={() => {
                        setRotateTarget(participant);
                        setRotatedKey(null);
                      }}
                    >
                      <KeyRound />
                    </Button>
                    {participant.status === 'active' ? (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Suspend"
                        onClick={() => handleStatus(participant, 'suspended')}
                      >
                        <Lock />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Reactivate"
                        onClick={() => handleStatus(participant, 'active')}
                      >
                        <Unlock />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Revoke"
                      className="text-destructive"
                      onClick={() => handleStatus(participant, 'revoked')}
                    >
                      <UserX />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {participants && participants.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                  No participants yet. Provision the cohort to mint their gateway keys.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Top-up dialog */}
      <Dialog open={topUpOpen} onOpenChange={setTopUpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Top up every active participant</DialogTitle>
            <DialogDescription>
              Adds the same amount to each active participant&apos;s base allocation. Their disclosure
              multiplier still applies, so someone on the open tier gains proportionally more.
              All-or-nothing, and every line lands in the append-only ledger.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleTopUp} className="space-y-4">
            <Input
              type="number"
              min="0.01"
              step="0.01"
              value={topUpUsd}
              onChange={(e) => setTopUpUsd(e.target.value)}
              placeholder="5.00"
              autoFocus
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTopUpOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={topUpBusy}>
                {topUpBusy && <Loader2 className="animate-spin" />}
                Top up
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Adjust allocation dialog */}
      <Dialog
        open={adjustTarget !== null}
        onOpenChange={(open) => {
          if (!open) setAdjustTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set base allocation for {adjustTarget?.handle}</DialogTitle>
            <DialogDescription>
              This is the base the disclosure multiplier is applied to. Guarded against the pool
              using the worst case — the participant can still raise their tier afterwards.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdjust} className="space-y-4">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={adjustValue}
              onChange={(e) => setAdjustValue(e.target.value)}
              placeholder="20.00"
              autoFocus
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAdjustTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={adjustBusy}>
                {adjustBusy && <Loader2 className="animate-spin" />}
                Set allocation
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Rotate key dialog */}
      <Dialog
        open={rotateTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRotateTarget(null);
            setRotatedKey(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rotate {rotateTarget?.handle}&apos;s key</DialogTitle>
            <DialogDescription>
              {rotatedKey
                ? 'The previous key is now invalid. This one is shown once.'
                : 'The previous key stops working immediately. The new key is shown once — only a hash is stored.'}
            </DialogDescription>
          </DialogHeader>
          {rotatedKey ? (
            <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2">
              <code className="block truncate font-mono text-xs">{rotatedKey}</code>
              <Button variant="outline" size="sm" onClick={() => copyKey(rotatedKey)}>
                {copied === rotatedKey ? <Check /> : <Copy />}
                {copied === rotatedKey ? 'Copied' : 'Copy'}
              </Button>
            </div>
          ) : (
            <DialogFooter>
              <Button variant="outline" onClick={() => setRotateTarget(null)}>
                Cancel
              </Button>
              <Button onClick={handleRotate} disabled={rotateBusy}>
                {rotateBusy && <Loader2 className="animate-spin" />}
                Rotate key
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Ledger dialog */}
      <Dialog
        open={ledgerTarget !== null}
        onOpenChange={(open) => {
          if (!open) setLedgerTarget(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ledger — {ledgerTarget?.handle}</DialogTitle>
            <DialogDescription>
              Append-only line-by-line history. Corrections are new lines, never edits. Balances are
              in nano-USD for exactness.
            </DialogDescription>
          </DialogHeader>
          {ledgerBusy ? (
            <p className="text-sm text-muted-foreground">Loading ledger…</p>
          ) : (
            <div className="space-y-1.5">
              {(ledger ?? []).map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{entry.kind}</p>
                    <p className="text-muted-foreground">
                      {entry.note || entry.refType
                        ? `${entry.note ?? ''}${entry.refId ? ` (${entry.refType}: ${entry.refId})` : ''}`
                        : '—'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={
                        entry.amountNano >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }
                    >
                      {entry.amountNano >= 0 ? '+' : ''}
                      {formatUsd(entry.amountNano / 1_000_000_000, 6)}
                    </p>
                    <p className="text-muted-foreground">
                      bal {formatUsd(entry.balanceAfterNano / 1_000_000_000, 6)} ·{' '}
                      {new Date(entry.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
              {ledger && ledger.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No ledger lines yet.
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ProvisionDialog
        programId={programId}
        programName={programName}
        open={provisionOpen}
        onOpenChange={setProvisionOpen}
        onProvisioned={() => mutate(key())}
      />
    </div>
  );
}
