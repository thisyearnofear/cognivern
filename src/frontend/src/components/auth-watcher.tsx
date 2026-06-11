"use client";

import { useEffect, useRef } from "react";
import { useAccount } from "wagmi";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { useAuthStore, useAuthHydrated } from "@/stores/auth-store";
import { useDemoStore } from "@/stores/demo-store";

/**
 * Bridge between "wallet connected" and "app session exists".
 *
 * Previous behaviour auto-triggered a SIWE signature as soon as a wallet
 * was connected. That was problematic: connectors like HashPack report
 * `isConnected: true` with a stale address even after `eth_accounts`
 * returns `[]`, so a user would get a phantom sign-in modal on every
 * page load. The sidebar already shows a clear "Sign In to Cognivern"
 * button when the wallet is connected but no app session exists, so
 * the watcher is reduced to surfacing a one-time, dismissible toast.
 */
export function AuthWatcher() {
  const { isConnected, address } = useAccount();
  const isAppConnected = useAuthStore((s) => s.isConnected);
  const demoMode = useDemoStore((s) => s.demoMode);
  const hasHydrated = useAuthHydrated();
  const lastAddressRef = useRef<string | null>(null);
  const toastIdRef = useRef<string | number | null>(null);

  useEffect(() => {
    // Never nag in demo mode.
    if (demoMode) return;
    // Don't surface anything until persisted state is rehydrated,
    // otherwise returning users will see a stale "sign in" toast.
    if (!hasHydrated) return;

    // Disconnect or new wallet: clear any pending toast.
    if (!isConnected || !address) {
      lastAddressRef.current = null;
      if (toastIdRef.current != null) {
        toast.dismiss(toastIdRef.current);
        toastIdRef.current = null;
      }
      return;
    }

    // App session already exists: nothing to do.
    if (isAppConnected) {
      lastAddressRef.current = address;
      if (toastIdRef.current != null) {
        toast.dismiss(toastIdRef.current);
        toastIdRef.current = null;
      }
      return;
    }

    // Don't re-toast for the same address while the prior toast is
    // still on screen.
    if (lastAddressRef.current === address && toastIdRef.current != null) {
      return;
    }
    lastAddressRef.current = address;

    // Show a dismissible prompt. Clicking takes the user to the
    // dashboard where the sidebar sign-in button lives.
    if (toastIdRef.current != null) {
      toast.dismiss(toastIdRef.current);
    }
    toastIdRef.current = toast(
      <span className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-emerald-500" />
        <span>
          Wallet <span className="font-mono">{address.slice(0, 6)}…{address.slice(-4)}</span> connected.
          Sign in to access your dashboard.
        </span>
      </span>,
      {
        duration: 6000,
        action: {
          label: "Sign In",
          onClick: () => {
            // The sidebar will pick this up via wagmi; the watcher
            // intentionally does not call signIn() automatically.
            window.location.href = "/dashboard";
          },
        },
      }
    );

    return () => {
      if (toastIdRef.current != null) {
        toast.dismiss(toastIdRef.current);
        toastIdRef.current = null;
      }
    };
  }, [isConnected, address, isAppConnected, hasHydrated, demoMode]);

  return null;
}
