import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAppStore } from '@/stores/app-store';

let socket: Socket | null = null;

export function useSocket(): Socket | null {
  const isConnected = useAppStore((s) => s.user.isConnected);

  useEffect(() => {
    if (!isConnected) {
      if (socket) {
        socket.disconnect();
        socket = null;
      }
      return;
    }

    if (!socket) {
      socket = io(window.location.origin, {
        path: '/api/socket',
        transports: ['websocket', 'polling'],
      });
    }

    return () => {};
  }, [isConnected]);

  return socket;
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
