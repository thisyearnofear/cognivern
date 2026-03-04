import { getApiUrl } from "../utils/api";

const HEADERS = {
  "Content-Type": "application/json",
  "X-API-KEY": import.meta.env.VITE_API_KEY || "development-api-key",
};

export type UxEventType =
  | "run_console_view"
  | "run_cancel"
  | "run_retry"
  | "run_retry_from_step"
  | "run_plan_opened"
  | "run_plan_saved"
  | "run_approval_approve"
  | "run_approval_reject";

export const uxAnalytics = {
  track: async (
    eventType: UxEventType,
    payload: Record<string, unknown> = {}
  ): Promise<void> => {
    try {
      await fetch(getApiUrl("/api/metrics/ux-events"), {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify({
          eventType,
          payload,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch {
      // Non-blocking analytics.
    }
  },
};
