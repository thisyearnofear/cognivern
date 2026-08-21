'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Copy, KeyRound, Loader2, Check, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { apiClient } from '@/lib/api-client';

function parseHandles(text: string): string[] {
  return text
    .split(/[\n,]+/)
    .map((h) => h.trim())
    .filter(Boolean);
}

export function ProvisionDialog({
  programId,
  programName,
  open,
  onOpenChange,
  onProvisioned,
}: {
  programId: string;
  programName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProvisioned: () => void;
}) {
  const [handlesText, setHandlesText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [issued, setIssued] = useState<Array<{ handle: string; gatewayKey: string }> | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const handles = parseHandles(handlesText);

  async function handleProvision(e: React.FormEvent) {
    e.preventDefault();
    if (handles.length === 0) {
      toast.error('Paste at least one participant handle');
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiClient.provisionCreditParticipants(programId, handles);
      if (!res.success) throw new Error(res.error || 'Provisioning failed');
      setIssued(res.data?.participants ?? []);
      toast.success(
        `Minted ${res.data?.participants.length ?? 0} gateway key${(res.data?.participants.length ?? 0) === 1 ? '' : 's'}`,
      );
      onProvisioned();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Provisioning failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function copyKey(key: string, handle: string) {
    try {
      await navigator.clipboard.writeText(key);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error(`Could not copy — key for ${handle}: ${key}`);
    }
  }

  function downloadCsv() {
    if (!issued || issued.length === 0) return;
    // Keys are shown exactly once; the CSV is the take-away for handing out
    // a whole cohort in one motion (mail merge, spreadsheet, encrypted file).
    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const rows = ['handle,gateway_key', ...issued.map(({ handle, gatewayKey }) => `${escape(handle)},${escape(gatewayKey)}`)];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${programName.replace(/[^a-z0-9-_]+/gi, '_').toLowerCase()}_keys.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded credentials for ${issued.length} participant(s)`);
  }

  function reset() {
    setIssued(null);
    setHandlesText('');
    setCopied(null);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {issued ? 'Provisioned — copy the keys now' : `Provision ${programName}`}
          </DialogTitle>
          <DialogDescription>
            {issued
              ? 'Keys are shown once and only a hash is stored. Distribute them now; a lost key is rotated, never recovered.'
              : 'One handle per line (or comma-separated). Bare handles work; this is the 50-username-paste case. The cohort provisions atomically — a failure anywhere rolls back the whole batch.'}
          </DialogDescription>
        </DialogHeader>

        {issued ? (
          <div className="space-y-2">
            {issued.map(({ handle, gatewayKey }) => (
              <div
                key={handle}
                className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">{handle}</p>
                  <code className="block truncate text-xs text-muted-foreground">{gatewayKey}</code>
                </div>
                <Button variant="outline" size="sm" onClick={() => copyKey(gatewayKey, handle)}>
                  {copied === gatewayKey ? <Check /> : <Copy />}
                  {copied === gatewayKey ? 'Copied' : 'Copy'}
                </Button>
              </div>
            ))}
            <p className="pt-1 text-xs text-amber-600 dark:text-amber-400">
              The raw keys are gone once this dialog closes. If any are lost, use rotate-key on the
              participant.
            </p>
            <DialogFooter className="pt-2">
              <Button variant="outline" onClick={downloadCsv}>
                <Download /> Download keys CSV
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleProvision}>
            <Textarea
              value={handlesText}
              onChange={(e) => setHandlesText(e.target.value)}
              placeholder={'alice\nbob\ncarol'}
              className="min-h-40 font-mono text-sm"
              autoFocus
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              {handles.length === 0
                ? 'Paste participant handles to mint their gateway keys.'
                : `${handles.length} participant${handles.length === 1 ? '' : 's'} — ${handles.slice(0, 5).join(', ')}${handles.length > 5 ? `…` : ''}`}
            </p>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || handles.length === 0}>
                {submitting && <Loader2 className="animate-spin" />}
                <KeyRound />
                Mint {handles.length || ''} key{handles.length === 1 ? '' : 's'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
