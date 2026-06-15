"use client";

import { useAuth } from "@/hooks/use-auth";

/**
 * Mounts the useAuth() effect globally so the `signInRequestId` listener
 * exists on every route. Without this, toasts that call requestSignIn()
 * (AuthWatcher, NotificationsProvider) do nothing on routes that don't
 * already render AppSidebar — notably the landing page.
 */
export function AuthBridge() {
  useAuth();
  return null;
}
