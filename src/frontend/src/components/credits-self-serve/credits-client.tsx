"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatUsd } from "@/lib/budget-format";

/**
 * Participant self-service, no dashboard account: paste the cvk_ key the
 * organiser handed you and see your balance, exactly what your sponsor can
 * see of your activity (side by side with what we hold), and the verifiable
 * receipt for the latest anchored snapshot.
 *
 * The key stays in page state — it is sent only as the Bearer credential to
 * /v1/*, never persisted, and this page sets no cookies or storage writes.
 */

interface CreditsBalance {
  allocatedUsd: number;
  consumedUsd: number;
  reservedUsd: number;
  availableUsd: number;
  requestCount: number;
}

interface CreditsResponse {
  participant: { handle: string; projectTag?: string | null; disclosureTier: string; status: string };
  program: {
    id: string;
    name: string;
    sponsor: string;
    status: string;
    startsAt: string | null;
    endsAt: string | null;
    allowedModels: string[];
  };
  balance: CreditsBalance;
  disclosureOptions: Array<{ tier: string; multiplier: number; allocationUsd: number; current: boolean }>;
}

interface ActivityCall {
  youSee: Record<string, unknown>;
  sponsorSees: Record<string, unknown> | null;
}

interface ActivityResponse {
  disclosureTier: string;
  withheldFromSponsor: number;
  calls: ActivityCall[];
  explanation: { storage: string; redaction: string; digests: string };
}

interface VerificationResponse {
  commitment?: { id: string; status: string; commitmentRoot: string; createdAt: string };
  proof?: { leaf: string; index: number; path: string[]; root?: string };
}

async function gatewayGet<T>(path: string, key: string): Promise<T> {
  const res = await fetch(path, { headers: { Authorization: `Bearer ${key}` } });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      (body && typeof body.error === "object" && body.error?.message) ||
      (typeof body?.error === "string" ? body.error : null) ||
      `Request failed (${res.status})`;
    throw new Error(message as string);
  }
  return body as T;
}

