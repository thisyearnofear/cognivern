"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sparkles,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Copy,
  Check,
  Plug,
  XCircle,
  Key,
  ShieldCheck,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { mutate } from "swr";
import { useCallback } from "react";

const CHAINS = [
  { id: "Ethereum", name: "Ethereum" },
  { id: "Arbitrum", name: "Arbitrum" },
  { id: "Base", name: "Base" },
  { id: "X Layer", name: "X Layer" },
  { id: "Mantle", name: "Mantle" },
  { id: "Fhenix", name: "Fhenix" },
];

const BUDGETS = [
  { id: "$1,000", label: "$1,000/day" },
  { id: "$5,000", label: "$5,000/day" },
  { id: "$10,000", label: "$10,000/day" },
  { id: "$25,000", label: "$25,000/day" },
  { id: "Unlimited", label: "Unlimited" },
];

const USE_CASE_TEMPLATES = [
  {
    role: "DeFi Trading Bot",
    name: "TraderBot",
    chain: "Ethereum",
    budget: "$5,000",
    desc: "External trading bots that need swap/order governance",
  },
  {
    role: "Yield Optimizer",
    name: "YieldHunter",
    chain: "Arbitrum",
    budget: "$10,000",
    desc: "Yield farming scripts that need deposit/withdraw limits",
  },
  {
    role: "Portfolio Rebalancer",
    name: "Rebalancer",
    chain: "Ethereum",
    budget: "$25,000",
    desc: "Cross-vault rebalancing automation",
  },
  {
    role: "Payment Agent",
    name: "PayBot",
    chain: "Base",
    budget: "$1,000",
    desc: "Recurring payments and vendor payout workflows",
  },
  {
    role: "DAO Treasury Agent",
    name: "TreasuryOps",
    chain: "Ethereum",
    budget: "$10,000",
    desc: "Proposal-linked disbursement automation",
  },
  {
    role: "Bridge Agent",
    name: "Bridger",
    chain: "Ethereum",
    budget: "$5,000",
    desc: "Cross-chain transfer scripts and relayers",
  },
];

