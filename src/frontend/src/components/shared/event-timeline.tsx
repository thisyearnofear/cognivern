"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FastForward,
  Pause,
  Play,
  Rewind,
  SkipBack,
  SkipForward,
  SquareActivity,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface TimelineEvent {
  id: number | string;
  label: string;
  timestamp: string;
  type?: string;
  payload?: Record<string, unknown>;
  status?: "success" | "error" | "pending" | "info";
}

type ReplaySpeed = 0.5 | 1 | 2;

const BASE_INTERVAL_MS = 1500;
const SPEEDS: ReplaySpeed[] = [0.5, 1, 2];

const statusStyles: Record<string, string> = {
  success: "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300",
  error: "border-destructive/30 bg-destructive/5 text-destructive",
  pending: "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300",
  info: "border-border bg-card text-foreground",
};

function compactPayload(payload?: Record<string, unknown>): string {
  if (!payload) return "";
  const preferred = ["status", "decision", "reason", "result", "policyId", "error"];
  const pairs = preferred
    .filter((key) => payload[key] !== undefined)
    .map((key) => `${key}: ${String(payload[key])}`);
  if (pairs.length) return pairs.join(" · ");
  return Object.keys(payload).slice(0, 4).join(" · ");
}

export function EventTimeline({
  events,
  title = "Event timeline",
  compact = false,
}: {
  events: TimelineEvent[];
  title?: string;
  compact?: boolean;
}) {
  const [index, setIndex] = useState(events.length - 1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<ReplaySpeed>(1);
  const itemRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());

  useEffect(() => {
    const id = window.setTimeout(() => {
      setIndex(Math.max(events.length - 1, 0));
      setPlaying(false);
    }, 0);
    return () => window.clearTimeout(id);
  }, [events.length]);

  useEffect(() => {
    if (!playing) return;
    if (index >= events.length - 1) {
      const id = window.setTimeout(() => setPlaying(false), 0);
      return () => window.clearTimeout(id);
    }
    const delay = Math.round(BASE_INTERVAL_MS / speed);
    const id = window.setTimeout(() => {
      setIndex((i) => Math.min(i + 1, events.length - 1));
    }, delay);
    return () => window.clearTimeout(id);
  }, [playing, index, events.length, speed]);

  useEffect(() => {
    if (!playing) return;
    const node = itemRefs.current.get(index);
    node?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [index, playing]);

  const step = useCallback(
    (delta: number) => {
      setIndex((i) => Math.max(0, Math.min(events.length - 1, i + delta)));
    },
    [events.length],
  );

  const reset = useCallback(() => {
    setPlaying(false);
    setIndex(0);
  }, []);

  const jumpToEnd = useCallback(() => {
    setPlaying(false);
    setIndex(Math.max(events.length - 1, 0));
  }, [events.length]);

  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
        No timeline events
      </div>
    );
  }

  const maxH = compact ? "max-h-64" : "max-h-[560px]";

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <SquareActivity className="h-3.5 w-3.5 text-primary" />
          {title}
          <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-300 text-[10px]">
            replay
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {index + 1} / {events.length}
          </span>
          <Button size="icon-xs" variant="ghost" onClick={reset} aria-label="Jump to first">
            <Rewind className="h-3 w-3" />
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={() => step(-1)}
            disabled={index === 0}
            aria-label="Previous"
          >
            <SkipBack className="h-3 w-3" />
          </Button>
          <Button
            size="icon-xs"
            variant={playing ? "default" : "secondary"}
            onClick={() => setPlaying((p) => !p)}
            disabled={index >= events.length - 1}
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={() => step(1)}
            disabled={index >= events.length - 1}
            aria-label="Next"
          >
            <SkipForward className="h-3 w-3" />
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={jumpToEnd}
            disabled={index >= events.length - 1}
            aria-label="Jump to last"
          >
            <FastForward className="h-3 w-3" />
          </Button>
          <div className="ml-1 flex items-center gap-0.5 rounded-md border bg-background p-0.5">
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSpeed(s)}
                aria-pressed={speed === s}
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums transition-colors",
                  speed === s
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>
      {events.length > 1 && (
        <div className="border-t bg-muted/30 px-3 py-1.5">
          <input
            type="range"
            min={0}
            max={events.length - 1}
            step={1}
            value={index}
            onChange={(e) => {
              setPlaying(false);
              setIndex(Number(e.target.value));
            }}
            aria-label="Scrub through timeline"
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
          />
        </div>
      )}
      <div className={cn("space-y-1.5 overflow-auto p-2", maxH)}>
        {events.map((event, i) => {
          const isActive = i === index;
          const isFuture = i > index;
          const tone = statusStyles[event.status || "info"] || statusStyles.info;
          return (
            <div
              key={event.id}
              ref={(node) => {
                itemRefs.current.set(i, node);
              }}
              className={cn(
                "rounded-lg border p-2.5 transition-all text-xs",
                tone,
                isActive && "ring-2 ring-primary ring-offset-1 ring-offset-background shadow-md",
                isFuture && "opacity-30",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] tabular-nums text-muted-foreground">
                      #{i + 1}
                    </span>
                    <span className="truncate text-xs font-medium">{event.label}</span>
                  </div>
                  {event.payload && (
                    <div className="mt-0.5 truncate text-[10px] opacity-75">
                      {compactPayload(event.payload)}
                    </div>
                  )}
                  <div className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </div>
                </div>
                <Badge variant="outline" className="shrink-0 text-[9px]">
                  {(event.type || "event").replace(/_/g, " ")}
                </Badge>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
