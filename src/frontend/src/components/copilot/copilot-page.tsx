"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Circle,
  Clock3,
  Eye,
  FastForward,
  History,
  Pause,
  Play,
  Rewind,
  RotateCcw,
  ShieldCheck,
  SkipBack,
  SkipForward,
  Sliders,
  SquareActivity,
  X,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  apiClient,
  type CopilotEvent,
  type CopilotRun,
} from "@/lib/api-client";
import { cn } from "@/lib/utils";

const defaultGoal =
  "For agent-copilot, preview a 100 USDC spend to vendor 0xABCDEF1234567890abcdef1234567890abcdef12 for API credits under the active spend policy. First recall agent-copilot memory and vendor reputation, then run the spend preview.";

type ReplaySpeed = 0.5 | 1 | 2;

const REPLAY_BASE_INTERVAL_MS = 1500;
const REPLAY_SPEEDS: ReplaySpeed[] = [0.5, 1, 2];

const phaseOrder = [
  "PLAN",
  "EVIDENCE",
  "PREVIEW",
  "CONFIRM",
  "EXECUTE",
  "AUDIT",
] as const;

function phaseForEvent(event: CopilotEvent): (typeof phaseOrder)[number] {
  if (event.type === "model_tool_call") return "PLAN";
  if (event.name?.startsWith("mongodb_")) return "EVIDENCE";
  if (event.name === "cognivern_list_policies") return "EVIDENCE";
  if (event.type === "preview_ready" || event.name === "cognivern_preview_spend") {
    return "PREVIEW";
  }
  if (
    event.type === "confirmation_required" ||
    event.type === "confirmation_recorded"
  ) {
    return "CONFIRM";
  }
  if (event.type === "execution_blocked") return "EXECUTE";
  if (event.type === "final") return "AUDIT";
  return "PLAN";
}

function labelForEvent(event: CopilotEvent): string {
  switch (event.type) {
    case "run_started":
      return "Mission accepted";
    case "model_tool_call":
      return `Tool requested: ${event.name}`;
    case "tool_result":
      return `Tool completed: ${event.name}`;
    case "tool_error":
      return `Tool error: ${event.name}`;
    case "preview_ready":
      return "Spend preview ready";
    case "confirmation_required":
      return "Human confirmation required";
    case "confirmation_recorded":
      return "Human decision recorded";
    case "execution_blocked":
      return "Execution blocked";
    case "final":
      return "Final summary ready";
    case "run_failed":
      return "Run failed";
  }
}

function eventTone(event: CopilotEvent): string {
  if (event.type === "tool_error" || event.type === "run_failed") {
    return "border-destructive/30 bg-destructive/5 text-destructive";
  }
  if (event.type === "preview_ready" || event.type === "final") {
    return "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300";
  }
  if (event.type === "confirmation_required") {
    return "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300";
  }
  return "border-border bg-card text-foreground";
}

function compactPayload(payload?: Record<string, unknown>): string {
  if (!payload) return "";
  const preferred = [
    "status",
    "decision",
    "reason",
    "id",
    "attestationHash",
    "decisionId",
    "error",
  ];
  const pairs = preferred
    .filter((key) => payload[key] !== undefined)
    .map((key) => `${key}: ${String(payload[key])}`);
  if (pairs.length) return pairs.join(" · ");
  return Object.keys(payload).slice(0, 4).join(" · ");
}

function statusVariant(status?: CopilotRun["status"]) {
  if (status === "failed") return "destructive" as const;
  if (status === "awaiting_confirmation" || status === "confirmed") {
    return "outline" as const;
  }
  return "secondary" as const;
}

type RecordedDecision = "approved" | "denied";

