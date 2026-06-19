"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
} from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { apiClient } from "@/lib/api-client";
import { authFetch } from "@/lib/auth-fetch";
import type { ApiKey, ApiKeyCreateResponse } from "@/lib/api-client";
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
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--font-space-grotesk)" }}>Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your workspace, API keys, and preferences
        </p>
      </div>

      <Tabs defaultValue="workspace" className="space-y-4">
        <TabsList>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
        </TabsList>

        <TabsContent value="workspace" className="space-y-4">
          <WorkspaceCard workspace={workspace} setWorkspace={setWorkspace} />
          <SuspicionThresholdCard workspaceId={workspace?.id} />
          <ChainsCard />
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
                  Create API Identity
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push("/policies")}
                >
                  Create Policy
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
    try {
      await apiClient.updateWorkspace({ suspicionHoldThreshold: threshold });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // ignore
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
    </div>
  );
}

function ApiKeysCard() {
  const { data, isLoading } = useSWR("api-keys", () => apiClient.getApiKeys());
  const [newKeyName, setNewKeyName] = useState("");
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

  const handleRevoke = useCallback(async (keyId: string) => {
    await apiClient.revokeApiKey(keyId);
    mutate("api-keys");
  }, []);

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
            API Keys
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
                    onClick={() => handleRevoke(key.id)}
                    className="text-destructive hover:text-destructive self-start sm:self-auto"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
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
    { name: "Ethereum", role: "Execution", supported: true },
    { name: "Arbitrum", role: "Execution", supported: true },
    { name: "Base", role: "Execution", supported: true },
    { name: "X Layer", role: "Execution", supported: true },
    { name: "Mantle", role: "Execution", supported: true },
    { name: "Fhenix", role: "Confidential Compute", supported: true },
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