export function AgentWorkshop() {
  const router = useRouter();
  const [mode, setMode] = useState<"create" | "connect">("create");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [chain, setChain] = useState("Ethereum");
  const [budget, setBudget] = useState("$5,000");
  const [walletAddress, setWalletAddress] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim() || !role.trim()) return;
    setCreating(true);
    setError(null);

    try {
      const res =
        mode === "connect"
          ? await apiClient.connectAgent({
              name: name.trim(),
              role: role.trim(),
              chain,
              walletAddress: walletAddress.trim(),
              budget,
              webhookUrl: webhookUrl.trim() || undefined,
            })
          : await apiClient.registerAgent({
              name: name.trim(),
              role: role.trim(),
              chain,
              budget,
            });

      if (res.success && res.data) {
        setCreatedId(res.data.id);
        mutate("/api/agents");
      } else {
        setError(
          res.error ||
            `Failed to ${mode === "connect" ? "connect" : "create"} identity`,
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Failed to ${mode === "connect" ? "connect" : "create"} identity`,
      );
    } finally {
      setCreating(false);
    }
  }

  if (createdId) {
    return (
      <IdentityCreatedSuccess
        name={name}
        chain={chain}
        createdId={createdId}
        router={router}
      />
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/agents")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--font-space-grotesk)" }}>Create Governed API Identity</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Give an external system policy-governed access to Cognivern
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("create")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
            mode === "create"
              ? "border-primary bg-primary/5 text-primary"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sparkles className="h-4 w-4" />
          Create New
        </button>
        <button
          type="button"
          onClick={() => setMode("connect")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
            mode === "connect"
              ? "border-primary bg-primary/5 text-primary"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          <Plug className="h-4 w-4" />
          Connect Existing
        </button>
      </div>

      <div className="rounded-xl border bg-card p-5 space-y-4">
          <div className="flex items-center gap-3 pb-2">
            <div className="p-2 rounded-lg bg-sky-100 dark:bg-sky-950">
              {mode === "connect" ? (
                <Plug className="h-5 w-5 text-sky-500" />
              ) : (
                <Key className="h-5 w-5 text-sky-500" />
              )}
            </div>
            <div>
              <h2 className="font-semibold" style={{ fontFamily: "var(--font-space-grotesk)" }}>
                {mode === "connect"
                  ? "Connect Existing System"
                  : "API Identity Configuration"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {mode === "connect"
                  ? "Link an external system that already has a wallet address"
                  : "Define the identity and constraints for your external system"}
              </p>
            </div>
          </div>

          <Separator />

          {/* Templates work in both modes — the role/chain/budget defaults
              are equally useful whether you're creating a fresh identity
              or linking an existing system. Connect mode still requires
              the user to provide a wallet address separately. */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Use case templates
            </label>
            <p className="text-[11px] text-muted-foreground">
              Pre-fill common scenarios. You can edit everything below
              {mode === "connect" && " — wallet address stays yours to enter"}.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {USE_CASE_TEMPLATES.map((t) => (
                <button
                  key={t.role}
                  type="button"
                  onClick={() => {
                    setName(t.name);
                    setRole(t.role);
                    setChain(t.chain);
                    setBudget(t.budget);
                  }}
                  className={`p-3 rounded-lg border text-left transition-colors hover:border-primary/50 ${
                    role === t.role
                      ? "border-primary bg-primary/5"
                      : "border-border"
                  }`}
                >
                  <div className="text-xs font-medium">{t.role}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {t.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              Identity Name
            </label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. YieldHunter-02"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="role" className="text-sm font-medium">
              What does this system do?
            </label>
            <Input
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder={
                mode === "connect"
                  ? "e.g. Existing DeFi Trading Bot"
                  : "e.g. DeFi yield farming script"
              }
            />
          </div>

          {mode === "connect" && (
            <div className="space-y-2">
              <label htmlFor="wallet" className="text-sm font-medium">
                Wallet Address <span className="text-red-500">*</span>
              </label>
              <Input
                id="wallet"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                placeholder="0x..."
              />
              <p className="text-[11px] text-muted-foreground">
                The wallet address your external system uses on-chain
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="chain" className="text-sm font-medium">
                Primary Chain
              </label>
              <Select value={chain} onValueChange={(v) => v && setChain(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select chain" />
                </SelectTrigger>
                <SelectContent>
                  {CHAINS.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label htmlFor="budget" className="text-sm font-medium">
                Daily Budget
              </label>
              <Select value={budget} onValueChange={(v) => v && setBudget(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select budget" />
                </SelectTrigger>
                <SelectContent>
                  {BUDGETS.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {mode === "connect" && (
            <div className="space-y-2">
              <label htmlFor="webhook" className="text-sm font-medium">
                Webhook URL{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </label>
              <Input
                id="webhook"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://your-system.example.com/webhook"
              />
              <p className="text-[11px] text-muted-foreground">
                Optional endpoint for governance decision callbacks
              </p>
            </div>
          )}

          {/* Plain-English summary so the user can verify the configuration
              at a glance before submitting — same pattern as the Create
              Policy form's "What this policy does" block. */}
          {(name.trim() || role.trim()) && (
            <div className="rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50/40 dark:bg-sky-950/20 p-3">
              <div className="flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 text-sky-500 mt-0.5 shrink-0" />
                <div className="text-xs text-muted-foreground space-y-1">
                  <div className="font-medium text-foreground">
                    {mode === "connect"
                      ? "You're connecting"
                      : "You're creating"}
                  </div>
                  <div>
                    <span className="text-foreground font-medium">
                      {name.trim() || "Unnamed identity"}
                    </span>
                    {role.trim() && (
                      <>
                        {" — a "}
                        <span className="text-foreground">{role.trim()}</span>
                      </>
                    )}{" "}
                    on{" "}
                    <span className="text-foreground">{chain}</span> with a{" "}
                    <span className="text-foreground">{budget}</span> daily
                    budget.
                  </div>
                  <div className="text-[11px]">
                    {mode === "connect"
                      ? walletAddress.trim()
                        ? `Linking wallet ${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}.`
                        : "Add the wallet address above to enable Connect."
                      : "Next: attach policies and watch decisions stream in real time."}
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <Button
            className="w-full"
            onClick={handleCreate}
            disabled={
              !name.trim() ||
              !role.trim() ||
              creating ||
              (mode === "connect" && !walletAddress.trim())
            }
          >
            {creating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />{" "}
                {mode === "connect" ? "Connecting..." : "Creating..."}
              </>
            ) : mode === "connect" ? (
              <>
                <Plug className="h-4 w-4" /> Connect System
              </>
            ) : (
              <>
                <Key className="h-4 w-4" /> Create API Identity
              </>
            )}
          </Button>
        </div>

      <div className="rounded-xl border bg-muted/20 p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="text-sm font-medium flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              What you&apos;re creating
            </div>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>A policy-bound API identity in your workspace</li>
              <li>Governance rules enforced on every API call</li>
              <li>Audit trail for all activity</li>
              <li>Budget and chain constraints</li>
            </ul>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium flex items-center gap-1.5">
              <XCircle className="h-3.5 w-3.5 text-red-400" />
              What you&apos;re NOT creating
            </div>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>No AI or LLM is provisioned</li>
              <li>No autonomous bot is spun up</li>
              <li>No infrastructure — you bring your own system</li>
            </ul>
          </div>
        </div>

        <Separator />

        <div className="text-sm space-y-2">
          <div className="font-medium">
            After creation:
          </div>
          <ol className="list-decimal list-inside text-muted-foreground space-y-1 text-xs">
            <li>Copy your API key from Settings</li>
            <li>
              Give it to your external system (bot, script, Zapier, etc.)
            </li>
            <li>
              Your system calls Cognivern&apos;s API before every transaction
            </li>
            <li>Cognivern enforces your policies and logs all activity</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

function IdentityCreatedSuccess({
  name,
  chain,
  createdId,
  router,
}: {
  name: string;
  chain: string;
  createdId: string;
  router: ReturnType<typeof useRouter>;
}) {
  const [copied, setCopied] = useState<"curl" | "js" | null>(null);

  const curlSnippet = `curl -X POST https://api.cognivern.xyz/governance/check \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: YOUR_API_KEY_HERE" \\
  -d '{
    "agentId": "${createdId}",
    "action": {
      "type": "swap",
      "description": "Test swap on ${chain}",
      "amount": 100,
      "currency": "USDC"
    }
  }'`;

  const jsSnippet = `const res = await fetch('https://api.cognivern.xyz/governance/check', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'YOUR_API_KEY_HERE',
  },
  body: JSON.stringify({
    agentId: '${createdId}',
    action: {
      type: 'swap',
      description: 'Test swap on ${chain}',
      amount: 100,
      currency: 'USDC',
    },
  }),
});
const result = await res.json();
console.log(result.allowed ? 'Approved' : 'Blocked', result.reasoning);`;

  const handleCopy = useCallback((type: "curl" | "js", text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  return (
    <div className="max-w-2xl mx-auto pt-8 space-y-6">
      <div className="text-center space-y-3">
        <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center mx-auto">
          <CheckCircle2 className="h-8 w-8 text-emerald-500" />
        </div>
        <h2 className="text-2xl font-bold" style={{ fontFamily: "var(--font-space-grotesk)" }}>API Identity Created</h2>
        <p className="text-muted-foreground">
          <strong>{name}</strong> is now a governed API identity in your workspace on {chain}.
        </p>
      </div>

      <div className="rounded-xl border bg-muted/20 p-4">
        <div className="text-sm font-medium mb-2">Next steps</div>
        <ol className="list-decimal list-inside text-xs text-muted-foreground space-y-1">
          <li>Get your API key from Settings</li>
          <li>Give it to your external system (bot, script, Zapier, etc.)</li>
          <li>Your system calls Cognivern before every transaction</li>
          <li>Cognivern enforces your policies and logs all activity</li>
        </ol>
      </div>

      <div className="space-y-3">
        <div className="text-sm font-medium">Integration snippets</div>
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-muted border-b border-border">
            <span className="text-xs font-medium text-muted-foreground">
              cURL
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 text-xs"
              onClick={() => handleCopy("curl", curlSnippet)}
            >
              {copied === "curl" ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied === "curl" ? "Copied" : "Copy"}
            </Button>
          </div>
          <pre className="p-4 text-xs font-mono bg-background overflow-x-auto">
            <code>{curlSnippet}</code>
          </pre>
        </div>

        <div className="rounded-lg border border-border overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-muted border-b border-border">
            <span className="text-xs font-medium text-muted-foreground">
              JavaScript
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 text-xs"
              onClick={() => handleCopy("js", jsSnippet)}
            >
              {copied === "js" ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied === "js" ? "Copied" : "Copy"}
            </Button>
          </div>
          <pre className="p-4 text-xs font-mono bg-background overflow-x-auto">
            <code>{jsSnippet}</code>
          </pre>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 flex-wrap">
        <Button onClick={() => router.push(`/agents/${createdId}`)}>
          View Identity
        </Button>
        {/* Closes the cross-product loop: a fresh agent without a policy
            attached is useless. The agent-detail page also offers this,
            but pushing it here saves a click for users in the
            "just created an agent" mindset. */}
        <Button variant="outline" onClick={() => router.push("/policies")}>
          <ShieldCheck className="h-4 w-4" /> Attach a policy
        </Button>
        <Button variant="outline" onClick={() => router.push("/agents")}>
          All Identities
        </Button>
        <Button variant="secondary" onClick={() => router.push("/settings")}>
          Get API Key
        </Button>
      </div>
    </div>
  );
}
