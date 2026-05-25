'use client';

import { QUICK_PROMPTS } from './os-content';

interface OsOnboardingOverlayProps {
  onDismiss: () => void;
  onRunDemo: () => void;
  onSelectPrompt: (prompt: string) => void;
  disabled?: boolean;
}

export function OsOnboardingOverlay({
  onDismiss,
  onRunDemo,
  onSelectPrompt,
  disabled = false,
}: OsOnboardingOverlayProps) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-[#0d0d0d] p-6 text-zinc-300 shadow-2xl">
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-mono uppercase tracking-[0.3em] text-zinc-500">
              First run
            </div>
            <h2 className="mt-2 text-xl font-semibold text-zinc-100">Inspect Agents Live</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Ask plain-English questions about agent status, audits, and governance health from one
              command center.
            </p>
          </div>
          <button
            onClick={onDismiss}
            className="rounded-md border border-zinc-800 px-3 py-1 text-xs font-mono text-zinc-500 transition-colors hover:border-zinc-600 hover:text-zinc-300"
          >
            dismiss
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
            <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
              Starter prompts
            </div>
            <div className="mt-3 grid gap-2">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => onSelectPrompt(prompt)}
                  disabled={disabled}
                  className="rounded-lg border border-zinc-800 px-3 py-2 text-left text-sm font-mono text-zinc-300 transition-colors hover:border-zinc-600 hover:bg-zinc-900/70 disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
            <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
              Quick start
            </div>
            <ul className="mt-3 space-y-2 text-sm text-zinc-400">
              <li>1. Start with a suggested prompt.</li>
              <li>2. Reuse follow-up actions to go deeper.</li>
              <li>3. Run the demo tour for the full walkthrough.</li>
            </ul>
            <button
              onClick={onRunDemo}
              disabled={disabled}
              className="mt-4 w-full rounded-lg border border-emerald-800 bg-emerald-950/50 px-3 py-2 text-sm font-mono text-emerald-400 transition-colors hover:bg-emerald-950/70 disabled:opacity-50"
            >
              run demo tour
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