export function CreditsClient() {
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credits, setCredits] = useState<CreditsResponse | null>(null);
  const [activity, setActivity] = useState<ActivityResponse | null>(null);
  const [verification, setVerification] = useState<VerificationResponse | null>(null);
  const [noCommitment, setNoCommitment] = useState(false);
  const [copiedReceipt, setCopiedReceipt] = useState(false);

  const lookUp = useCallback(async () => {
    const trimmed = key.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    setCredits(null);
    setActivity(null);
    setVerification(null);
    setNoCommitment(false);
    try {
      const [creditsRes, activityRes] = await Promise.all([
        gatewayGet<CreditsResponse>("/v1/credits", trimmed),
        gatewayGet<ActivityResponse>("/v1/credits/activity?limit=10", trimmed),
      ]);
      setCredits(creditsRes);
      setActivity(activityRes);
      try {
        setVerification(await gatewayGet<VerificationResponse>("/v1/credits/verification", trimmed));
      } catch {
        setNoCommitment(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setBusy(false);
    }
  }, [key]);

  async function copyReceipt() {
    if (!verification?.proof || !verification.commitment) return;
    const receipt = {
      root: verification.commitment.commitmentRoot,
      leaf: verification.proof.leaf,
      index: verification.proof.index,
      path: verification.proof.path,
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(receipt, null, 2));
      setCopiedReceipt(true);
      setTimeout(() => setCopiedReceipt(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-6">
          <Link href="/" className="text-sm font-semibold text-foreground">
            Cognivern
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to site
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
          <KeyRound className="h-4 w-4" /> Participant self-service
        </div>
        <h1 className="mt-3 text-2xl font-bold text-foreground">Check your sponsored credits</h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          Paste the key your organiser gave you. You will see your balance, your disclosure tier,
          exactly what your sponsor can see of each call, and the receipt for the latest anchored
          snapshot. The key goes to the API and nowhere else — nothing is stored in this browser.
        </p>

        <form
          className="mt-8 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void lookUp();
          }}
        >
          <div className="relative flex-1">
            <Input
              type={showKey ? "text" : "password"}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="cvk_…"
              autoComplete="off"
              className="pr-10 font-mono text-xs"
            />
            <button
              type="button"
              aria-label={showKey ? "Hide key" : "Show key"}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setShowKey((v) => !v)}
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <Button type="submit" disabled={busy || !key.trim()}>
            {busy ? "Checking…" : "Check balance"}
          </Button>
        </form>

        {error && <p className="mt-6 text-sm text-destructive">{error}</p>}

        {credits && (
          <div className="mt-8 space-y-6">
            {/* Program + balance */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-semibold text-foreground">{credits.program.name}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    Sponsored by {credits.program.sponsor || "organiser"}
                    {credits.program.endsAt && (
                      <> · ends {new Date(credits.program.endsAt).toLocaleDateString()}</>
                    )}
                  </div>
                </div>
                <Badge variant="outline">{credits.participant.disclosureTier} tier</Badge>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <BalanceStat label="Available" value={credits.balance.availableUsd} emphasise />
                <BalanceStat label="Allocated" value={credits.balance.allocatedUsd} />
                <BalanceStat label="Consumed" value={credits.balance.consumedUsd} />
                <BalanceStat label="Reserved" value={credits.balance.reservedUsd} />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {credits.balance.requestCount} call(s) so far
                {credits.program.allowedModels.length > 0 && (
                  <> · models: {credits.program.allowedModels.join(", ")}</>
                )}
              </p>
            </div>

            {/* Draft options */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="font-semibold text-foreground">Your disclosure tier</div>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Openness raises your effective budget under this program&apos;s multipliers; privacy
                lowers it. The choice is yours — the sponsor never sets it. Switch tiers with{" "}
                <code className="font-mono">PATCH /v1/credits/disclosure</code>.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {credits.disclosureOptions.map((option) => (
                  <span
                    key={option.tier}
                    className={`rounded-lg border px-3 py-1.5 text-xs ${
                      option.current
                        ? "border-primary/40 bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {option.tier}
                    <span className="ml-1.5 tabular-nums">
                      ×{option.multiplier} → {formatUsd(option.allocationUsd)}
                    </span>
                  </span>
                ))}
              </div>
            </div>

            {/* What the sponsor sees */}
            {activity && (
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold text-foreground">What your sponsor sees</div>
                  <span className="text-xs text-muted-foreground">
                    {activity.withheldFromSponsor} of your last {activity.calls.length} call(s)
                    withheld at your tier
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  Fields your tier does not permit are never stored — not recorded and hidden later.
                  Redaction strips keys and secrets before anything is written.
                </p>
                {activity.calls.length > 0 && (
                  <div className="mt-3 overflow-hidden rounded-lg border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">When</TableHead>
                          <TableHead className="text-xs">Model</TableHead>
                          <TableHead className="text-xs text-right">Cost</TableHead>
                          <TableHead className="text-xs">Sponsor sees</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activity.calls.map((call, i) => (
                          <TableRow key={String(call.youSee.id ?? i)}>
                            <TableCell className="text-xs text-muted-foreground">
                              {call.youSee.createdAt
                                ? new Date(String(call.youSee.createdAt)).toLocaleString()
                                : "—"}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {String(call.youSee.model ?? "—")}
                            </TableCell>
                            <TableCell className="text-right text-xs tabular-nums">
                              {typeof call.youSee.costUsd === "number"
                                ? formatUsd(call.youSee.costUsd, 6)
                                : "—"}
                            </TableCell>
                            <TableCell className="text-xs">
                              {call.sponsorSees === null ? (
                                <span className="text-muted-foreground">withheld</span>
                              ) : (
                                <span className="text-foreground">
                                  digest{tierShowsExcerpt(credits.participant.disclosureTier) ? " + excerpt" : ""}
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {activity.calls.length === 0 && (
                  <p className="mt-3 text-xs text-muted-foreground">No calls recorded yet.</p>
                )}
              </div>
            )}

            {/* Verifiable receipt */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="font-semibold text-foreground">Proof the budget is metered honestly</div>
              {verification?.commitment ? (
                <>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    Your balance is a leaf in the anchored snapshot from{" "}
                    {new Date(verification.commitment.createdAt).toUTCString()}. Anyone can confirm
                    inclusion without an account.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Link
                      href={`/verify?id=${verification.commitment.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" /> Open public verification
                    </Link>
                    <Button variant="outline" size="sm" onClick={() => void copyReceipt()}>
                      {copiedReceipt ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      Copy receipt
                    </Button>
                  </div>
                </>
              ) : noCommitment ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  No anchored snapshot exists for this program yet — ask the organiser to anchor
                  one, and your balance becomes publicly provable.
                </p>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">Loading receipt…</p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function BalanceStat({
  label,
  value,
  emphasise,
}: {
  label: string;
  value: number;
  emphasise?: boolean;
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className={`mt-0.5 tabular-nums ${emphasise ? "text-2xl font-bold text-foreground" : "text-sm font-medium text-foreground"}`}
      >
        {formatUsd(value)}
      </div>
    </div>
  );
}

function tierShowsExcerpt(tier: string): boolean {
  return tier === "detailed" || tier === "open";
}
