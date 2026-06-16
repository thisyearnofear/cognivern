"use client";

import { useEffect, useRef } from "react";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useAuth } from "@/hooks/use-auth";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Single global owner of the `signInRequestId` listener. Toasts
 * (AuthWatcher, NotificationsProvider) and any other UI ask for a
 * sign-in by bumping `signInRequestId` in the store; this one mounted
 * component runs the actual SIWE flow.
 *
 * The listener lives here (not in useAuth) so it fires exactly once.
 * useAuth() is also consumed by AppSidebar and the onboarding wizard;
 * if each of those subscribed to the counter we'd get duplicate nonce
 * fetches and double signature prompts on sidebar routes.
 */
export function AuthBridge() {
  const { signIn } = useAuth();
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const signInRequestId = useAuthStore((s) => s.signInRequestId);
  const lastHandledRef = useRef(signInRequestId);

  useEffect(() => {
    if (signInRequestId === lastHandledRef.current) return;
    // Advance the ref only once we've committed to handling this request,
    // and handle it synchronously here. The previous implementation
    // advanced the ref then deferred the work to setTimeout(0); a re-render
    // in that window cancelled the timer via cleanup and the guard then
    // swallowed the request, so the toast button silently did nothing.
    lastHandledRef.current = signInRequestId;
    if (!isConnected) {
      openConnectModal?.();
      return;
    }
    void signIn();
  }, [signInRequestId, isConnected, openConnectModal, signIn]);

  return null;
}
