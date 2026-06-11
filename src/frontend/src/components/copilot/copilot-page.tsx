"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Circle,
  Clock3,
  Play,
  ShieldCheck,
  SquareActivity,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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

function readableError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("API error 401")) {
    return "Sign in with your wallet, then run the mission again.";
  }
  return message;
}

export function CopilotPage() {
  const [goal, setGoal] = useState(defaultGoal);
  const [run, setRun] = useState<CopilotRun | null>(null);
  const [events, setEvents] = useState<CopilotEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const activePhase = useMemo(() => {
    const latest = events[events.length - 1];
    return latest ? phaseForEvent(latest) : "PLAN";
  }, [events]);

  const canConfirm =
    run?.status === "awaiting_confirmation" ||
    events.some((event) => event.type === "confirmation_required");

  async function startRun() {
    setBusy(true);
    setError(null);
    setEvents([]);
    abortRef.current?.abort();
    try {
      const response = await apiClient.startCopilotRun({
        goal,
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
    } catch (err) {
      setError(readableError(err));
    } finally {
      setBusy(false);
    }
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
    } catch (err) {
      setError(readableError(err));
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

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)]">
        <section className="space-y-3 rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold">Mission</div>
            <Button onClick={startRun} disabled={busy || goal.trim().length < 10}>
              <Play className="h-4 w-4" />
              Run
            </Button>
          </div>
          <Textarea
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
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
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <SquareActivity className="h-4 w-4 text-primary" />
              Live trace
            </div>
            <span className="text-xs text-muted-foreground">
              {events.length} events
            </span>
          </div>
          <div className="max-h-[560px] space-y-2 overflow-auto p-3">
            {events.length === 0 ? (
              <div className="flex h-44 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                <Clock3 className="mr-2 h-4 w-4" />
                Awaiting mission
              </div>
            ) : (
              events.map((event) => (
                <div
                  key={event.id}
                  className={cn("rounded-lg border p-3", eventTone(event))}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {labelForEvent(event)}
                      </div>
                      <div className="mt-1 truncate text-xs opacity-75">
                        {compactPayload(event.payload)}
                      </div>
                    </div>
                    <Badge variant="outline" className="shrink-0">
                      {phaseForEvent(event)}
                    </Badge>
                  </div>
                </div>
              ))
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
            {canConfirm ? (
              <Badge variant="outline">pending</Badge>
            ) : (
              <Badge variant="secondary">idle</Badge>
            )}
          </div>
          <p className="min-h-12 text-sm text-muted-foreground">
            {run?.summary ||
              "The operator decision appears here after the preview step completes."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={() => confirm(true)}
              disabled={!canConfirm || busy}
              variant="default"
            >
              <CheckCircle2 className="h-4 w-4" />
              Approve
            </Button>
            <Button
              onClick={() => confirm(false)}
              disabled={!canConfirm || busy}
              variant="outline"
            >
              <XCircle className="h-4 w-4" />
              Deny
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
