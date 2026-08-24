"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animate a number from 0 to `target` over `duration` ms once `start` is true.
 * Uses an ease-out cubic so the counter decelerates into the final value.
 * Shared by the landing stats and the dashboard KPI strip — keep one
 * implementation so the motion language stays identical across surfaces.
 */
export function useCountUp(target: number, duration = 2000, start = false) {
  const [count, setCount] = useState(0);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (!start) return;
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) frame.current = requestAnimationFrame(animate);
    };
    frame.current = requestAnimationFrame(animate);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [target, duration, start]);

  return count;
}
