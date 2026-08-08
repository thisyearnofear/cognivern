"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ShieldCheck,
  XCircle,
  CheckCircle2,
  Loader2,
  ExternalLink,
  Wallet,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api-client";

interface CleanverseStatus {
  enabled: boolean;
  chain: string;
  monadChainId: number;
  aTokenAddress: string;
  aTokenSymbol: string;
  aTokenDecimals: number;
  gateAllSpends: boolean;
  apiConfigured: boolean;
}

interface ScreenParty {
  address: string;
  ok: boolean;
  reason?: string;
  aPass?: {
    status?: string;
    tier?: string;
    group?: string;
    isBlacklisted?: boolean;
    isPaused?: boolean;
  };
}

interface ScreeningResult {
  required: boolean;
  chain: string;
  sender: ScreenParty;
  recipient: ScreenParty;
  ok: boolean;
  reason?: string;
}

export function CleanverseDemo() {
  const [status, setStatus] = useState<CleanverseStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [sender, setSender] = useState("");
  const [recipient, setRecipient] = useState("");
  const [screening, setScreening] = useState<ScreeningResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.getCleanverseStatus();
        if (cancelled) return;
        if (res.success && res.data) {
          setStatus(res.data);
        } else {
          setStatusError(res.error || "Failed to load Cleanverse status");
        }
      } catch (err) {
        if (!cancelled) {
          setStatusError(err instanceof Error ? err.message : "Status failed");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const runScreen = useCallback(async () => {
    setBusy(true);
    setError(null);
    setScreening(null);
    try {
      const res = await apiClient.screenCleanverse({ sender, recipient });
      if (res.success && res.data) {
        setScreening(res.data as unknown as ScreeningResult);
      } else {
        setError(res.error || "Screening failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Screening failed");
    } finally {
      setBusy(false);
    }
  }, [sender, recipient]);

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10">
      <div className="space-y-3">
        <Badge variant="secondary">Track 2 · DeFi</Badge>
        <h1
          className="text-3xl font-semibold tracking-tight"
          style={{ fontFamily: "var(--font-space-grotesk)" }}
        >
          Verified Agent Capital Rail
        </h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Cognivern gates governed agent spend with Cleanverse CVI (A-Pass)
          before policy approval, then settles approved spends as CVA
          (aUSD-D) on Monad testnet. Screen two addresses below to see the
          identity gate that every Cleanverse-rail spend must pass.
        </p>
      </div>

      <div className="rounded-xl border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-sky-500" />
          <h2 className="font-semibold text-sm">Cleanverse status</h2>
          {status && (
            <Badge variant={status.enabled ? "default" : "secondary"} className="ml-auto">
              {status.enabled ? "API connected" : "Not configured"}
            </Badge>
          )}
        </div>
        {statusError && (
          <p className="text-xs text-red-600 dark:text-red-400">{statusError}</p>
        )}
        {status && (
          <dl className="grid gap-2 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Chain</dt>
              <dd className="font-mono">
                {status.chain} · {status.monadChainId}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">A-Token</dt>
              <dd className="font-mono">
                {status.aTokenSymbol} · {status.aTokenAddress.slice(0, 10)}…
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Gate all spends</dt>
              <dd>{status.gateAllSpends ? "yes" : "no (wallet opt-in)"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Explorer</dt>
              <dd>
                <a
                  className="inline-flex items-center gap-1 underline"
                  href="https://testnet.monadscan.com"
                  target="_blank"
                  rel="noreferrer"
                >
                  MonadScan testnet <ExternalLink className="h-3 w-3" />
                </a>
              </dd>
            </div>
          </dl>
        )}
      </div>

      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          <h2 className="font-semibold text-sm">CVI screen (A-Pass)</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Sender</label>
            <Input
              placeholder="0x…"
              value={sender}
              onChange={(e) => setSender(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Recipient</label>
            <Input
              placeholder="0x…"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
            />
          </div>
        </div>
        <Button
          onClick={runScreen}
          disabled={busy || !sender || !recipient}
          className="gap-2"
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Screening…
            </>
          ) : (
            "Screen identities"
          )}
        </Button>
        {error && (
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        )}
        {screening && (
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center gap-2">
              {screening.ok ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm font-medium">
                {screening.ok
                  ? "Both parties pass CVI — spend may proceed to policy + CVA"
                  : screening.reason || "CVI screening failed"}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 text-xs">
              <PartyCard label="Sender" party={screening.sender} />
              <PartyCard label="Recipient" party={screening.recipient} />
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border p-5 space-y-2 text-sm text-muted-foreground">
        <p className="font-medium text-foreground text-sm">Core spend loop</p>
        <ol className="list-decimal list-inside space-y-1 text-xs">
          <li>Set wallet <code>executionProvider: &quot;cleanverse&quot;</code> in Settings → Wallets (chain 10143).</li>
          <li>
            <code>POST /api/spend</code> screens sender + recipient via{" "}
            <code>query_apass</code> before policy evaluation.
          </li>
          <li>
            On approval, <code>verify_apass</code> then broadcasts an aUSD-D{" "}
            <code>transfer</code> on Monad; receipt + A-Pass evidence land in the CRE audit trail.
          </li>
        </ol>
      </div>
    </div>
  );
}

function PartyCard({ label, party }: { label: string; party: ScreenParty }) {
  return (
    <div className="rounded-md border p-3 space-y-1">
      <div className="flex items-center justify-between">
        <span className="font-medium">{label}</span>
        <Badge variant={party.ok ? "default" : "destructive"}>
          {party.ok ? "pass" : "fail"}
        </Badge>
      </div>
      <code className="block truncate text-[10px] text-muted-foreground">
        {party.address}
      </code>
      {party.aPass && (
        <p className="text-muted-foreground">
          {party.aPass.status} · {party.aPass.tier} · {party.aPass.group}
        </p>
      )}
      {!party.ok && party.reason && (
        <p className="text-red-600 dark:text-red-400">{party.reason}</p>
      )}
    </div>
  );
}
