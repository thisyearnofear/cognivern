"use client";

import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  PlusCircle,
  X,
  Lock,
  EyeOff,
  Zap,
  Loader2,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePolicies } from "@/hooks/use-api";
import { apiClient } from "@/lib/api-client";
import { mutate } from "swr";

const POLICY_TEMPLATES = [
  {
    id: "strict-budget",
    name: "Strict Budget",
    desc: "Max $100/day, deny above $500 per tx",
    icon: "🔒",
    type: "budget",
    rules: [
      { condition: "amount > 500", action: "deny" },
      { condition: "daily_total > 100", action: "deny" },
    ],
  },
  {
    id: "moderate-budget",
    name: "Moderate Budget",
    desc: "Max $500/day, flag above $1,000",
    icon: "⚖️",
    type: "budget",
    rules: [
      { condition: "amount > 1000", action: "deny" },
      { condition: "daily_total > 500", action: "flag" },
    ],
  },
  {
    id: "dex-only",
    name: "DEX Allowlist",
    desc: "Only Uniswap, Curve, Sushi allowed",
    icon: "📋",
    type: "allowlist",
    rules: [
      {
        condition: "vendor NOT IN [uniswap, curve, sushiswap]",
        action: "deny",
      },
    ],
  },
  {
    id: "human-approval",
    name: "Human Approval",
    desc: "Require approval above $500",
    icon: "👤",
    type: "approval",
    rules: [{ condition: "amount > 500", action: "flag" }],
  },
];

