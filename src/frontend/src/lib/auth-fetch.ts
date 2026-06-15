import { useAuthStore } from "@/stores/auth-store";

/**
 * Thin wrapper around window.fetch that adds auth headers from the
 * Zustand store and handles 401 responses by clearing auth state.
 * Use this for direct fetch() calls that can't go through the ApiClient
 * (e.g. OS terminal commands, fire-and-forget posts).
 */
export async function authFetch(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const { token, workspaceMode } = useAuthStore.getState();

  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  headers.set("X-Workspace-Mode", workspaceMode);
  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, { ...init, headers });

  if (res.status === 401) {
    useAuthStore.getState().logout();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("auth:expired"));
    }
  }

  return res;
}
