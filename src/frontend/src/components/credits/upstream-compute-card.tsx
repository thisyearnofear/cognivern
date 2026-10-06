'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { KeyRound, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';

/**
 * Bring-your-own upstream compute: paste the program's provider key once and
 * participant calls meter against it. The key is encrypted server-side under
 * OWS_VAULT_SECRET and never returned by any endpoint — this card only ever
 * shows provider + last-4 hint. Pooling per-person promo codes may violate
 * the sponsor's terms; that compliance call is the organiser's.
 */
export function UpstreamComputeCard({ programId }: { programId: string }) {
  const [status, setStatus] = useState<{
    configured: boolean;
    provider: string | null;
    keyHint: string | null;
    updatedAt: string | null;
  } | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await apiClient.getUpstreamCredential(programId);
      if (res.success) setStatus(res.data?.credential ?? null);
    } catch {
      // Status stays unknown rather than blocking the tab.
    }
  }, [programId]);

  useEffect(() => {
    // Deferred a tick so the fetch is async from the effect's point of view
    // (react lint: no synchronous setState in effects).
    queueMicrotask(() => void refresh());
  }, [refresh]);

  async function save() {
    if (keyInput.trim().length < 8 || busy) return;
    setBusy(true);
    try {
      const res = await apiClient.setUpstreamCredential(programId, 'anthropic', keyInput.trim());
      if (!res.success) throw new Error(res.error || 'Save failed');
      setStatus(res.data?.credential ?? null);
      setKeyInput('');
      toast.success('Upstream key stored — participant calls now route through Anthropic');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await apiClient.revokeUpstreamCredential(programId);
      if (!res.success) throw new Error(res.error || 'Revoke failed');
      setStatus({ configured: false, provider: null, keyHint: null, updatedAt: null });
      toast.success('Upstream key revoked — gateway calls will deny until a key is added');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Revoke failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Upstream compute" className="rounded-xl border bg-card p-4">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <KeyRound className="size-3.5 text-muted-foreground" /> Upstream compute
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Bring your own grant credits: participant keys meter against your Anthropic key instead of
        the default router. Stored encrypted, never shown again.
      </p>
      <div className="mt-3 text-xs">
        {status == null ? (
          <span className="text-muted-foreground">Checking…</span>
        ) : status.configured ? (
          <span>
            Connected: <span className="font-medium">{status.provider}</span>{' '}
            <span className="font-mono text-muted-foreground">{status.keyHint}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">No upstream key — programs route through the default provider.</span>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="password"
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
          placeholder={status?.configured ? 'Paste a new key to rotate' : 'Paste your Anthropic API key'}
          autoComplete="off"
          spellCheck={false}
          className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2.5 text-xs"
        />
        <Button size="sm" variant="outline" onClick={() => void save()} disabled={keyInput.trim().length < 8 || busy}>
          {busy ? <Loader2 className="animate-spin" /> : null} {status?.configured ? 'Rotate' : 'Connect'}
        </Button>
        {status?.configured && (
          <Button size="sm" variant="ghost" onClick={() => void revoke()} disabled={busy}>
            Revoke
          </Button>
        )}
      </div>
    </section>
  );
}
