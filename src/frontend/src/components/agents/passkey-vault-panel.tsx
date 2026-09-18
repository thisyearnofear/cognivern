'use client';

import { useCallback, useEffect, useState } from 'react';
import { Fingerprint, KeyRound, Loader2, Lock, Unlock } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api-client';

/**
 * Passkey vault panel — "one passkey, many agent keys".
 *
 * The passkey wraps a server-side 32-byte root (mera secret vault). Agent
 * spend keys are HKDF-derived per agent+mandate context server-side; the
 * browser only ever handles the wrapped blob and the ephemeral root during
 * enroll/unlock ceremonies. Root and key material are never displayed.
 */

type VaultStatus = {
  enrolled: boolean;
  locked: boolean;
  enrolledAt: string | null;
  derivedKeyCount: number;
};

type DerivedKey = {
  walletId: string;
  name: string;
  address?: string;
  context?: string;
  agentId?: string;
  mandateId?: string | null;
  createdAt: string;
};

type Busy = 'enroll' | 'unlock' | 'lock' | 'derive' | null;

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/** Human-readable form for mera/WebAuthn failures. */
function describePasskeyError(error: unknown): string {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';
  if (code === 'PRF_UNAVAILABLE') {
    return 'This passkey authenticator does not support the WebAuthn PRF extension. Try a device-bound passkey (Touch ID, Windows Hello, Android).';
  }
  if (code === 'PASSKEY_OPERATION_FAILED' || code === 'CRYPTO_UNAVAILABLE') {
    return 'The passkey ceremony was cancelled or is unavailable in this browser. Passkeys require HTTPS (or localhost) and WebAuthn support.';
  }
  return error instanceof Error ? error.message : 'The passkey operation failed.';
}

