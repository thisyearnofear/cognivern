import { useEffect, useRef, useState, useCallback } from "react";
import { useAuthStore, useAuthHydrated } from "@/stores/auth-store";

type EventCallback = (data: Record<string, unknown>) => void;
const listeners = new Map<string, Set<EventCallback>>();

let source: EventSource | null = null;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let retryCount = 0;

function connect(token: string) {
  if (source) source.close();

  const backendUrl =
    process.env.NEXT_PUBLIC_API_URL ||
    "https://cognivern.thisyearnofear.com";

  const url = `${backendUrl}/api/events/stream?token=${encodeURIComponent(token)}`;
  source = new EventSource(url);

  const dispatch = (eventName: string) => (e: MessageEvent) => {
    try {
      const data = JSON.parse(e.data);
      const cbs = listeners.get(eventName);
      if (cbs) for (const cb of cbs) cb(data);
    } catch {
      // Ignore malformed SSE data
    }
  };

  for (const evt of ["audit:log", "agent:status", "decision:notify"]) {
    source.addEventListener(evt, dispatch(evt));
  }

  source.onopen = () => {
    retryCount = 0;
  };

  source.onerror = () => {
    source?.close();
    source = null;

    retryCount++;
    if (retryCount > 10) return;

    const delay = Math.min(2000 * Math.pow(2, retryCount - 1), 15_000);
    retryTimer = setTimeout(() => {
      if (token) connect(token);
    }, delay);
  };
}

function disconnect() {
  source?.close();
  source = null;
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = undefined;
  }
  retryCount = 0;
}

/**
 * Module-level SSE singleton. Connects when authenticated, disconnects
 * on logout. All components share the same connection.
 */
export function useEventStream() {
  const isConnected = useAuthStore((s) => s.isConnected);
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthHydrated();

  useEffect(() => {
    if (!hasHydrated) return;

    if (!isConnected || !token) {
      disconnect();
      return;
    }

    if (!source) connect(token);
  }, [hasHydrated, isConnected, token]);
}

/**
 * Subscribe to a specific SSE event type.
 */
export function useSseEvent<T>(event: string, callback: (data: T) => void) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    let set = listeners.get(event);
    if (!set) {
      set = new Set();
      listeners.set(event, set);
    }
    const cb: EventCallback = (data) => callbackRef.current(data as T);
    set.add(cb);

    return () => {
      set!.delete(cb);
      if (set!.size === 0) listeners.delete(event);
    };
  }, [event]);
}
