"use client";

import { useCallback, useState } from "react";
import { useAccount, useSignMessage, useDisconnect } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth-store";
import {
  fetchNonce,
  verifySignature,
  useSiweMessageFactory,
} from "@/lib/auth";

export function useAuth() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { disconnect } = useDisconnect();
  const { openConnectModal } = useConnectModal();
  const { login, logout: storeLogout } = useAuthStore();
  const buildSiweMessage = useSiweMessageFactory();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = useCallback(async () => {
    if (!address) {
      openConnectModal?.();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const nonce = await fetchNonce();
      const message = buildSiweMessage(address, nonce);
      const signature = await signMessageAsync({ message });
      const { token, user, workspace } = await verifySignature(
        message,
        signature,
        address
      );
      login(token, user, workspace);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign in failed";
      setError(msg);
      // Surface the failure to the user. Previously the only caller that
      // ran signIn() from a toast did so via `void signIn()`, swallowing
      // this rejection — so a declined/failed signature gave no feedback.
      toast.error("Sign in failed", { description: msg });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [address, signMessageAsync, openConnectModal, login, buildSiweMessage]);

  const handleLogout = useCallback(() => {
    storeLogout();
    disconnect();
    // Clear any persisted wallet-connect / wagmi storage so a reload
    // doesn't immediately rehydrate a stale "connected" state.
    if (typeof window !== "undefined") {
      try {
        const wcKeys = Object.keys(localStorage).filter(
          (k) =>
            k.startsWith("wc@2:") ||
            k.startsWith("wagmi") ||
            k.startsWith("rk-")
        );
        wcKeys.forEach((k) => localStorage.removeItem(k));
      } catch {
        // localStorage may not be available; ignore.
      }
    }
  }, [storeLogout, disconnect]);

  return {
    signIn,
    logout: handleLogout,
    loading,
    error,
    isConnected,
    address,
  };
}