function shortAddress(address?: string): string {
  if (!address) return '—';
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function PasskeyVaultPanel({
  agents,
}: {
  agents: Array<{ id: string; name: string }>;
}) {
  const [status, setStatus] = useState<VaultStatus | null>(null);
  const [keys, setKeys] = useState<DerivedKey[]>([]);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [agentId, setAgentId] = useState('');
  const [mandateId, setMandateId] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [statusRes, keysRes] = await Promise.all([
      apiClient.getPasskeyVaultStatus(),
      apiClient.listPasskeyAgentKeys(),
    ]);
    if (statusRes.success && statusRes.data) setStatus(statusRes.data);
    else setLoadError(statusRes.error || 'Could not load passkey vault status.');
    if (keysRes.success && keysRes.data) setKeys(keysRes.data);
  }, []);

  useEffect(() => {
    // Defer so the effect body doesn't synchronously setState on mount
    // (react-hooks/set-state-in-effect).
    const id = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(id);
  }, [refresh]);

  const handleEnroll = async () => {
    setBusy('enroll');
    setError(null);
    try {
      const begin = await apiClient.passkeyVaultEnrollBegin();
      if (!begin.success || !begin.data) {
        setError(begin.error || 'Could not start enrollment.');
        return;
      }
      // Wrap the provisional root behind a new passkey (mera secret vault).
      const { createSecretVaultWithNewPasskey } = await import(
        '@category-labs/mera'
      );
      const wrapped = await createSecretVaultWithNewPasskey({
        secret: base64ToBytes(begin.data.root),
        rp: { id: window.location.hostname, name: 'Cognivern' },
        user: {
          name: 'cognivern-operator',
          displayName: 'Cognivern operator',
        },
      });
      const commit = await apiClient.passkeyVaultEnrollCommit(
        wrapped as unknown as Record<string, unknown>,
      );
      if (!commit.success) {
        setError(commit.error || 'Enrollment commit failed.');
        return;
      }
      await refresh();
    } catch (e) {
      setError(describePasskeyError(e));
    } finally {
      setBusy(null);
    }
  };

  const handleUnlock = async () => {
    setBusy('unlock');
    setError(null);
    try {
      const begin = await apiClient.passkeyVaultUnlockBegin();
      if (!begin.success || !begin.data) {
        setError(begin.error || 'Could not start unlock.');
        return;
      }
      const { parseSecretVault, decryptSecretVaultWithPasskey } = await import(
        '@category-labs/mera'
      );
      const vault = parseSecretVault(begin.data.vault);
      const root = await decryptSecretVaultWithPasskey({
        vault,
        rpId: window.location.hostname,
      });
      const commit = await apiClient.passkeyVaultUnlockCommit(
        bytesToBase64(root),
      );
      if (!commit.success) {
        setError(commit.error || 'Unlock verification failed.');
        return;
      }
      await refresh();
    } catch (e) {
      setError(describePasskeyError(e));
    } finally {
      setBusy(null);
    }
  };

  const handleLock = async () => {
    setBusy('lock');
    setError(null);
    try {
      await apiClient.passkeyVaultLock();
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const handleDerive = async () => {
    if (!agentId) return;
    setBusy('derive');
    setError(null);
    try {
      const res = await apiClient.derivePasskeyAgentKey({
        agentId,
        mandateId: mandateId.trim() || undefined,
      });
      if (!res.success) {
        setError(res.error || 'Key derivation failed.');
        return;
      }
      setMandateId('');
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const unlocked = Boolean(status?.enrolled && !status?.locked);

  return (
    <section className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
            <Fingerprint className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold">Passkey vault</h2>
            <p className="text-xs text-muted-foreground">
              One passkey protects a root of trust; every agent spend key is
              derived from it under a mandate context.
            </p>
          </div>
        </div>
        {status?.enrolled && (
          <Badge variant={status.locked ? 'outline' : 'secondary'}>
            {status.locked ? 'locked' : 'unlocked'}
          </Badge>
        )}
      </div>

      {loadError && (
        <div
          role="alert"
          className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
        >
          {loadError}
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50/60 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
        >
          {error}
        </div>
      )}

      {/* Enrolled state */}
      {status?.enrolled ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {status.locked ? (
              <Button
                size="sm"
                onClick={() => void handleUnlock()}
                disabled={busy !== null}
              >
                {busy === 'unlock' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Unlock className="h-4 w-4" />
                )}
                Unlock with passkey
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleLock()}
                disabled={busy !== null}
              >
                {busy === 'lock' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Lock className="h-4 w-4" />
                )}
                Lock
              </Button>
            )}
            <span className="text-xs text-muted-foreground">
              Enrolled {status.enrolledAt ? new Date(status.enrolledAt).toLocaleDateString() : ''}
              {' · '}
              {status.derivedKeyCount}{' '}
              {status.derivedKeyCount === 1 ? 'key' : 'keys'} derived
            </span>
          </div>

          {/* Derive a mandate-scoped agent key */}
          <div className="rounded-lg border border-dashed p-3 space-y-2">
            <div className="text-xs font-medium flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5" /> Derive an agent key
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                className="h-9 rounded-md border bg-background px-2 text-sm min-w-[10rem]"
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                disabled={!unlocked || busy !== null}
                aria-label="Agent"
              >
                <option value="">Select agent…</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <Input
                className="h-9 w-44"
                placeholder="Mandate ID (optional)"
                value={mandateId}
                onChange={(e) => setMandateId(e.target.value)}
                disabled={!unlocked || busy !== null}
              />
              <Button
                size="sm"
                onClick={() => void handleDerive()}
                disabled={!unlocked || !agentId || busy !== null}
              >
                {busy === 'derive' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <KeyRound className="h-4 w-4" />
                )}
                Derive key
              </Button>
            </div>
            {!unlocked && (
              <p className="text-xs text-muted-foreground">
                Unlock the vault with your passkey to derive keys.
              </p>
            )}
            {unlocked && agents.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Create an API identity first — keys are scoped to an agent.
              </p>
            )}
          </div>

          {/* Derived keys */}
          {keys.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Derived keys
              </div>
              <div className="divide-y rounded-lg border">
                {keys.map((k) => (
                  <div
                    key={k.walletId}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="font-mono text-xs truncate">
                        {shortAddress(k.address)}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {k.context}
                      </div>
                    </div>
                    <Badge variant="outline" className="shrink-0">
                      passkey
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Not enrolled */
        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="sm"
            onClick={() => void handleEnroll()}
            disabled={busy !== null}
          >
            {busy === 'enroll' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Fingerprint className="h-4 w-4" />
            )}
            Set up passkey
          </Button>
          <p className="text-xs text-muted-foreground">
            Creates a passkey that wraps the vault root. The same passkey on
            any of your devices can later unlock it — nothing else to back up.
          </p>
        </div>
      )}
    </section>
  );
}
