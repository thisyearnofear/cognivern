"use client";

import { useState, useCallback } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Check, Terminal, Code2, Zap, ArrowRight, Shield, Key, Plus, Loader2 } from "lucide-react";
import { HelpIcon } from "@/components/ui/help-icon";
import { apiClient } from "@/lib/api-client";
import type { ApiKeyCreateResponse } from "@/lib/api-client";

const AVAILABLE_SCOPES = [
  { id: "agents:read", label: "Agents (read)" },
  { id: "agents:write", label: "Agents (write)" },
  { id: "governance:read", label: "Governance (read)" },
  { id: "governance:write", label: "Governance (write)" },
  { id: "audit:read", label: "Audit (read)" },
  { id: "spend:execute", label: "Spend (execute)" },
] as const;

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="relative group">
      <pre className="p-4 rounded-lg bg-zinc-950 text-zinc-100 text-sm overflow-x-auto font-mono leading-relaxed">
        <code>{code}</code>
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
      <Badge
        variant="outline"
        className="absolute bottom-2 right-2 text-[10px] opacity-50"
      >
        {language}
      </Badge>
    </div>
  );
}

function StepCard({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0">
          {step}
        </div>
        <div className="w-px flex-1 bg-border mt-2" />
      </div>
      <div className="pb-8 flex-1">
        <h3 className="font-semibold mb-2" style={{ fontFamily: "var(--font-space-grotesk)" }}>{title}</h3>
        {children}
      </div>
    </div>
  );
}

