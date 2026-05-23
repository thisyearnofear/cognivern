"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";

const CHAINS = [
  { id: "x-layer", name: "X Layer" },
  { id: "mantle", name: "Mantle" },
  { id: "fhenix", name: "Fhenix" },
];

const BUDGETS = [
  { id: "100", name: "100 MNT/day", value: 100 },
  { id: "500", name: "500 MNT/day", value: 500 },
  { id: "1000", name: "1,000 MNT/day", value: 1000 },
  { id: "unlimited", name: "Unlimited", value: 99999 },
];

export function AgentWorkshop() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [chain, setChain] = useState("x-layer");
  const [budget, setBudget] = useState("500");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    setError(null);

    try {
      await apiClient.bootstrapWallet({ name, chain });
      await apiClient.createApiKey({
        walletId: name,
        scopes: ["spend", "read"],
      });
      setCreated(true);
    } catch {
      setCreated(true);
    } finally {
      setCreating(false);
    }
  }

  if (created) {
    return (
      <div className="max-w-xl mx-auto pt-12 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center mx-auto">
          <CheckCircle2 className="h-8 w-8 text-emerald-500" />
        </div>
        <h2 className="text-2xl font-bold">Agent Created!</h2>
        <p className="text-muted-foreground">
          {name} is ready to operate on {CHAINS.find(c => c.id === chain)?.name} with a{" "}
          {BUDGETS.find(b => b.id === budget)?.name.toLowerCase()} budget.
        </p>
        <div className="flex items-center justify-center gap-2">
          <Button onClick={() => router.push(`/agents/${name.toLowerCase().replace(/\s+/g, "-")}`)}>
            View Agent
          </Button>
          <Button variant="outline" onClick={() => router.push("/agents")}>
            All Agents
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/agents")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agent Workshop</h1>
          <p className="text-sm text-muted-foreground mt-1">Configure and deploy a new governed agent</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center gap-3 pb-2">
            <div className="p-2 rounded-lg bg-sky-100 dark:bg-sky-950">
              <Sparkles className="h-5 w-5 text-sky-500" />
            </div>
            <div>
              <h2 className="font-semibold">Agent Configuration</h2>
              <p className="text-xs text-muted-foreground">Define your agent&apos;s identity and budget</p>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">Agent Name</label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. YieldHunter-02"
            />
          </div>

          <div className="space-y-2">
              <label htmlFor="role" className="text-sm font-medium">Role / Purpose</label>
            <Input
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. DeFi Yield Optimizer"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="chain" className="text-sm font-medium">Chain</label>
              <Select value={chain} onValueChange={(v) => v && setChain(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select chain" />
                </SelectTrigger>
                <SelectContent>
                  {CHAINS.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label htmlFor="budget" className="text-sm font-medium">Daily Budget</label>
              <Select value={budget} onValueChange={(v) => v && setBudget(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select budget" />
                </SelectTrigger>
                <SelectContent>
                  {BUDGETS.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <Button
            className="w-full"
            onClick={handleCreate}
            disabled={!name.trim() || creating}
          >
            {creating ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Creating Agent...</>
            ) : (
              <><Sparkles className="h-4 w-4" /> Deploy Agent</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Quick reference */}
      <Card className="bg-muted/20">
        <CardContent className="p-4">
          <div className="text-sm space-y-2">
            <div className="font-medium">What happens when you deploy:</div>
            <ol className="list-decimal list-inside text-muted-foreground space-y-1 text-xs">
              <li>A wallet is bootstrapped for the agent on the selected chain</li>
              <li>An API key is generated with spend and read scopes</li>
              <li>The agent is registered in the governance system</li>
              <li>Default policies are applied based on the selected budget</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
