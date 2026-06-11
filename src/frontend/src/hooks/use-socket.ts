import { useEffect, useRef, useSyncExternalStore } from "react";
import { io, type Socket } from "socket.io-client";
import { useAuthStore, useAuthHydrated } from "@/stores/auth-store";

/**
 * Module-level socket singleton. The socket is created lazily the first
 * time a consumer asks for it while authenticated, and disposed when
 * the user logs out.
 *
 * Production deploys on Vercel do not support long-lived WebSocket
 * connections, so we use polling on `https://` origins. Locally the
 * combined transport is fine.
 */
let socket: Socket | null = null;
const listeners = new Set<() => void>();

function buildSocket(): Socket | null {
  const token = useAuthStore.getState().token;
  if (!token) return null;
  if (typeof window === "undefined") return null;

  const isHttps = window.location.protocol === "https:";
  const transports: Array<"websocket" | "polling"> = isHttps
    ? ["polling"]
    : ["websocket", "polling"];

  const next = io(window.location.origin, {
    path: "/api/socket",
    transports,
    auth: { token },
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 15000,
    timeout: 8000,
    autoConnect: true,
  });

  // Quietly track connection state instead of letting socket.io's
  // default `console.error` fire on every failed reconnect.
  if (process.env.NODE_ENV === "development") {
    next.on("connect_error", (err) =>
      console.debug("[socket] connect_error", err.message),
    );
    next.on("reconnect_failed", () =>
      console.debug("[socket] reconnect_failed - giving up"),
    );
  }

  return next;
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}

function notifyAll() {
  listeners.forEach((l) => l());
}

function getSocketSnapshot(): Socket | null {
  return socket;
}

function getServerSnapshot(): Socket | null {
  return null;
}

export function useSocket(): Socket | null {
  const isConnected = useAuthStore((s) => s.isConnected);
  const hasHydrated = useAuthHydrated();

  useEffect(() => {
    if (!hasHydrated) return;

    if (!isConnected) {
      if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
        socket = null;
        notifyAll();
      }
      return;
    }

    if (!socket) {
      socket = buildSocket();
      notifyAll();
    }
  }, [hasHydrated, isConnected]);

  return useSyncExternalStore(subscribe, getSocketSnapshot, getServerSnapshot);
}

export function useSocketEvent<T>(event: string, callback: (data: T) => void) {
  const socket = useSocket();
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!socket) return;

    const handler = (data: T) => callbackRef.current(data);
    socket.on(event, handler);

    return () => {
      socket.off(event, handler);
    };
  }, [socket, event]);
}
