"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  XCircle,
  CheckCircle2,
  Loader2,
  ExternalLink,
  Fingerprint,
  Coins,
  Settings2,
  ArrowRight,
  Activity,
  AlertTriangle,
  Scale,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { apiClient } from "@/lib/api-client";
import { trackUxEvent } from "@/lib/ux-events";

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

interface SpendStatusSlice {
  cleanverse?: {
    enabled: boolean;
    chain: string;
    monadChainId: number;
    aTokenAddress: string;
    aTokenSymbol: string;
    gateAllSpends: boolean;
  };
  features?: string[];
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

export function VerifiedCapitalPage() {
  const [status, setStatus] = useState<CleanverseStatus | null>(null);
  const [spendStatus, setSpendStatus] = useState<SpendStatusSlice | null>(null);
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
        const [cv, spend] = await Promise.all([
          apiClient.getCleanverseStatus(),
          apiClient.getSpendStatus(),
        ]);
        if (cancelled) return;
        if (cv.success && cv.data) setStatus(cv.data);
        else setStatusError(cv.error || "Failed to load Cleanverse status");
        if (spend.success && spend.data) setSpendStatus(spend.data);
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
    trackUxEvent("primary_action_clicked", "verified_capital_screen");
    try {
      const res = await apiClient.screenCleanverse({ sender, recipient });
      if (res.success && res.data) {
        const data = res.data as unknown as ScreeningResult;
        setScreening(data);
        trackUxEvent(
          "primary_action_completed",
          "verified_capital_screen",
          data.ok ? "pass" : "fail",
        );
      } else {
        setError(res.error || "Screening failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Screening failed");
    } finally {
      setBusy(false);
    }
  }, [sender, recipient]);

  const railLive = Boolean(status?.enabled);

  return (
    <div className="relative mx-auto max-w-3xl space-y-8 px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-8 h-56 opacity-70"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 15% 0%, color-mix(in oklab, #0f766e 14%, transparent), transparent 70%), radial-gradient(ellipse 50% 40% at 95% 5%, color-mix(in oklab, var(--primary) 8%, transparent), transparent 60%)",
        }}
      />

      <header className="relative space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={railLive ? "default" : "secondary"}>
            {railLive ? "Rail connected" : "Credentials required"}
          </Badge>
          <Badge variant="outline">
            Monad · {status?.monadChainId ?? 10143}
          </Badge>
          {spendStatus?.features?.includes("cleanverse-cvi-cva") && (
            <Badge variant="outline">Spend path armed</Badge>
          )}
        </div>
        <h1
          className="text-3xl font-semibold tracking-tight"
          style={{ fontFamily: "var(--font-space-grotesk)" }}
        >
          Verified Capital
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Cleanverse is wired into Cognivern&apos;s governed spend path—not a
          side demo. Wallets on this rail screen{" "}
          <strong className="font-medium text-foreground">CVI (A-Pass)</strong>{" "}
          before policy approval, then settle{" "}
          <strong className="font-medium text-foreground">CVA (aUSD-D)</strong>{" "}
          on Monad. Evidence lands in the same CRE / audit trail as every other
          spend.
        </p>
      </header>

