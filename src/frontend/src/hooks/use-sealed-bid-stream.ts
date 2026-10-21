import { useEffect, useRef } from "react";
import { useSWRConfig } from "swr";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Live sealed-bid round updates over SSE.
 *
 * The stream is public and carries only {roundId, change, status, at} — the
 * hook reacts by invalidating the SWR keys the sealed-bid views already use,
 * so connected clients see bids/close/reveal land without polling. Only
 * active while authenticated: when signed out the hooks serve static demo
 * data and there is nothing live to subscribe to.
 */

export interface SealedBidRoundEvent {
  roundId: string;
  change:
    | "created"
    | "bid_submitted"
    | "bid_withdrawn"
    | "closed"
    | "revealed"
    | "cancelled";
  status: string;
  at: string;
}

const MAX_RETRIES = 10;

export function useSealedBidLiveUpdates(
  roundId?: string | null,
  onEvent?: (event: SealedBidRoundEvent) => void,
  enabled = true,
) {
  const isConnected = useAuthStore((s) => s.isConnected);
  const { mutate } = useSWRConfig();
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!isConnected || !enabled) return;

    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;
    let retryCount = 0;
    let disposed = false;

    const url =
      "/api/vendor/sealed-bid/stream" +
      (roundId ? `?roundId=${encodeURIComponent(roundId)}` : "");

    function connect() {
      source = new EventSource(url);

      source.addEventListener("sealedbid:round", (e: MessageEvent) => {
        let event: SealedBidRoundEvent;
        try {
          event = JSON.parse(e.data) as SealedBidRoundEvent;
        } catch {
          return;
        }
        onEventRef.current?.(event);
        // Debounce so a burst of lifecycle changes collapses into one refetch.
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          void mutate("/api/vendor/sealed-bid/rounds");
          if (roundId) {
            void mutate(`/api/vendor/sealed-bid/rounds/${roundId}`);
          }
        }, 500);
      });

      source.onopen = () => {
        retryCount = 0;
      };

      source.onerror = () => {
        source?.close();
        source = null;
        if (disposed) return;
        retryCount++;
        if (retryCount > MAX_RETRIES) return;
        const delay = Math.min(2000 * Math.pow(2, retryCount - 1), 15_000);
        retryTimer = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      disposed = true;
      source?.close();
      if (retryTimer) clearTimeout(retryTimer);
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [isConnected, enabled, roundId, mutate]);
}
