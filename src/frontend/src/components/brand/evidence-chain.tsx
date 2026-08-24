"use client";

import { motion, useReducedMotion } from "motion/react";
import { ShieldCheck } from "lucide-react";

/**
 * The Cognivern signature motif: a chain of evidence. Every governed action
 * is a link — mandate → action → spend → evidence — terminating in the shield
 * that stands for the tamper-evident record. Used as a quiet brand divider so
 * the product is recognizable in a screenshot, not as decoration for its own
 * sake. Honors `prefers-reduced-motion` by rendering the settled state.
 */

const DEFAULT_STAGES = ["Mandate", "Action", "Spend", "Evidence"];

interface EvidenceChainProps {
  /** Stage labels. Omit for the unlabeled decorative divider. */
  stages?: string[];
  /** Show the stage labels under each node. */
  labeled?: boolean;
  className?: string;
}

export function EvidenceChain({
  stages = DEFAULT_STAGES,
  labeled = false,
  className = "",
}: EvidenceChainProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div
      aria-hidden={!labeled}
      className={`flex items-center justify-center ${className}`}
    >
      <ol className="flex items-center gap-0">
        {stages.map((stage, index) => (
          <li key={stage} className="flex items-center">
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, scale: 0.4 }}
              whileInView={reduceMotion ? undefined : { opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.12, duration: 0.35, ease: "easeOut" }}
              className="flex flex-col items-center"
            >
              <span className="relative flex h-3 w-3 items-center justify-center">
                <span className="absolute inline-flex h-full w-full rounded-full bg-primary/25" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
              {labeled && (
                <span className="mt-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                  {stage}
                </span>
              )}
            </motion.div>
            {index < stages.length - 1 && (
              <motion.span
                initial={reduceMotion ? false : { opacity: 0, scaleX: 0 }}
                whileInView={reduceMotion ? undefined : { opacity: 1, scaleX: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.12 + 0.1, duration: 0.3, ease: "easeOut" }}
                className={`mx-1.5 h-px origin-left bg-gradient-to-r from-primary/50 to-primary/20 ${
                  labeled ? "-mt-5" : ""
                }`}
                style={{ width: "2.5rem" }}
              />
            )}
          </li>
        ))}
        {/* Terminal shield — the record the whole chain produces. */}
        <li className="flex items-center">
          <motion.span
            initial={reduceMotion ? false : { opacity: 0, scaleX: 0 }}
            whileInView={reduceMotion ? undefined : { opacity: 1, scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ delay: stages.length * 0.12, duration: 0.3, ease: "easeOut" }}
            className={`mx-1.5 h-px origin-left bg-gradient-to-r from-primary/20 to-primary/60 ${
              labeled ? "-mt-5" : ""
            }`}
            style={{ width: "2.5rem" }}
          />
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, scale: 0.5 }}
            whileInView={reduceMotion ? undefined : { opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: stages.length * 0.12 + 0.1, duration: 0.4, ease: "easeOut" }}
            className="flex flex-col items-center"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
              <ShieldCheck className="h-3.5 w-3.5" />
            </span>
            {labeled && (
              <span className="mt-1.5 text-[10px] font-medium uppercase tracking-widest text-primary">
                Record
              </span>
            )}
          </motion.div>
        </li>
      </ol>
    </div>
  );
}
