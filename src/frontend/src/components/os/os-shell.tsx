"use client";

import { useState, useCallback, useRef } from "react";
import { Terminal, type TerminalHandle } from "./Terminal";
import { AgentGrid } from "./AgentGrid";
import { runAutoDemo } from "./AutoDemo";

export function OsShell() {
  const [booted, setBooted] = useState(false);
  const [demoRunning, setDemoRunning] = useState(false);
  const [activeIntentType, setActiveIntentType] = useState<string | null>(null);
  const terminalRef = useRef<TerminalHandle>(null);

  const handleCommand = useCallback(async (command: string): Promise<string> => {
    try {
      const res = await fetch("/api/os/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: command }),
      });

      const data = await res.json();

      if (data.success && data.data) {
        const { type, response, suggestions } = data.data;

        setActiveIntentType(type);
        setTimeout(() => setActiveIntentType(null), 8000);

        const lines: string[] = [];
        const typeColors: Record<string, string> = {
          forensic: "\x1b[38;2;168;85;247m",
          governance: "\x1b[38;2;56;189;248m",
          agent: "\x1b[38;2;34;197;94m",
          risk: "\x1b[38;2;239;68;68m",
          policy: "\x1b[38;2;234;179;8m",
          stats: "\x1b[38;2;56;189;248m",
          create: "\x1b[38;2;34;197;94m",
          unknown: "\x1b[38;2;113;113;122m",
        };

        const color = typeColors[type] || typeColors.unknown;
        lines.push(`${color}[${type.toUpperCase()}]\x1b[0m ${response}`);

        if (suggestions && suggestions.length > 0) {
          lines.push("");
          lines.push("\x1b[38;2;113;113;122mSuggestions:\x1b[0m");
          suggestions.forEach((s: string) => {
            lines.push(`  \x1b[38;2;34;197;94m>\x1b[0m ${s}`);
          });
        }

        return lines.join("\n");
      }

      return "\x1b[38;2;239;68;68mError: " + (data.error || "Unknown error") + "\x1b[0m";
    } catch (err) {
      return `\x1b[38;2;239;68;68mError: Failed to process command. ${err instanceof Error ? err.message : ""}\x1b[0m`;
    }
  }, []);

  const handleBoot = useCallback(() => {
    setBooted(true);
  }, []);

  const startDemo = useCallback(() => {
    if (demoRunning || !booted) return;
    setDemoRunning(true);
    runAutoDemo({
      terminalRef,
      onComplete: () => setDemoRunning(false),
    });
  }, [demoRunning, booted, terminalRef]);

  return (
    <div className="h-screen w-screen bg-[#0a0a0a] text-zinc-300 flex flex-col overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-zinc-800/60 bg-[#0a0a0a] shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
          </div>
          <span className="text-xs font-mono text-zinc-500">
            cognivern os v0.1
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={startDemo}
            disabled={demoRunning || !booted}
            className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${
              demoRunning
                ? "border-emerald-800 text-emerald-500 bg-emerald-950/50"
                : "border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500"
            }`}
          >
            {demoRunning ? "[demo running]" : "[auto-demo]"}
          </button>
          <span className="text-[10px] font-mono text-zinc-600">
            {new Date().toLocaleTimeString()}
          </span>
          <a
            href="/dashboard"
            className="text-[10px] font-mono text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            [dashboard]
          </a>
        </div>
      </header>

      {/* Main area */}
      <div className="flex-1 flex min-h-0">
        {/* Terminal panel */}
        <div className="flex-1 flex flex-col min-h-0 border-r border-zinc-800/60">
          <Terminal ref={terminalRef} onCommand={handleCommand} onBoot={handleBoot} />
        </div>

        {/* Agent grid panel — hidden on small screens */}
        <div
          className="hidden md:flex w-80 shrink-0 flex-col bg-[#0d0d0d] border-zinc-800/60"
        >
          <AgentGrid activeIntentType={activeIntentType} />
        </div>
      </div>

      {/* Bottom status bar */}
      <footer className="flex items-center justify-between px-4 py-1.5 border-t border-zinc-800/60 bg-[#0a0a0a] shrink-0">
        <span className="text-[10px] font-mono text-zinc-600">
          {booted ? "ready" : "booting..."}
        </span>
        <span className="text-[10px] font-mono text-zinc-700">
          TAB: autocomplete &middot; UP/DOWN: history &middot; CTRL+L: clear
        </span>
      </footer>
    </div>
  );
}
