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
  AlertTriangle,
  Wallet,
  Shield,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { apiClient } from "@/lib/api-client";
import { authFetch } from "@/lib/auth-fetch";
import { useWallets } from "@/hooks/use-api";
import { PageState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import type { ApiKey, ApiKeyCreateResponse } from "@/lib/api-client";
import type { OwsWallet } from "@cognivern/shared";
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
  const setWorkspace = useAuthStore((s) => s.setWorkspace);

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Settings" description="Configure workspace access, wallet execution, and interface preferences." />
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
          <WorkspaceCard workspace={workspace} setWorkspace={setWorkspace} />
          <SuspicionThresholdCard workspaceId={workspace?.id} />
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
        executionProvider?: "local" | "keeperhub" | "cleanverse";
        chainId?: string;
        keeperHubWalletAddress?: string;
        cleanverseSenderAddress?: string;
        requireCleanverseIdentity?: boolean;
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

  const keeperHubWallets =
    wallets?.filter((w) => (w.metadata as { executionProvider?: string } | null)?.executionProvider === "keeperhub") ?? [];
  const cleanverseWallets =
    wallets?.filter((w) => (w.metadata as { executionProvider?: string } | null)?.executionProvider === "cleanverse") ?? [];
  const hasAnyWallet = (wallets?.length ?? 0) > 0;

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Wallet className="h-4 w-4 text-sky-500" />
        <h2 className="font-semibold" style={{ fontFamily: "var(--font-space-grotesk)" }}>
          Wallet Execution Provider
        </h2>
        <div className="ml-auto flex items-center gap-2">
          {keeperHubWallets.length > 0 && (
            <Badge variant="default">
              {keeperHubWallets.length} on KeeperHub
            </Badge>
          )}
          {cleanverseWallets.length > 0 && (
            <Badge variant="default">
              {cleanverseWallets.length} on Cleanverse
            </Badge>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Choose how each OWS wallet broadcasts approved spends. Local uses the
        Cognivern vault; KeeperHub routes managed native transfers;
        Cleanverse screens A-Pass (CVI) then settles Access USDC/aUSDC (CVA) on Monad
        testnet. Audit trails show up in
        <a className="underline ml-1" href="/observability">Observability</a>.
      </p>

      {isLoading ? (
        <div className="rounded-lg border p-4 space-y-3 animate-pulse">
          <div className="h-4 w-40 bg-muted rounded" />
          <div className="h-8 w-full bg-muted rounded" />
        </div>
      ) : error ? (
        <PageState variant="error" title="Could not load wallets" message="Wallet execution settings are unavailable right now." action={{ label: "Retry", onClick: () => mutate() }} />
      ) : !hasAnyWallet ? (
        <KeeperHubEmptyState />
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

function KeeperHubEmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-sky-300 dark:border-sky-800 bg-sky-50/40 dark:bg-sky-950/20 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Rocket className="h-4 w-4 text-sky-500" />
        <h3 className="text-sm font-semibold">Set up a KeeperHub-routed wallet</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        You don&apos;t have an OWS wallet yet. To use KeeperHub, first bootstrap
        a wallet (Cognivern creates one from your <code>OWS_BOOTSTRAP_PRIVATE_KEY</code>),
        then return here to pick the KeeperHub execution provider.
      </p>
      <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-1">
        <li>Set <code>OWS_BOOTSTRAP_PRIVATE_KEY</code> in the backend env and restart the API.</li>
        <li>Reload this page — the wallet will appear in the list above.</li>
        <li>Choose <strong>KeeperHub</strong> as the execution provider and supply a KeeperHub-funded wallet address.</li>
      </ol>
      <p className="text-[10px] text-muted-foreground">
        Need a KeeperHub wallet? Create one at <a className="underline" href="https://app.keeperhub.com" target="_blank" rel="noreferrer">app.keeperhub.com</a>.
      </p>
    </div>
  );
}

function KeeperHubConsequences() {
  return (
    <div className="rounded-lg border border-sky-200 dark:border-sky-900 bg-sky-50/30 dark:bg-sky-950/20 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Wallet className="h-3.5 w-3.5 text-sky-500" />
        <span className="text-xs font-semibold text-sky-900 dark:text-sky-200">
          What you&apos;re opting into
        </span>
      </div>
      <ul className="text-[11px] text-sky-900/80 dark:text-sky-200/80 space-y-1 list-disc list-inside">
        <li><strong>Managed execution.</strong> KeeperHub handles gas, nonces, retries, and multi-RPC failover on your behalf.</li>
        <li><strong>Gas sponsorship.</strong> Mainnet Ethereum transactions are gas-sponsored by KeeperHub.</li>
        <li><strong>MEV protection.</strong> Private routing avoids the public mempool.</li>
        <li><strong>Audit trail.</strong> Every spend flows through the same <code>wallet_sign_and_broadcast</code> span in SigNoz, with the KeeperHub <code>executionId</code> as a span attribute.</li>
        <li><strong>Cost.</strong> KeeperHub charges its own fee on top of gas — see <a className="underline" href="https://docs.keeperhub.com" target="_blank" rel="noreferrer">docs.keeperhub.com</a> for current pricing.</li>
      </ul>
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
      executionProvider?: "local" | "keeperhub" | "cleanverse";
      chainId?: string;
      keeperHubWalletAddress?: string;
      cleanverseSenderAddress?: string;
      requireCleanverseIdentity?: boolean;
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
  };
  const initialProvider =
    meta.executionProvider === "keeperhub"
      ? "keeperhub"
      : meta.executionProvider === "cleanverse"
        ? "cleanverse"
        : "local";
  const [provider, setProvider] = useState<"local" | "keeperhub" | "cleanverse">(
    initialProvider,
  );
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
  const [requireCleanverseIdentity, setRequireCleanverseIdentity] = useState(
    meta.requireCleanverseIdentity === true,
  );

  const providerLabel =
    provider === "keeperhub"
      ? "KeeperHub"
      : provider === "cleanverse"
        ? "Cleanverse"
        : "Local";

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{wallet.name}</span>
          <code className="text-xs text-muted-foreground font-mono">
            {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
          </code>
        </div>
        <Badge variant={provider === "local" ? "secondary" : "default"}>
          {providerLabel}
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-xs font-medium">Execution provider</label>
          <select
            value={provider}
            onChange={(e) => {
              const next = e.target.value as "local" | "keeperhub" | "cleanverse";
              setProvider(next);
              if (next === "cleanverse" && !chainId) {
                setChainId("10143");
              }
            }}
            disabled={saving}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          >
            <option value="local">Local vault</option>
            <option value="keeperhub">KeeperHub</option>
            <option value="cleanverse">Cleanverse (Monad Access USDC)</option>
          </select>
          <p className="text-[10px] text-muted-foreground">
            {provider === "keeperhub"
              ? "Transfers are routed through KeeperHub."
              : provider === "cleanverse"
                ? "A-Pass (CVI) gates approval; Access USDC/aUSDC (CVA) settles on Monad testnet."
                : "Transfers are signed and broadcast by the local Cognivern vault."}
          </p>
        </div>

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
            {provider === "cleanverse"
              ? "Monad testnet is 10143."
              : "Chain ID for KeeperHub execution. Defaults to the configured Cognivern chain."}
          </p>
        </div>
      </div>

      {provider === "keeperhub" && (
        <>
          <KeeperHubConsequences />
          <div className="space-y-2">
            <label className="text-xs font-medium">KeeperHub wallet address</label>
            <Input
              type="text"
              placeholder="0x..."
              value={keeperHubWalletAddress}
              onChange={(e) => setKeeperHubWalletAddress(e.target.value)}
              disabled={saving}
            />
            <p className="text-[10px] text-muted-foreground">
              The KeeperHub-funded wallet address to send from. Must match the address in KeeperHub.
            </p>
          </div>
        </>
      )}

      {provider === "cleanverse" && (
        <div className="space-y-2">
          <label className="text-xs font-medium">Cleanverse sender address (optional)</label>
          <Input
            type="text"
            placeholder={wallet.address}
            value={cleanverseSenderAddress}
            onChange={(e) => setCleanverseSenderAddress(e.target.value)}
            disabled={saving}
          />
          <p className="text-[10px] text-muted-foreground">
            Defaults to the vault wallet address. Must hold an active A-Pass and Access USDC/aUSDC on Monad.
          </p>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={requireCleanverseIdentity}
              onChange={(e) => setRequireCleanverseIdentity(e.target.checked)}
              disabled={saving}
            />
            Always require CVI screening (even if provider changes later)
          </label>
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
              requireCleanverseIdentity:
                provider === "cleanverse" ? true : requireCleanverseIdentity,
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
  setWorkspace,
}: {
  workspace: { id: string; name: string; tier: string } | null;
  setWorkspace: (w: {
    id: string;
    name: string;
    ownerId: string;
    tier: "demo" | "live";
    createdAt: string;
    updatedAt: string;
  }) => void;
}) {
  const router = useRouter();
  const [upgrading, setUpgrading] = useState(false);
  const [upgraded, setUpgraded] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);

  const handleGoLive = useCallback(async () => {
    if (!workspace) return;
    setUpgrading(true);
    setUpgradeError(null);
    try {
      const res = await apiClient.updateWorkspace({ tier: "live" });
      if (res.success && res.data) {
        setWorkspace(res.data);
        setUpgraded(true);
      } else {
        setUpgradeError(res.error || "Failed to upgrade workspace");
      }
    } catch (err) {
      setUpgradeError(
        err instanceof Error ? err.message : "Failed to upgrade workspace",
      );
    } finally {
      setUpgrading(false);
    }
  }, [workspace, setWorkspace]);

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <h2 className="font-semibold flex items-center gap-2" style={{ fontFamily: "var(--font-space-grotesk)" }}>
          <Rocket className="h-4 w-4 text-purple-500" />
          Workspace
        </h2>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">
              {workspace?.name || "Not connected"}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              ID: {workspace?.id ? `${workspace.id.slice(0, 8)}...` : "—"}
            </div>
          </div>
          <Badge variant={workspace?.tier === "live" ? "default" : "secondary"}>
            {workspace?.tier || "none"}
          </Badge>
        </div>

        {workspace?.tier === "demo" && !upgraded && (
          <div className="rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/30 p-4 space-y-3">
            <div>
              <div className="text-sm font-medium">Ready to go live?</div>
              <div className="text-xs text-muted-foreground mt-1">
                Upgrade to connect real agents with real blockchain
                transactions. Demo data will be replaced by live data from your
                agents.
              </div>
            </div>
            {upgradeError && (
              <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/30 text-xs text-red-600 dark:text-red-400">
                {upgradeError}
              </div>
            )}
            <Button
              size="sm"
              onClick={handleGoLive}
              disabled={upgrading}
              className="gap-2"
            >
              <Rocket className="h-3.5 w-3.5" />{" "}
              {upgrading ? "Upgrading..." : "Go Live"}
            </Button>
          </div>
        )}

        {(workspace?.tier === "live" || upgraded) && (
          <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-500" />
              <div className="text-sm font-medium">
                {upgraded ? "Upgraded successfully!" : "Workspace is live"}
              </div>
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
            {upgraded && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => router.push("/agents/workshop")}
                >
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
            )}
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
    authFetch("/api/workspace")
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
  const [copied, setCopied] = useState(false);

  const keys: ApiKey[] = data?.data || [];
  const activeKeys = keys.filter((k) => !k.revokedAt);

  const handleCreate = useCallback(async () => {
    if (!newKeyName.trim()) return;
    setCreating(true);
    try {
      const res = await apiClient.createWorkspaceApiKey({
        name: newKeyName.trim(),
        scopes: selectedScopes,
      });
      if (res.success && res.data) {
        setCreatedKey(res.data);
        setNewKeyName("");
        mutate("api-keys");
      }
    } finally {
      setCreating(false);
    }
  }, [newKeyName, selectedScopes]);

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

  return (      <div className="rounded-xl border bg-card p-5 space-y-4">
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
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setCreatedKey(null)}
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
  const chains = [
    { name: "Arbitrum Sepolia", role: "Governance", note: "Gov + Vault live", noteColor: "text-emerald-500" },
    { name: "Robinhood Chain", role: "Governance", note: "Gov + Vault live", noteColor: "text-emerald-500" },
    { name: "X Layer", role: "Execution", note: "Live", noteColor: "text-emerald-500" },
    { name: "Fhenix / Arb Sepolia", role: "Confidential Compute", note: "FHE live · verified", noteColor: "text-emerald-500" },
    { name: "Ethereum", role: "Execution" },
    { name: "Base", role: "Execution" },
    { name: "Mantle", role: "Execution" },
  ];

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
