"use client";

import { useEffect, useRef } from "react";
import { useAccount } from "wagmi";
import { useAppStore } from "@/stores/app-store";
import { useAuth } from "@/hooks/use-auth";

/**
 * Watcher component that auto-triggers the Sign-In flow
 * when a wallet is connected but no session exists in the app store.
 */
export function AuthWatcher() {
  const { isConnected, address } = useAccount();
  const { signIn, loading } = useAuth();
  const user = useAppStore((s) => s.user);
  const demoMode = useAppStore((s) => s.demoMode);
  const autoSignInAttempted = useRef(false);

  useEffect(() => {
    // Never nag for auth when user is exploring demo mode
    if (demoMode) {
      return;
    }

    // Reset attempt flag when address changes or disconnects
    if (!isConnected || !address) {
      autoSignInAttempted.current = false;
      return;
    }

    // Trigger auto sign-in if:
    // 1. Wallet is connected
    // 2. App is NOT authenticated
    // 3. We haven't attempted auto-signin for this session yet
    // 4. Not currently loading
    if (
      isConnected &&
      address &&
      !user.isConnected &&
      !autoSignInAttempted.current &&
      !loading
    ) {
      console.log("[AuthWatcher] Auto-triggering Sign In for", address);
      autoSignInAttempted.current = true;
      signIn().catch((err) => {
        console.error("[AuthWatcher] Auto Sign In failed:", err);
        // We don't reset the ref here to prevent infinite retry loops on failure
      });
    }
  }, [isConnected, address, user.isConnected, signIn, loading, demoMode]);

  return null;
}
