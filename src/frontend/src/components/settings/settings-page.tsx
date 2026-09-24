"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTheme } from "next-themes";
import { useConfidentialRail } from "@/hooks/use-confidential-rail";
import {
  settingsRailRows,
  workspaceSelectableExecutionRails,
  DEFAULT_LEDGER_DERIVATION_PATH,
  deriveCustodyMode,
  custodyToProviders,
  CUSTODY_MODE_META,
  PRIMARY_CUSTODY_MODES,
  EXTENDED_CUSTODY_MODES,
  type CustodyMode,
} from "@cognivern/shared";
import {
  Sun,
  Moon,
  Monitor,
  Key,
  ExternalLink,
  Copy,
  Trash2,
  Plus,
  Rocket,
  Check,
  CheckCircle2,
  XCircle,
  Loader2,
  Zap,
  AlertTriangle,
  Wallet,
  Shield,
  Lock,
  RefreshCw,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useWorkspaceMode } from "@/hooks/use-workspace-mode";
import { apiClient } from "@/lib/api-client";
import { shortAddress, workspaceLabel } from "@/lib/workspace-label";
import { authFetch } from "@/lib/auth-fetch";
import { useWallets } from "@/hooks/use-api";
import { PageState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import type { ApiKey, ApiKeyCreateResponse } from "@/lib/api-client";
import type { OwsWallet, WalletSigningProviderId } from "@cognivern/shared";
import useSWR, { mutate } from "swr";

const AVAILABLE_SCOPES = [
  { id: "agents:read", label: "Agents (read)" },
  { id: "agents:write", label: "Agents (write)" },
  { id: "governance:read", label: "Governance (read)" },
  { id: "governance:write", label: "Governance (write)" },
  { id: "audit:read", label: "Audit (read)" },
  { id: "spend:execute", label: "Spend (execute)" },
] as const;

export function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const workspace = useAuthStore((s) => s.workspace);

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader eyebrow="Supporting" title="Settings" description="Configure workspace access, wallet execution, and interface preferences." />
      <div className="app-surface-card flex flex-wrap items-center gap-2 p-3 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Recommended setup</span>
        <span>Policy</span><span aria-hidden="true">→</span><span>API identity</span><span aria-hidden="true">→</span><span>Access key</span>
      </div>

      <Tabs defaultValue="workspace" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4">
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          <TabsTrigger value="wallets">Wallet execution</TabsTrigger>
          <TabsTrigger value="api-keys">Access & API keys</TabsTrigger>
          <TabsTrigger value="appearance">Interface</TabsTrigger>
        </TabsList>

        <TabsContent value="workspace" className="space-y-4">
          <WorkspaceCard workspace={workspace} />
          <SuspicionThresholdCard workspaceId={workspace?.id} />
          <RailsPreferencesCard workspaceId={workspace?.id} />
          <ChainsCard />
        </TabsContent>

        <TabsContent value="wallets">
          <WalletsCard />
        </TabsContent>

        <TabsContent value="api-keys">
          <ApiKeysCard />
        </TabsContent>

        <TabsContent value="appearance">
          <AppearanceCard theme={theme} setTheme={setTheme} />
        </TabsContent>
      </Tabs>

      <Separator />
      <div className="text-xs text-muted-foreground">
        Cognivern v0.1.0 — AI Agent Governance Platform
      </div>
    </div>
  );
}

