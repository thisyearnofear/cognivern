'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Terminal, type TerminalHandle } from './Terminal';
import { AgentGrid } from './AgentGrid';
import { runAutoDemo } from './AutoDemo';
import { OsOnboardingOverlay } from './OsOnboardingOverlay';
import {
  formatIntentError,
  formatIntentResult,
  MAX_RECENT_PROMPTS,
  MOBILE_PROMPT_HINT,
  ONBOARDING_STORAGE_KEY,
  QUICK_PROMPTS,
  RECENT_PROMPTS_STORAGE_KEY,
} from './os-content';

interface HydraDBStatusData {
  configured: boolean;
  tenantExists: boolean;
  error?: string;
}

function readStoredBoolean(key: string) {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(key) === 'true';
}

function readStoredPrompts() {
  if (typeof window === 'undefined') return [] as string[];

  try {
    const raw = window.localStorage.getItem(RECENT_PROMPTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string')
      : [];
  } catch {
    return [];
  }
}

function storeRecentPrompts(prompts: string[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(RECENT_PROMPTS_STORAGE_KEY, JSON.stringify(prompts));
}

function buildRecentPrompts(current: string[], prompt: string) {
  return [prompt, ...current.filter((item) => item !== prompt)].slice(0, MAX_RECENT_PROMPTS);
}

export function OsShell() {
  const [booted, setBooted] = useState(false);
  const [demoRunning, setDemoRunning] = useState(false);
  const [commandRunning, setCommandRunning] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(
    () => !readStoredBoolean(ONBOARDING_STORAGE_KEY),
  );
  const [recentPrompts, setRecentPrompts] = useState<string[]>(() => readStoredPrompts());
  const [activeIntentType, setActiveIntentType] = useState<string | null>(null);
  const [followUpSuggestions, setFollowUpSuggestions] = useState<string[]>([]);
  const [showWelcomeBack, setShowWelcomeBack] = useState(() =>
    readStoredBoolean(ONBOARDING_STORAGE_KEY),
  );
  const [welcomeBackFading, setWelcomeBackFading] = useState(false);
  const [hydraStatus, setHydraStatus] = useState<HydraDBStatusData | null>(null);
  const terminalRef = useRef<TerminalHandle>(null);
  const intentResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!showOnboarding) {
      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    }
  }, [showOnboarding]);

  // Fetch HydraDB status and recent memories on mount
  useEffect(() => {
    Promise.all([
      fetch('/api/os/hydra'),
      fetch('/api/os/hydra', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'recent', limit: 3 }),
      }).catch(() => null),
    ])
      .then(async ([statusRes, recentRes]) => {
        const statusData = (await statusRes.json()).data;
        if (statusData) {
          setHydraStatus(statusData);
        }
        // Memory count available via the side-panel Memory feed
      })
      .catch(() => {
        // HydraDB not configured or unreachable — leave status as null
      });
  }, []);

  useEffect(() => {
    if (showWelcomeBack) {
      const fadeTimer = setTimeout(() => setWelcomeBackFading(true), 4500);
      const removeTimer = setTimeout(() => {
        setShowWelcomeBack(false);
        setWelcomeBackFading(false);
      }, 5000);
      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(removeTimer);
      };
    }
  }, [showWelcomeBack]);

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
      const res = await fetch('/api/os/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

        // Fire-and-forget: store the command as a HydraDB memory
        fetch('/api/os/hydra', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'memory',
            text: `[intent] ${command}`,
            title: `OS Command: ${command.slice(0, 60)}${command.length > 60 ? '...' : ''}`,
          }),
        }).catch(() => {
          // Memory storage is best-effort
        });

        return result.output;
      }

      setFollowUpSuggestions([]);
      return formatIntentError(data.error || 'Unknown error').output;
    } catch (err) {
      setFollowUpSuggestions([]);
      return formatIntentError(
        `Failed to process command. ${err instanceof Error ? err.message : ''}`,
      ).output;
    } finally {
      setCommandRunning(false);
    }
  }, []);

  const handleBoot = useCallback(() => {
    setBooted(true);
  }, []);

  const runPrompt = useCallback((prompt: string) => {
    setShowOnboarding(false);
    setRecentPrompts((current) => {
      const next = buildRecentPrompts(current, prompt);
      storeRecentPrompts(next);
      return next;
    });
    terminalRef.current?.typeCommand(prompt);
  }, []);

  const fillPrompt = useCallback((prompt: string) => {
    setShowOnboarding(false);
    terminalRef.current?.setInputValue(prompt);
  }, []);

  const clearRecentPrompts = useCallback(() => {
    setRecentPrompts([]);
    storeRecentPrompts([]);
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
          <span className="text-xs font-mono text-zinc-500">agent command center v0.1</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={startDemo}
            disabled={demoRunning || !booted || commandRunning}
            className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${
              demoRunning
                ? 'border-emerald-800 text-emerald-500 bg-emerald-950/50'
                : commandRunning
                  ? 'border-sky-800 text-sky-400 bg-sky-950/40'
                  : 'border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500'
            }`}
          >
            {demoRunning ? '[demo running]' : commandRunning ? '[command running]' : '[auto-demo]'}
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

      {/* Welcome-back banner for returning users */}
      {showWelcomeBack && (
        <div
          className={`flex items-center justify-center gap-3 px-4 py-1.5 bg-emerald-950/25 border-b border-emerald-900/40 transition-all duration-500 ${
            welcomeBackFading ? 'opacity-0 translate-y-[-4px]' : 'opacity-100 translate-y-0'
          }`}
        >
          <span className="text-xs font-mono text-emerald-400/80">Welcome back</span>
          <span className="text-[10px] font-mono text-emerald-500/50">&middot;</span>
          {recentPrompts.length > 0 && (
            <>
              <span className="text-xs font-mono text-emerald-400/80">
                {recentPrompts.length} recent prompt{recentPrompts.length === 1 ? '' : 's'} ready
              </span>
              <span className="text-[10px] font-mono text-emerald-500/50">&middot;</span>
            </>
          )}
          {hydraStatus?.configured && (
            <span className="text-[10px] font-mono text-emerald-500/60">memory active</span>
          )}
          {!hydraStatus?.configured && hydraStatus !== null && (
            <span className="text-[10px] font-mono text-amber-500/60">
              memory: configure HYDRA_DB_API_KEY
            </span>
          )}
        </div>
      )}

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
            Start with a prompt or run the demo tour to inspect agents, audits, and governance
            health.
          </div>

          {recentPrompts.length > 0 && (
            <div className="space-y-2 border-t border-zinc-800/60 pt-3">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider">
                  Recent prompts
                </div>
                <button
                  onClick={clearRecentPrompts}
                  className="text-[9px] font-mono text-zinc-700 hover:text-zinc-400 transition-colors"
                >
                  [clear]
                </button>
              </div>
              <div className="space-y-2">
                {recentPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => runPrompt(prompt)}
                    disabled={!booted || demoRunning || commandRunning}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-left text-xs font-mono text-zinc-400 hover:border-zinc-600 hover:bg-zinc-900/60 transition-colors disabled:opacity-50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

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
        <div className="hidden md:flex w-80 shrink-0 flex-col bg-[#0d0d0d] border-zinc-800/60">
          <AgentGrid activeIntentType={activeIntentType} />
        </div>
      </div>

      {/* Bottom status bar */}
      <footer className="flex items-center justify-between px-4 py-1.5 border-t border-zinc-800/60 bg-[#0a0a0a] shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-zinc-600">
            {booted ? 'ready' : 'booting...'}
          </span>
          {hydraStatus && (
            <span className="flex items-center gap-1.5 text-[10px] font-mono">
              <span
                className={`inline-block w-1.5 h-1.5 rounded-full ${
                  hydraStatus.configured && hydraStatus.tenantExists
                    ? 'bg-emerald-500'
                    : 'bg-amber-500'
                }`}
              />
              <span
                className={
                  hydraStatus.configured && hydraStatus.tenantExists
                    ? 'text-emerald-500/70'
                    : 'text-amber-500/70'
                }
              >
                hydra
              </span>
            </span>
          )}
        </div>
        <span className="text-[10px] font-mono text-zinc-700">
          TAB: autocomplete &middot; UP/DOWN: history &middot; CTRL+L: clear &middot; hydra: memory
        </span>
      </footer>
    </div>
  );
}
