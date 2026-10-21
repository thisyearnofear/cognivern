"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Gavel, RotateCcw, AlertTriangle, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCantonIdentity } from "@/hooks/use-api";
import { useAuthStore } from "@/stores/auth-store";
import { BackendBadge } from "./backend-badge";
import { displayPartyName, shortAddress } from "@/lib/workspace-label";

/**
 * Shows which Canton party the signed-in wallet acts as. Used in the sign-in
 * modal (Canton tab) and at the top of the sealed-bid page, so both routes
 * land on the same identity and the same next step.
 */
export function CantonIdentityCard({
  compact = false,
  onOpen,
}: {
  compact?: boolean;
  onOpen?: () => void;
}) {
  const router = useRouter();
  const isAppAuthenticated = useAuthStore((s) => s.isConnected);
  // Don't fire the 401-returning fetch until SIWE has completed — otherwise
  // signed-out visitors see an error flash before the sign-in prompt.
  const { data, error, isLoading, mutate } = useCantonIdentity(isAppAuthenticated);
  const [copied, setCopied] = useState(false);

  const openSealedBid = () => {
    onOpen?.();
    router.push("/sealed-bid");
  };

  const copyParty = async (party: string) => {
    try {
      await navigator.clipboard.writeText(party);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable — the full id stays visible via title tooltip.
    }
  };

  if (!isAppAuthenticated) return null;

  if (isLoading) {
    return (
      <div className="rounded-xl border bg-card p-4 space-y-2" aria-busy="true">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-full" />
      </div>
    );
  }

  if (error) {
    const status = (error as { status?: number }).status;
    const notSignedIn = status === 401;
    const notConfigured = status === 503;
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
        <div className="flex items-start gap-2 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
          <div>
            <p className="font-medium">
              {notSignedIn
                ? "Link a wallet to bid"
                : "Could not load your Canton bidding identity"}
            </p>
            <p className="text-xs text-muted-foreground">
              {notSignedIn
                ? "Your Canton bidding identity comes from a wallet. Link one in Settings → Identities."
                : notConfigured
                  ? "Canton bidding identities aren't set up on this server yet. Rounds stay in demo mode until they are."
                  : "Try again in a moment."}
            </p>
          </div>
        </div>
        {notSignedIn ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              onOpen?.();
              router.push("/settings#identities");
            }}
          >
            Link a wallet
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => void mutate()}>
            <RotateCcw className="h-3.5 w-3.5 mr-2" /> Retry
          </Button>
        )}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-emerald-600" />
        <p className="text-sm font-medium">
          Bidding as <span className="font-semibold">{displayPartyName(data.party)}</span>
        </p>
        {data.backendConfigured && (
          <span className="ml-auto">
            <BackendBadge backend="canton" />
          </span>
        )}
      </div>
      <dl className="space-y-1.5 text-xs">
        <div className="flex items-center gap-2">
          <dt className="w-16 shrink-0 text-muted-foreground">Party</dt>
          <dd className="min-w-0 flex-1 truncate font-mono" title={data.party}>
            {data.party}
          </dd>
          <button
            type="button"
            onClick={() => void copyParty(data.party)}
            aria-label="Copy full party id"
            title="Copy full party id"
            className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
        <div className="flex gap-2">
          <dt className="w-16 shrink-0 text-muted-foreground">Wallet</dt>
          <dd className="truncate font-mono text-muted-foreground" title={data.walletAddress}>
            {shortAddress(data.walletAddress)}
          </dd>
        </div>
      </dl>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Your bids are submitted as this identity — competitors never see your wallet address.{" Hosted by Cognivern — we submit your bids on Canton for you."}
        {data.backendConfigured
          ? ""
          : " The ledger isn't connected here, so rounds run in demo mode."}
      </p>
      {!compact && (
        <Button size="sm" onClick={openSealedBid} className="gap-2">
          <Gavel className="h-3.5 w-3.5" /> Open sealed-bid rounds
        </Button>
      )}
    </div>
  );
}
