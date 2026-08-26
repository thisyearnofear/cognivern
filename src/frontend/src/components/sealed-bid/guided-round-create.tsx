"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Gavel,
  Loader2,
  LockKeyhole,
  Shield,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api-client";
import { useWorkspaceMode } from "@/hooks/use-workspace-mode";
import { mutate } from "swr";

function deadlineFromHours(hours: number): string {
  const deadline = new Date();
  deadline.setUTCHours(deadline.getUTCHours() + hours);
  return deadline.toISOString();
}

const STEPS = ["Define selection", "Set guardrails", "Review and create"];

export function GuidedRoundCreate({
  onCreated,
  onCancel,
}: {
  onCreated: (roundId: string) => void;
  onCancel: () => void;
}) {
  const { mode, isConnected } = useWorkspaceMode();
  const [step, setStep] = useState(1);
  const [description, setDescription] = useState("");
  const [serviceCategory, setServiceCategory] = useState("consulting");
  const [maxBids, setMaxBids] = useState(5);
  const [deadlineHours, setDeadlineHours] = useState(24);
  const [creating, setCreating] = useState(false);

  const environment = !isConnected ? "Demo" : mode === "production" ? "Production" : "Sandbox";
  const isProduction = environment === "Production";
  const canContinue = step === 1 ? description.trim().length > 0 : true;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    // Only the final review step may create a round. This also blocks the
    // browser's implicit Enter-to-submit behavior in earlier steps.
    if (step !== 3) return;
    if (!description.trim()) {
      setStep(1);
      return;
    }

    setCreating(true);
    try {
      const res = await apiClient.createSealedBidRound({
        description: description.trim(),
        serviceCategory: serviceCategory.trim() || "consulting",
        deadline: deadlineFromHours(deadlineHours),
        maxBids,
        backend: "canton",
        manager: "Auctioneer",
      });
      if (!res.success) throw new Error(res.error || "Failed to create round");

      toast.success(
        isProduction
          ? "Vendor selection created in Production"
          : "Vendor selection created safely",
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
      aria-label="Guided round creation"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-xl border border-primary/25 bg-card shadow-sm"
    >
      <div className="border-b border-border/70 bg-primary/[.035] px-4 py-4 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
              <Gavel className="h-4 w-4 text-primary" />
              Create a private vendor selection
            </div>
            <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
              Set up the request first, then review what is private and whether
              this flow reserves funds before anything is created.
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onCancel} aria-label="Cancel round creation">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ol aria-label="Round creation steps" className="mt-5 grid grid-cols-3 gap-2">
          {STEPS.map((label, index) => {
            const number = index + 1;
            const complete = number < step;
            const current = number === step;
            return (
              <li key={label} className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    aria-current={current ? "step" : undefined}
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${
                      complete
                        ? "border-primary bg-primary text-primary-foreground"
                        : current
                          ? "border-primary bg-background text-primary"
                          : "border-border bg-background text-muted-foreground"
                    }`}
                  >
                    {complete ? <Check className="h-3.5 w-3.5" /> : number}
                  </span>
                  <span className={`truncate text-[11px] ${current ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                    {label}
                  </span>
                </div>
                {index < STEPS.length - 1 && <div className="ml-3 mt-2 h-px bg-border/70" aria-hidden="true" />}
              </li>
            );
          })}
        </ol>
      </div>

      <div className="space-y-5 px-4 py-5 sm:px-5">
        {step === 1 && (
          <section aria-labelledby="define-selection-heading" className="space-y-4">
            <div>
              <h3 id="define-selection-heading" className="text-sm font-semibold">What are you selecting?</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Describe the outcome vendors are competing to provide. This is
                visible to eligible participants; bid amounts remain protected.
              </p>
            </div>
            <div className="space-y-2">
              <label htmlFor="round-description" className="text-xs font-medium">Selection description</label>
              <Input
                id="round-description"
                placeholder="Q3 security audit RFP"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="round-category" className="text-xs font-medium">Service category</label>
              <Input
                id="round-category"
                placeholder="consulting"
                value={serviceCategory}
                onChange={(e) => setServiceCategory(e.target.value)}
              />
            </div>
          </section>
        )}

        {step === 2 && (
          <section aria-labelledby="set-guardrails-heading" className="space-y-4">
            <div>
              <h3 id="set-guardrails-heading" className="text-sm font-semibold">Set the round guardrails</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                These boundaries determine when the selection can move from
                open bidding to close and reveal.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="round-max-bids" className="text-xs font-medium">Maximum bids</label>
                <Input
                  id="round-max-bids"
                  type="number"
                  min={1}
                  max={50}
                  value={maxBids}
                  onChange={(e) => setMaxBids(Math.min(50, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                />
                <p className="text-[11px] text-muted-foreground">The round stops accepting bids at this count.</p>
              </div>
              <div className="space-y-2">
                <label htmlFor="round-deadline" className="text-xs font-medium">Bidding window</label>
                <select
                  id="round-deadline"
                  value={deadlineHours}
                  onChange={(e) => setDeadlineHours(Number(e.target.value))}
                  className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value={2}>2 hours</option>
                  <option value={24}>24 hours</option>
                  <option value={72}>3 days</option>
                  <option value={168}>7 days</option>
                </select>
                <p className="text-[11px] text-muted-foreground">Bids cannot be submitted after the deadline.</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/[.045] p-3">
                <div className="flex items-start gap-2">
                  <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <div>
                    <p className="text-xs font-semibold">Competitor privacy</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                      Vendors cannot see one another&apos;s bid amounts. The
                      auctioneer can administer the round, and Party View later
                      shows the ledger-backed disclosure rules.
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-amber-500/25 bg-amber-500/[.045] p-3">
                <div className="flex items-start gap-2">
                  <Shield className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div>
                    <p className="text-xs font-semibold">No funds reserved</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                      This manual round does not escrow funds. Creating the
                      round and closing bids cannot move money.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {step === 3 && (
          <section aria-labelledby="review-round-heading" className="space-y-4">
            <div>
              <h3 id="review-round-heading" className="text-sm font-semibold">Review before creating</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Confirm the request and the boundary between selection and settlement.
              </p>
            </div>
            <div className="rounded-lg border bg-muted/[.18] p-3">
              <dl className="grid gap-3 text-xs sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Selection</dt>
                  <dd className="mt-0.5 font-medium">{description}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Category</dt>
                  <dd className="mt-0.5 font-medium">{serviceCategory || "consulting"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Bidding window</dt>
                  <dd className="mt-0.5 flex items-center gap-1 font-medium"><Clock3 className="h-3 w-3 text-muted-foreground" /> {deadlineHours === 2 ? "2 hours" : deadlineHours === 24 ? "24 hours" : deadlineHours === 72 ? "3 days" : "7 days"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Maximum bids</dt>
                  <dd className="mt-0.5 font-medium">{maxBids}</dd>
                </div>
              </dl>
            </div>
            <div className={`flex items-start gap-3 rounded-lg border p-3 ${isProduction ? "border-amber-500/35 bg-amber-500/[.06]" : "border-emerald-500/25 bg-emerald-500/[.045]"}`}>
              {isProduction ? <Zap className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /> : <Shield className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />}
              <div>
                <p className="text-xs font-semibold">{environment} workspace</p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  {isProduction
                    ? "This creates a real Canton round. No settlement funds are attached in this manual flow, but the round and its bids are live workspace data."
                    : `${environment} data is safe to explore. No real funds can move in this manual flow.`}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/[.035] p-3 text-[11px] leading-relaxed text-muted-foreground">
              <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <span>
                Vendors see the selection brief, not competing bid amounts.
                Creating this round records the request; it does not reveal a
                winner or move settlement value.
              </span>
            </div>
          </section>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-4">
          <Button type="button" variant="ghost" onClick={step === 1 ? onCancel : () => setStep((current) => current - 1)}>
            <ChevronLeft className="h-4 w-4" />
            {step === 1 ? "Cancel" : "Back"}
          </Button>
          {step < 3 ? (
            <Button type="button" onClick={() => setStep((current) => current + 1)} disabled={!canContinue}>
              Continue
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="submit" disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gavel className="h-4 w-4" />}
              {creating ? "Creating…" : "Create round"}
            </Button>
          )}
        </div>
      </div>
    </motion.form>
  );
}
