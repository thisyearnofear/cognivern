"use client";

import { useCallback, useState } from "react";
import { mutate } from "swr";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";
import { useDemoStore } from "@/stores/demo-store";

export type WorkspaceMode = "sandbox" | "production";

/**
 * Sandbox ⇄ Production is three pieces of state that must move together:
 *
 *   - `workspace.tier` ("demo" | "live") — server-side, authoritative. The
 *     backend `demoInterceptor` force-sandboxes a demo-tier workspace no
 *     matter what the client asks for.
 *   - `useAuthStore.workspaceMode` — sent as the `X-Workspace-Mode` header.
 *   - `useDemoStore.demoMode` — local seed data plus the demo chrome.
 *
 * Before this module every entry point flipped a different subset, so users
 * hit dead ends: Settings → "Go Live" upgraded the tier but left
 * `workspaceMode: "sandbox"`, so every request still asked for sandbox data
 * and the UI kept showing the amber demo chip. "View sandbox demo" did the
 * mirror image — flipped the header while the tier stayed live. Anything that
 * changes mode must go through `applyWorkspaceMode` / `useWorkspaceMode`.
 */
export async function applyWorkspaceMode(
  next: WorkspaceMode,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = useAuthStore.getState();
  const demo = useDemoStore.getState();

  try {
    if (next === "production") {
      // `upgradeWorkspace` (PATCH /auth/workspace/upgrade) is the
      // owner-gated, idempotent path and returns a fresh JWT reflecting the
      // new tier. Plain PUT /workspace also flips the tier but skips the
      // owner check and the token refresh.
      const res = await apiClient.upgradeWorkspace();
      if (!res.success || !res.data) {
        return { ok: false, error: res.error || "Workspace upgrade failed" };
      }
      if (res.data.token) {
        useAuthStore.setState({ token: res.data.token });
      }
      if (res.data.workspace) {
        auth.setWorkspace(res.data.workspace);
      }
      demo.exitDemoMode();
    } else {
      const res = await apiClient.updateWorkspace({ tier: "demo" });
      if (!res.success || !res.data) {
        return { ok: false, error: res.error || "Could not enter sandbox" };
      }
      auth.setWorkspace(res.data);
      demo.enableDemoMode();
    }

    // Set the header mode before revalidating so every refetch below already
    // carries the new X-Workspace-Mode.
    auth.setWorkspaceMode(next);
    auth.setHasExitedSandbox(true);
    await mutate(() => true, undefined, { revalidate: true });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "Could not switch workspace mode",
    };
  }
}

export function useWorkspaceMode() {
  const isConnected = useAuthStore((s) => s.isConnected);
  const requestedMode = useAuthStore((s) => s.workspaceMode);
  const tier = useAuthStore((s) => s.workspace?.tier);
  const [switching, setSwitching] = useState<WorkspaceMode | null>(null);

  // Mirror the backend's resolution (`demoInterceptor`): a demo-tier
  // workspace is served sandbox data regardless of the header. Displaying
  // `requestedMode` instead is how the UI used to claim "Production" while
  // every response was still seed data.
  const mode: WorkspaceMode = tier === "demo" ? "sandbox" : requestedMode;

  const switchMode = useCallback(
    async (next: WorkspaceMode): Promise<boolean> => {
      if (switching) return false;
      const alreadyThere =
        next === requestedMode &&
        (next === "production" ? tier === "live" : tier === "demo");
      if (alreadyThere) return true;

      setSwitching(next);
      const result = await applyWorkspaceMode(next);
      setSwitching(null);

      if (!result.ok) {
        toast.error(
          next === "production"
            ? "Couldn't switch to Production"
            : "Couldn't switch to Sandbox",
          { description: result.error },
        );
        return false;
      }

      if (next === "production") {
        toast.success("Production mode", {
          description:
            "Showing your real workspace. It stays empty until you create an agent and a policy.",
          action: {
            label: "Create an API identity",
            onClick: () => {
              if (typeof window !== "undefined") {
                window.location.href = "/agents/workshop";
              }
            },
          },
        });
      } else {
        toast.success("Sandbox mode", {
          description: "Sample data only — nothing persists, no funds move.",
        });
      }
      return true;
    },
    [switching, requestedMode, tier],
  );

  return {
    /** Effective mode, resolved the same way the backend resolves it. */
    mode,
    isProduction: mode === "production",
    isSandbox: mode === "sandbox",
    tier,
    isConnected,
    /** The mode currently being switched to, or null when idle. */
    switching,
    switchMode,
  };
}
