'use client';

import { useEffect, useRef } from 'react';
import { useAppStore } from '@/stores/app-store';
import { generateDemoAuditLog } from '@/lib/demo-data';

/**
 * Simulates live agent activity when the user is in demo mode.
 * Generates a new audit log entry every 8–15 seconds so the dashboard feels alive.
 */
export function useDemoSimulator() {
  const demoMode = useAppStore((s) => s.demoMode);
  const addDemoAuditLog = useAppStore((s) => s.addDemoAuditLog);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!demoMode) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Generate initial burst of 3 logs immediately
    for (let i = 0; i < 3; i++) {
      addDemoAuditLog(generateDemoAuditLog());
    }

    intervalRef.current = setInterval(() => {
      addDemoAuditLog(generateDemoAuditLog());
    }, 8000 + Math.random() * 7000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [demoMode, addDemoAuditLog]);
}
