"use client";

import { useCallback, useState } from "react";
import { useAccount, useSignMessage, useDisconnect } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useAppStore } from "@/stores/app-store";
import { generateSiweMessage, fetchNonce, verifySignature } from "@/lib/auth";

export function useAuth() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { disconnect } = useDisconnect();
  const { openConnectModal } = useConnectModal();
  const { login, logout: storeLogout } = useAppStore();
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
      const message = generateSiweMessage(address, nonce);
      const signature = await signMessageAsync({ message });
      const { token, user, workspace } = await verifySignature(message, signature, address);
      login(token, user, workspace);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign in failed";
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [address, signMessageAsync, openConnectModal, login]);

  const handleLogout = useCallback(() => {
    storeLogout();
    disconnect();
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
