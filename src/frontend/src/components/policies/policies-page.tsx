"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import { ShieldCheck, PlusCircle } from "lucide-react";
import { usePolicies } from "@/hooks/use-api";

export function PoliciesPage() {
  const router = useRouter();
  const { data: rawPolicies, isLoading, error } = usePolicies();

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
          <Button onClick={() => router.push("/governance/check?mode=create")}>
            <PlusCircle className="h-4 w-4" /> Create Policy
          </Button>
        </div>
      </div>

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
          <Button className="mt-4" onClick={() => router.push("/governance/check?mode=create")}>
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
