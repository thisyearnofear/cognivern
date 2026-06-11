"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
  /** Route key that triggers exit/enter animation when it changes. Pass `pathname` from the layout. */
  routeKey?: string;
}

/**
 * Shared page entrance/exit animation.
 * Wraps page content with a fade-in + slight upward motion on mount,
 * and a fade-out + downward motion on unmount (when routeKey changes
 * and wrapped in <AnimatePresence mode="wait">).
 *
 * Reuse this on every dashboard page for consistent motion language.
 */
export function PageTransition({ children, className, routeKey }: PageTransitionProps) {
  return (
    <motion.div
      key={routeKey}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
