"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import {
  Gavel,
  PlusCircle,
  X,
  ChevronRight,
  Loader2,
  Shield,
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
import { Skeleton } from "@/components/ui/skeleton";
import { useSealedBidRounds } from "@/hooks/use-api";
import { apiClient } from "@/lib/api-client";
import { mutate } from "swr";
import { BackendBadge } from "./backend-badge";
import { RoundDetail } from "./round-detail";

function defaultDeadline(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}

export function SealedBidPage() {
  const { data: rounds, isLoading, error } = useSealedBidRounds();
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);

  const [description, setDescription] = useState("");
  const [serviceCategory, setServiceCategory] = useState("consulting");
  const [maxBids, setMaxBids] = useState(5);
  const [backend, setBackend] = useState<"canton" | "fhe">("canton");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;
    setCreating(true);
    try {
      const res = await apiClient.createSealedBidRound({
        description: description.trim(),
        serviceCategory,
        deadline: defaultDeadline(),
        maxBids,
        backend,
        manager: "Auctioneer",
      });
      if (!res.success) throw new Error(res.error || "Failed to create round");
      toast.success(
        `Round created on ${backend === "canton" ? "Canton" : "FHE"} backend`,
      );
      await mutate("/api/vendor/sealed-bid/rounds");
      setDescription("");
      setShowCreate(false);
      if (res.data?.roundId) setSelectedRoundId(res.data.roundId);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create round");
    } finally {
      setCreating(false);
    }
  }

  if (selectedRoundId) {
    return (
      <RoundDetail
        roundId={selectedRoundId}
        onBack={() => setSelectedRoundId(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Gavel className="h-6 w-6" /> Sealed-bid vendor selection
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Confidential vendor RFPs. Bids stay sealed from competitors — on
            the Canton backend, sub-transaction privacy is enforced by the
            ledger; on the FHE backend, amounts are held as ciphertext handles.
          </p>
        </div>
        <Button
          onClick={() => setShowCreate((v) => !v)}
          variant={showCreate ? "outline" : "default"}
        >
          {showCreate ? (
            <>
              <X className="h-4 w-4 mr-2" /> Cancel
            </>
          ) : (
            <>
              <PlusCircle className="h-4 w-4 mr-2" /> New round
            </>
          )}
        </Button>
      </div>

      {showCreate && (
        <motion.form
          onSubmit={handleCreate}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border bg-card p-4 space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-medium">Description</label>
              <Input
                placeholder="Q3 security audit RFP"
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
                min={1}
                max={50}
                value={maxBids}
                onChange={(e) => setMaxBids(parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-medium">Privacy backend</label>
              <Select
                value={backend}
                onValueChange={(v) => setBackend(v as "canton" | "fhe")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="canton">
                    Canton — full privacy reveal, losers never decrypted
                  </SelectItem>
                  <SelectItem value="fhe">
                    FHE (Fhenix) — sealed bids, manager-publish reveal
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground">Canton (recommended):</strong>{" "}
                structural sub-transaction privacy — the winner is revealed in one
                atomic transaction without decrypting losing bids.{" "}
                <strong className="text-foreground">FHE:</strong> amounts stay as
                ciphertext; the round manager publishes the winner after
                decrypt-and-publish (losing plaintexts are visible to the manager).
                Canton is the recommended default.
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={creating || !description.trim()}>
              {creating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Shield className="h-4 w-4 mr-2" />
              )}
              Create round
            </Button>
          </div>
        </motion.form>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-destructive bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load rounds. Check that the backend is reachable and try
          again.
        </div>
      )}

      {!isLoading && !error && rounds && rounds.length === 0 && (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          No rounds yet. Create one to kick off a confidential vendor selection.
        </div>
      )}

      {rounds && rounds.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {rounds.map((r) => (
            <button
              key={r.roundId}
              type="button"
              onClick={() => setSelectedRoundId(r.roundId)}
              className="text-left rounded-xl border bg-card p-4 hover:border-primary transition-colors group"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <h3 className="font-semibold truncate">{r.description}</h3>
                  <p className="text-xs text-muted-foreground">
                    {r.serviceCategory}
                    {r.status === "revealed"
                      ? " · bids sealed & archived"
                      : ` · ${r.bidCount}/${r.maxBids} bids`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <BackendBadge backend={r.backend} />
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="capitalize">{r.status}</span>
                {r.winner && (
                  <span className="text-emerald-600 font-medium">
                    winner: {r.winner.split("::")[0]}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
