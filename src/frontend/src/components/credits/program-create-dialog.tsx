'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { apiClient } from '@/lib/api-client';

export function ProgramCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [sponsorName, setSponsorName] = useState('');
  const [poolUsd, setPoolUsd] = useState('');
  const [baseAllocationUsd, setBaseAllocationUsd] = useState('');
  const [allowedModels, setAllowedModels] = useState('');
  const [maxOutputTokens, setMaxOutputTokens] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [multipliersMode, setMultipliersMode] = useState<'bonus' | 'ceiling'>('ceiling');
  const [status, setStatus] = useState<'draft' | 'active'>('active');

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Program name is required');
      return;
    }
    const pool = Number(poolUsd);
    const base = Number(baseAllocationUsd);
    if (!Number.isFinite(pool) || pool < 0) {
      toast.error('Pool amount must be a valid number');
      return;
    }
    if (!Number.isFinite(base) || base <= 0) {
      toast.error('Per-participant allocation must be a positive number');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiClient.createCreditProgram({
        name: name.trim(),
        sponsorName: sponsorName.trim() || undefined,
        poolUsd: pool,
        baseAllocationUsd: base,
        allowedModels: allowedModels
          .split(',')
          .map((m) => m.trim())
          .filter(Boolean),
        maxOutputTokens: maxOutputTokens ? Number(maxOutputTokens) : undefined,
        startsAt: startsAt ? new Date(startsAt).toISOString() : undefined,
        endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
        multipliersMode,
        status,
      });
      if (!res.success) throw new Error(res.error || 'Failed to create program');
      toast.success('Credit program created');
      onCreated();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create program');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New credit program</DialogTitle>
          <DialogDescription>
            The pool is bookkeeping for now — the real upstream deposit is a separate act at the
            provider. The funding banner on the program page reconciles the two.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="cp-name" className="text-xs font-medium">
                Program name
              </label>
              <Input
                id="cp-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Summer Hackathon 2026"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="cp-sponsor" className="text-xs font-medium">
                Sponsor name
              </label>
              <Input
                id="cp-sponsor"
                value={sponsorName}
                onChange={(e) => setSponsorName(e.target.value)}
                placeholder="Acme Labs"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="cp-pool" className="text-xs font-medium">
                Pool (USD)
              </label>
              <Input
                id="cp-pool"
                type="number"
                min="0"
                step="0.01"
                value={poolUsd}
                onChange={(e) => setPoolUsd(e.target.value)}
                placeholder="1000"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="cp-base" className="text-xs font-medium">
                Per-participant allocation (USD)
              </label>
              <Input
                id="cp-base"
                type="number"
                min="0.01"
                step="0.01"
                value={baseAllocationUsd}
                onChange={(e) => setBaseAllocationUsd(e.target.value)}
                placeholder="20"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="cp-models" className="text-xs font-medium">
              Allowed models (comma-separated, empty = all)
            </label>
            <Input
              id="cp-models"
              value={allowedModels}
              onChange={(e) => setAllowedModels(e.target.value)}
              placeholder="glm-5.2, llama-3.3-70b"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="cp-mode" className="text-xs font-medium">
                Multiplier philosophy
              </label>
              <Select
                value={multipliersMode}
                onValueChange={(v) => setMultipliersMode(v as 'bonus' | 'ceiling')}
              >
                <SelectTrigger id="cp-mode" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ceiling">
                    Ceiling — $20 is the max, $1,000 covers 50 × $20 exactly
                  </SelectItem>
                  <SelectItem value="bonus">
                    Bonus — open disclosure doubles the budget, pool needs 2×
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="cp-maxtok" className="text-xs font-medium">
                Max output tokens
              </label>
              <Input
                id="cp-maxtok"
                type="number"
                min="1"
                value={maxOutputTokens}
                onChange={(e) => setMaxOutputTokens(e.target.value)}
                placeholder="4096"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="cp-start" className="text-xs font-medium">
                Starts at
              </label>
              <Input
                id="cp-start"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="cp-end" className="text-xs font-medium">
                Ends at
              </label>
              <Input
                id="cp-end"
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="cp-status" className="text-xs font-medium">
              Status on creation
            </label>
            <Select value={status} onValueChange={(v) => setStatus(v as 'draft' | 'active')}>
              <SelectTrigger id="cp-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active — participants can spend immediately</SelectItem>
                <SelectItem value="draft">Draft — provision first, go live later</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="animate-spin" />}
              Create program
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
