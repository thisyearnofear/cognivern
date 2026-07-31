export type UxEventName =
  | "primary_action_clicked"
  | "primary_action_completed"
  | "disclosure_opened"
  | "filter_applied"
  | "search_used"
  | "empty_state_action_clicked"
  | "error_retry_clicked"
  | "route_backtracked";

/**
 * Privacy-safe UX instrumentation. Production transport is opt-in through
 * NEXT_PUBLIC_UX_EVENTS_URL; without it, events are only visible in local
 * development so analytics never becomes a hard dependency for the UI.
 */
export function trackUxEvent(
  event: UxEventName,
  component: string,
  variant?: string,
) {
  if (typeof window === "undefined") return;
  const payload = {
    event,
    route: window.location.pathname,
    component,
    ...(variant ? { variant } : {}),
  };
  const endpoint = process.env.NEXT_PUBLIC_UX_EVENTS_URL;
  if (endpoint && navigator.sendBeacon) {
    navigator.sendBeacon(
      endpoint,
      new Blob([JSON.stringify(payload)], { type: "application/json" }),
    );
  } else if (process.env.NODE_ENV !== "production") {
    console.debug("[ux]", payload);
  }
}
