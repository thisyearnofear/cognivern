"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import {
  Bot,
  Loader2,
  X,
  Gavel,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAgents } from "@/hooks/use-api";
import { apiClient } from "@/lib/api-client";
import { mutate } from "swr";

function defaultDeadline(): string {
  const d = new Date();
  d.setUTCMinutes(d.getUTCMinutes() + 2); // 2 min — short for demo
  return d.toISOString();
}

// The agent-initiated round creation form. This is the visible "agent
// initiates a commercial action" moment for Track 3 (Agentic Commerce).
// The user picks an agent from the existing agents list, fills in the RFP
// details, and the agent creates the round — the backend records a CRE run
// and a hash-signed round_created event. The round then appears in the list
// with a "Created by agent X" badge.
export function AgentCreateRound({
  onCreated,
  onCancel,
}: {
  onCreated: (roundId: string) => void;
  onCancel: () => void;
}) {
  const { data: agents, isLoading: agentsLoading } = useAgents();
  const [agentId, setAgentId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [serviceCategory, setServiceCategory] = useState("security-audit");
  const [maxBids, setMaxBids] = useState(5);
  const [settlementAmount, setSettlementAmount] = useState<number>(50000);
  const [settlementAssetTag, setSettlementAssetTag] = useState("USDC");
  const [creating, setCreating] = useState(false);

  // Only active agents can create rounds — paused/inactive agents are
  // governance-locked out of initiating commercial actions.
  const activeAgents = (agents ?? []).filter(
    (a) => a.status === "active" || a.source === "demo",
  );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!agentId) {
      toast.error("Select an agent to create the round");
      return;
    }
    if (!description.trim()) return;
    setCreating(true);
    try {
      const res = await apiClient.createSealedBidRound({
        description: description.trim(),
        serviceCategory,
        deadline: defaultDeadline(),
        maxBids,
        backend: "canton",
        manager: "Auctioneer",
        agentId,
        settlementAmount,
        settlementAssetTag,
      });
      if (!res.success) throw new Error(res.error || "Failed to create round");
      const agent = activeAgents.find((a) => a.id === agentId);
      toast.success(
        `Agent ${agent?.name ?? agentId} created a governed round — policy gate active`,
      );
      await mutate("/api/vendor/sealed-bid/rounds");
      if (res.data?.roundId) {
        onCreated(res.data.roundId);
      } else {
        onCancel();
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create round");
    } finally {
      setCreating(false);
    }
  }

  return (
    <motion.form
      onSubmit={handleCreate}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4 space-y-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Bot className="h-4 w-4 text-violet-500" />
          Agent-initiated round
        </h3>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        An agent creates a confidential vendor-selection round on Canton. The
        round is <span className="font-medium text-foreground">policy-governed</span>:
        the auctioneer cannot close until minimum bids, deadline, and budget
        checks all pass. Every event is hash-signed in a tamper-evident run
        ledger.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2 md:col-span-2">
          <label className="text-xs font-medium">Agent</label>
          {agentsLoading ? (
            <div className="h-10 rounded-md border bg-muted/40 animate-pulse" />
          ) : activeAgents.length === 0 ? (
            <div className="h-10 flex items-center rounded-md border border-dashed px-3 text-xs text-muted-foreground">
              No active agents — register one in the Agents page first
            </div>
          ) : (
            <Select value={agentId} onValueChange={(v) => setAgentId(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Select an agent" />
              </SelectTrigger>
              <SelectContent>
                {activeAgents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} — {a.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="space-y-2 md:col-span-2">
          <label className="text-xs font-medium">RFP description</label>
          <Input
            placeholder="Q3 security audit RFP — vendor selection"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium">Category</label>
          <Input
            value={serviceCategory}
            onChange={(e) => setServiceCategory(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium">Max bids</label>
          <Input
            type="number"
            min={3}
            max={50}
            value={maxBids}
            onChange={(e) => setMaxBids(parseInt(e.target.value) || 3)}
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium">Settlement amount (USD)</label>
          <Input
            type="number"
            min={1}
            value={settlementAmount}
            onChange={(e) =>
              setSettlementAmount(parseFloat(e.target.value) || 0)
            }
          />
          <div className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 flex items-start gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-[10px] sm:text-xs text-amber-700 dark:text-amber-400">
              <strong className="font-semibold">Test the policy gate:</strong>{" "}
              Set this above $100,000 to demo a blocked close by the agent
              governance layer.
            </p>
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium">Asset tag</label>
          <Input
            value={settlementAssetTag}
            onChange={(e) => setSettlementAssetTag(e.target.value)}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={creating || !agentId || !description.trim()}
        >
          {creating ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Gavel className="h-4 w-4 mr-2" />
          )}
          Create governed round
        </Button>
      </div>
    </motion.form>
  );
}
