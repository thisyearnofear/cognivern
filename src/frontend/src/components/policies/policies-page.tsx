"use client";

import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import { ShieldCheck, PlusCircle, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePolicies } from "@/hooks/use-api";
import { apiClient } from "@/lib/api-client";
import { mutate } from "swr";

export function PoliciesPage() {
  const router = useRouter();
  const { data: rawPolicies, isLoading, error } = usePolicies();
  const [showCreate, setShowCreate] = useState(false);

  const policies = (rawPolicies || []).map(p => ({
    id: p.id, name: p.name, type: p.type, agents: p.agents, violations: p.violations, status: p.status, desc: p.description
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Policies</h1>
          <p className="text-sm text-muted-foreground mt-1">Governance guardrails for agent spend</p>
        </div>
        <div className="flex items-center gap-2">
          {error && <Badge variant="destructive" className="text-xs">Error</Badge>}
          <Button onClick={() => setShowCreate(true)}>
            <PlusCircle className="h-4 w-4" /> Create Policy
          </Button>
        </div>
      </div>

      {showCreate && <CreatePolicyForm onClose={() => setShowCreate(false)} />}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}><CardContent className="p-5"><Skeleton className="h-32 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : error ? (
        <div className="p-12 text-center text-muted-foreground border rounded-xl">
          <p>Failed to load policies</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => router.refresh()}>Retry</Button>
        </div>
      ) : policies.length === 0 ? (
        <div className="p-12 text-center text-muted-foreground border rounded-xl">
          <ShieldCheck className="h-8 w-8 mx-auto mb-3 opacity-50" />
          <p className="font-medium">No policies yet</p>
          <p className="text-sm mt-1">Create a policy to govern agent spending</p>
          <Button className="mt-4" onClick={() => setShowCreate(true)}>
            <PlusCircle className="h-4 w-4" /> Create Policy
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {policies.map((policy) => (
            <Card key={policy.id} className="hover:border-sky-200 dark:hover:border-sky-800 transition-colors">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      policy.status === "active" ? "bg-emerald-100 dark:bg-emerald-950" : "bg-stone-100 dark:bg-stone-800"
                    }`}>
                      <ShieldCheck className={`h-5 w-5 ${policy.status === "active" ? "text-emerald-600" : "text-stone-400"}`} />
                    </div>
                    <div>
                      <div className="font-semibold">{policy.name}</div>
                      <div className="text-xs text-muted-foreground">{policy.type}</div>
                    </div>
                  </div>
                  <Badge variant={policy.status === "active" ? "secondary" : "outline"}>
                    {policy.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-4">{policy.desc}</p>
                <div className="flex items-center gap-6 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs">Agents:</span>{" "}
                    <span className="font-medium">{policy.agents}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Violations:</span>{" "}
                    <span className={`font-medium ${policy.violations > 0 ? "text-amber-500" : ""}`}>
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

  const handleCreate = useCallback(async () => {
    if (!name.trim() || !type) return;
    setCreating(true);
    setError(null);

    try {
      const rules = ruleCondition.trim()
        ? [{ condition: ruleCondition.trim(), action: ruleAction }]
        : [];

      const res = await apiClient.createGovernancePolicy({
        name: name.trim(),
        type,
        description: description.trim() || `${POLICY_TYPES.find(t => t.id === type)?.label} policy`,
        rules,
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
  }, [name, type, description, ruleCondition, ruleAction, onClose]);

  return (
    <Card className="border-sky-200 dark:border-sky-800">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Create Policy</h3>
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
              placeholder="e.g. Daily Spend Limit"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Type</label>
            <Select value={type} onValueChange={(v) => v && setType(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POLICY_TYPES.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
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
            placeholder="What does this policy enforce?"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-sm font-medium">Rule condition (optional)</label>
            <Input
              value={ruleCondition}
              onChange={(e) => setRuleCondition(e.target.value)}
              placeholder="e.g. amount > 3000"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Action</label>
            <Select value={ruleAction} onValueChange={(v) => v && setRuleAction(v)}>
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

        {error && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleCreate} disabled={!name.trim() || creating}>
            {creating ? "Creating..." : "Create Policy"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
