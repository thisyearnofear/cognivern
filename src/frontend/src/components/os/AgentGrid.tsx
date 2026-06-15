"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { authFetch } from "@/lib/auth-fetch";

interface HydraMemory {
  text: string;
  score?: number;
}

type AgentState = "IDLE" | "BUSY" | "CRSH" | "SYNC";

interface AgentCore {
  id: string;
  name: string;
  state: AgentState;
  task: string | null;
  lastActivity: string;
}

const STATE_COLORS: Record<
  AgentState,
  { bg: string; text: string; glow: string }
> = {
  IDLE: { bg: "bg-zinc-800", text: "text-zinc-500", glow: "" },
  BUSY: {
    bg: "bg-emerald-950",
    text: "text-emerald-400",
    glow: "shadow-[0_0_12px_rgba(34,197,94,0.3)]",
  },
  CRSH: {
    bg: "bg-red-950",
    text: "text-red-400",
    glow: "shadow-[0_0_12px_rgba(239,68,68,0.3)]",
  },
  SYNC: {
    bg: "bg-sky-950",
    text: "text-sky-400",
    glow: "shadow-[0_0_12px_rgba(56,189,248,0.3)]",
  },
};

const STATE_LABEL: Record<AgentState, string> = {
  IDLE: "IDLE",
  BUSY: "BUSY",
  CRSH: "CRSH",
  SYNC: "SYNC",
};

const CORE_DEFINITIONS: Omit<AgentCore, "state" | "task" | "lastActivity">[] = [
  { id: "core-0", name: "Governance" },
  { id: "core-1", name: "Audit" },
  { id: "core-2", name: "CRE Engine" },
  { id: "core-3", name: "Intent Router" },
];

export interface AgentGridProps {
  activeIntentType?: string | null;
  onRunGovernanceCheck?: () => void;
}

