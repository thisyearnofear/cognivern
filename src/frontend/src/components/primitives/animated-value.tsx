"use client";

import { useMemo, type CSSProperties } from "react";
import NumberFlow, { type Format, type Trend } from "@number-flow/react";

const ROLL_TIMING = {
  duration: 220,
  easing: "cubic-bezier(0.22, 1, 0.36, 1)",
} satisfies EffectTiming;

const naturalTrend: Trend = (oldValue, value) => Math.sign(value - oldValue);

export interface AnimatedValueProps {
  value: number;
  format?: Format;
  prefix?: string;
  suffix?: string;
  locales?: Intl.LocalesArgument;
  /** Reserve at least this many monospace character cells so live updates never shift layout. */
  minChars?: number;
  /** Escape hatch for places that must render as static text even when values update. */
  animated?: boolean;
  trend?: Trend;
  className?: string;
  style?: CSSProperties;
}

/**
 * Rolling numeric readout for values that genuinely change after mount.
 * NumberFlow only computes transition deltas after its element has been
 * created, so first paint is instant and never becomes a decorative count-up.
 */
export function AnimatedValue({
  value,
  format,
  prefix,
  suffix,
  locales,
  minChars,
  animated = true,
  trend = naturalTrend,
  className,
  style,
}: AnimatedValueProps) {
  const currentChars = useMemo(() => {
    const formatted = new Intl.NumberFormat(locales, format).format(value);
    return `${prefix ?? ""}${formatted}${suffix ?? ""}`.length;
  }, [value, format, prefix, suffix, locales]);
  const reserveChars = Math.max(minChars ?? 0, currentChars);

  return (
    <NumberFlow
      value={value}
      format={format}
      prefix={prefix}
      suffix={suffix}
      locales={locales}
      animated={animated}
      trend={trend}
      willChange={false}
      respectMotionPreference
      transformTiming={ROLL_TIMING}
      spinTiming={{ ...ROLL_TIMING, duration: 240 }}
      opacityTiming={{ duration: 120, easing: "ease-out" }}
      className={`inline-block tabular-nums ${className ?? ""}`}
      style={{ minWidth: `${reserveChars}ch`, ...style }}
    />
  );
}