      {/* Integration path */}
      <section className="relative grid gap-3 sm:grid-cols-4">
        {[
          {
            icon: Fingerprint,
            title: "CVI gate",
            body: "query_apass on sender + recipient before policy",
          },
          {
            icon: Scale,
            title: "Policy",
            body: "Existing SpendOS / mandate rules still apply",
          },
          {
            icon: Coins,
            title: "CVA settle",
            body: "verify_apass + aUSD-D ERC-20 on Monad",
          },
          {
            icon: Activity,
            title: "Evidence",
            body: "cleanverse_apass + receipt in CRE runs",
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className="rounded-xl border bg-card/80 p-4 space-y-2"
            >
              <Icon className="h-4 w-4 text-teal-700 dark:text-teal-400" />
              <h2 className="text-sm font-medium">{item.title}</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {item.body}
              </p>
            </div>
          );
        })}
      </section>

      <section className="relative grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <h2
            className="text-sm font-semibold"
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
            Rail status
          </h2>
          {statusError && (
            <p className="text-xs text-red-600 dark:text-red-400">{statusError}</p>
          )}
          {status ? (
            <dl className="grid gap-2 text-xs">
              <Row label="API" value={status.enabled ? "connected" : "not configured"} />
              <Row label="Chain" value={`${status.chain} · ${status.monadChainId}`} mono />
              <Row label="A-Token" value={status.aTokenSymbol} mono />
              <Row
                label="Contract"
                value={`${status.aTokenAddress.slice(0, 8)}…${status.aTokenAddress.slice(-6)}`}
                mono
              />
              <Row
                label="Gate mode"
                value={
                  status.gateAllSpends
                    ? "all spends"
                    : "opt-in wallets (executionProvider=cleanverse)"
                }
              />
              <div className="pt-1">
                <a
                  className="inline-flex items-center gap-1 text-xs underline"
                  href={`https://testnet.monadscan.com/address/${status.aTokenAddress}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View aUSD-D on MonadScan <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </dl>
          ) : (
            <p className="text-xs text-muted-foreground">Loading…</p>
          )}
        </div>

        <div className="rounded-xl border bg-card p-5 space-y-3">
          <h2
            className="text-sm font-semibold"
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
            Arm a wallet
          </h2>
          <ol className="list-decimal list-inside space-y-2 text-xs text-muted-foreground">
            <li>
              Settings → Wallets → execution provider{" "}
              <code className="text-foreground">Cleanverse (Monad aUSD-D)</code>
            </li>
            <li>
              Chain ID <code className="text-foreground">10143</code>; fund MON
              (gas) + aUSD-D
            </li>
            <li>
              Both sender and recipient need active A-Passes — screen them below
              first
            </li>
            <li>
              Any <code className="text-foreground">POST /api/spend</code> on
              that wallet runs the full CVI → policy → CVA loop
            </li>
          </ol>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link
              href="/settings"
              className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Open Settings
            </Link>
            <Link
              href="/runs"
              className="inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[0.8rem] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Runs ledger
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      <Separator />

      <section className="relative rounded-xl border bg-card p-5 space-y-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Fingerprint className="h-4 w-4 text-teal-700 dark:text-teal-400" />
            <h2
              className="text-sm font-semibold"
              style={{ fontFamily: "var(--font-space-grotesk)" }}
            >
              Screen identities (CVI)
            </h2>
          </div>
          <p className="text-[10px] text-muted-foreground font-mono">
            POST /api/cleanverse/screen → query_apass
          </p>
        </div>

        {!railLive && (
          <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
            <span>
              Set <code className="text-foreground">CLEANVERSE_API_ID</code> and{" "}
              <code className="text-foreground">CLEANVERSE_API_KEY</code> on the
              API host. Until then the spend path still fails closed if a wallet
              is set to Cleanverse without credentials.
            </span>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Sender (agent wallet)</label>
            <Input
              placeholder="0x…"
              value={sender}
              onChange={(e) => setSender(e.target.value.trim())}
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Recipient</label>
            <Input
              placeholder="0x…"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value.trim())}
              className="font-mono text-xs"
            />
          </div>
        </div>

        <Button
          onClick={runScreen}
          disabled={busy || !sender || !recipient || !railLive}
          className="gap-2"
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Screening…
            </>
          ) : (
            <>
              <ShieldCheck className="h-4 w-4" /> Run A-Pass screen
            </>
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
                  ? "CVI passed — a Cleanverse-rail spend may proceed to policy and CVA settlement"
                  : screening.reason || "CVI screening failed"}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 text-xs">
              <PartyCard label="Sender" party={screening.sender} />
              <PartyCard label="Recipient" party={screening.recipient} />
            </div>
          </div>
        )}
      </section>

      <p className="relative text-xs text-muted-foreground">
        Integration details and submission notes:{" "}
        <a
          className="underline"
          href="https://github.com/thisyearnofear/cognivern/blob/main/docs/HACKATHON_SUBMISSION_CLEANVERSE.md"
          target="_blank"
          rel="noreferrer"
        >
          docs/HACKATHON_SUBMISSION_CLEANVERSE.md
        </a>
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd className={`text-right ${mono ? "font-mono" : ""}`}>{value}</dd>
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
