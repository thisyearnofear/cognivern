"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Terminal, type TerminalHandle } from "./Terminal";
import { AgentGrid } from "./AgentGrid";
import { runAutoDemo } from "./AutoDemo";
import { OsOnboardingOverlay } from "./OsOnboardingOverlay";
import {
  formatIntentError,
  formatIntentResult,
  MOBILE_PROMPT_HINT,
  QUICK_PROMPTS,
} from "./os-content";

export function OsShell() {
  const [booted, setBooted] = useState(false);
  const [demoRunning, setDemoRunning] = useState(false);
  const [commandRunning, setCommandRunning] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [activeIntentType, setActiveIntentType] = useState<string | null>(null);
  const [followUpSuggestions, setFollowUpSuggestions] = useState<string[]>([]);
  const terminalRef = useRef<TerminalHandle>(null);
  const intentResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (intentResetTimeoutRef.current) {
        clearTimeout(intentResetTimeoutRef.current);
      }
    };
  }, []);

  const handleCommand = useCallback(async (command: string): Promise<string> => {
    setCommandRunning(true);

    try {
      const res = await fetch("/api/os/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: command }),
      });

      const data = await res.json();

      if (data.success && data.data) {
        const result = formatIntentResult(data.data);

        setActiveIntentType(result.type);
        setFollowUpSuggestions(result.suggestions);
        if (intentResetTimeoutRef.current) {
          clearTimeout(intentResetTimeoutRef.current);
        }
        intentResetTimeoutRef.current = setTimeout(() => setActiveIntentType(null), 8000);

        return result.output;
      }

      setFollowUpSuggestions([]);
      return formatIntentError(data.error || "Unknown error").output;
    } catch (err) {
      setFollowUpSuggestions([]);
      return formatIntentError(`Failed to process command. ${err instanceof Error ? err.message : ""}`).output;
    } finally {
      setCommandRunning(false);
    }
  }, []);

  const handleBoot = useCallback(() => {
    setBooted(true);
  }, []);

  const runPrompt = useCallback((prompt: string) => {
    setShowOnboarding(false);
    terminalRef.current?.typeCommand(prompt);
  }, []);

  const fillPrompt = useCallback((prompt: string) => {
    setShowOnboarding(false);
    terminalRef.current?.setInputValue(prompt);
  }, []);

  const startDemo = useCallback(() => {
    if (demoRunning || !booted) return;
    setShowOnboarding(false);
    setDemoRunning(true);
    runAutoDemo({
      terminalRef,
      onComplete: () => setDemoRunning(false),
    });
  }, [demoRunning, booted, terminalRef]);

  return (
    <div className="h-screen w-screen bg-[#0a0a0a] text-zinc-300 flex flex-col overflow-hidden">
      {showOnboarding && booted && (
        <OsOnboardingOverlay
          onDismiss={() => setShowOnboarding(false)}
          onRunDemo={startDemo}
          onSelectPrompt={runPrompt}
          disabled={demoRunning || commandRunning}
        />
      )}

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
            disabled={demoRunning || !booted || commandRunning}
            className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${
              demoRunning
                ? "border-emerald-800 text-emerald-500 bg-emerald-950/50"
                : commandRunning
                  ? "border-sky-800 text-sky-400 bg-sky-950/40"
                  : "border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500"
            }`}
          >
            {demoRunning ? "[demo running]" : commandRunning ? "[command running]" : "[auto-demo]"}
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
          <div className="lg:hidden border-t border-zinc-800/60 px-4 py-2 text-[10px] font-mono text-zinc-600">
            {MOBILE_PROMPT_HINT}
          </div>
        </div>

        {/* Starter prompts — hidden on small screens */}
        <div className="hidden lg:flex w-64 shrink-0 flex-col gap-3 p-3 border-r border-zinc-800/60 bg-[#0d0d0d]">
          <div className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider">
            Starter prompts
          </div>
          <div className="space-y-2">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => runPrompt(prompt)}
                disabled={!booted || demoRunning || commandRunning}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-left text-xs font-mono text-zinc-300 hover:border-zinc-600 hover:bg-zinc-900/70 transition-colors disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>
          <div className="text-[10px] font-mono text-zinc-600 leading-relaxed">
            Start with a prompt or run the auto-demo to explore the system.
          </div>

          {followUpSuggestions.length > 0 && (
            <div className="space-y-2 border-t border-zinc-800/60 pt-3">
              <div className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider">
                Follow-up actions
              </div>
              <div className="space-y-2">
                {followUpSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => fillPrompt(suggestion)}
                    disabled={demoRunning || commandRunning}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-left text-xs font-mono text-zinc-400 hover:border-zinc-600 hover:bg-zinc-900/60 transition-colors disabled:opacity-50"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
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