export function AgentGrid({
  activeIntentType,
  onRunGovernanceCheck,
}: AgentGridProps) {
  const [cores, setCores] = useState<AgentCore[]>(() =>
    CORE_DEFINITIONS.map((c) => ({
      ...c,
      state: "IDLE" as AgentState,
      task: null,
      lastActivity: "idle",
    })),
  );
  const [runCount, setRunCount] = useState(0);
  const [auditEvents, setAuditEvents] = useState<
    Array<{ eventType: string; timestamp: string }>
  >([]);
  const [recentMemories, setRecentMemories] = useState<HydraMemory[]>([]);
  const [memoryConfig, setMemoryConfig] = useState<{
    configured: boolean;
  } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const [runsRes, auditRes] = await Promise.allSettled([
          authFetch("/api/cre/runs"),
          authFetch("/api/audit/logs"),
        ]);

        if (runsRes.status === "fulfilled") {
          const data = await runsRes.value.json();
          const runs = data.runs || [];
          const runningCount = runs.filter(
            (r: { status: string }) =>
              r.status === "running" || r.status === "queued",
          ).length;
          setRunCount(runs.length);

          setCores((prev) =>
            prev.map((core, i) => {
              if (i === 2 && runningCount > 0) {
                return {
                  ...core,
                  state: "BUSY" as AgentState,
                  task: `${runningCount} active run(s)`,
                  lastActivity: "processing",
                };
              }
              return {
                ...core,
                state: "IDLE" as AgentState,
                task: null,
                lastActivity: "idle",
              };
            }),
          );
        }

        if (auditRes.status === "fulfilled") {
          const data = await auditRes.value.json();
          const logs = data.data?.logs || data.data || [];
          setAuditEvents((Array.isArray(logs) ? logs : []).slice(0, 10));
        }
      } catch {
        // Silent fail
      }
    };

    poll();
    pollRef.current = setInterval(poll, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Poll memory feed separately (parallel to main poll)
  useEffect(() => {
    const fetchMemories = async () => {
      try {
        const [statusRes, recentRes] = await Promise.all([
          authFetch("/api/os/hydra"),
          authFetch("/api/os/hydra", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "recent", limit: 5 }),
          }),
        ]);

        const statusData = (await statusRes.json()).data;
        if (statusData) {
          setMemoryConfig({
            configured: statusData.configured && statusData.tenantExists,
          });
        }

        const recentData = (await recentRes.json()).data;
        if (recentData?.results && Array.isArray(recentData.results)) {
          setRecentMemories(recentData.results.slice(0, 5));
        }
      } catch {
        // HydraDB not available
      }
    };

    // Initial fetch with delay so layout doesn't block
    const timer = setTimeout(fetchMemories, 2000);
    const interval = setInterval(fetchMemories, 15000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  // React to terminal intents
  useEffect(() => {
    if (!activeIntentType) return;

    // Map intent types to cores that should light up
    const intentCoreMap: Record<
      string,
      { coreIdx: number; state: AgentState }[]
    > = {
      governance: [{ coreIdx: 0, state: "BUSY" }],
      risk: [{ coreIdx: 0, state: "BUSY" }],
      policy: [{ coreIdx: 0, state: "BUSY" }],
      forensic: [{ coreIdx: 1, state: "BUSY" }],
      agent: [{ coreIdx: 2, state: "BUSY" }],
      stats: [{ coreIdx: 3, state: "BUSY" }],
      create: [
        { coreIdx: 0, state: "SYNC" },
        { coreIdx: 2, state: "SYNC" },
      ],
    };

    const activation = intentCoreMap[activeIntentType] || [
      { coreIdx: 3, state: "BUSY" },
    ];

    const activeType = activeIntentType;
    const timeoutId = setTimeout(() => {
      setCores((prev) =>
        prev.map((core, i) => {
          const match = activation.find((a) => a.coreIdx === i);
          if (match) {
            return {
              ...core,
              state: match.state,
              task: activeType,
              lastActivity: "processing",
            };
          }
          return core;
        }),
      );
    }, 0);

    // Reset after 8 seconds
    const timeout = setTimeout(() => {
      setCores((prev) =>
        prev.map((core) => ({
          ...core,
          state: "IDLE" as AgentState,
          task: null,
          lastActivity: "idle",
        })),
      );
    }, 8000);

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(timeout);
    };
  }, [activeIntentType]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
        <h2 className="text-xs font-mono text-zinc-500 uppercase tracking-wider">
          Agent Cores
        </h2>
        <span className="text-[10px] font-mono text-zinc-600">
          {runCount} run{runCount !== 1 ? "s" : ""} logged
        </span>
      </div>

      <div className="flex-1 grid grid-cols-2 gap-2 p-3">
        <AnimatePresence>
          {cores.map((core) => {
            const colors = STATE_COLORS[core.state];
            return (
              <motion.div
                key={core.id}
                initial={false}
                animate={{
                  scale: core.state === "CRSH" ? [1, 1.05, 0.95, 1] : 1,
                }}
                transition={{ duration: 0.3 }}
                className={`
                  ${colors.bg} ${colors.glow}
                  rounded-lg border border-zinc-800 p-3
                  flex flex-col justify-between
                  transition-all duration-300
                `}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase">
                    {core.id}
                  </span>
                  <motion.span
                    className={`text-[10px] font-mono font-bold ${colors.text}`}
                    animate={
                      core.state === "BUSY"
                        ? { opacity: [1, 0.5, 1] }
                        : { opacity: 1 }
                    }
                    transition={
                      core.state === "BUSY"
                        ? { duration: 1.5, repeat: Infinity }
                        : {}
                    }
                  >
                    {STATE_LABEL[core.state]}
                  </motion.span>
                </div>

                <div className="text-xs font-mono text-zinc-300 mb-1 truncate">
                  {core.name}
                </div>

                {core.task && (
                  <div className="text-[10px] font-mono text-zinc-500 truncate">
                    {core.task}
                  </div>
                )}

                {/* Pulse ring for BUSY/SYNC states */}
                {(core.state === "BUSY" || core.state === "SYNC") && (
                  <motion.div
                    className="absolute inset-0 rounded-lg border border-current opacity-20"
                    animate={{ opacity: [0.2, 0, 0.2] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Memory feed */}
      <div className="border-t border-zinc-800 px-3 py-2">
        <div className="flex items-center justify-between mb-1">
          <div className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider">
            Memory
          </div>
          {memoryConfig && (
            <span
              className={`inline-block w-1.5 h-1.5 rounded-full ${
                memoryConfig.configured ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
          )}
        </div>
        <div className="space-y-0.5 max-h-24 overflow-y-auto scrollbar-thin">
          {recentMemories.length > 0 ? (
            recentMemories.map((mem, i) => {
              const display =
                (mem.text || "").length > 55
                  ? (mem.text || "").slice(0, 55) + "..."
                  : mem.text || "";
              return (
                <div
                  key={`mem-${i}`}
                  className="text-[10px] font-mono text-zinc-500 truncate hover:text-zinc-400 transition-colors"
                >
                  <span className="text-emerald-600">&#9655;</span> {display}
                </div>
              );
            })
          ) : (
            <div className="text-[10px] font-mono text-zinc-600">
              {memoryConfig === null
                ? "loading..."
                : memoryConfig.configured
                  ? "no memories yet"
                  : "not configured"}
            </div>
          )}
        </div>
      </div>

      {/* Event feed */}
      <div className="border-t border-zinc-800 px-3 py-2">
        <div className="text-[10px] font-mono text-zinc-600 mb-1 uppercase tracking-wider">
          Event Feed
        </div>
        <div className="space-y-0.5 max-h-24 overflow-y-auto scrollbar-thin">
          {/* Active core states first */}
          {cores
            .filter((c) => c.state !== "IDLE")
            .map((c) => (
              <div
                key={c.id}
                className="text-[10px] font-mono text-zinc-500 truncate"
              >
                <span className={STATE_COLORS[c.state].text}>[{c.state}]</span>{" "}
                {c.name}: {c.task || c.lastActivity}
              </div>
            ))}
          {/* Recent audit events */}
          {auditEvents.slice(0, 5).map((evt, i) => (
            <div
              key={`audit-${i}`}
              className="text-[10px] font-mono text-zinc-600 truncate"
            >
              <span className="text-zinc-500">
                [
                {evt.timestamp
                  ? new Date(evt.timestamp).toLocaleTimeString()
                  : "..."}
                ]
              </span>{" "}
              {evt.eventType || "event"}
            </div>
          ))}
          {cores.every((c) => c.state === "IDLE") &&
            auditEvents.length === 0 && (
              <div className="text-[10px] font-mono text-zinc-600">
                all cores idle
              </div>
            )}
        </div>
      </div>

      {/* Quick governance check */}
      <div className="border-t border-zinc-800 px-3 py-2">
        <button
          onClick={onRunGovernanceCheck}
          className="w-full text-left px-2 py-1.5 rounded text-[10px] font-mono text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors"
        >
          <span className="text-sky-500">&#9655;</span> Quick Governance Check
        </button>
      </div>
    </div>
  );
}
