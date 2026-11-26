"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { MOTION_DURATION, MOTION_EASE } from "@/lib/motion-tokens";

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
  /** Route key that triggers the entrance animation when it changes. Pass `pathname` from the layout. */
  routeKey?: string;
}

/**
 * Shared page entrance animation.
 * Fast, non-blocking fade-in + slight upward settle on mount. There is no
 * blocking exit animation: route switches must never hold exit frames or
 * delay the incoming page.
 *
 * Reuse this on every dashboard page for consistent motion language.
 */
export function PageTransition({ children, className, routeKey }: PageTransitionProps) {
  return (
    <motion.div
      key={routeKey}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: MOTION_DURATION.micro, ease: MOTION_EASE.out }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
