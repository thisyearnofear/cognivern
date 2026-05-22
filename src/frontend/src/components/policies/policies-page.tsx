"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { ShieldCheck, PlusCircle } from "lucide-react";

const DEMO_POLICIES = [
  { id: "p1", name: "Agent Spend Guardrails", type: "spend-limit", agents: 4, violations: 2, status: "active", desc: "Limits agent spend to configured daily budgets with FHE enforcement" },
  { id: "p2", name: "Regulatory Compliance", type: "compliance", agents: 4, violations: 0, status: "active", desc: "Ensures all agent actions comply with KYC/AML regulations" },
  { id: "p3", name: "High-Value Approval", type: "approval", agents: 3, violations: 0, status: "active", desc: "Requires manual approval for transactions above 1,000 MNT" },
  { id: "p4", name: "Contract Scanner", type: "security", agents: 2, violations: 1, status: "draft", desc: "Scans smart contract interactions for known vulnerability patterns" },
];

export function PoliciesPage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Policies</h1>
          <p className="text-sm text-muted-foreground mt-1">Governance guardrails for agent spend</p>
        </div>
        <Button onClick={() => router.push("/governance/check?mode=create")}>
          <PlusCircle className="h-4 w-4" /> Create Policy
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {DEMO_POLICIES.map((policy) => (
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
    </div>
  );
}