export function PoliciesPage() {
  const router = useRouter();
  const { data: rawPolicies, isLoading, error } = usePolicies();
  const [showCreate, setShowCreate] = useState(false);
  const [quickCreating, setQuickCreating] = useState<string | null>(null);

  const policies = Array.isArray(rawPolicies)
    ? rawPolicies.map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        agents: p.agents,
        violations: p.violations,
        status: p.status,
        desc: p.description,
        confidential: p.metadata?.confidential === true,
      }))
    : [];

  const handleQuickCreate = useCallback(
    async (template: (typeof POLICY_TEMPLATES)[number]) => {
      setQuickCreating(template.id);
      try {
        await apiClient.createGovernancePolicy({
          name: template.name,
          type: template.type,
          description: template.desc,
          rules: template.rules,
        });
        mutate("/api/governance/policies");
      } finally {
        setQuickCreating(null);
      }
    },
    [],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Policies</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Governance guardrails for agent spend
          </p>
        </div>
        <div className="flex items-center gap-2">
          {error && (
            <Badge variant="destructive" className="text-xs">
              Error
            </Badge>
          )}
          <Button onClick={() => setShowCreate(true)}>
            <PlusCircle className="h-4 w-4" /> Create Policy
          </Button>
        </div>
      </div>

      {/* Quick-create templates */}
      {policies.length === 0 && !isLoading && !error && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium">Quick Start Templates</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {POLICY_TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => handleQuickCreate(t)}
                disabled={quickCreating !== null}
                className="p-4 rounded-xl border border-border text-left hover:border-primary/50 hover:bg-muted/50 transition-colors disabled:opacity-50"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{t.icon}</span>
                  <span className="text-sm font-medium">{t.name}</span>
                </div>
                <p className="text-xs text-muted-foreground mb-3">{t.desc}</p>
                {quickCreating === t.id ? (
                  <div className="flex items-center gap-1.5 text-xs text-primary">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Creating...
                  </div>
                ) : (
                  <span className="text-xs text-primary">Click to create</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {showCreate && <CreatePolicyForm onClose={() => setShowCreate(false)} />}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <Skeleton className="h-32 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        <div className="p-12 text-center text-muted-foreground border rounded-xl">
          <p>Failed to load policies</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => router.refresh()}
          >
            Retry
          </Button>
        </div>
      ) : policies.length === 0 ? (
        <div className="p-12 text-center text-muted-foreground border rounded-xl">
          <ShieldCheck className="h-8 w-8 mx-auto mb-3 opacity-50" />
          <p className="font-medium">No policies yet</p>
          <p className="text-sm mt-1">
            Create a policy to govern agent spending
          </p>
          <Button className="mt-4" onClick={() => setShowCreate(true)}>
            <PlusCircle className="h-4 w-4" /> Create Policy
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {policies.map((policy) => (
            <Card
              key={policy.id}
              className={`hover:border-sky-200 dark:hover:border-sky-800 transition-colors ${
                policy.confidential
                  ? "border-amber-200/50 dark:border-amber-800/50"
                  : ""
              }`}
            >
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-lg ${
                        policy.confidential
                          ? "bg-amber-100 dark:bg-amber-950"
                          : policy.status === "active"
                            ? "bg-emerald-100 dark:bg-emerald-950"
                            : "bg-stone-100 dark:bg-stone-800"
                      }`}
                    >
                      {policy.confidential ? (
                        <Lock className="h-5 w-5 text-amber-600" />
                      ) : (
                        <ShieldCheck
                          className={`h-5 w-5 ${policy.status === "active" ? "text-emerald-600" : "text-stone-400"}`}
                        />
                      )}
                    </div>
                    <div>
                      <div className="font-semibold">{policy.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {policy.type}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {policy.confidential && (
                      <Badge
                        variant="outline"
                        className="text-[10px] border-amber-300 text-amber-600 dark:border-amber-700 dark:text-amber-400"
                      >
                        FHE
                      </Badge>
                    )}
                    <Badge
                      variant={
                        policy.status === "active" ? "secondary" : "outline"
                      }
                    >
                      {policy.status}
                    </Badge>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  {policy.desc}
                </p>
                {policy.confidential && (
                  <div className="flex items-center gap-2 mb-3 px-2 py-1.5 rounded-md bg-amber-50 dark:bg-amber-950/30 text-xs text-amber-700 dark:text-amber-300">
                    <EyeOff className="h-3 w-3" />
                    <span>Budget limits encrypted on-chain via Fhenix FHE</span>
                  </div>
                )}
                <div className="flex items-center gap-6 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs">
                      Agents:
                    </span>{" "}
                    <span className="font-medium">{policy.agents}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">
                      Violations:
                    </span>{" "}
                    <span
                      className={`font-medium ${policy.violations > 0 ? "text-amber-500" : ""}`}
                    >
                      {policy.violations}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

const POLICY_TYPES = [
  { id: "budget", label: "Budget / Spend Limit" },
  { id: "confidential-budget", label: "Confidential Budget (FHE)" },
  { id: "allowlist", label: "Vendor Allowlist" },
  { id: "chain", label: "Chain Restriction" },
  { id: "approval", label: "Human Approval" },
];

function CreatePolicyForm({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("budget");
  const [description, setDescription] = useState("");
  const [ruleCondition, setRuleCondition] = useState("");
  const [ruleAction, setRuleAction] = useState("deny");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConfidential = type === "confidential-budget";

  const handleCreate = useCallback(async () => {
    if (!name.trim() || !type) return;
    setCreating(true);
    setError(null);

    try {
      const rules = isConfidential
        ? [
            {
              id: "fhe-budget-check",
              type: "deny",
              condition: "true",
              action: {
                type: "block",
                parameters: { reason: "FHE evaluation required" },
              },
              metadata: { confidential: true },
            },
          ]
        : ruleCondition.trim()
          ? [{ condition: ruleCondition.trim(), action: ruleAction }]
          : [];

      const metadata = isConfidential
        ? {
            confidential: true,
            chain: "fhenix-arbitrum-sepolia",
            fheProvider: "cofhe-sdk",
          }
        : undefined;

      const res = await apiClient.createGovernancePolicy({
        name: name.trim(),
        type: isConfidential ? "budget" : type,
        description:
          description.trim() ||
          `${POLICY_TYPES.find((t) => t.id === type)?.label} policy`,
        rules,
        metadata,
      });

      if (res.success) {
        mutate("/api/governance/policies");
        onClose();
      } else {
        setError("Failed to create policy");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create policy");
    } finally {
      setCreating(false);
    }
  }, [
    name,
    type,
    description,
    ruleCondition,
    ruleAction,
    isConfidential,
    onClose,
  ]);

  return (
    <Card
      className={`${isConfidential ? "border-amber-200 dark:border-amber-800" : "border-sky-200 dark:border-sky-800"}`}
    >
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            {isConfidential && <Lock className="h-4 w-4 text-amber-500" />}
            Create Policy
          </h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                isConfidential
                  ? "e.g. Encrypted DeFi Budget"
                  : "e.g. Daily Spend Limit"
              }
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Type</label>
            <Select value={type} onValueChange={(v) => v && setType(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POLICY_TYPES.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Description</label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={
              isConfidential
                ? "Encrypted budget enforced on-chain — agent cannot see limits"
                : "What does this policy enforce?"
            }
          />
        </div>

        {isConfidential ? (
          <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-300">
              <Lock className="h-4 w-4" />
              Confidential Policy (Fhenix FHE)
            </div>
            <p className="text-xs text-muted-foreground">
              Budget limits are encrypted on-chain using Fully Homomorphic
              Encryption. The agent cannot see its spending caps — evaluations
              happen in ciphertext. Only designated auditors can decrypt limits
              via CoFHE permits.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  Daily limit (encrypted)
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    disabled
                    placeholder="Set on-chain"
                    className="text-xs"
                  />
                  <EyeOff className="h-4 w-4 text-amber-500 shrink-0" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  Per-tx limit (encrypted)
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    disabled
                    placeholder="Set on-chain"
                    className="text-xs"
                  />
                  <EyeOff className="h-4 w-4 text-amber-500 shrink-0" />
                </div>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Limits are set during contract registration via{" "}
              <code className="px-1 py-0.5 rounded bg-stone-100 dark:bg-stone-800">
                registerPolicy()
              </code>{" "}
              on ConfidentialSpendPolicy.sol
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-sm font-medium">
                Rule condition (optional)
              </label>
              <Input
                value={ruleCondition}
                onChange={(e) => setRuleCondition(e.target.value)}
                placeholder="e.g. amount > 3000"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Action</label>
              <Select
                value={ruleAction}
                onValueChange={(v) => v && setRuleAction(v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deny">Deny</SelectItem>
                  <SelectItem value="flag">Flag for review</SelectItem>
                  <SelectItem value="allow">Allow</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={!name.trim() || creating}
          >
            {creating
              ? "Creating..."
              : isConfidential
                ? "Create Confidential Policy"
                : "Create Policy"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
