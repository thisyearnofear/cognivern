"use client";

import { ShieldCheck, Loader2 } from "lucide-react";
import { useAccount } from "wagmi";
import { useAuthStore } from "@/stores/auth-store";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

/**
 * Shown above the page content on mobile when the wallet is connected but
 * SIWE hasn't completed. On desktop the sidebar footer shows the same CTA,
 * but on mobile the sidebar is hidden behind the hamburger — so users think
 * they're signed in (they see their address in the wallet modal) while the
 * app still shows demo data. This bar makes the required next step obvious.
 */
export function SignInPrompt() {
  const { isConnected: walletConnected } = useAccount();
  const isAppAuthenticated = useAuthStore((s) => s.isConnected);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const { signIn, loading } = useAuth();

  // Only show when wallet is connected but the SIWE handshake hasn't finished.
  if (!hasHydrated || !walletConnected || isAppAuthenticated) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-sky-50 dark:bg-sky-950/30 border-b border-sky-200 dark:border-sky-900 md:hidden">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-sky-800 dark:text-sky-200">
          Wallet connected — one more step
        </p>
        <p className="text-[11px] text-sky-600/80 dark:text-sky-400/70 mt-0.5">
          Sign a message to prove ownership and access your workspace.
        </p>
      </div>
      <Button
        size="sm"
        onClick={() => signIn()}
        disabled={loading}
        className="shrink-0 h-8 gap-1.5 bg-sky-600 hover:bg-sky-700 text-white border-0"
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <ShieldCheck className="h-3.5 w-3.5" />
        )}
        {loading ? "Signing…" : "Sign in"}
      </Button>
    </div>
  );
}
