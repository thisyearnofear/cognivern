"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Users, PlusCircle } from "lucide-react";

const DEMO_AGENTS = [
  { id: "yield-01", name: "YieldHunter-01", role: "DeFi Yield Optimizer", status: "active", trades: 142, budget: "500 MNT/day", chain: "X Layer" },
  { id: "rebal-03", name: "Rebalancer-03", role: "Portfolio Rebalancing", status: "active", trades: 89, budget: "1,000 MNT/day", chain: "Mantle" },
  { id: "arb-07", name: "Arbitrage-07", role: "Cross-DEX Arbitrage", status: "paused", trades: 56, budget: "500 MNT/day", chain: "X Layer" },
  { id: "gov-01", name: "GovChecker-01", role: "Policy Validator", status: "active", trades: 31, budget: "Unlimited", chain: "Fhenix" },
  { id: "nft-02", name: "NFT-Flipper-v2", role: "NFT Market Scanner", status: "inactive", trades: 0, budget: "250 MNT/day", chain: "X Layer" },
];

export function AgentsPage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agents</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage and monitor governed agents</p>
        </div>
        <Button onClick={() => router.push("/agents/workshop")}>
          <PlusCircle className="h-4 w-4" /> Add Agent
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {DEMO_AGENTS.map((agent) => (
          <Card
            key={agent.id}
            className="hover:border-sky-200 dark:hover:border-sky-800 transition-colors cursor-pointer"
            onClick={() => router.push(`/agents/${agent.id}`)}
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    agent.status === "active" ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-600" :
                    agent.status === "paused" ? "bg-amber-100 dark:bg-amber-950 text-amber-600" :
                    "bg-stone-100 dark:bg-stone-800 text-stone-400"
                  }`}>
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-semibold">{agent.name}</div>
                    <div className="text-xs text-muted-foreground">{agent.role}</div>
                  </div>
                </div>
                <Badge variant={
                  agent.status === "active" ? "secondary" :
                  agent.status === "paused" ? "outline" : "outline"
                }>
                  {agent.status}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Trades</div>
                  <div className="font-medium">{agent.trades}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Budget</div>
                  <div className="font-medium text-xs">{agent.budget}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-xs text-muted-foreground">Chain</div>
                  <div className="font-medium text-xs">{agent.chain}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
