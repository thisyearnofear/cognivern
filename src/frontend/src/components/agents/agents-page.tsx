"use client";

import { motion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, EmptyState } from "@/components/ui/error-state";
import { useRouter } from "next/navigation";
import { Users, PlusCircle } from "lucide-react";
import { useAgents } from "@/hooks/use-api";

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

export function AgentsPage() {
  const router = useRouter();
  const { data: agents, isLoading, error } = useAgents();

  const agentList = agents || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
            Agents
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage and monitor governed agents
          </p>
        </div>
        <div className="flex items-center gap-2">
          {error && (
            <Badge variant="destructive" className="text-xs">
              Error
            </Badge>
          )}
          <Button onClick={() => router.push("/agents/workshop")}>
            <PlusCircle className="h-4 w-4" /> Add Agent
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
          title="Failed to load agents"
          message={error?.message || "We couldn't load your agents. Please try again."}
          onRetry={() => router.refresh()}
        />
      ) : agentList.length === 0 ? (
        <EmptyState
          icon={<Users className="h-8 w-8 text-muted-foreground" />}
          title="No agents yet"
          description="Create your first agent to start governing spend."
          action={{
            label: "Create Agent",
            onClick: () => router.push("/agents/workshop"),
            icon: <PlusCircle className="h-4 w-4" />,
          }}
          className="border rounded-xl"
        />
      ) : (
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border rounded-xl overflow-hidden"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {agentList.map((agent) => (
            <motion.div
              key={agent.id}
              variants={itemVariants}
              className="bg-card p-5 hover:bg-accent/50 transition-colors cursor-pointer"
              onClick={() => router.push(`/agents/${agent.id}`)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      agent.status === "active"
                        ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-600"
                        : agent.status === "paused"
                          ? "bg-amber-100 dark:bg-amber-950 text-amber-600"
                          : "bg-stone-100 dark:bg-stone-800 text-stone-400"
                    }`}
                  >
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-semibold">{agent.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {agent.role}
                    </div>
                  </div>
                </div>
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
          ))}
        </motion.div>
      )}
    </div>
  );
}
