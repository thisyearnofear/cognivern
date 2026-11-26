"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { MOTION_EASE, MOTION_SPRING } from "@/lib/motion-tokens";
import { PlateFrame, PLATE_STROKES } from "./plate-frame";

function KeycardState() {
  return (
    <g>
      <g
        fill="none"
        stroke={PLATE_STROKES.structural}
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="55" y="38" width="130" height="68" rx="8" fill="var(--muted)" fillOpacity="0.34" />
        <path d="M55 55h130" opacity="0.62" />
        <path d="M68 68h38M68 78h27M68 91h55" opacity="0.6" />
        <path d="M162 68h12M162 78h12" opacity="0.55" />
      </g>
      <g
        fill="none"
        stroke={PLATE_STROKES.primary}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="142" cy="80" r="9" />
        <path d="M151 80h24M167 80v7M175 80v5" />
      </g>
    </g>
  );
}

function BoundaryState({ profile }: { profile: string }) {
  const approveEnd = profile === "strict" ? 70 : profile === "relaxed" ? 154 : 94;
  const holdEnd = profile === "strict" ? 148 : profile === "relaxed" ? 190 : 174;

  return (
    <g>
      <g strokeLinecap="round" strokeWidth="10">
        <motion.line
          x1="42"
          y1="78"
          y2="78"
          initial={false}
          animate={{ x2: approveEnd }}
          transition={MOTION_SPRING.instrument}
          className="stroke-emerald-500"
          opacity="0.72"
        />
        <motion.line
          y1="78"
          y2="78"
          initial={false}
          animate={{ x1: approveEnd + 4, x2: holdEnd }}
          transition={MOTION_SPRING.instrument}
          className="stroke-amber-500"
          opacity="0.72"
        />
        <motion.line
          y1="78"
          x2="200"
          y2="78"
          initial={false}
          animate={{ x1: holdEnd + 4 }}
          transition={MOTION_SPRING.instrument}
          className="stroke-red-500"
          opacity="0.72"
        />
      </g>
      <g
        fill="none"
        stroke={PLATE_STROKES.structural}
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M42 78h158" />
        <path d="M42 66v24M94 66v24M174 66v24M200 66v24" />
        <path d="M52 96h24M111 96h35M184 96h12" opacity="0.58" />
      </g>
      <g
        fill="none"
        stroke={PLATE_STROKES.primary}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M121 45v24" />
        <path d="M112 45h18l-4-9h-10l-4 9Z" fill="var(--muted)" fillOpacity="0.42" />
        <circle cx="121" cy="78" r="5" />
      </g>
    </g>
  );
}

function AgentIdentityState() {
  return (
    <g>
      <g
        fill="none"
        stroke={PLATE_STROKES.structural}
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* compact key identity */}
        <rect x="38" y="52" width="62" height="40" rx="6" fill="var(--muted)" fillOpacity="0.35" />
        <path d="M48 65h22M48 76h30" opacity="0.62" />
        <circle cx="82" cy="72" r="6" />

        {/* agent node */}
        <path d="M173 43l31 18v36l-31 18-31-18V61l31-18Z" fill="var(--muted)" fillOpacity="0.35" />
        <circle cx="173" cy="79" r="13" />
        <path d="M173 62v-10M190 88l9 5M156 88l-9 5" opacity="0.58" />
      </g>
      <g
        fill="none"
        stroke={PLATE_STROKES.primary}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M100 72h27c8 0 12 2 15 7" />
        <path d="M136 72l8 8-8 8" opacity="0.8" />
        <circle cx="173" cy="79" r="5" />
      </g>
    </g>
  );
}

function ShieldGateState() {
  return (
    <g>
      <g
        fill="none"
        stroke={PLATE_STROKES.structural}
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M32 70h64M144 70h64" />
        <path d="M49 61v18M191 61v18" opacity="0.55" />
        <path d="M70 58h18M152 82h18" opacity="0.55" />
      </g>
      <g
        fill="none"
        stroke={PLATE_STROKES.primary}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          d="M120 34l28 10v27c0 20-12 32-28 39-16-7-28-19-28-39V44l28-10Z"
          fill="var(--muted)"
          fillOpacity="0.38"
        />
        <path d="M108 69l8 9 17-20" />
      </g>
      <circle cx="97" cy="70" r="4" className="fill-emerald-500" />
      <circle cx="97" cy="70" r="8" fill="none" className="stroke-emerald-500" strokeWidth="1.25" opacity="0.42" />
    </g>
  );
}

const STEP_STATES = [KeycardState, BoundaryState, AgentIdentityState, ShieldGateState] as const;

/**
 * Reactive onboarding schematic. Only the mechanism inside the registration
 * plate swaps as the wizard advances; the plate itself remains spatially stable.
 */
export function OnboardingPlate({
  step,
  policyProfile = "moderate",
  className,
}: {
  step: number;
  /** Strict/Moderate/Relaxed template id; only used by the boundary-rail state. */
  policyProfile?: string;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const activeStep = Math.max(0, Math.min(STEP_STATES.length - 1, step));

  return (
    <PlateFrame title="Onboarding treasury setup schematic" className={className}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.g
          key={activeStep}
          initial={{ opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 7 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : -7 }}
          transition={{ duration: reduceMotion ? 0 : 0.28, ease: MOTION_EASE.out }}
        >
          {activeStep === 0 ? (
            <KeycardState />
          ) : activeStep === 1 ? (
            <BoundaryState profile={policyProfile} />
          ) : activeStep === 2 ? (
            <AgentIdentityState />
          ) : (
            <ShieldGateState />
          )}
        </motion.g>
      </AnimatePresence>

      {/* persistent four-step registration rail */}
      <g>
        <path
          d="M82 122h76"
          stroke={PLATE_STROKES.muted}
          strokeWidth="1.25"
          strokeLinecap="round"
          opacity="0.65"
        />
        {STEP_STATES.map((_, index) => (
          <circle
            key={index}
            cx={82 + index * (76 / (STEP_STATES.length - 1))}
            cy="122"
            r={index === activeStep ? 3.5 : 2.25}
            fill={index === activeStep ? "var(--primary)" : "var(--muted-foreground)"}
            opacity={index === activeStep ? 1 : index < activeStep ? 0.8 : 0.36}
          />
        ))}
      </g>
    </PlateFrame>
  );
}