function WalletsCard() {
  const { data: wallets, isLoading, error, mutate } = useWallets();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSave = useCallback(
    async (
      walletId: string,
      updates: {
        executionProvider?: "local" | "keeperhub" | "cleanverse" | "dynamic";
        chainId?: string;
        keeperHubWalletAddress?: string;
        cleanverseSenderAddress?: string;
        requireCleanverseIdentity?: boolean;
        signingProvider?: WalletSigningProviderId;
        ledgerDerivationPath?: string;
        externalSource?: string;
        dynamicAccountAddress?: string;
      },
    ) => {
      setSavingId(walletId);
      setSavedId(null);
      setErrorId(null);
      setErrorMsg(null);
      try {
        const res = await apiClient.updateWallet(walletId, {
          executionProvider: updates.executionProvider,
          chainId: updates.chainId ? Number(updates.chainId) : undefined,
          keeperHubWalletAddress: updates.keeperHubWalletAddress,
          cleanverseSenderAddress: updates.cleanverseSenderAddress,
          requireCleanverseIdentity: updates.requireCleanverseIdentity,
          signingProvider: updates.signingProvider,
          ledgerDerivationPath: updates.ledgerDerivationPath,
          externalSource: updates.externalSource,
          dynamicAccountAddress: updates.dynamicAccountAddress,
        });
        if (res.success) {
          setSavedId(walletId);
          setTimeout(() => setSavedId(null), 2000);
          mutate();
        } else {
          setErrorId(walletId);
          setErrorMsg(res.error || "Failed to update wallet");
        }
      } catch (err) {
        setErrorId(walletId);
        setErrorMsg(err instanceof Error ? err.message : "Failed to update wallet");
      } finally {
        setSavingId(null);
      }
    },
    [mutate],
  );

  const custodyCounts = {
    vault: 0,
    managed_mpc: 0,
    hosted_execution: 0,
    verified_settlement: 0,
    custom: 0,
  };
  for (const w of wallets ?? []) {
    const meta = (w.metadata || {}) as {
      executionProvider?: string;
      signingProvider?: string;
    };
    const mode = deriveCustodyMode(meta);
    custodyCounts[mode] += 1;
  }
  const hasAnyWallet = (wallets?.length ?? 0) > 0;

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Wallet className="h-4 w-4 text-sky-500" />
        <h2 className="font-semibold" style={{ fontFamily: "var(--font-space-grotesk)" }}>
          Wallet custody
        </h2>
        <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
          {custodyCounts.managed_mpc > 0 && (
            <Badge variant="default">{custodyCounts.managed_mpc} managed MPC</Badge>
          )}
          {custodyCounts.hosted_execution > 0 && (
            <Badge variant="default">{custodyCounts.hosted_execution} hosted</Badge>
          )}
          {custodyCounts.verified_settlement > 0 && (
            <Badge variant="default">{custodyCounts.verified_settlement} verified</Badge>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Where each agent wallet holds and moves capital after policy approval.
        Fund the wallet address on its chain — approval moves value plus gas.
        Cognivern keeps mandates, policy, and evidence; custody adapters are
        swappable underneath. Audit trails appear in{" "}
        <a className="underline" href="/observability">
          Observability
        </a>
        .
      </p>

      {isLoading ? (
        <div className="rounded-lg border p-4 space-y-3 animate-pulse">
          <div className="h-4 w-40 bg-muted rounded" />
          <div className="h-8 w-full bg-muted rounded" />
        </div>
      ) : error ? (
        <PageState variant="error" title="Could not load wallets" message="Wallet custody settings are unavailable right now." action={{ label: "Retry", onClick: () => mutate() }} />
      ) : !hasAnyWallet ? (
        <WalletCustodyEmptyState />
      ) : (
        <div className="space-y-4">
          {wallets!.map((wallet) => (
            <WalletExecutionForm
              key={wallet.id}
              wallet={wallet}
              saving={savingId === wallet.id}
              saved={savedId === wallet.id}
              error={errorId === wallet.id ? errorMsg : null}
              onSave={handleSave}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function WalletCustodyEmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-sky-300 dark:border-sky-800 bg-sky-50/40 dark:bg-sky-950/20 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Rocket className="h-4 w-4 text-sky-500" />
        <h3 className="text-sm font-semibold">Set up a wallet</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Bootstrap a Cognivern vault wallet first, then choose custody by need —
        vault by default, managed MPC when you do not want keys on this box.
      </p>
      <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-1">
        <li>
          Set <code>OWS_BOOTSTRAP_PRIVATE_KEY</code> in the backend env and restart
          the API (or import a wallet).
        </li>
        <li>Reload this page — the wallet will appear above.</li>
        <li>Pick a custody mode and save.</li>
      </ol>
    </div>
  );
}

function HostedExecutionConsequences() {
  return (
    <div className="rounded-lg border border-sky-200 dark:border-sky-900 bg-sky-50/30 dark:bg-sky-950/20 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Wallet className="h-3.5 w-3.5 text-sky-500" />
        <span className="text-xs font-semibold text-sky-900 dark:text-sky-200">
          What you&apos;re opting into
        </span>
      </div>
      <ul className="text-[11px] text-sky-900/80 dark:text-sky-200/80 space-y-1 list-disc list-inside">
        <li>
          <strong>Managed broadcast.</strong> Gas, nonces, retries, and multi-RPC
          failover are handled by the hosted execution adapter.
        </li>
        <li>
          <strong>Same control plane.</strong> Policy approval and CRE evidence
          still run through Cognivern.
        </li>
        <li>
          <strong>Provider footnote.</strong> Currently powered by KeeperHub —
          see their docs for gas sponsorship and pricing.
        </li>
      </ul>
    </div>
  );
}

function ManagedMpcSetupHints() {
  return (
    <div className="rounded-lg border border-dashed p-3 space-y-2">
      <p className="text-xs font-medium">Setup checklist</p>
      <ol className="text-[11px] text-muted-foreground list-decimal list-inside space-y-1">
        <li>
          Provision a server wallet (<code className="font-mono">pnpm dynamic:provision</code>
          ) or paste an existing account address.
        </li>
        <li>
          Attach <code className="font-mono">dynamicWalletMetadata</code> on the wallet
          (or keep the provision file at{" "}
          <code className="font-mono">DYNAMIC_WALLET_METADATA_PATH</code>) — spends fail
          closed without it.
        </li>
        <li>
          Set chain ID to a <strong>configured</strong> Cognivern rail (unknown chains
          are rejected, not silently remapped).
        </li>
        <li>Fund the address, then run a dust spend to confirm the path.</li>
      </ol>
      <p className="text-[10px] text-muted-foreground">
        If a spend is uncertain after broadcast, reconcile via the run&apos;s on-chain
        receipt — do not retry. Details:{" "}
        <code className="font-mono">docs/DYNAMIC.md</code>
      </p>
    </div>
  );
}

interface WalletExecutionFormProps {
  wallet: OwsWallet;
  saving: boolean;
  saved: boolean;
  error: string | null;
  onSave: (
    walletId: string,
    updates: {
      executionProvider?: "local" | "keeperhub" | "cleanverse" | "dynamic";
      chainId?: string;
      keeperHubWalletAddress?: string;
      cleanverseSenderAddress?: string;
      requireCleanverseIdentity?: boolean;
      signingProvider?: WalletSigningProviderId;
      ledgerDerivationPath?: string;
      externalSource?: string;
      dynamicAccountAddress?: string;
    },
  ) => void;
}

function WalletExecutionForm({
  wallet,
  saving,
  saved,
  error,
  onSave,
}: WalletExecutionFormProps) {
  const meta = (wallet.metadata || {}) as {
    executionProvider?: string;
    chainId?: number | string;
    keeperHubWalletAddress?: string;
    cleanverseSenderAddress?: string;
    requireCleanverseIdentity?: boolean;
    signingProvider?: WalletSigningProviderId;
    ledgerDerivationPath?: string;
    externalSource?: string;
    dynamicAccountAddress?: string;
  };

  const initialCustody = deriveCustodyMode(meta);
  const [custody, setCustody] = useState<CustodyMode>(initialCustody);
  const [showExtended, setShowExtended] = useState(
    initialCustody === "hosted_execution" ||
      initialCustody === "verified_settlement" ||
      initialCustody === "custom",
  );
  const [advancedOpen, setAdvancedOpen] = useState(initialCustody === "custom");

  const initialProvider =
    meta.executionProvider === "keeperhub"
      ? "keeperhub"
      : meta.executionProvider === "cleanverse"
        ? "cleanverse"
        : meta.executionProvider === "dynamic"
          ? "dynamic"
          : "local";
  const [provider, setProvider] = useState<
    "local" | "keeperhub" | "cleanverse" | "dynamic"
  >(initialProvider);
  const [chainId, setChainId] = useState<string>(
    meta.chainId !== undefined
      ? String(meta.chainId)
      : provider === "cleanverse"
        ? "10143"
        : "",
  );
  const [keeperHubWalletAddress, setKeeperHubWalletAddress] = useState<string>(
    meta.keeperHubWalletAddress || "",
  );
  const [cleanverseSenderAddress, setCleanverseSenderAddress] = useState<string>(
    meta.cleanverseSenderAddress || "",
  );
  const [dynamicAccountAddress, setDynamicAccountAddress] = useState<string>(
    meta.dynamicAccountAddress || "",
  );
  const [requireCleanverseIdentity, setRequireCleanverseIdentity] = useState(
    meta.requireCleanverseIdentity === true,
  );
  const [signingProvider, setSigningProvider] =
    useState<WalletSigningProviderId>(meta.signingProvider ?? "local");
  const [ledgerDerivationPath, setLedgerDerivationPath] = useState<string>(
    meta.ledgerDerivationPath || DEFAULT_LEDGER_DERIVATION_PATH,
  );
  const [externalSource, setExternalSource] = useState<string>(
    meta.externalSource || "",
  );

  const applyCustody = (mode: CustodyMode) => {
    setCustody(mode);
    const mapped = custodyToProviders(mode);
    if (!mapped) {
      setAdvancedOpen(true);
      return;
    }
    setProvider(mapped.executionProvider);
    setSigningProvider(mapped.signingProvider);
    if (mapped.executionProvider === "cleanverse" && !chainId) {
      setChainId("10143");
    }
  };

  const effectiveCustody = advancedOpen
    ? deriveCustodyMode({
        executionProvider: provider,
        signingProvider,
      })
    : custody;

  const custodyMeta = CUSTODY_MODE_META[effectiveCustody];

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{wallet.name}</span>
          <code className="text-xs text-muted-foreground font-mono">
            {shortAddress(wallet.address)}
          </code>
        </div>
        <Badge variant={effectiveCustody === "vault" ? "secondary" : "default"}>
          {custodyMeta.label}
        </Badge>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium">Custody</label>
        <select
          value={
            PRIMARY_CUSTODY_MODES.includes(custody as (typeof PRIMARY_CUSTODY_MODES)[number]) ||
            (showExtended &&
              EXTENDED_CUSTODY_MODES.includes(
                custody as (typeof EXTENDED_CUSTODY_MODES)[number],
              ))
              ? custody
              : custody === "custom"
                ? "custom"
                : "vault"
          }
          onChange={(e) => {
            const next = e.target.value as CustodyMode;
            applyCustody(next);
          }}
          disabled={saving || advancedOpen}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        >
          {PRIMARY_CUSTODY_MODES.map((id) => (
            <option key={id} value={id}>
              {CUSTODY_MODE_META[id].label}
            </option>
          ))}
          {showExtended &&
            EXTENDED_CUSTODY_MODES.map((id) => (
              <option key={id} value={id}>
                {CUSTODY_MODE_META[id].label}
              </option>
            ))}
          {(custody === "custom" || advancedOpen) && (
            <option value="custom">Custom (advanced)</option>
          )}
        </select>
        <p className="text-[10px] text-muted-foreground">
          {custodyMeta.need}
          {custodyMeta.poweredBy ? ` · ${custodyMeta.poweredBy}` : ""}
        </p>
        {!showExtended && (
          <button
            type="button"
            className="text-[10px] text-sky-600 dark:text-sky-400 underline underline-offset-2"
            onClick={() => setShowExtended(true)}
          >
            Need hosted execution or verified settlement?
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-xs font-medium">Chain ID</label>
          <Input
            type="number"
            placeholder={provider === "cleanverse" ? "10143" : "e.g. 84532"}
            value={chainId}
            onChange={(e) => setChainId(e.target.value)}
            disabled={saving}
          />
          <p className="text-[10px] text-muted-foreground">
            Execution rail for this wallet. Defaults to the workspace rail when empty.
          </p>
        </div>
      </div>

      {provider === "dynamic" && (
        <>
          <ManagedMpcSetupHints />
          <div className="space-y-2">
            <label className="text-xs font-medium">MPC account address</label>
            <Input
              type="text"
              placeholder="0x..."
              value={dynamicAccountAddress}
              onChange={(e) => setDynamicAccountAddress(e.target.value)}
              disabled={saving}
            />
            <p className="text-[10px] text-muted-foreground">
              From provision, or leave blank to use the process default metadata file.
            </p>
          </div>
        </>
      )}

      {provider === "keeperhub" && (
        <>
          <HostedExecutionConsequences />
          <div className="space-y-2">
            <label className="text-xs font-medium">Hosted wallet address</label>
            <Input
              type="text"
              placeholder="0x..."
              value={keeperHubWalletAddress}
              onChange={(e) => setKeeperHubWalletAddress(e.target.value)}
              disabled={saving}
            />
          </div>
        </>
      )}

      {provider === "cleanverse" && (
        <div className="space-y-2">
          <label className="text-xs font-medium">Verified sender address (optional)</label>
          <Input
            type="text"
            placeholder={wallet.address}
            value={cleanverseSenderAddress}
            onChange={(e) => setCleanverseSenderAddress(e.target.value)}
            disabled={saving}
          />
          <p className="text-[10px] text-muted-foreground">
            Defaults to the vault address. Must pass identity screening on the
            verified settlement rail.
          </p>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={requireCleanverseIdentity}
              onChange={(e) => setRequireCleanverseIdentity(e.target.checked)}
              disabled={saving}
            />
            Always require identity screening
          </label>
        </div>
      )}

      <div className="pt-1">
        <button
          type="button"
          className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
          onClick={() => setAdvancedOpen((o) => !o)}
        >
          <Lock className="h-3 w-3" />
          {advancedOpen ? "Hide advanced" : "Advanced — split signing & broadcast"}
        </button>
      </div>

      {advancedOpen && (
        <div className="space-y-3 rounded-md border border-dashed p-3">
          <p className="text-[10px] text-muted-foreground">
            Broadcast (execution) and attestation signing are usually paired by
            custody mode. Split them only when you know you need it.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-medium">Broadcast adapter</label>
              <select
                value={provider}
                onChange={(e) => {
                  const next = e.target.value as
                    | "local"
                    | "keeperhub"
                    | "cleanverse"
                    | "dynamic";
                  setProvider(next);
                  setCustody(
                    deriveCustodyMode({
                      executionProvider: next,
                      signingProvider,
                    }),
                  );
                  if (next === "cleanverse" && !chainId) setChainId("10143");
                }}
                disabled={saving}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              >
                <option value="local">Local vault</option>
                <option value="dynamic">Managed MPC</option>
                <option value="keeperhub">Hosted execution</option>
                <option value="cleanverse">Verified settlement</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium">Signing adapter</label>
              <select
                value={signingProvider}
                onChange={(e) => {
                  const next = e.target.value as WalletSigningProviderId;
                  setSigningProvider(next);
                  setCustody(
                    deriveCustodyMode({
                      executionProvider: provider,
                      signingProvider: next,
                    }),
                  );
                }}
                disabled={saving}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              >
                <option value="local">Local (software key)</option>
                <option value="dynamic">Managed MPC</option>
                <option value="ledger">Ledger (hardware)</option>
                <option value="speculos">Speculos (sandbox)</option>
                <option value="ows_remote">OWS Remote</option>
              </select>
            </div>
          </div>

          {signingProvider === "ledger" && (
            <div className="space-y-2">
              <label className="text-xs font-medium">Ledger derivation path</label>
              <Input
                type="text"
                placeholder={DEFAULT_LEDGER_DERIVATION_PATH}
                value={ledgerDerivationPath}
                onChange={(e) => setLedgerDerivationPath(e.target.value)}
                disabled={saving}
              />
            </div>
          )}

          {(signingProvider === "speculos" ||
            signingProvider === "ows_remote") && (
            <div className="space-y-2">
              <label className="text-xs font-medium">External signing endpoint</label>
              <Input
                type="text"
                placeholder="https://speculos.local:5001"
                value={externalSource}
                onChange={(e) => setExternalSource(e.target.value)}
                disabled={saving}
              />
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-3 text-xs text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2 pt-2">
        <Button
          size="sm"
          onClick={() =>
            onSave(wallet.id, {
              executionProvider: provider,
              chainId,
              keeperHubWalletAddress,
              cleanverseSenderAddress,
              dynamicAccountAddress,
              requireCleanverseIdentity:
                provider === "cleanverse" ? true : requireCleanverseIdentity,
              signingProvider,
              ledgerDerivationPath:
                signingProvider === "ledger" ? ledgerDerivationPath : undefined,
              externalSource:
                signingProvider === "speculos" ||
                signingProvider === "ows_remote"
                  ? externalSource
                  : undefined,
            })
          }
          disabled={saving}
          className="gap-1.5"
        >
          {saving ? "Saving..." : saved ? (
            <>
              <Check className="h-3.5 w-3.5" /> Saved
            </>
          ) : (
            "Save"
          )}
        </Button>
        {saved && (
          <span className="text-xs text-emerald-600 dark:text-emerald-400">
            Saved successfully
          </span>
        )}
      </div>
    </div>
  );
}

function WorkspaceCard({
  workspace,
}: {
  workspace: { id: string; name: string; tier: string } | null;
}) {
  const router = useRouter();
  const { mode, switching, switchMode } = useWorkspaceMode();
  const upgrading = switching === "production";
  const isLive = mode === "production";

  // Routed through useWorkspaceMode: the old handler flipped the workspace
  // tier but left `workspaceMode: "sandbox"` in the auth store, so every
  // subsequent request still sent X-Workspace-Mode: sandbox and the user kept
  // seeing demo data after "Go Live" appeared to succeed.
  const handleGoLive = useCallback(() => {
    void switchMode("production");
  }, [switchMode]);

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <h2 className="font-semibold flex items-center gap-2" style={{ fontFamily: "var(--font-space-grotesk)" }}>
          <Rocket className="h-4 w-4 text-purple-500" />
          Workspace
        </h2>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">
              {workspace ? workspaceLabel(workspace) : "Not connected"}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              ID: {workspace?.id ? `${workspace.id.slice(0, 8)}...` : "—"}
            </div>
          </div>
          <Badge variant={isLive ? "default" : "secondary"}>
            {workspace ? (isLive ? "Production" : "Sandbox") : "none"}
          </Badge>
        </div>

        {workspace && !isLive && (
          <div className="rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/30 p-4 space-y-3">
            <div>
              <div className="text-sm font-medium">Ready to go live?</div>
              <div className="text-xs text-muted-foreground mt-1">
                Upgrade to connect real agents with real blockchain
                transactions. Demo data will be replaced by live data from your
                agents.
              </div>
            </div>
            <Button
              size="sm"
              onClick={handleGoLive}
              disabled={switching !== null}
              className="gap-2"
            >
              <Rocket className="h-3.5 w-3.5" />{" "}
              {upgrading ? "Upgrading..." : "Go Live"}
            </Button>
          </div>
        )}

        {workspace && isLive && (
          <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-500" />
              <div className="text-sm font-medium">Workspace is live</div>
            </div>
            <div className="text-xs text-muted-foreground">
              Create API identities, generate keys below, and{" "}
              <a
                href="/integrate"
                className="text-primary underline underline-offset-2"
              >
                integrate the governance API
              </a>{" "}
              into your external system.
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => router.push("/agents/workshop")}>
                Create API identity
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => router.push("/policies")}
              >
                Create policy
              </Button>
            </div>
          </div>
        )}
    </div>
  );
}

function SuspicionThresholdCard({ workspaceId }: { workspaceId?: string }) {
  const [threshold, setThreshold] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    // `/workspace`, not `/api/workspace`: the workspace router is mounted at
    // the backend root, so the `/api`-prefixed path resolves to nothing.
    authFetch("/workspace")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!cancelled && json?.success) {
          const wsSettings = json.data?.settings;
          setThreshold(typeof wsSettings?.suspicionHoldThreshold === "number" ? wsSettings.suspicionHoldThreshold : 0);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaved(false);
    setSaveError(false);
    try {
      await apiClient.updateWorkspace({ suspicionHoldThreshold: threshold });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setSaveError(true);
      toast.error("Failed to save threshold", {
        description: "Could not update the suspicion hold threshold. Try again.",
      });
    } finally {
      setSaving(false);
    }
  }, [threshold]);

  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-5 animate-pulse">
        <div className="h-4 w-40 bg-muted rounded mb-3" />
        <div className="h-8 w-full bg-muted rounded" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-orange-500" />
        <h2 className="font-semibold text-sm" style={{ fontFamily: "var(--font-space-grotesk)" }}>
          Suspicion Auto-Hold Threshold
        </h2>
      </div>
      <p className="text-xs text-muted-foreground">
        When suspicion scoring is enabled, agent actions with a composite score at or above
        this threshold are automatically held for human review instead of being approved.
        Set to 0 to disable auto-hold (scores are still recorded in the audit trail).
      </p>
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={threshold}
            onChange={(e) => setThreshold(parseFloat(e.target.value))}
            className="w-full accent-orange-500"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>0 (off)</span>
            <span>0.3 (cautious)</span>
            <span>0.6 (moderate)</span>
            <span>0.8 (strict)</span>
            <span>1.0</span>
          </div>
        </div>
        <div className="text-center min-w-[60px]">
          <div className="text-lg font-bold font-mono" style={{ fontFamily: "var(--font-space-grotesk)" }}>
            {threshold.toFixed(2)}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {threshold === 0 ? "disabled" : threshold < 0.3 ? "cautious" : threshold < 0.6 ? "moderate" : threshold < 0.8 ? "strict" : "very strict"}
          </div>
        </div>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : saved ? (
            <>
              <Check className="h-3.5 w-3.5 mr-1" /> Saved
            </>
          ) : "Save"}
        </Button>
      </div>
      {saveError && (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" />
          Failed to save threshold. Check your connection and try again.
        </p>
      )}
    </div>
  );
}

function RailsPreferencesCard({ workspaceId }: { workspaceId?: string }) {
  const executionRails = workspaceSelectableExecutionRails();
  const [executionRail, setExecutionRail] = useState<string>("");
  const [executionProvider, setExecutionProvider] = useState<string>("");
  const [sinkZerog, setSinkZerog] = useState(true);
  const [sinkFilecoin, setSinkFilecoin] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    authFetch("/workspace")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled || !json?.success) return;
        const ws = json.data?.settings ?? {};
        setExecutionRail(
          typeof ws.defaultExecutionRail === "string" ? ws.defaultExecutionRail : "",
        );
        setExecutionProvider(
          typeof ws.defaultExecutionProvider === "string"
            ? ws.defaultExecutionProvider
            : "",
        );
        const sinks = Array.isArray(ws.evidenceSinks) ? ws.evidenceSinks : null;
        if (sinks === null) {
          setSinkZerog(true);
          setSinkFilecoin(true);
        } else {
          setSinkZerog(sinks.includes("zerog"));
          setSinkFilecoin(sinks.includes("filecoin"));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaved(false);
    try {
      const evidenceSinks: Array<"zerog" | "filecoin"> = [];
      if (sinkZerog) evidenceSinks.push("zerog");
      if (sinkFilecoin) evidenceSinks.push("filecoin");
      // Empty selection clears override → platform defaults (both sinks).
      await apiClient.updateWorkspace({
        defaultExecutionRail: executionRail || null,
        defaultExecutionProvider: (executionProvider || null) as
          | "local"
          | "keeperhub"
          | "cleanverse"
          | "dynamic"
          | null,
        evidenceSinks: evidenceSinks.length > 0 ? evidenceSinks : null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      toast.error("Failed to save rail preferences", {
        description: "Could not update workspace execution / evidence settings.",
      });
    } finally {
      setSaving(false);
    }
  }, [executionRail, executionProvider, sinkZerog, sinkFilecoin]);

  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-5 animate-pulse">
        <div className="h-4 w-40 bg-muted rounded mb-3" />
        <div className="h-8 w-full bg-muted rounded" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-sky-500" />
        <h2
          className="font-semibold text-sm"
          style={{ fontFamily: "var(--font-space-grotesk)" }}
        >
          Rail preferences
        </h2>
      </div>
      <p className="text-xs text-muted-foreground">
        Defaults for this workspace when a wallet does not set its own custody
        or chain. Evidence sinks control which storage anchors fan out from
        audit runs (CRE remains canonical either way).
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5 text-xs">
          <span className="text-muted-foreground">Default execution rail</span>
          <select
            className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
            value={executionRail}
            onChange={(e) => setExecutionRail(e.target.value)}
          >
            <option value="">Platform default</option>
            {executionRails.map((r) => (
              <option key={r.id} value={r.id}>
                {r.displayName}
                {r.chainId != null ? ` (${r.chainId})` : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5 text-xs">
          <span className="text-muted-foreground">Default custody</span>
          <select
            className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
            value={executionProvider}
            onChange={(e) => setExecutionProvider(e.target.value)}
          >
            <option value="">Platform default (vault)</option>
            <option value="local">Cognivern vault</option>
            <option value="dynamic">Managed MPC</option>
            <option value="keeperhub">Hosted execution</option>
            <option value="cleanverse">Verified settlement</option>
          </select>
        </label>
      </div>

      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">Evidence sinks</div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={sinkZerog}
              onChange={(e) => setSinkZerog(e.target.checked)}
              className="accent-sky-500"
            />
            0G storage
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={sinkFilecoin}
              onChange={(e) => setSinkFilecoin(e.target.checked)}
              className="accent-sky-500"
            />
            Filecoin
          </label>
        </div>
        {!sinkZerog && !sinkFilecoin && (
          <p className="text-[11px] text-muted-foreground">
            Leaving both unchecked clears the override and restores platform
            defaults (both sinks).
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : saved ? (
            <>
              <Check className="h-3.5 w-3.5 mr-1" /> Saved
            </>
          ) : (
            "Save"
          )}
        </Button>
      </div>
    </div>
  );
}

/** Shared mandate controls — used by Create-key and Import-credential forms. */
function MandateControls(props: {
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  budget: string;
  onBudgetChange: (v: string) => void;
  perTx: string;
  onPerTxChange: (v: string) => void;
  threshold: string;
  onThresholdChange: (v: string) => void;
}) {
  return (
    <div className="rounded-lg border border-purple-200 dark:border-purple-900 bg-purple-50/40 dark:bg-purple-950/20 p-3 space-y-2">
      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={props.enabled}
          onChange={(e) => props.onEnabledChange(e.target.checked)}
          className="mt-0.5 accent-purple-500"
        />
        <span>
          <span className="text-xs font-medium flex items-center gap-1.5">
            <Lock className="h-3 w-3 text-purple-500" />
            Seal a spend mandate in TEE
          </span>
          <span className="text-[11px] text-muted-foreground block mt-0.5">
            The enclave — not the key — enforces the budget. Even a leaked key
            cannot overspend its mandate.
          </span>
        </span>
      </label>
      {props.enabled && (
        <div className="grid grid-cols-3 gap-2 pt-1">
          {([
            { label: "Daily budget ($)", value: props.budget, onChange: props.onBudgetChange },
            { label: "Per-tx cap ($)", value: props.perTx, onChange: props.onPerTxChange },
            { label: "Review above ($)", value: props.threshold, onChange: props.onThresholdChange },
          ] as const).map((f) => (
            <div key={f.label}>
              <div className="text-[10px] text-muted-foreground mb-0.5">{f.label}</div>
              <Input
                type="number"
                min={1}
                value={f.value}
                onChange={(e) => f.onChange(e.target.value)}
                className="h-7 text-xs"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ApiKeysCard() {
  const { data, isLoading } = useSWR("api-keys", () => apiClient.getApiKeys());
  const [newKeyName, setNewKeyName] = useState("");
  const [confirmRevoke, setConfirmRevoke] = useState<ApiKey | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [selectedScopes, setSelectedScopes] = useState<string[]>([
    "agents:read",
    "governance:read",
    "audit:read",
  ]);
  const [createdKey, setCreatedKey] = useState<ApiKeyCreateResponse | null>(
    null,
  );
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message?: string; agentCount?: number } | null>(null);

  // TEE-sealed mandate ("key = sealed mandate") — presets mirror the live
  // demo policy on Coston2 so the three trial amounts behave identically.
  const [mandateEnabled, setMandateEnabled] = useState(false);
  const [mandateBudget, setMandateBudget] = useState("5000");
  const [mandatePerTx, setMandatePerTx] = useState("2000");
  const [mandateThreshold, setMandateThreshold] = useState("500");
  const [trialing, setTrialing] = useState(false);
  const [trials, setTrials] = useState<
    Array<{ amountUsd: number; outcome?: string; policyId?: string; error?: string }>
  >([]);

  // Bring your own credential
  const [importOpen, setImportOpen] = useState(false);
  const [importName, setImportName] = useState("");
  const [importRawKey, setImportRawKey] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const keys: ApiKey[] = data?.data || [];
  const activeKeys = keys.filter((k) => !k.revokedAt);

  const mandatePayload = useCallback(
    () =>
      mandateEnabled
        ? {
            budgetUsd: Number(mandateBudget),
            perTxUsd: Number(mandatePerTx),
            approvalThresholdUsd: Number(mandateThreshold),
          }
        : undefined,
    [mandateEnabled, mandateBudget, mandatePerTx, mandateThreshold],
  );

  const handleCreate = useCallback(async () => {
    if (!newKeyName.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await apiClient.createWorkspaceApiKey({
        name: newKeyName.trim(),
        scopes: selectedScopes,
        mandate: mandatePayload(),
      });
      if (res.success && res.data) {
        setCreatedKey(res.data);
        setTrials([]);
        setNewKeyName("");
        mutate("api-keys");
      } else {
        setCreateError(res.error || "Failed to create key");
      }
    } finally {
      setCreating(false);
    }
  }, [newKeyName, selectedScopes, mandatePayload]);

  const handleImport = useCallback(async () => {
    if (!importName.trim() || !importRawKey.trim()) return;
    setImporting(true);
    setImportError(null);
    try {
      const res = await apiClient.importWorkspaceApiKey({
        name: importName.trim(),
        rawKey: importRawKey.trim(),
        scopes: selectedScopes,
        mandate: mandatePayload(),
      });
      if (res.success && res.data) {
        setImportName("");
        setImportRawKey("");
        setImportOpen(false);
        mutate("api-keys");
        toast.success(`Credential "${res.data.name}" wrapped into this workspace`);
      } else {
        setImportError(res.error || "Import failed");
      }
    } finally {
      setImporting(false);
    }
  }, [importName, importRawKey, selectedScopes, mandatePayload]);

  const handleRefreshMandate = useCallback(async () => {
    if (!createdKey) return;
    const res = await apiClient.getApiKeys();
    const fresh = res.data?.find((k) => k.id === createdKey.id);
    if (fresh) setCreatedKey({ ...createdKey, mandate: fresh.mandate, scopes: fresh.scopes });
  }, [createdKey]);

  const handleMandateTrials = useCallback(async () => {
    if (!createdKey?.key) return;
    setTrialing(true);
    setTrials([]);
    // Same three amounts as the public demo — but routed through THIS key,
    // so the enclave evaluates against the key's own sealed mandate.
    for (const amountUsd of [25, 750, 2500]) {
      try {
        const response = await fetch(`/api/spend/encrypted`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": createdKey.key,
          },
          body: JSON.stringify({
            agentId: "0xaa",
            policyId: "0x01",
            amountUsd,
            vendorHash: "0xbb",
          }),
        });
        const body = await response.json();
        const outcome = body.data?.outcome ?? (response.ok ? "unknown" : `HTTP ${response.status}`);
        setTrials((prev) => [
          ...prev,
          { amountUsd, outcome, policyId: body.data?.mandate?.policyId },
        ]);
      } catch (err) {
        setTrials((prev) => [
          ...prev,
          { amountUsd, error: err instanceof Error ? err.message : "request failed" },
        ]);
      }
    }
    setTrialing(false);
  }, [createdKey]);

  const handleRevoke = useCallback(
    async (key: ApiKey) => {
      setRevoking(true);
      try {
        await apiClient.revokeApiKey(key.id);
        mutate("api-keys");
        setConfirmRevoke(null);
      } finally {
        setRevoking(false);
      }
    },
    [],
  );

  const handleCopy = useCallback(() => {
    if (createdKey?.key) {
      navigator.clipboard.writeText(createdKey.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [createdKey]);

  const handleTestKey = useCallback(async () => {
    if (!createdKey?.key) return;
    setTesting(true);
    setTestResult(null);
    try {
      // Use ONLY the generated API key — no session JWT — to prove the key
      // itself works. This is the whole point of the verification step.
      // Always use a relative path so the request goes through the Next
      // rewrite proxy — NEXT_PUBLIC_API_URL points at the backend directly
      // and is blocked by the frontend's own CSP when called cross-origin.
      const response = await fetch(`/api/agents`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": createdKey.key,
        },
      });
      if (response.ok) {
        const body = await response.json();
        const count = (body.data || []).length;
        setTestResult({ ok: true, agentCount: count });
      } else {
        const errorBody = await response.text();
        setTestResult({
          ok: false,
          message: `${response.status}: ${errorBody.slice(0, 120)}`,
        });
      }
    } catch (err) {
      setTestResult({
        ok: false,
        message: err instanceof Error ? err.message : "Request failed",
      });
    } finally {
      setTesting(false);
    }
  }, [createdKey]);

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div>
        <h2 className="font-semibold flex items-center gap-2" style={{ fontFamily: "var(--font-space-grotesk)" }}>
            <Key className="h-4 w-4 text-amber-500" />
            API keys
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Create keys for your external systems to authenticate with the Cognivern API.
            Keys are scoped to this workspace.
          </p>
        </div>

        {/* Create new key */}
        <div className="space-y-3 rounded-lg border p-4">
          <div className="text-sm font-medium">Create a new key</div>
          <div className="flex gap-2">
            <Input
              placeholder="Key name (e.g. Trading Bot)"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              className="flex-1"
            />
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={creating || !newKeyName.trim()}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              {creating ? "Creating..." : "Create"}
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {AVAILABLE_SCOPES.map((scope) => (
              <button
                key={scope.id}
                onClick={() =>
                  setSelectedScopes((prev) =>
                    prev.includes(scope.id)
                      ? prev.filter((s) => s !== scope.id)
                      : [...prev, scope.id],
                  )
                }
                className={`text-xs px-2 py-1 rounded border transition-colors ${
                  selectedScopes.includes(scope.id)
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/50"
                }`}
              >
                {scope.label}
              </button>
            ))}
          </div>

          <MandateControls
            enabled={mandateEnabled}
            onEnabledChange={setMandateEnabled}
            budget={mandateBudget}
            onBudgetChange={setMandateBudget}
            perTx={mandatePerTx}
            onPerTxChange={setMandatePerTx}
            threshold={mandateThreshold}
            onThresholdChange={setMandateThreshold}
          />
          {createError && (
            <p className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" />
              {createError}
            </p>
          )}
        </div>

        {/* Bring your own credential */}
        <div className="space-y-2 rounded-lg border p-4">
          <button
            onClick={() => setImportOpen((v) => !v)}
            className="text-sm font-medium flex items-center gap-2 hover:text-primary transition-colors"
          >
            <Key className="h-3.5 w-3.5 text-muted-foreground" />
            Bring your own credential
            <span className="text-muted-foreground">{importOpen ? "−" : "+"}</span>
          </button>
          <p className="text-[11px] text-muted-foreground">
            Already manage a key somewhere else (an agent runtime, an existing
            integration)? Paste it here — we wrap your own material with this
            workspace&apos;s scopes and, optionally, a TEE-sealed mandate. Hashed
            on arrival, never shown back.
          </p>
          {importOpen && (
            <div className="space-y-2 pt-1">
              <Input
                placeholder="Label (e.g. Existing agent key)"
                value={importName}
                onChange={(e) => setImportName(e.target.value)}
              />
              <Input
                placeholder="Existing key material (32+ chars)"
                value={importRawKey}
                onChange={(e) => setImportRawKey(e.target.value)}
                className="font-mono text-xs"
                type="password"
                autoComplete="off"
              />
              {importError && (
                <p className="flex items-center gap-1.5 text-xs text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {importError}
                </p>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={handleImport}
                disabled={importing || !importName.trim() || importRawKey.trim().length < 32}
                className="gap-1.5"
              >
                {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                {importing ? "Wrapping…" : "Wrap credential"}
              </Button>
            </div>
          )}
        </div>

        {/* Show newly created key */}
        {createdKey && (
          <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 space-y-2">
            <div className="text-sm font-medium">Key created — copy it now</div>
            <div className="text-xs text-muted-foreground">
              This is the only time the full key will be shown.
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-background rounded px-2 py-1.5 border font-mono truncate">
                {createdKey.key}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopy}
                className="gap-1.5 shrink-0"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>

            {/* Test the key */}
            <div className="pt-1 border-t border-amber-200/60 dark:border-amber-800/40 space-y-2">
              <div className="flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-xs font-semibold">Test your key</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleTestKey}
                disabled={testing}
                className="h-7 gap-1.5 text-xs"
              >
                {testing ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Zap className="h-3 w-3" />
                )}
                {testing ? "Testing…" : "Verify key works"}
              </Button>
              {testResult && (
                <div className={`flex items-start gap-2 p-2 rounded-lg text-xs ${
                  testResult.ok
                    ? "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900"
                    : "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900"
                }`}>
                  {testResult.ok ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                  )}
                  <span className="text-muted-foreground">
                    {testResult.ok
                      ? `Key works — found ${testResult.agentCount} agent${testResult.agentCount === 1 ? "" : "s"} in your workspace.`
                      : `Key test failed: ${testResult.message}`}
                  </span>
                </div>
              )}
            </div>

            {/* Mandate trials — only when this key carries a sealed mandate */}
            {createdKey.mandate && (
              <div className="pt-1 border-t border-amber-200/60 dark:border-amber-800/40 space-y-2">
                <div className="flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5 text-purple-500" />
                  <span className="text-xs font-semibold">
                    Mandate: ${createdKey.mandate.budgetUsd} budget · ${createdKey.mandate.perTxUsd} per-tx · ${createdKey.mandate.approvalThresholdUsd} review floor
                  </span>
                  <Badge
                    variant="outline"
                    className={
                      createdKey.mandate.status === "sealed"
                        ? "text-emerald-600 border-emerald-300"
                        : createdKey.mandate.status === "failed" || createdKey.mandate.status === "unsupported"
                          ? "text-red-600 border-red-300"
                          : "text-amber-600 border-amber-300"
                    }
                  >
                    {createdKey.mandate.status === "sealed" ? "sealed in TEE" : createdKey.mandate.status}
                  </Badge>
                </div>
                {createdKey.mandate.status === "sealed" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleMandateTrials}
                    disabled={trialing}
                    className="h-7 gap-1.5 text-xs"
                  >
                    {trialing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                    {trialing ? "Evaluating in TEE…" : "Run trials against this key&apos;s mandate"}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleRefreshMandate}
                    className="h-7 gap-1.5 text-xs"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Refresh seal status
                  </Button>
                )}
                {trials.length > 0 && (
                  <div className="space-y-1">
                    {trials.map((t) => (
                      <div key={t.amountUsd} className="flex items-center gap-2 text-xs">
                        <span className="w-14 font-mono">${t.amountUsd}</span>
                        {t.error ? (
                          <span className="text-red-500">{t.error}</span>
                        ) : (
                          <span
                            className={
                              t.outcome === "approve"
                                ? "text-emerald-600"
                                : t.outcome === "hold"
                                  ? "text-amber-600"
                                  : "text-red-500"
                            }
                          >
                            → {t.outcome}
                          </span>
                        )}
                        {t.policyId && (
                          <code className="text-[10px] text-muted-foreground font-mono">
                            policy {t.policyId.slice(0, 10)}…
                          </code>
                        )}
                      </div>
                    ))}
                    <p className="text-[10px] text-muted-foreground pt-0.5">
                      The request&apos;s policyId is ignored — the enclave evaluated
                      against the mandate sealed to this key.
                    </p>
                  </div>
                )}
              </div>
            )}

            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setCreatedKey(null); setTestResult(null); setTrials([]); }}
              className="text-xs"
            >
              Dismiss
            </Button>
          </div>
        )}

        {/* Existing keys */}
        <div className="space-y-2">
          <div className="text-sm font-medium">
            Active keys ({activeKeys.length}/10)
          </div>
          {isLoading ? (
            <div className="text-xs text-muted-foreground">Loading...</div>
          ) : activeKeys.length === 0 ? (
            <div className="text-xs text-muted-foreground">
              No API keys yet. Create one above.
            </div>
          ) : (
            <div className="space-y-2">
              {activeKeys.map((key) => (
                <div
                  key={key.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2 px-3 rounded border"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="text-sm font-medium">{key.name}</div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                      <code className="font-mono">{key.keyPrefix}...</code>
                      <span>·</span>
                      <span>
                        {key.scopes.length} scope
                        {key.scopes.length !== 1 ? "s" : ""}
                      </span>
                      {key.mandate && (
                        <>
                          <span>·</span>
                          <span
                            className={`inline-flex items-center gap-1 ${
                              key.mandate.status === "sealed"
                                ? "text-purple-600 dark:text-purple-400"
                                : "text-muted-foreground"
                            }`}
                          >
                            <Lock className="h-3 w-3" />
                            ${key.mandate.budgetUsd} TEE mandate
                            {key.mandate.status !== "sealed" && ` (${key.mandate.status})`}
                          </span>
                        </>
                      )}
                      {key.lastUsedAt && (
                        <>
                          <span>·</span>
                          <span>
                            Last used{" "}
                            {new Date(key.lastUsedAt).toLocaleDateString()}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmRevoke(key)}
                    className="text-destructive hover:text-destructive self-start sm:self-auto"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Revoke confirmation dialog */}
        <Dialog
          open={confirmRevoke !== null}
          onOpenChange={(open) => {
            if (!open) setConfirmRevoke(null);
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="h-4 w-4" />
                Revoke API key
              </DialogTitle>
              <DialogDescription>
                {confirmRevoke && (
                  <>
                    You are about to revoke{" "}
                    <span className="font-medium text-foreground">
                      {confirmRevoke.name}
                    </span>{" "}
                    (<code className="font-mono">{confirmRevoke.keyPrefix}…</code>).
                    Any system using this key will immediately lose access.
                    This action cannot be undone.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setConfirmRevoke(null)}
                disabled={revoking}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (confirmRevoke) void handleRevoke(confirmRevoke);
                }}
                disabled={revoking}
                className="gap-1.5"
              >
                {revoking ? "Revoking…" : "Revoke key"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  );
}

function AppearanceCard({
  theme,
  setTheme,
}: {
  theme: string | undefined;
  setTheme: (t: string) => void;
}) {
  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <h2 className="font-semibold flex items-center gap-2" style={{ fontFamily: "var(--font-space-grotesk)" }}>
          <Sun className="h-4 w-4 text-amber-500" />
          Appearance
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { id: "light" as const, icon: Sun, label: "Light" },
            { id: "dark" as const, icon: Moon, label: "Dark" },
            { id: "system" as const, icon: Monitor, label: "System" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm border transition-all ${
                theme === t.id
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border hover:border-sky-200"
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>
    </div>
  );
}

function ChainsCard() {
  const { view: rail } = useConfidentialRail();
  const chains = [
    ...settingsRailRows().map((row) => ({
      name: row.name,
      role: row.role,
      note: row.note,
      noteColor: row.noteColor,
    })),
  ];
  // Confidential compute host may swap (Flare TEE vs Fhenix) — surface the active one.
  if (rail.rail === "flare") {
    const idx = chains.findIndex((c) => c.role === "Confidential Compute");
    const flareRow = {
      name: "Flare Coston2",
      role: "Confidential Compute",
      note: "TEE live · private budgets",
      noteColor: "text-emerald-500",
    };
    if (idx >= 0) chains[idx] = flareRow;
    else chains.splice(2, 0, flareRow);
  }

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <h2 className="font-semibold flex items-center gap-2" style={{ fontFamily: "var(--font-space-grotesk)" }}>
          <ExternalLink className="h-4 w-4 text-sky-500" />
          Supported Chains
        </h2>
        <p className="text-xs text-muted-foreground">
          Your systems can operate on any of these chains. Set the primary chain when
          creating an API identity.
        </p>
        <div className="space-y-2">
          {chains.map((chain) => (
            <div
              key={chain.name}
              className="flex items-center justify-between py-2"
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-sm font-medium">{chain.name}</span>
              </div>
              <div className="flex items-center gap-2">
                {chain.note && (
                  <span className={`text-[10px] font-medium ${chain.noteColor ?? "text-muted-foreground"}`}>
                    {chain.note}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {chain.role}
                </span>
                <Badge variant="secondary" className="text-xs">
                  supported
                </Badge>
              </div>
            </div>
          ))}
        </div>
    </div>
  );
}
