import { refreshToken } from "@/lib/auth";
import { useAuthStore } from "@/stores/auth-store";

let refreshInFlight: Promise<boolean> | null = null;
let expiryEventSent = false;

/** Refresh once for all concurrent requests that observe the same 401. */
export function refreshSession(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  const token = useAuthStore.getState().token;
  if (!token) return Promise.resolve(false);

  refreshInFlight = refreshToken(token)
    .then((result) => {
      useAuthStore.getState().login(result.token, result.user, result.workspace);
      expiryEventSent = false;
      return true;
    })
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

/** Clear the session and emit one consistent expiry event for the shell. */
export function expireSession() {
  const state = useAuthStore.getState();
  if (!state.token && !state.isConnected) return;
  state.logout();
  if (expiryEventSent) return;
  expiryEventSent = true;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("auth:expired"));
  }
}
