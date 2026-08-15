"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  Play,
  Eye,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  apiClient,
  type Agent,
  type FundedMandate,
} from "@/lib/api-client";
import { trackUxEvent } from "@/lib/ux-events";

interface CleanverseStatus {
  enabled: boolean;
  chain: string;
  monadChainId: number;
  aTokenAddress: string;
  aTokenSymbol: string;
  aTokenDecimals: number;
  depositAddress: string | null;
  depositForAddress: string | null;
  depositAddressConfigured: boolean;
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

interface WalletRow {
  id: string;
  name?: string;
  metadata?: {
    executionProvider?: string;
    chainId?: number | string;
    cleanverseSenderAddress?: string;
  };
  accounts?: Array<{ address?: string }>;
}

type BusyAction = "screen" | "preview" | "execute" | null;

function toBaseUnits(humanAmount: string, decimals: number): string | null {
  const trimmed = humanAmount.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const [whole, frac = ""] = trimmed.split(".");
  if (frac.length > decimals) return null;
  const padded = `${whole}${frac.padEnd(decimals, "0")}`.replace(/^0+(?=\d)/, "");
  return padded || "0";
}

export function VerifiedCapitalPage({ hideHeader = false }: { hideHeader?: boolean }) {
  const [status, setStatus] = useState<CleanverseStatus | null>(null);
  const [resolvedDepositAddress, setResolvedDepositAddress] = useState<string | null>(null);
  const [depositLookupBusy, setDepositLookupBusy] = useState(false);
  const [depositLookupError, setDepositLookupError] = useState<string | null>(null);
  const [spendStatus, setSpendStatus] = useState<SpendStatusSlice | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [mandates, setMandates] = useState<FundedMandate[]>([]);

  const [sender, setSender] = useState("");
  const [recipient, setRecipient] = useState("");
  const [agentId, setAgentId] = useState("");
  const [walletId, setWalletId] = useState("");
  const [mandateId, setMandateId] = useState("");
  const [amountHuman, setAmountHuman] = useState("1");
  const [reason, setReason] = useState("Verified capital settlement under Cleanverse rail");
  const [owsKey, setOwsKey] = useState("");

  const [screening, setScreening] = useState<ScreeningResult | null>(null);
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [execution, setExecution] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [error, setError] = useState<string | null>(null);

  const decimals = status?.aTokenDecimals ?? 6;
  const assetSymbol = status?.aTokenSymbol ?? "aUSDC";
  const amountBase = useMemo(
    () => toBaseUnits(amountHuman, decimals),
    [amountHuman, decimals],
  );

  const cleanverseWallets = useMemo(
    () =>
      wallets.filter(
        (w) => (w.metadata?.executionProvider as string | undefined) === "cleanverse",
      ),
    [wallets],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cv, spend, walletRes, agentRes, mandateRes] = await Promise.all([
          apiClient.getCleanverseStatus(),
          apiClient.getSpendStatus(),
          apiClient.getWallets(),
          apiClient.getAgents(),
          apiClient.getMandates(),
        ]);
        if (cancelled) return;
        if (cv.success && cv.data) {
          setStatus(cv.data);
          if (cv.data.depositAddress) setResolvedDepositAddress(cv.data.depositAddress);
        }
        else setStatusError(cv.error || "Failed to load Cleanverse status");
        if (spend.success && spend.data) setSpendStatus(spend.data);
        if (walletRes.success && Array.isArray(walletRes.data)) {
          const rows = walletRes.data as unknown as WalletRow[];
          setWallets(rows);
          const preferred =
            rows.find((w) => w.metadata?.executionProvider === "cleanverse") || rows[0];
          if (preferred) {
            setWalletId(preferred.id);
            const addr =
              preferred.metadata?.cleanverseSenderAddress ||
              preferred.accounts?.[0]?.address ||
              "";
            if (addr) setSender(addr);
          }
        }
        if (agentRes.success && Array.isArray(agentRes.data) && agentRes.data.length > 0) {
          setAgents(agentRes.data);
          setAgentId(agentRes.data[0].id);
        }
        if (mandateRes.success && Array.isArray(mandateRes.data)) {
          setMandates(mandateRes.data);
          const verified = mandateRes.data.find(
            (m) =>
              m.settlement?.requireVerifiedSettlement ||
              m.settlement?.requireCleanverseIdentity ||
              m.settlement?.allowedAssets?.some((a) => a.toUpperCase() === "AUSD-D"),
          );
          if (verified) setMandateId(verified.id);
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

  const depositChain = status?.chain;
  const resolveDepositAddress = useCallback(async () => {
    if (!sender) return;
    setDepositLookupBusy(true);
    setDepositLookupError(null);
    try {
      const res = await apiClient.getCleanverseDepositAddress({ address: sender, chain: depositChain });
      if (res.success && res.data) setResolvedDepositAddress(res.data.depositAddress);
      else setDepositLookupError(res.error || 'Deposit address lookup failed');
    } catch (err) {
      setDepositLookupError(err instanceof Error ? err.message : 'Deposit address lookup failed');
    } finally {
      setDepositLookupBusy(false);
    }
  }, [sender, depositChain]);

  const runScreen = useCallback(async () => {
    setBusy("screen");
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
      setBusy(null);
    }
  }, [sender, recipient]);

  const spendPayload = useCallback(() => {
    if (!amountBase || amountBase === "0") {
      throw new Error(`Enter a positive ${assetSymbol} amount (up to ${decimals} decimals)`);
    }
    if (!agentId) throw new Error("Select an agent");
    if (!recipient) throw new Error("Recipient required");
    if (!reason.trim()) throw new Error("Purpose / reason required (travel-rule note)");
    return {
      agentId,
      recipient,
      amount: amountBase,
      asset: assetSymbol,
      reason: reason.trim(),
      metadata: {
        ...(walletId ? { walletId } : {}),
        ...(mandateId ? { mandateId } : {}),
      },
      owsScopedAccess: owsKey.trim() || undefined,
    };
  }, [
    amountBase,
    assetSymbol,
    decimals,
    agentId,
    recipient,
    reason,
    walletId,
    mandateId,
    owsKey,
  ]);

  const runPreview = useCallback(async () => {
    setBusy("preview");
    setError(null);
    setPreview(null);
    setExecution(null);
    trackUxEvent("primary_action_clicked", "verified_capital_preview");
    try {
      const payload = spendPayload();
      const res = await apiClient.previewSpend(payload);
      if (res.success && res.data) {
        setPreview(res.data);
        trackUxEvent("primary_action_completed", "verified_capital_preview", "ok");
      } else {
        setError(res.error || "Preview failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setBusy(null);
    }
  }, [spendPayload]);

  const runExecute = useCallback(async () => {
    setBusy("execute");
    setError(null);
    setExecution(null);
    trackUxEvent("primary_action_clicked", "verified_capital_execute");
    try {
      if (!owsKey.trim()) {
        throw new Error("OWS scoped API key is required to execute (x-ows-scoped-access)");
      }
      const payload = spendPayload();
      const attestationHash =
        typeof preview?.attestationHash === "string" ? preview.attestationHash : undefined;
      const res = await apiClient.executeSpend({
        ...payload,
        attestationHash,
      });
      if (res.success && res.data) {
        setExecution(res.data);
        trackUxEvent("primary_action_completed", "verified_capital_execute", "ok");
      } else {
        setError(res.error || "Spend failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Spend failed");
    } finally {
      setBusy(null);
    }
  }, [owsKey, spendPayload, preview]);

  const railLive = Boolean(status?.enabled);
  const runId =
    typeof execution?.runId === "string"
      ? execution.runId
      : typeof (execution as { run?: { runId?: string } } | null)?.run?.runId === "string"
        ? (execution as { run: { runId: string } }).run.runId
        : undefined;
  const txHash =
    typeof execution?.transferTxHash === "string"
      ? execution.transferTxHash
      : typeof execution?.transactionHash === "string"
        ? execution.transactionHash
        : undefined;
  const previewStatus = typeof preview?.status === "string" ? preview.status : null;

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

      {!hideHeader && (
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
            {cleanverseWallets.length > 0 && (
              <Badge variant="outline">{cleanverseWallets.length} Cleanverse wallet(s)</Badge>
            )}
          </div>
          <h1
            className="text-3xl font-semibold tracking-tight"
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
            Verified Capital
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Screen identities (CVI), preview policy with A-Pass risk signals, then settle{" "}
            <strong className="font-medium text-foreground">{assetSymbol}</strong> on Monad
            (CVA). Evidence lands in CRE runs and Capital statements.
          </p>
        </header>
      )}

      <section className="relative grid gap-3 sm:grid-cols-4">
        {[
          {
            icon: Fingerprint,
            title: "1 · CVI gate",
            body: "query_apass on sender + recipient",
          },
          {
            icon: Scale,
            title: "2 · Policy",
            body: "Tier caps + mandate settlement rules",
          },
          {
            icon: Coins,
            title: "3 · CVA settle",
            body: "verify_apass + Access USDC on Monad",
          },
          {
            icon: Activity,
            title: "4 · Evidence",
            body: "CRE run → Capital / allocate",
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
              <Row label="Access asset" value={status.aTokenSymbol} mono />
              <Row
                label="Access USDC contract"
                value={`${status.aTokenAddress.slice(0, 8)}…${status.aTokenAddress.slice(-6)}`}
                mono
              />
              {(resolvedDepositAddress || status.depositAddress) && (
                <Row
                  label="USDC deposit address"
                  value={`${(resolvedDepositAddress || status.depositAddress)!.slice(0, 8)}…${(resolvedDepositAddress || status.depositAddress)!.slice(-6)}`}
                  mono
                />
              )}
              {depositLookupError && <p className="text-[10px] text-red-600">{depositLookupError}</p>}
              <Button size="sm" variant="outline" onClick={resolveDepositAddress} disabled={depositLookupBusy || !sender || !railLive}>
                {depositLookupBusy ? 'Looking up…' : 'Resolve USDC deposit address'}
              </Button>
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
                  View Access USDC on MonadScan <ExternalLink className="h-3 w-3" />
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
              <code className="text-foreground">Cleanverse (Monad Access USDC)</code>
            </li>
            <li>
              Chain ID <code className="text-foreground">10143</code>; fund MON
              (gas) + {assetSymbol}
            </li>
            <li>
              Create an OWS scoped API key for that wallet (required to execute)
            </li>
            <li>
              Optional: mandate with{" "}
              <code className="text-foreground">settlement.requireVerifiedSettlement</code>{" "}
              and budget in {assetSymbol}
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
              href="/capital"
              className="inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[0.8rem] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Capital / allocate
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
              Screen → preview → settle
            </h2>
          </div>
          <p className="text-[10px] text-muted-foreground font-mono">
            CVI → /api/spend/preview → /api/spend
          </p>
        </div>

        {!railLive && (
          <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
            <span>
              Set <code className="text-foreground">CLEANVERSE_API_ID</code> and{" "}
              <code className="text-foreground">CLEANVERSE_API_KEY</code> on the
              API host. Until then the spend path fails closed if a wallet is
              set to Cleanverse without credentials.
            </span>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Cleanverse wallet</label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
              value={walletId}
              onChange={(e) => {
                const nextId = e.target.value;
                setWalletId(nextId);
                const next = wallets.find((w) => w.id === nextId);
                const addr =
                  next?.metadata?.cleanverseSenderAddress ||
                  next?.accounts?.[0]?.address ||
                  "";
                if (addr) setSender(addr);
              }}
            >
              <option value="">Select wallet…</option>
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {(w.name || w.id).slice(0, 40)}
                  {w.metadata?.executionProvider === "cleanverse" ? " · cleanverse" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Agent</label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
            >
              <option value="">Select agent…</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name || a.id}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Sender</label>
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
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Amount ({assetSymbol})</label>
            <Input
              placeholder="1.00"
              value={amountHuman}
              onChange={(e) => setAmountHuman(e.target.value)}
              className="font-mono text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              Base units: {amountBase ?? "invalid"} ({decimals} decimals)
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Mandate (optional)</label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
              value={mandateId}
              onChange={(e) => setMandateId(e.target.value)}
            >
              <option value="">None</option>
              {mandates.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.settlement?.requireVerifiedSettlement ? " · verified settlement" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-medium">Purpose / reason</label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="text-xs"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-medium">OWS scoped API key (execute)</label>
            <Input
              type="password"
              placeholder="ows_…"
              value={owsKey}
              onChange={(e) => setOwsKey(e.target.value)}
              className="font-mono text-xs"
              autoComplete="off"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={runScreen}
            disabled={busy !== null || !sender || !recipient || !railLive}
            variant="outline"
            className="gap-2"
          >
            {busy === "screen" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Screening…
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" /> Screen A-Pass
              </>
            )}
          </Button>
          <Button
            onClick={runPreview}
            disabled={
              busy !== null ||
              !recipient ||
              !agentId ||
              !amountBase ||
              amountBase === "0"
            }
            variant="outline"
            className="gap-2"
          >
            {busy === "preview" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Previewing…
              </>
            ) : (
              <>
                <Eye className="h-4 w-4" /> Preview policy
              </>
            )}
          </Button>
          <Button
            onClick={runExecute}
            disabled={
              busy !== null ||
              !screening?.ok ||
              previewStatus === "denied" ||
              !owsKey.trim() ||
              !amountBase
            }
            className="gap-2"
          >
            {busy === "execute" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Settling…
              </>
            ) : (
              <>
                <Play className="h-4 w-4" /> Execute CVA spend
              </>
            )}
          </Button>
        </div>

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
                  ? "CVI passed — proceed to preview / settle"
                  : screening.reason || "CVI screening failed"}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 text-xs">
              <PartyCard label="Sender" party={screening.sender} />
              <PartyCard label="Recipient" party={screening.recipient} />
            </div>
          </div>
        )}

        {preview && (
          <div className="rounded-lg border p-4 space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  previewStatus === "approved"
                    ? "default"
                    : previewStatus === "denied"
                      ? "destructive"
                      : "secondary"
                }
              >
                preview · {previewStatus || "unknown"}
              </Badge>
              {typeof preview.reason === "string" && (
                <span className="text-muted-foreground">{preview.reason}</span>
              )}
            </div>
            {typeof preview.attestationHash === "string" && (
              <code className="block truncate text-[10px] text-muted-foreground">
                attestation {preview.attestationHash}
              </code>
            )}
            {(() => {
              const cv = preview.cleanverse as
                | {
                    screened?: boolean;
                    ok?: boolean;
                    policySignals?: { amlCapUsd?: number; riskTier?: string };
                  }
                | undefined;
              if (!cv || typeof preview.cleanverse !== "object") return null;
              return (
                <p className="text-muted-foreground">
                  CVI in preview:{" "}
                  {cv.ok === false ? "fail" : cv.screened ? "pass" : "skipped"}
                  {cv.policySignals ? (
                    <>
                      {" "}
                      · AML cap ${cv.policySignals.amlCapUsd ?? "—"} · risk{" "}
                      {cv.policySignals.riskTier ?? "—"}
                    </>
                  ) : null}
                </p>
              );
            })()}
          </div>
        )}

        {execution && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3 text-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="text-sm font-medium">
                Spend {typeof execution.status === "string" ? execution.status : "submitted"}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {runId && (
                <Link
                  href={`/runs/${encodeURIComponent(runId)}`}
                  className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted"
                >
                  Open run
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
              {txHash && (
                <a
                  className="inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[0.8rem] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                  href={`https://testnet.monadscan.com/tx/${txHash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  MonadScan
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              <Link
                href="/capital"
                className="inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[0.8rem] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Review on Capital
              </Link>
            </div>
          </div>
        )}
      </section>

      <p className="relative text-xs text-muted-foreground">
        Integration details:{" "}
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