function ApiKeyGenerator() {
  const [newKeyName, setNewKeyName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([
    "agents:read",
    "governance:read",
    "audit:read",
  ]);
  const [createdKey, setCreatedKey] = useState<ApiKeyCreateResponse | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = useCallback(async () => {
    if (!newKeyName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await apiClient.createWorkspaceApiKey({
        name: newKeyName.trim(),
        scopes: selectedScopes,
      });
      if (res.success && res.data) {
        setCreatedKey(res.data);
        setNewKeyName("");
      } else {
        setError(res.error || "Failed to create key");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create key");
    } finally {
      setCreating(false);
    }
  }, [newKeyName, selectedScopes]);

  const handleCopy = useCallback(() => {
    if (createdKey?.key) {
      navigator.clipboard.writeText(createdKey.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [createdKey]);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Generate a key right here — no need to leave this page.
      </p>

      {!createdKey ? (
        <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Name your key (e.g. Alpha Trader)"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={creating || !newKeyName.trim()}
              className="gap-1.5 shrink-0"
            >
              {creating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              {creating ? "Creating..." : "Generate Key"}
            </Button>
          </div>

          <div>
            <div className="text-xs text-muted-foreground mb-2">
              Scopes <span className="text-muted-foreground/60">(recommended defaults pre-selected)</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
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
                  className={`text-[11px] px-2 py-1 rounded border transition-colors ${
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

          {error && (
            <div className="text-xs text-red-600 dark:text-red-400 p-2 rounded-lg bg-red-50 dark:bg-red-950/30">
              {error}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-medium">Key created successfully</span>
          </div>
          <div className="text-xs text-muted-foreground">
            Copy this key now — it will only be shown once.
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-background rounded px-3 py-2 border font-mono truncate select-all">
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
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Use this key in the{" "}
            <code className="font-mono bg-background/50 px-1 rounded">x-api-key</code>{" "}
            header. Next step: try it with a governance check below.
          </p>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setCreatedKey(null);
              setCopied(false);
            }}
            className="text-xs"
          >
            Generate another key
          </Button>
        </div>
      )}

      {/* Example key format */}
      <div className="text-xs text-muted-foreground/60 flex items-center gap-2">
        <div className="w-1 h-1 rounded-full bg-muted-foreground/30" />
        Keys start with <code className="font-mono text-[10px] px-1 py-0.5 rounded bg-muted">cvn_</code>
        and are scoped to this workspace. Manage keys anytime in{" "}
        <a href="/settings" className="text-primary hover:underline">
          Settings
        </a>
        .
      </div>
    </div>
  );
}

export function IntegratePage() {
  const baseUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://api.cognivern.xyz";

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--font-space-grotesk)" }}>
          Integrate Your Agent
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect your AI agent to Cognivern&apos;s governance API in under 5
          minutes
        </p>
      </div>

      {/* Quick overview */}
      <div className="rounded-xl border bg-gradient-to-r from-primary/5 to-sky-500/5 border-primary/20 p-5">
          <div className="flex items-center gap-3 mb-3">
            <Zap className="h-5 w-5 text-primary" />
            <h2 className="font-semibold" style={{ fontFamily: "var(--font-space-grotesk)" }}>How it works</h2>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
            <Badge variant="secondary">Agent wants to spend</Badge>
            <ArrowRight className="h-3 w-3" />
            <Badge variant="secondary">Calls /governance/evaluate</Badge>
            <ArrowRight className="h-3 w-3" />
            <Badge variant="secondary">Policies checked</Badge>
            <ArrowRight className="h-3 w-3" />
            <Badge variant="outline">Approved / Denied</Badge>
            <ArrowRight className="h-3 w-3" />
            <Badge variant="secondary">Audit logged</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Your agent calls Cognivern before every transaction. If the action
            violates a policy, it gets denied. The agent should respect the
            decision — or the audit trail will flag it.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            <strong>Works with any agent</strong> that performs on-chain
            actions: trading bots, yield optimizers, rebalancers, payment
            agents, DAO treasury ops, bridge agents — anything that spends,
            swaps, stakes, or transfers.
          </p>
        </div>

      <Tabs defaultValue="quickstart" className="space-y-4">
        <TabsList>
          <TabsTrigger value="quickstart">Quickstart</TabsTrigger>
          <TabsTrigger value="reference">API Reference</TabsTrigger>
          <TabsTrigger value="examples">Code Examples</TabsTrigger>
        </TabsList>

        {/* Quickstart */}
        <TabsContent value="quickstart" className="space-y-2">
          <StepCard step={1} title="Get an API key">
            <ApiKeyGenerator />
          </StepCard>

          <StepCard step={2} title="Check governance before every spend">
            <p className="text-sm text-muted-foreground mb-3">
              Before your agent executes a transaction, call the evaluate
              endpoint:
            </p>
            <CodeBlock
              language="bash"
              code={`curl -X POST ${baseUrl}/api/governance/evaluate \\
  -H "x-api-key: cvn_YOUR_KEY_HERE" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agentId": "agent-YOUR-AGENT-ID",
    "action": {
      "type": "swap",
      "description": "Swap 1500 USDC for ETH on Uniswap",
      "amount": 1500,
      "currency": "USDC"
    }
  }'`}
            />
          </StepCard>

          <StepCard step={3} title="Handle the response">
            <p className="text-sm text-muted-foreground mb-3">
              The API returns whether the action is allowed and why:
            </p>
            <CodeBlock
              language="json"
              code={`{
  "success": true,
  "data": {
    "allowed": true,
    "reasoning": "Action approved — passed 3 policy check(s)",
    "policyChecks": [
      { "policyId": "pol-abc123", "result": true, "reason": "Within daily limit" },
      { "policyId": "pol-def456", "result": true, "reason": "Uniswap is allowlisted" },
      { "policyId": "pol-ghi789", "result": true, "reason": "Chain restriction check passed" }
    ],
    "auditLogId": "log-agent-xxx-2026-05-23T10:00:00.000Z",
    "timestamp": "2026-05-23T10:00:00.000Z"
  }
}`}
            />
            <div className="mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-sm">
              <strong>If denied:</strong> the response has{" "}
              <code className="text-xs bg-background px-1 rounded">{`"allowed": false`}</code>{" "}
              with a{" "}
              <code className="text-xs bg-background px-1 rounded">
                reasoning
              </code>{" "}
              field explaining which policy blocked it. Your agent should abort
              the transaction.
            </div>
          </StepCard>

          <StepCard step={4} title="That's it — your agent is governed">
            <p className="text-sm text-muted-foreground">
              Every evaluation is automatically logged. View results in the{" "}
              <a
                href="/audit"
                className="text-primary underline underline-offset-2"
              >
                Audit Trail
              </a>
              . Adjust policies anytime from the{" "}
              <a
                href="/policies"
                className="text-primary underline underline-offset-2"
              >
                Policies
              </a>{" "}
              page.
            </p>
          </StepCard>
        </TabsContent>

        {/* API Reference */}
        <TabsContent value="reference" className="space-y-4">
    <div className="rounded-xl border bg-card p-5 space-y-4">
              <h3 className="font-semibold flex items-center gap-2" style={{ fontFamily: "var(--font-space-grotesk)" }}>
                <Terminal className="h-4 w-4" />
                Authentication
                <HelpIcon helpKey="security:apikeys" />
              </h3>
              <p className="text-sm text-muted-foreground">
                All requests require an{" "}
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                  x-api-key
                </code>{" "}
                header with a workspace-scoped API key (starts with{" "}
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                  cvn_
                </code>
                ).
              </p>
              <CodeBlock
                language="http"
                code={`x-api-key: cvn_YOUR_KEY_HERE`}
              />
            </div>

    <div className="rounded-xl border bg-card p-5 space-y-3">
              <h3 className="font-semibold flex items-center gap-2" style={{ fontFamily: "var(--font-space-grotesk)" }}>
                <Shield className="h-4 w-4 text-emerald-500" />
                Security Features
              </h3>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <Check className="h-3.5 w-3.5 mt-0.5 text-emerald-500 shrink-0" />
                  API keys hashed with scrypt — only the prefix is visible after creation
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-3.5 w-3.5 mt-0.5 text-emerald-500 shrink-0" />
                  Rate limiting: 50 req/min per key, 100/min per workspace, persistent across restarts
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-3.5 w-3.5 mt-0.5 text-emerald-500 shrink-0" />
                  Nonce-based SIWE authentication prevents replay attacks
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-3.5 w-3.5 mt-0.5 text-emerald-500 shrink-0" />
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">Idempotency-Key</code>{" "}
                  header prevents duplicate spend execution (24h TTL)
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-3.5 w-3.5 mt-0.5 text-emerald-500 shrink-0" />
                  Contract addresses automatically audited via ChainGPT before spend
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-3.5 w-3.5 mt-0.5 text-emerald-500 shrink-0" />
                  Body limits: 512KB (data plane), 10MB (control plane) — Helmet CSP enabled
                </li>
              </ul>
            </div>

          <EndpointCard
            method="POST"
            path="/api/governance/evaluate"
            description="Evaluate an agent action against workspace policies"
            requestBody={`{
  "agentId": "string (required) — ID of the registered agent",
  "action": {
    "type": "string (required) — e.g. swap, transfer, stake",
    "description": "string — human-readable description",
    "amount": "number — transaction amount",
    "currency": "string — e.g. USDC, ETH"
  },
  "policyId": "string (optional) — evaluate against a specific policy"
}`}
            responseBody={`{
  "success": true,
  "data": {
    "allowed": boolean,
    "reasoning": "string — why allowed or denied",
    "policyChecks": [
      { "policyId": "string", "result": boolean, "reason": "string" }
    ],
    "auditLogId": "string",
    "timestamp": "ISO 8601"
  }
}`}
          />

          <EndpointCard
            method="POST"
            path="/api/agents/register"
            description="Register a new agent in your workspace"
            requestBody={`{
  "name": "string (required)",
  "role": "string (required) — e.g. DeFi Trading",
  "chain": "string (required) — e.g. Ethereum, Arbitrum",
  "walletAddress": "string (optional)",
  "budget": "string (optional) — e.g. $5,000"
}`}
            responseBody={`{
  "success": true,
  "data": {
    "id": "agent-xxxxxxxx",
    "name": "string",
    "role": "string",
    "status": "active",
    "chain": "string",
    "budget": "string",
    "trades": 0,
    "spendHistory": []
  }
}`}
          />

          <EndpointCard
            method="GET"
            path="/api/agents"
            description="List all agents in your workspace"
            responseBody={`{
  "success": true,
  "data": [
    { "id": "...", "name": "...", "role": "...", "status": "active", ... }
  ]
}`}
          />

          <EndpointCard
            method="GET"
            path="/api/governance/policies"
            description="List all active policies in your workspace"
            responseBody={`{
  "success": true,
  "data": [
    { "id": "...", "name": "...", "type": "budget", "status": "active", "rules": [...] }
  ]
}`}
          />

          <EndpointCard
            method="GET"
            path="/api/audit/logs"
            description="Get audit trail for your workspace"
            responseBody={`{
  "success": true,
  "data": {
    "logs": [...],
    "summary": { "totalActions": 5, "complianceRate": 80, ... }
  }
}`}
          />
        </TabsContent>

        {/* Code Examples */}
        <TabsContent value="examples" className="space-y-4">
    <div className="rounded-xl border bg-card p-5 space-y-4">
              <h3 className="font-semibold flex items-center gap-2" style={{ fontFamily: "var(--font-space-grotesk)" }}>
                <Code2 className="h-4 w-4" />
                TypeScript / Node.js
              </h3>
              <CodeBlock
                language="typescript"
                code={`const COGNIVERN_API_KEY = process.env.COGNIVERN_API_KEY; // cvn_...
const COGNIVERN_URL = "${baseUrl}";
const AGENT_ID = "agent-YOUR-AGENT-ID";

async function checkGovernance(action: {
  type: string;
  description: string;
  amount: number;
  currency: string;
}): Promise<boolean> {
  const res = await fetch(\`\${COGNIVERN_URL}/api/governance/evaluate\`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": COGNIVERN_API_KEY,
    },
    body: JSON.stringify({ agentId: AGENT_ID, action }),
  });

  const { data } = await res.json();

  if (!data.allowed) {
    console.log("Governance DENIED:", data.reasoning);
    return false;
  }

  console.log("Governance APPROVED:", data.reasoning);
  return true;
}

// Usage in your agent loop:
async function executeSwap(amount: number) {
  const allowed = await checkGovernance({
    type: "swap",
    description: \`Swap \${amount} USDC for ETH\`,
    amount,
    currency: "USDC",
  });

  if (!allowed) return; // Abort — policy violation

  // ... execute the actual swap
}`}
              />
            </div>

          <div className="rounded-xl border bg-card p-5 space-y-4">
              <h3 className="font-semibold flex items-center gap-2" style={{ fontFamily: "var(--font-space-grotesk)" }}>
                <Code2 className="h-4 w-4" />
                Python
              </h3>
              <CodeBlock
                language="python"
                code={`import requests
import os

COGNIVERN_URL = "${baseUrl}"
API_KEY = os.environ["COGNIVERN_API_KEY"]  # cvn_...
AGENT_ID = "agent-YOUR-AGENT-ID"

def check_governance(action_type: str, description: str, amount: float, currency: str = "USDC") -> bool:
    """Check if an action is allowed by workspace policies."""
    res = requests.post(
        f"{COGNIVERN_URL}/api/governance/evaluate",
        headers={"x-api-key": API_KEY, "Content-Type": "application/json"},
        json={
            "agentId": AGENT_ID,
            "action": {
                "type": action_type,
                "description": description,
                "amount": amount,
                "currency": currency,
            },
        },
    )
    data = res.json()["data"]

    if not data["allowed"]:
        print(f"DENIED: {data['reasoning']}")
        return False

    print(f"APPROVED: {data['reasoning']}")
    return True

# Usage:
if check_governance("swap", "Swap 2000 USDC for ETH", 2000):
    # execute the swap
    pass`}
              />
            </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EndpointCard({
  method,
  path,
  description,
  requestBody,
  responseBody,
}: {
  method: string;
  path: string;
  description: string;
  requestBody?: string;
  responseBody: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-5 space-y-3">
        <div className="flex items-center gap-3">
          <Badge
            variant={method === "GET" ? "secondary" : "default"}
            className="font-mono text-xs"
          >
            {method}
          </Badge>
          <code className="text-sm font-mono">{path}</code>
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
        {requestBody && (
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">
              Request body
            </div>
            <CodeBlock language="json" code={requestBody} />
          </div>
        )}
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1">
            Response
          </div>
          <CodeBlock language="json" code={responseBody} />
        </div>
      </div>
  );
}