function deriveDecision(run: CopilotRun | null): RecordedDecision | null {
  if (!run) return null;
  // Walk events newest-first; the most recent confirmation_recorded wins.
  for (let i = run.events.length - 1; i >= 0; i--) {
    const event = run.events[i];
    if (event.type === "confirmation_recorded") {
      if (event.payload?.approved === false) return "denied";
      if (event.payload?.approved === true) return "approved";
    }
  }
  return null;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.round((now - then) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.round(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)}h ago`;
  return `${Math.round(diffSec / 86400)}d ago`;
}

function readableError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("API error 401")) {
    return "Sign in with your wallet, then run the mission again.";
  }
  if (message.includes("API error 404") || message.includes("not found")) {
    return "Run expired — please Run again.";
  }
  return message;
}

export function CopilotPage() {
  const router = useRouter();
  const [goal, setGoal] = useState(defaultGoal);
  const [run, setRun] = useState<CopilotRun | null>(null);
  const [events, setEvents] = useState<CopilotEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [decision, setDecision] = useState<"approved" | "denied" | null>(null);
  const [recentRuns, setRecentRuns] = useState<CopilotRun[]>([]);
  const [replayRunId, setReplayRunId] = useState<string | null>(null);
  const [replayIndex, setReplayIndex] = useState(0);
  const [replayPlaying, setReplayPlaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState<ReplaySpeed>(1);
  const abortRef = useRef<AbortController | null>(null);

  // Refs to event cards so the player can keep the playhead in view.
  const eventRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());

  const isReplaying = replayRunId !== null;

  // Effective "latest" event: in live mode, the newest SSE event; in
  // replay mode, the event at the current playhead. Phase strip and
  // active-event highlighting both read from this.
  const effectiveLatest = useMemo(() => {
    if (isReplaying) {
      return events[Math.min(replayIndex, events.length - 1)] ?? null;
    }
    return events[events.length - 1] ?? null;
  }, [events, isReplaying, replayIndex]);

  const activePhase = effectiveLatest
    ? phaseForEvent(effectiveLatest)
    : "PLAN";

  // Pull the recent-decisions rail on mount. After every decision or
  // start, we re-pull so the rail reflects the latest state.
  const refreshRecent = useCallback(async () => {
    try {
      const response = await apiClient.listCopilotRuns(8);
      setRecentRuns(response.runs || []);
    } catch {
      // Non-fatal: the rail is a nice-to-have, not a blocker.
    }
  }, []);
  useEffect(() => {
    // Defer the initial fetch so the effect body doesn't trigger a
    // synchronous setState on mount (per react-hooks/set-state-in-effect).
    const id = window.setTimeout(() => {
      void refreshRecent();
    }, 0);
    return () => window.clearTimeout(id);
  }, [refreshRecent]);

  // Auto-advance the replay playhead. In live mode this is a no-op.
  useEffect(() => {
    if (!replayPlaying) return;
    if (!isReplaying) return;
    if (replayIndex >= events.length - 1) {
      // Defer the pause to avoid a synchronous setState inside the
      // effect body (react-hooks/set-state-in-effect).
      const id = window.setTimeout(() => setReplayPlaying(false), 0);
      return () => window.clearTimeout(id);
    }
    const delay = Math.round(REPLAY_BASE_INTERVAL_MS / replaySpeed);
    const id = window.setTimeout(() => {
      setReplayIndex((i) => Math.min(i + 1, events.length - 1));
    }, delay);
    return () => window.clearTimeout(id);
  }, [replayPlaying, replayIndex, events.length, replaySpeed, isReplaying]);

  // Keep the playhead card in view while auto-playing. We only auto-scroll
  // when playback is on so manual scrubbing isn't disruptive.
  useEffect(() => {
    if (!replayPlaying || !isReplaying) return;
    const node = eventRefs.current.get(replayIndex);
    node?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [replayIndex, replayPlaying, isReplaying]);

  const canConfirm =
    decision === null &&
    replayRunId === null &&
    (run?.status === "awaiting_confirmation" ||
      events.some((event) => event.type === "confirmation_required"));

  const isStale =
    run?.status === "confirmed" ||
    run?.status === "completed" ||
    run?.status === "failed";

  async function startRun(overrideGoal?: string) {
    const goalToRun = overrideGoal ?? goal;
    setBusy(true);
    setError(null);
    setDecision(null);
    setReplayRunId(null);
    setReplayIndex(0);
    setReplayPlaying(false);
    setEvents([]);
    abortRef.current?.abort();
    try {
      const response = await apiClient.startCopilotRun({
        goal: goalToRun,
        previewOnly: true,
      });
      setRun(response.run);
      setEvents(response.run.events || []);
      abortRef.current = apiClient.connectCopilotSse(response.run.id, {
        onEvent(event) {
          setEvents((current) => {
            if (current.some((existing) => existing.id === event.id)) {
              return current;
            }
            return [...current, event];
          });
          void apiClient
            .getCopilotRun(response.run.id)
            .then((fresh) => setRun(fresh.run))
            .catch(() => undefined);
        },
        onError(message) {
          setError(message);
        },
      });
      // Pull the rail so the new run appears at the top.
      void refreshRecent();
    } catch (err) {
      setError(readableError(err));
    } finally {
      setBusy(false);
    }
  }

  async function loadHistoricalRun(runId: string) {
    setBusy(true);
    setError(null);
    abortRef.current?.abort();
    abortRef.current = null;
    try {
      const response = await apiClient.getCopilotRun(runId);
      setRun(response.run);
      const loadedEvents = response.run.events || [];
      setEvents(loadedEvents);
      setDecision(deriveDecision(response.run));
      setReplayRunId(runId);
      // Seed the playhead at the final event so the user sees the full
      // trace immediately; they can scrub back with the prev/step buttons.
      setReplayIndex(Math.max(loadedEvents.length - 1, 0));
      setReplayPlaying(false);
    } catch (err) {
      setError(readableError(err));
    } finally {
      setBusy(false);
    }
  }

  function exitReplay() {
    setReplayRunId(null);
    setReplayIndex(0);
    setReplayPlaying(false);
    setReplaySpeed(1);
    setRun(null);
    setEvents([]);
    setDecision(null);
    setError(null);
    abortRef.current?.abort();
    abortRef.current = null;
  }

  function replayStep(delta: number) {
    setReplayIndex((i) => {
      const next = Math.max(0, Math.min(events.length - 1, i + delta));
      return next;
    });
  }

  function replayReset() {
    setReplayPlaying(false);
    setReplayIndex(0);
  }

  function replayJumpToEnd() {
    setReplayPlaying(false);
    setReplayIndex(Math.max(events.length - 1, 0));
  }

  function rerunWithGoal(priorGoal: string) {
    setGoal(priorGoal);
    void startRun(priorGoal);
  }

  async function confirm(approve: boolean) {
    if (!run) return;
    setBusy(true);
    setError(null);
    try {
      const response = await apiClient.confirmCopilotRun(run.id, {
        approve,
        reason: approve ? "Approved from Cognivern console." : "Denied from Cognivern console.",
      });
      setRun(response.run);
      setEvents(response.run.events || []);
      setDecision(approve ? "approved" : "denied");
      void refreshRecent();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Stale run: backend lost the in-memory state. Surface a clear
      // recovery message and reset the run so the user can re-run.
      if (message.includes("API error 404") || message.includes("not found")) {
        setError("Run expired — please Run again.");
        setRun(null);
        setEvents([]);
        setDecision(null);
        abortRef.current?.abort();
        abortRef.current = null;
        void refreshRecent();
      } else {
        setError(readableError(err));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <h1
              className="text-2xl font-bold tracking-tight"
              style={{ fontFamily: "var(--font-space-grotesk)" }}
            >
              Copilot
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Vertex AI mission control for governed agent spend.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {run?.status && (
            <Badge variant={statusVariant(run.status)}>{run.status}</Badge>
          )}
          <Badge variant="outline">Gemini 3.1</Badge>
          <Badge variant="outline">MongoDB MCP</Badge>
        </div>
      </div>

      {replayRunId && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm"
        >
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
            <Eye className="h-4 w-4" />
            <span>
              Viewing historical run <span className="font-mono text-xs">{replayRunId.slice(0, 18)}…</span>
              {run ? <> · {formatRelative(run.createdAt)}</> : null}
            </span>
          </div>
          <Button size="xs" variant="ghost" onClick={exitReplay}>
            <X className="h-3 w-3" />
            Close replay
          </Button>
        </div>
      )}

      {recentRuns.length > 0 && (
        <section
          id="recent-decisions"
          className="space-y-2 rounded-lg border bg-card p-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <History className="h-4 w-4 text-muted-foreground" />
              Recent decisions
            </div>
            <span className="text-xs text-muted-foreground">
              {recentRuns.length} run{recentRuns.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {recentRuns.map((recent) => {
              const recorded = deriveDecision(recent);
              const isActive = recent.id === run?.id;
              return (
                <button
                  key={recent.id}
                  type="button"
                  onClick={() => loadHistoricalRun(recent.id)}
                  className={cn(
                    "group flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left text-sm transition-colors",
                    isActive
                      ? "border-primary/50 bg-primary/5"
                      : "border-border bg-background hover:border-primary/30 hover:bg-muted/40",
                  )}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <Badge variant={statusVariant(recent.status)} className="shrink-0">
                      {recent.status}
                    </Badge>
                    {recorded === "approved" ? (
                      <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300">
                        approved
                      </Badge>
                    ) : recorded === "denied" ? (
                      <Badge variant="outline" className="border-rose-500/40 text-rose-700 dark:text-rose-300">
                        denied
                      </Badge>
                    ) : null}
                  </div>
                  <div className="line-clamp-2 w-full text-xs leading-5 text-foreground/90">
                    {truncate(recent.goal, 110)}
                  </div>
                  <div className="flex w-full items-center justify-between gap-2 text-[11px] text-muted-foreground">
                    <span className="font-mono">{recent.id.slice(0, 14)}…</span>
                    <span>{formatRelative(recent.createdAt)}</span>
                  </div>
                  <div className="flex w-full justify-end opacity-0 transition-opacity group-hover:opacity-100">
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        event.stopPropagation();
                        rerunWithGoal(recent.goal);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          event.stopPropagation();
                          rerunWithGoal(recent.goal);
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Re-run
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)]">
        <section className="space-y-3 rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold">Mission</div>
            <Button
              onClick={() => startRun()}
              disabled={busy || goal.trim().length < 10}
              aria-busy={busy}
            >
              {busy ? <Spinner /> : <Play className="h-4 w-4" />}
              {busy ? "Running…" : "Run"}
            </Button>
          </div>
          <Textarea
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
            disabled={busy}
            className="min-h-44 resize-none font-mono text-xs leading-5"
          />
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border bg-border">
            {phaseOrder.map((phase) => {
              const reached =
                phaseOrder.indexOf(phase) <= phaseOrder.indexOf(activePhase);
              return (
                <div
                  key={phase}
                  className={cn(
                    "bg-background px-3 py-3 text-xs font-medium",
                    reached ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  <div className="flex items-center gap-2">
                    {reached ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Circle className="h-3.5 w-3.5" />
                    )}
                    {phase}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-lg border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <SquareActivity className="h-4 w-4 text-primary" />
              {isReplaying ? "Event timeline" : "Live trace"}
              {isReplaying && (
                <Badge variant="outline" className="ml-1 border-amber-500/40 text-amber-700 dark:text-amber-300">
                  replay
                </Badge>
              )}
            </div>
            {isReplaying && events.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs tabular-nums text-muted-foreground">
                  {replayIndex + 1} / {events.length}
                </span>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  onClick={replayReset}
                  disabled={busy}
                  aria-label="Jump to first event"
                >
                  <Rewind className="h-3 w-3" />
                </Button>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  onClick={() => replayStep(-1)}
                  disabled={busy || replayIndex === 0}
                  aria-label="Previous event"
                >
                  <SkipBack className="h-3 w-3" />
                </Button>
                <Button
                  size="icon-xs"
                  variant={replayPlaying ? "default" : "secondary"}
                  onClick={() => setReplayPlaying((p) => !p)}
                  disabled={busy || replayIndex >= events.length - 1}
                  aria-label={replayPlaying ? "Pause replay" : "Play replay"}
                >
                  {replayPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                </Button>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  onClick={() => replayStep(1)}
                  disabled={busy || replayIndex >= events.length - 1}
                  aria-label="Next event"
                >
                  <SkipForward className="h-3 w-3" />
                </Button>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  onClick={replayJumpToEnd}
                  disabled={busy || replayIndex >= events.length - 1}
                  aria-label="Jump to last event"
                >
                  <FastForward className="h-3 w-3" />
                </Button>
                <div className="ml-1 flex items-center gap-0.5 rounded-md border bg-background p-0.5">
                  {REPLAY_SPEEDS.map((speed) => (
                    <button
                      key={speed}
                      type="button"
                      onClick={() => setReplaySpeed(speed)}
                      aria-pressed={replaySpeed === speed}
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums transition-colors",
                        replaySpeed === speed
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {speed}×
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">
                {events.length} events
              </span>
            )}
          </div>
          {isReplaying && events.length > 1 && (
            <div className="border-t bg-muted/30 px-4 py-2">
              <input
                type="range"
                min={0}
                max={events.length - 1}
                step={1}
                value={replayIndex}
                onChange={(event) => {
                  setReplayPlaying(false);
                  setReplayIndex(Number(event.target.value));
                }}
                aria-label="Scrub through event timeline"
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
              />
            </div>
          )}
          <div className="max-h-[560px] space-y-2 overflow-auto p-3">
            {events.length === 0 ? (
              <div className="flex h-44 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                <Clock3 className="mr-2 h-4 w-4" />
                Awaiting mission
              </div>
            ) : (
              events.map((event, index) => {
                const isActive = isReplaying && index === replayIndex;
                const isFuture = isReplaying && index > replayIndex;
                return (
                  <div
                    key={event.id}
                    ref={(node) => {
                      eventRefs.current.set(index, node);
                    }}
                    data-replay-active={isActive ? "true" : undefined}
                    className={cn(
                      "rounded-lg border p-3 transition-all",
                      eventTone(event),
                      isActive &&
                        "ring-2 ring-primary ring-offset-2 ring-offset-background shadow-md",
                      isFuture && "opacity-30",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] tabular-nums text-muted-foreground">
                            #{index + 1}
                          </span>
                          <span className="truncate text-sm font-medium">
                            {labelForEvent(event)}
                          </span>
                        </div>
                        <div className="mt-1 truncate text-xs opacity-75">
                          {compactPayload(event.payload)}
                        </div>
                        <div className="mt-1 text-[10px] tabular-nums text-muted-foreground">
                          {new Date(event.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                      <Badge variant="outline" className="shrink-0">
                        {phaseForEvent(event)}
                      </Badge>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            Preview
          </div>
          <pre className="max-h-64 overflow-auto rounded-lg bg-muted p-3 text-xs leading-5 text-muted-foreground">
            {run?.preview
              ? JSON.stringify(run.preview, null, 2)
              : "No preview receipt yet."}
          </pre>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-sm font-semibold">Human gate</div>
            {decision === "approved" ? (
              <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300">
                approved
              </Badge>
            ) : decision === "denied" ? (
              <Badge variant="outline" className="border-rose-500/40 text-rose-700 dark:text-rose-300">
                denied
              </Badge>
            ) : canConfirm ? (
              <Badge variant="outline">pending</Badge>
            ) : (
              <Badge variant="secondary">idle</Badge>
            )}
          </div>
          <p className="min-h-12 text-sm text-muted-foreground">
            {run?.summary ||
              "The operator decision appears here after the preview step completes."}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              onClick={() => confirm(true)}
              disabled={!canConfirm || busy}
              variant="default"
            >
              <CheckCircle2 className="h-4 w-4" />
              {busy && decision === null ? "Approving…" : "Approve"}
            </Button>
            <Button
              onClick={() => confirm(false)}
              disabled={!canConfirm || busy}
              variant="outline"
            >
              <XCircle className="h-4 w-4" />
              {busy && decision === null ? "Denying…" : "Deny"}
            </Button>
            {isStale && decision === null && (
              <span className="text-xs text-muted-foreground">
                Run already finalized — start a new mission to act on a fresh preview.
              </span>
            )}
          </div>

          {decision !== null && run && (
            <div
              role="status"
              data-testid="post-decision-card"
              className={cn(
                "mt-4 rounded-lg border p-3",
                decision === "approved"
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : "border-rose-500/30 bg-rose-500/5",
              )}
            >
              <div className="flex items-start gap-2">
                {decision === "approved" ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 text-rose-600" />
                )}
                <div className="flex-1">
                  <div className="text-sm font-semibold">
                    {decision === "approved" ? "Spend approved" : "Spend denied"}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {decision === "approved"
                      ? "The decision is recorded on the audit trail. The agent can re-run with the same goal, or you can tune the spend policy for a different outcome next time."
                      : "The denial is recorded on the audit trail. The agent can re-run with the same goal, or you can tune the spend policy to allow this category of spend."}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => {
                        document
                          .getElementById("recent-decisions")
                          ?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                    >
                      <History className="h-3 w-3" />
                      View decision history
                    </Button>
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => rerunWithGoal(run.goal)}
                    >
                      <RotateCcw className="h-3 w-3" />
                      Re-run with same goal
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => router.push("/policies")}
                    >
                      <Sliders className="h-3 w-3" />
                      Tune the policy
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
