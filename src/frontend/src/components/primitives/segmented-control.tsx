"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { MOTION_SPRING } from "@/lib/motion-tokens";

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
  /** Marks the option as altered by governance; renders an amber dot. */
  changed?: boolean;
}

interface SegmentedControlProps<T extends string> {
  /** Unique instance id — used in the shared layoutId so highlight pills never collide across instances. */
  id: string;
  label?: string;
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/**
 * Segmented control with a gliding highlight pill (shared layoutId spring,
 * zero bounce). Visual language follows the ChipGroup chips: small text-xs
 * rounded buttons, primary-tinted active state.
 */
export function SegmentedControl<T extends string>({
  id,
  label,
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div className={`min-w-0 ${className ?? ""}`}>
      {label ? (
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
      ) : null}
      <div
        role="group"
        aria-label={label}
        className={`${label ? "mt-1.5 " : ""}inline-flex flex-wrap gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5`}
      >
        {options.map((option) => {
          const isActive = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isActive}
              title={option.changed ? "Governance changed this decision" : undefined}
              onClick={() => onChange(option.value)}
              className={`relative rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId={`segmented-control-${id}`}
                  transition={MOTION_SPRING.snappy}
                  aria-hidden
                  className="absolute inset-0 rounded-md border border-primary/40 bg-primary/10"
                />
              )}
              <span className="relative z-10 inline-flex items-center gap-1.5">
                {option.changed && (
                  <span
                    aria-hidden
                    className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500 align-middle"
                  />
                )}
                {option.icon}
                {option.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
