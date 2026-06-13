"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { motion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ShieldCheck,
  PlusCircle,
  X,
  Lock,
  EyeOff,
  Zap,
  Loader2,
  History,
  Plus,
  Trash2,
  Share2,
  Check,
  AlertTriangle,
  Pause,
  Play,
} from "lucide-react";
import { PolicyVersionHistory } from "./policy-version-history";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePolicies, useAuditLogs } from "@/hooks/use-api";
import { apiClient } from "@/lib/api-client";
import { mutate } from "swr";
import { HelpIcon } from "@/components/ui/help-icon";

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
  const searchParams = useSearchParams();
  const { data: rawPolicies, isLoading, error } = usePolicies();
  const { data: auditLogs } = useAuditLogs();
  const [showCreate, setShowCreate] = useState(false);
  const [quickCreating, setQuickCreating] = useState<string | null>(null);
  const [historyPolicy, setHistoryPolicy] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [copiedPolicyId, setCopiedPolicyId] = useState<string | null>(null);
  const [importedTemplate, setImportedTemplate] = useState<null | {
    name: string;
    type: string;
    description: string;
    rules: { condition: string; action: string }[];
  }>(null);
  const [holds, setHolds] = useState<Array<{
    policyId: string;
    policyName: string;
    reason: string;
    heldAt: string;
    triggeredBy: {
      id: string;
      type: string;
      title: string;
      severity: string;
      affectedProtocols: string[];
      affectedTokens: string[];
      timestamp: string;
    };
  }>>([]);
  const [releasingHold, setReleasingHold] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchHolds = async () => {
      try {
        const res = await fetch("/api/webhooks/holds");
        const json = await res.json();
        if (!cancelled && json.success) {
          setHolds(json.data.holds || []);
        }
      } catch {
        // ignore
      }
    };
    fetchHolds();
    const interval = setInterval(fetchHolds, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const handleReleaseHold = useCallback(async (policyId: string) => {
    setReleasingHold(policyId);
    try {
      const res = await fetch(`/api/webhooks/holds/${policyId}/release`, {
        method: "POST",
      });
      const json = await res.json();
      if (json.success) {
        setHolds((prev) => prev.filter((h) => h.policyId !== policyId));
        mutate("/api/governance/policies");
      }
    } finally {
      setReleasingHold(null);
    }
  }, []);

  // Import shared policy from URL query param
  const templateParam = searchParams.get("template");
  const parsedTemplate = (() => {
    if (!templateParam) return null;
    try {
      const decoded = JSON.parse(atob(templateParam));
      if (decoded?.name && decoded?.type) return decoded;
    } catch {
      // Malformed template — ignore silently
    }
    return null;
  })();

  // Sync parsed template to state once on mount
  if (parsedTemplate && !importedTemplate) {
    setImportedTemplate(parsedTemplate);
    setShowCreate(true);
  }

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
        rules: p.rules || [],
      }))
    : [];

  const triggerCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (Array.isArray(auditLogs)) {
      for (const log of auditLogs) {
        for (const check of log.policyChecks || []) {
          counts[check.policyId] = (counts[check.policyId] || 0) + 1;
        }
      }
    }
    return counts;
  }, [auditLogs]);

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

  const handleSharePolicy = useCallback((policy: (typeof policies)[number]) => {
    const shareable = {
      name: policy.name,
      type: policy.type,
      description: policy.desc,
      rules: policy.rules || [],
    };
    const encoded = btoa(JSON.stringify(shareable));
    const url = `${window.location.origin}/policies?template=${encoded}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedPolicyId(policy.id);
      setTimeout(() => setCopiedPolicyId(null), 2000);
    });
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--font-space-grotesk)" }}>Policies</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Governance guardrails for system spend
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

      {/* Held Policies Banner */}
      {holds.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50/80 dark:bg-amber-950/30 overflow-hidden"
        >
          <div className="flex items-center gap-2 px-4 py-3 border-b border-amber-200 dark:border-amber-800">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span className="font-semibold text-sm text-amber-800 dark:text-amber-200">
              {holds.length} {holds.length === 1 ? "Policy" : "Policies"} Auto-Held
            </span>
            <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-600 dark:border-amber-700 dark:text-amber-400 ml-auto">
              News-triggered
            </Badge>
          </div>
          <div className="divide-y divide-amber-200 dark:divide-amber-800/50">
            {holds.map((hold) => (
              <div key={hold.policyId} className="px-4 py-3 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Pause className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                    <span className="font-medium text-sm text-foreground">{hold.policyName}</span>
                    <Badge
                      variant={
                        hold.triggeredBy.severity === "critical"
                          ? "destructive"
                          : hold.triggeredBy.severity === "high"
                            ? "secondary"
                            : "outline"
                      }
                      className="text-[10px] capitalize"
                    >
                      {hold.triggeredBy.severity}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mb-1">
                    <span className="font-medium text-amber-700 dark:text-amber-300 capitalize">{hold.triggeredBy.type}:</span>{" "}
                    {hold.triggeredBy.title}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground/70">
                    {hold.triggeredBy.affectedProtocols.length > 0 && (
                      <span>Protocols: {hold.triggeredBy.affectedProtocols.join(", ")}</span>
                    )}
                    {hold.triggeredBy.affectedTokens.length > 0 && (
                      <span>Tokens: {hold.triggeredBy.affectedTokens.join(", ")}</span>
                    )}
                    <span>Held: {new Date(hold.heldAt).toLocaleString()}</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleReleaseHold(hold.policyId)}
                  disabled={releasingHold === hold.policyId}
                  className="shrink-0 h-8 text-xs gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                >
                  {releasingHold === hold.policyId ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Play className="h-3 w-3" />
                  )}
                  Release
                </Button>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Quick-create templates */}
      {policies.length === 0 && !isLoading && !error && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium">Quick Start Templates</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {POLICY_TEMPLATES.map((t, i) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.08 }}
              >
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
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {showCreate && (
        <CreatePolicyForm
          onClose={() => {
            setShowCreate(false);
            setImportedTemplate(null);
          }}
          initialTemplate={importedTemplate ?? undefined}
        />
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border rounded-xl overflow-hidden">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-card p-5">
              <Skeleton className="h-32 w-full" />
            </div>
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
            Create a policy to govern spending
          </p>
          <Button className="mt-4" onClick={() => setShowCreate(true)}>
            <PlusCircle className="h-4 w-4" /> Create Policy
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border rounded-xl overflow-hidden">
          {policies.map((policy, i) => (
            <motion.div
              key={policy.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className={`bg-card p-5 transition-colors ${
                policy.confidential
                  ? "border-l-2 border-amber-400/50"
                  : ""
              }`}
            >
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
                    <div className="font-semibold" style={{ fontFamily: "var(--font-space-grotesk)" }}>{policy.name}</div>
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
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs">
                      Identities:
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
                  {(triggerCounts[policy.id] ?? 0) > 0 && (
                    <div>
                      <span className="text-muted-foreground text-xs">
                        Triggered:
                      </span>{" "}
                      <span className="font-medium">
                        {triggerCounts[policy.id]}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSharePolicy(policy)}
                    className="h-7 gap-1 text-xs"
                    title="Copy shareable link"
                  >
                    {copiedPolicyId === policy.id ? (
                      <>
                        <Check className="h-3 w-3 text-green-500" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Share2 className="h-3 w-3" />
                        Share
                      </>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setHistoryPolicy({ id: policy.id, name: policy.name })
                    }
                    className="h-7 gap-1 text-xs"
                  >
                    <History className="h-3 w-3" />
                    History
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {historyPolicy && (
        <PolicyVersionHistory
          policyId={historyPolicy.id}
          policyName={historyPolicy.name}
          open={!!historyPolicy}
          onClose={() => setHistoryPolicy(null)}
        />
      )}
    </div>
  );
}

const POLICY_TYPES = [
  { id: "budget", label: "Budget / Spend Limit", helpKey: "policy:budget" },
  { id: "allowlist", label: "Vendor Allowlist", helpKey: "policy:allowlist" },
  { id: "chain", label: "Chain Restriction", helpKey: "policy:chain" },
  { id: "approval", label: "Human Approval", helpKey: "policy:approval" },
];

const RULE_PRESETS = [
  { label: "Amount > $500", condition: "amount > 500" },
  { label: "Amount > $1000", condition: "amount > 1000" },
  { label: "Daily total > $2000", condition: "daily_total > 2000" },
  { label: "Not in allowlist", condition: "vendor NOT IN allowlist" },
  { label: "Unknown chain", condition: "chain NOT IN [ethereum, arbitrum, base]" },
];

interface PolicyRule {
  condition: string;
  action: string;
}

interface VisualRule {
  field: string;
  operator: string;
  value: string;
  action: string;
}

const RULE_FIELDS = [
  { id: "amount", label: "Amount", type: "number" },
  { id: "daily_total", label: "Daily Total", type: "number" },
  { id: "vendor", label: "Vendor", type: "text" },
  { id: "chain", label: "Chain", type: "text" },
];

const RULE_OPERATORS = [
  { id: ">", label: "greater than" },
  { id: "<", label: "less than" },
  { id: "===", label: "equals" },
  { id: "NOT IN", label: "not in" },
  { id: "IN", label: "in" },
];

const RULE_ACTIONS = [
  { id: "deny", label: "Deny" },
  { id: "flag", label: "Flag for review" },
  { id: "allow", label: "Allow" },
];

function conditionFromVisual(rule: VisualRule): string {
  if (!rule.field || !rule.operator || !rule.value) return "";
  if (rule.operator === "NOT IN" || rule.operator === "IN") {
    return `${rule.field} ${rule.operator} [${rule.value}]`;
  }
  return `${rule.field} ${rule.operator} ${rule.value}`;
}

function visualFromCondition(condition: string): VisualRule {
  const match = condition.match(/^(\w+)\s*(>|<|===|NOT IN|IN)\s*(.*)$/);
  if (!match) return { field: "", operator: ">", value: "", action: "deny" };
  const [, field, operator, value] = match;
  let cleanValue = value;
  if (operator === "NOT IN" || operator === "IN") {
    cleanValue = value.replace(/^\[|\]$/g, "");
  }
  return { field, operator, value: cleanValue, action: "deny" };
}

function CreatePolicyForm({
  onClose,
  initialTemplate,
}: {
  onClose: () => void;
  initialTemplate?: {
    name: string;
    type: string;
    description: string;
    rules: { condition: string; action: string }[];
  };
}) {
  const [name, setName] = useState(initialTemplate?.name ?? "");
  const [type, setType] = useState(initialTemplate?.type ?? "budget");
  const [description, setDescription] = useState(initialTemplate?.description ?? "");
  const [encrypted, setEncrypted] = useState(false);
  const [rules, setRules] = useState<PolicyRule[]>(
    initialTemplate?.rules?.length
      ? initialTemplate.rules
      : [{ condition: "", action: "deny" }],
  );
  const [visualMode, setVisualMode] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addRule = () => setRules((r) => [...r, { condition: "", action: "deny" }]);
  const removeRule = (idx: number) =>
    setRules((r) => r.filter((_, i) => i !== idx));
  const updateRule = (idx: number, field: keyof PolicyRule, value: string) =>
    setRules((r) => r.map((rule, i) => (i === idx ? { ...rule, [field]: value } : rule)));

  const updateVisualRule = (idx: number, visual: Partial<VisualRule>) => {
    const current = visualFromCondition(rules[idx].condition);
    const next = { ...current, ...visual };
    updateRule(idx, "condition", conditionFromVisual(next));
  };

  const handleCreate = useCallback(async () => {
    if (!name.trim() || !type) return;
    setCreating(true);
    setError(null);

    try {
      const policyRules = encrypted
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
        : rules
            .filter((r) => r.condition.trim())
            .map((r) => ({ condition: r.condition.trim(), action: r.action }));

      const metadata = encrypted
        ? {
            confidential: true,
            chain: "fhenix-arbitrum-sepolia",
            fheProvider: "cofhe-sdk",
          }
        : undefined;

      const res = await apiClient.createGovernancePolicy({
        name: name.trim(),
        type,
        description:
          description.trim() ||
          `${POLICY_TYPES.find((t) => t.id === type)?.label} policy`,
        rules: policyRules,
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
  }, [name, type, description, encrypted, rules, onClose]);

  const selectedType = POLICY_TYPES.find((t) => t.id === type);

  return (
    <div
      className={`rounded-xl border p-5 space-y-4 ${
        encrypted
          ? "border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/10"
          : "border-sky-200 dark:border-sky-800 bg-sky-50/30 dark:bg-sky-950/10"
      }`}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          {encrypted && <Lock className="h-4 w-4 text-amber-500" />}
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
                encrypted
                  ? "e.g. Encrypted DeFi Budget"
                  : "e.g. Daily Spend Limit"
              }
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium flex items-center gap-1.5">
              Type
              {selectedType && <HelpIcon helpKey={selectedType.helpKey} />}
            </label>
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
              encrypted
                ? "Encrypted budget enforced on-chain — agent cannot see limits"
                : "What does this policy enforce?"
            }
          />
        </div>

        {/* Encryption toggle */}
        <button
          type="button"
          onClick={() => setEncrypted(!encrypted)}
          className={`flex items-center gap-3 w-full p-3 rounded-lg border transition-colors text-left ${
            encrypted
              ? "border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20"
              : "border-border hover:border-primary/30"
          }`}
        >
          <Lock
            className={`h-4 w-4 shrink-0 ${encrypted ? "text-amber-500" : "text-muted-foreground"}`}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium">
                Encrypt this policy (FHE)
              </span>
              <HelpIcon helpKey="policy:encrypt" />
            </div>
            <p className="text-xs text-muted-foreground">
              {encrypted
                ? "Budget limits encrypted on-chain — agent cannot see caps"
                : "Enable to hide spending limits from agents using Fhenix FHE"}
            </p>
          </div>
          <div
            className={`w-9 h-5 rounded-full transition-colors shrink-0 flex items-center ${
              encrypted ? "bg-amber-500 justify-end" : "bg-muted justify-start"
            }`}
          >
            <div className="w-4 h-4 mx-0.5 rounded-full bg-white shadow-sm" />
          </div>
        </button>

        {encrypted ? (
          <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-3">
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
                  <Input disabled placeholder="Set on-chain" className="text-xs" />
                  <EyeOff className="h-4 w-4 text-amber-500 shrink-0" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  Per-tx limit (encrypted)
                </label>
                <div className="flex items-center gap-2">
                  <Input disabled placeholder="Set on-chain" className="text-xs" />
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
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  Rules
                  <span className="text-xs text-muted-foreground font-normal">
                    ({rules.length})
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => setVisualMode(!visualMode)}
                  className="text-[10px] px-2 py-0.5 rounded-full border border-border hover:border-primary/50 transition-colors"
                >
                  {visualMode ? "Text Mode" : "Visual Mode"}
                </button>
              </div>
              {rules.length < 5 && (
                <button
                  type="button"
                  onClick={addRule}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Plus className="h-3 w-3" /> Add rule
                </button>
              )}
            </div>
            {rules.map((rule, idx) => {
              const visual = visualFromCondition(rule.condition);
              return (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-muted/30 space-y-3"
                >
                  {visualMode ? (
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_auto_auto] gap-2 items-start">
                      <Select
                        value={visual.field}
                        onValueChange={(v) => v && updateVisualRule(idx, { field: v })}
                      >
                        <SelectTrigger className="text-sm">
                          <SelectValue placeholder="Field" />
                        </SelectTrigger>
                        <SelectContent>
                          {RULE_FIELDS.map((f) => (
                            <SelectItem key={f.id} value={f.id}>
                              {f.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={visual.operator}
                        onValueChange={(v) => v && updateVisualRule(idx, { operator: v })}
                      >
                        <SelectTrigger className="text-sm w-[140px]">
                          <SelectValue placeholder="Operator" />
                        </SelectTrigger>
                        <SelectContent>
                          {RULE_OPERATORS.map((o) => (
                            <SelectItem key={o.id} value={o.id}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Input
                        value={visual.value}
                        onChange={(e) => updateVisualRule(idx, { value: e.target.value })}
                        placeholder={visual.operator === "NOT IN" || visual.operator === "IN" ? "a, b, c" : "500"}
                        className="text-sm"
                      />

                      <Select
                        value={rule.action}
                        onValueChange={(v) => v && updateRule(idx, "action", v)}
                      >
                        <SelectTrigger className="text-sm w-[130px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {RULE_ACTIONS.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {rules.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRule(idx)}
                          className="p-2 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2 items-start">
                      <div className="space-y-1.5">
                        <Input
                          value={rule.condition}
                          onChange={(e) => updateRule(idx, "condition", e.target.value)}
                          placeholder="e.g. amount > 3000"
                          className="text-sm"
                        />
                        {idx === 0 && (
                          <div className="flex flex-wrap gap-1">
                            {RULE_PRESETS.map((p) => (
                              <button
                                key={p.condition}
                                type="button"
                                onClick={() => updateRule(idx, "condition", p.condition)}
                                className={`text-[10px] px-1.5 py-0.5 rounded-full border transition-colors ${
                                  rule.condition === p.condition
                                    ? "border-primary bg-primary/10 text-primary"
                                    : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                                }`}
                              >
                                {p.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <Select
                        value={rule.action}
                        onValueChange={(v) => v && updateRule(idx, "action", v)}
                      >
                        <SelectTrigger className="w-[130px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="deny">Deny</SelectItem>
                          <SelectItem value="flag">Flag for review</SelectItem>
                          <SelectItem value="allow">Allow</SelectItem>
                        </SelectContent>
                      </Select>
                      {rules.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRule(idx)}
                          className="p-2 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )}

                  {rule.condition && (
                    <div className="text-xs font-mono text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                      Generated: {rule.condition} → {rule.action}
                    </div>
                  )}
                </div>
              );
            })}
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
              : encrypted
                ? "Create Encrypted Policy"
                : "Create Policy"}
          </Button>
        </div>
      </div>
  );
}
