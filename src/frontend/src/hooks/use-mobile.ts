import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

function subscribe(callback: () => void) {
  const mql = window.matchMedia(MOBILE_QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getSnapshot() {
  return window.matchMedia(MOBILE_QUERY).matches;
}

// SSR / first paint: assume desktop so server and client markup are consistent.
function getServerSnapshot() {
  return false;
}

/**
 * Reactive is-mobile check. Uses useSyncExternalStore against matchMedia so the
 * correct value is known on the first client render (no desktop-layout flash)
 * and stays in sync with resize/orientation without a manual effect.
 */
export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
