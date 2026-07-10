"use client";

import { motion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, EmptyState } from "@/components/ui/error-state";
import { useRouter } from "next/navigation";
import { PlusCircle, Key, Eye } from "lucide-react";
import { useAgents } from "@/hooks/use-api";
import { useMemo } from "react";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

function AgentCard({ agent }: { agent: { id: string; name: string; role: string; status: string; trades: number; budget: string; chain: string; source?: string } }) {
  const router = useRouter();
  const isDemo = agent.source === "demo";

  return (
    <motion.div
      variants={itemVariants}
      className="bg-card p-5 hover:bg-accent/50 transition-colors cursor-pointer"
      onClick={() => router.push(`/agents/${agent.id}`)}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              isDemo
                ? "bg-violet-100 dark:bg-violet-950 text-violet-600"
                : agent.status === "active"
                  ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-600"
                  : agent.status === "paused"
                    ? "bg-amber-100 dark:bg-amber-950 text-amber-600"
                    : "bg-stone-100 dark:bg-stone-800 text-stone-400"
            }`}
          >
            {isDemo ? <Eye className="h-5 w-5" /> : <Key className="h-5 w-5" />}
          </div>
          <div>
            <div className="font-semibold">{agent.name}</div>
            <div className="text-xs text-muted-foreground">
              {agent.role}
            </div>
          </div>
        </div>
        {isDemo ? (
          <Badge variant="outline" className="text-violet-600 border-violet-300 dark:border-violet-700 dark:text-violet-400">
            demo
          </Badge>
        ) : (
          <Badge
            variant={
              agent.status === "active"
                ? "secondary"
                : agent.status === "paused"
                  ? "outline"
                  : "outline"
            }
          >
            {agent.status}
          </Badge>
        )}
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
    </motion.div>
  );
}

export function AgentsPage() {
  const router = useRouter();
  const { data: agents, isLoading, error } = useAgents();

  const agentList = useMemo(() => agents || [], [agents]);

  const { showcase, user } = useMemo(() => {
    const showcase: typeof agentList = [];
    const user: typeof agentList = [];
    for (const agent of agentList) {
      if (agent.source === "demo") showcase.push(agent);
      else user.push(agent);
    }
    return { showcase, user };
  }, [agentList]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
            API Identities
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            Policy-bound identities for bots, scripts, and workflows that spend through Cognivern
          </p>
        </div>
        <div className="flex items-center gap-2">
          {error && (
            <Badge variant="destructive" className="text-xs">
              Error
            </Badge>
          )}
          <Button onClick={() => router.push("/agents/workshop")}>
            <PlusCircle className="h-4 w-4" /> Create API Identity
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border rounded-xl overflow-hidden">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-card p-5">
              <Skeleton className="h-32 w-full" />
            </div>
          ))}
        </div>
      ) : error ? (
        <ErrorState
          title="Failed to load API identities"
          message={error?.message || "We couldn't load your API identities. Please try again."}
          onRetry={() => router.refresh()}
        />
      ) : agentList.length === 0 ? (
        <EmptyState
          icon={<Key className="h-8 w-8 text-muted-foreground" />}
          title="No API identities yet"
          description="Give your first external system governed access to Cognivern. You bring the system — Cognivern enforces the rules."
          action={{
            label: "Create Your First API Identity",
            onClick: () => router.push("/agents/workshop"),
            icon: <PlusCircle className="h-4 w-4" />,
          }}
          className="border rounded-xl"
        />
      ) : (
        <div className="space-y-8">
          {showcase.length > 0 && (
            <div className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Example Identities
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Demos showing what Cognivern can govern. Not configurable.
                </p>
              </div>
              <motion.div
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border rounded-xl overflow-hidden"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
              >
                {showcase.map((agent) => (
                  <AgentCard key={agent.id} agent={agent} />
                ))}
              </motion.div>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Your API Identities
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                External systems you&apos;ve given governed access to Cognivern.
              </p>
            </div>
            {user.length === 0 ? (
              <div className="rounded-xl border border-dashed bg-card p-8 text-center">
                <Key className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No API identities yet. Create one to get started.
                </p>
              </div>
            ) : (
              <motion.div
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border rounded-xl overflow-hidden"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
              >
                {user.map((agent) => (
                  <AgentCard key={agent.id} agent={agent} />
                ))}
              </motion.div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
