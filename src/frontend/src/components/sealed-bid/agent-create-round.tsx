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
import { useAgents, useSealedBidCapabilities } from "@/hooks/use-api";
import { apiClient } from "@/lib/api-client";
import { useWorkspaceMode } from "@/hooks/use-workspace-mode";
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
  const {
    data: capabilities,
    isLoading: capabilitiesLoading,
    error: capabilitiesError,
  } = useSealedBidCapabilities();
  const { mode, isConnected } = useWorkspaceMode();
  const environment = !isConnected ? "Demo" : mode === "production" ? "Production" : "Sandbox";
  const isProduction = environment === "Production";
  const settlementSupported = isProduction && capabilities?.settlementSupported === true;
  const settlementUnavailable =
    isProduction && !capabilitiesLoading && !settlementSupported;
  const backendUnavailable =
    isProduction && !capabilitiesLoading && capabilities?.backendConfigured === false;
  const productionCapabilityBlocked =
    isProduction &&
    (capabilitiesLoading || Boolean(capabilitiesError) || backendUnavailable);
  const [agentId, setAgentId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [serviceCategory, setServiceCategory] = useState("security-audit");
  const [maxBids, setMaxBids] = useState(5);
  const [settlementAmount, setSettlementAmount] = useState<number>(50000);
  const [settlementAssetTag, setSettlementAssetTag] = useState("USDC");
  const [creating, setCreating] = useState(false);
  const [productionConfirmationVisible, setProductionConfirmationVisible] = useState(false);
  const [productionAcknowledged, setProductionAcknowledged] = useState(false);

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
    if (productionCapabilityBlocked) {
      toast.info(
        capabilitiesError
          ? "Canton settlement capability could not be verified — try again in a moment"
          : "Checking Canton settlement capability — try again in a moment",
      );
      return;
    }
    if (settlementSupported && !productionAcknowledged) {
      setProductionConfirmationVisible(true);
      return;
    }
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
        // The current Demo/Sandbox fallback DAR does not include the optional
        // PaymentDeposit template. Production sends settlement explicitly
        // after the operator confirms the exact value being reserved.
        ...(settlementSupported ? { settlementAmount, settlementAssetTag } : {}),
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
      aria-label="Agent round creation"
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
        An agent creates a confidential vendor-selection round. The
        round is <span className="font-medium text-foreground">policy-governed</span>:
        the auctioneer cannot close until minimum bids, deadline, and budget
        checks all pass. Every event is hash-signed in a tamper-evident run
        ledger.
      </p>
      <p className="text-[11px] text-muted-foreground">
        {environment} workspace ·{" "}
        {capabilitiesLoading && isProduction
          ? "checking Canton settlement capability"
          : settlementSupported
            ? "settlement can move real value at reveal"
            : "no real funds can move"}
        {"."}
      </p>

      {settlementUnavailable && (
        <div
          role="status"
          className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300"
        >
          <p className="font-semibold">Production settlement unavailable</p>
          <p className="mt-1">
            {capabilitiesError
              ? "Canton capability could not be verified."
              : backendUnavailable
                ? "The Canton backend is not configured on this server."
                : capabilities?.settlementReason ||
                  "The configured Canton DAR does not expose PaymentDeposit."}{" "}
            {capabilitiesError || backendUnavailable
              ? "Creation is paused until the capability is available."
              : "You can still create a governed round, but it will not reserve funds."}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2 md:col-span-2">
          <label htmlFor="agent-id" className="text-xs font-medium">Agent</label>
          {agentsLoading ? (
            <div className="h-10 rounded-md border bg-muted/40 animate-pulse" />
          ) : activeAgents.length === 0 ? (
            <div className="h-10 flex items-center rounded-md border border-dashed px-3 text-xs text-muted-foreground">
              No active agents — register one in the Agents page first
            </div>
          ) : (
            <Select value={agentId} onValueChange={(v) => setAgentId(v ?? "")}>
              <SelectTrigger id="agent-id">
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
          <label htmlFor="agent-round-description" className="text-xs font-medium">RFP description</label>
          <Input
            id="agent-round-description"
            placeholder="Q3 security audit RFP — vendor selection"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="agent-round-category" className="text-xs font-medium">Category</label>
          <Input
            id="agent-round-category"
            value={serviceCategory}
            onChange={(e) => setServiceCategory(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="agent-round-max-bids" className="text-xs font-medium">Max bids</label>
          <Input
            id="agent-round-max-bids"
            type="number"
            min={3}
            max={50}
            value={maxBids}
            onChange={(e) => setMaxBids(parseInt(e.target.value) || 3)}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="agent-round-settlement-amount" className="text-xs font-medium">Settlement amount (USD)</label>
          <Input
            id="agent-round-settlement-amount"
            type="number"
            min={1}
            value={settlementAmount}
            disabled={!settlementSupported}
            onChange={(e) => {
              setSettlementAmount(parseFloat(e.target.value) || 0);
              setProductionAcknowledged(false);
            }}
          />
          <div className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 flex items-start gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-[10px] sm:text-xs text-amber-700 dark:text-amber-400">
              <strong className="font-semibold">Settlement:</strong>{" "}
              {settlementSupported
                ? "this round escrows the amount on Canton and transfers it to the winner at reveal — real value is reserved."
                : isProduction
                  ? "value settlement is unavailable for this Canton DAR; no funds are reserved."
                  : "settlement is disabled in Demo/Sandbox; no funds are reserved and no real value can move."}{" "}
              {settlementSupported && "Set it above $100,000 to demo a blocked check by the agent governance layer."}
            </p>
          </div>
        </div>
        <div className="space-y-2">
          <label htmlFor="agent-round-asset-tag" className="text-xs font-medium">Asset tag</label>
          <Input
            id="agent-round-asset-tag"
            value={settlementAssetTag}
            disabled={!settlementSupported}
            onChange={(e) => {
              setSettlementAssetTag(e.target.value);
              setProductionAcknowledged(false);
            }}
          />
        </div>
      </div>

      {settlementSupported && productionConfirmationVisible && (
        <div
          role="alert"
          className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300"
        >
          <p className="font-semibold">Confirm production settlement</p>
          <p className="mt-1">
            Creating this round will reserve {settlementAmount.toLocaleString()} {settlementAssetTag || "USDC"} on Canton now.
            The amount is transferred to the revealed winner later.
          </p>
          <label className="mt-2 flex items-start gap-2">
            <input
              type="checkbox"
              checked={productionAcknowledged}
              onChange={(e) => setProductionAcknowledged(e.target.checked)}
              className="mt-0.5 accent-primary"
            />
            <span>I understand that this production action reserves real value.</span>
          </label>
        </div>
      )}

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={
            creating ||
            !agentId ||
            !description.trim() ||
            productionCapabilityBlocked ||
            (settlementSupported && productionConfirmationVisible && !productionAcknowledged)
          }
        >
          {creating ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Gavel className="h-4 w-4 mr-2" />
          )}
          {settlementSupported && productionConfirmationVisible
            ? "Create and reserve value"
            : "Create governed round"}
        </Button>
      </div>
    </motion.form>
  );
}
