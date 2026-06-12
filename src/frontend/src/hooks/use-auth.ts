"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount, useSignMessage, useDisconnect } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
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
      throw err;
    } finally {
      setLoading(false);
    }
  }, [address, signMessageAsync, openConnectModal, login, buildSiweMessage]);

  // React to sign-in requests fired from the AuthWatcher toast. The watcher
  // intentionally doesn't call signIn() itself (HashPack reports
  // isConnected:true with eth_accounts:[]), so it bumps a counter in the
  // store; we run the actual SIWE flow here where wagmi/RainbowKit are
  // already in scope.
  const signInRequestId = useAuthStore((s) => s.signInRequestId);
  const lastHandledRequestIdRef = useRef(signInRequestId);
  useEffect(() => {
    if (signInRequestId === lastHandledRequestIdRef.current) return;
    lastHandledRequestIdRef.current = signInRequestId;
    // Defer to the next tick so the effect body doesn't kick off the
    // SIWE flow + setState(true) synchronously (react-hooks/set-state-in-effect).
    const id = window.setTimeout(() => {
      if (!isConnected) {
        openConnectModal?.();
        return;
      }
      void signIn();
    }, 0);
    return () => window.clearTimeout(id);
  }, [signInRequestId, isConnected, openConnectModal, signIn]);

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
