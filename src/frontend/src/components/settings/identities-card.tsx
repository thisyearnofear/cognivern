"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Check, Fingerprint, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useCantonIdentity } from "@/hooks/use-api";
import { useAuth } from "@/hooks/use-auth";
import { useAuthStore } from "@/stores/auth-store";
import { displayPartyName, shortAddress } from "@/lib/workspace-label";
import type { AuthUser } from "@cognivern/shared";

/**
 * One identity story: how the user signs in (email and/or wallet) and which
 * Canton bidding identity the wallet maps to. Linking a wallet is a SIWE
 * proof against the signed-in session — afterwards both logins land on the
 * same account.
 */
export function IdentitiesCard() {
  const isConnected = useAuthStore((s) => s.isConnected);
  const [me, setMe] = useState<AuthUser | null>(null);
  const { linkWallet, unlinkWallet, linkLoading, unlinkLoading } = useAuth();
  const { data: cantonIdentity, error: cantonError } =
    useCantonIdentity(isConnected);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isConnected) return;
    let active = true;
    apiClient
      .getMe()
      .then((res) => {
        if (active && res.success && res.data) setMe(res.data.user);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isConnected]);

  const isWalletNative = me?.authMethod === "wallet";
  const hasWallet = Boolean(me?.walletAddress);
  const cantonStatus = (cantonError as { status?: number } | undefined)?.status;

  const copyParty = async (party: string) => {
    try {
      await navigator.clipboard.writeText(party);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div>
        <h2
          className="font-semibold flex items-center gap-2"
          style={{ fontFamily: "var(--font-space-grotesk)" }}
        >
          <Fingerprint className="h-4 w-4 text-primary" />
          Identities
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          How you sign in, and who you are on the Canton ledger.
        </p>
      </div>

      <div className="divide-y divide-border/60">
        {/* ── Email ── */}
        <div className="flex items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">Email</p>
            {me?.email ? (
              <p className="truncate text-xs text-muted-foreground">{me.email}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Not added — adding email to a wallet account isn&apos;t supported yet.
              </p>
            )}
          </div>
          {me?.email && (
            <Badge variant={me.emailVerified ? "default" : "secondary"}>
              {me.emailVerified ? "Verified" : "Unverified"}
            </Badge>
          )}
        </div>

        {/* ── Wallet ── */}
        <div className="flex items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">Wallet</p>
            {hasWallet ? (
              <p className="truncate font-mono text-xs text-muted-foreground">
                {shortAddress(me?.walletAddress)}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                No wallet linked.
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasWallet && (
              <Badge variant={isWalletNative ? "default" : "secondary"}>
                {isWalletNative ? "Sign-in method" : "Linked"}
              </Badge>
            )}
            {!isWalletNative && !hasWallet && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void linkWallet()}
                disabled={linkLoading}
              >
                {linkLoading && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                Link a wallet
              </Button>
            )}
            {!isWalletNative && hasWallet && (
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground"
                disabled={unlinkLoading}
                onClick={() => {
                  if (
                    window.confirm(
                      "Unlink this wallet? You'll lose production sealed-bid actions until you link one again. Your Canton bidding identity stays with the wallet.",
                    )
                  ) {
                    void unlinkWallet();
                  }
                }}
              >
                {unlinkLoading && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                Unlink
              </Button>
            )}
            {isWalletNative && (
              <span className="text-xs text-muted-foreground">
                Your wallet is how you sign in.
              </span>
            )}
          </div>
        </div>

        {/* ── Canton bidding identity ── */}
        <div className="py-3">
          <p className="text-sm font-medium">Canton bidding identity</p>
          {cantonIdentity?.party ? (
            <div className="mt-1 space-y-1.5">
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">
                  Bidding as{" "}
                  <span className="font-medium text-foreground">
                    {displayPartyName(cantonIdentity.party)}
                  </span>
                </p>
                <code
                  className="truncate font-mono text-[10px] text-muted-foreground"
                  title={cantonIdentity.party}
                >
                  {cantonIdentity.party}
                </code>
                <button
                  type="button"
                  onClick={() => void copyParty(cantonIdentity.party)}
                  aria-label="Copy full party id"
                  title="Copy full party id"
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Hosted by Cognivern: we hold this identity&apos;s keys on the
                Canton ledger and submit your bids for you. Competitors never
                see your wallet address.
              </p>
              <p className="text-[11px] text-muted-foreground">
                Bringing your own Canton identity is coming soon.
              </p>
            </div>
          ) : cantonStatus === 503 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Canton bidding identities aren&apos;t set up on this server yet.
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              Link a wallet to get a Canton bidding identity.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
