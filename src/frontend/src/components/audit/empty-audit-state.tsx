'use client';

import { useEffect, useState } from 'react';
import { FileSearch, PlayCircle, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';

/* ─── Terminal typewriter hook ───────────────────────────────── */

function useTypewriter(lines: string[], speed = 40, initialDelay?: number) {
  const [displayed, setDisplayed] = useState<string[]>([]);
  const [currentLine, setCurrentLine] = useState(0);
  const [currentChar, setCurrentChar] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const timer = setTimeout(
      () => {
        if (currentLine >= lines.length) {
          setDone(true);
          return;
        }
        const line = lines[currentLine];
        if (currentChar < line.length) {
          setDisplayed((prev) => {
            const copy = [...prev];
            if (copy.length <= currentLine) copy.push('');
            copy[currentLine] = line.slice(0, currentChar + 1);
            return copy;
          });
          setCurrentChar((c) => c + 1);
        } else {
          setCurrentLine((l) => l + 1);
          setCurrentChar(0);
        }
      },
      currentChar === 0 && currentLine === 0
        ? (initialDelay ?? speed)
        : currentChar === 0 && currentLine > 0
          ? speed * 8
          : speed,
    );
    return () => clearTimeout(timer);
  }, [currentLine, currentChar, initialDelay, lines, speed]);

  return { displayed, done };
}

/* ─── Empty state with terminal typewriter ───────────────────── */

/**
 * Shown when the audit trail has no decisions yet. The typewriter terminal
 * shows the exact API call that produces the first record, so the empty state
 * is also the onboarding step.
 */
export function EmptyAuditState({ onRunCheck }: { onRunCheck: () => void }) {
  const terminalLines = [
    '$ curl -X POST https://api.cognivern.persidian.com/api/governance/evaluate \\',
    '  -H "Content-Type: application/json" \\',
    '  -H "x-api-key: $KEY" \\',
    '  -d \'{"agentId":"demo","action":{"type":"spend","amount":50,"currency":"USDC"}}\'',
    '',
    '→ Waiting for first agent action...',
    '→ No audit logs yet.',
    '→ Create an API identity or run a check to get started.',
  ];

  const { displayed: terminalOutput, done: terminalDone } = useTypewriter(terminalLines, 30, 400);

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="p-6 sm:p-8 text-center space-y-4">
        <div className="max-w-md mx-auto">
          {/* Terminal widget */}
          <div className="rounded-lg border border-border bg-[#0A0A0A] dark:bg-black overflow-hidden text-left mb-6 shadow-lg">
            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
              <span className="ml-2 text-[10px] text-white/40 font-medium">cognivern — audit</span>
            </div>
            <pre
              className="p-4 text-sm leading-relaxed text-white/80 min-h-[120px]"
              style={{ fontFamily: 'var(--font-jetbrains-mono, var(--font-geist-mono))' }}
            >
              {terminalOutput.map((line, i) => (
                <div key={i} className="whitespace-pre">
                  {line.startsWith('→') ? (
                    <span className="text-amber-400/90">{line}</span>
                  ) : line.startsWith('$') ? (
                    <span>
                      <span className="text-emerald-400">$</span>
                      {line.slice(1)}
                    </span>
                  ) : (
                    line
                  )}
                </div>
              ))}
              {!terminalDone && (
                <span className="inline-block w-2 h-4 bg-white/60 ml-0.5 animate-pulse" />
              )}
            </pre>
          </div>

          <FileSearch className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
          <p className="font-medium text-foreground">No audit logs yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Activity will appear here as governed systems execute spends.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Button variant="default" size="sm" onClick={onRunCheck}>
            <PlayCircle className="h-3.5 w-3.5 mr-1.5" /> Run a Check
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.open('/agents/workshop', '_self')}
          >
            <Terminal className="h-3.5 w-3.5 mr-1.5" /> Create API identity
          </Button>
        </div>
      </div>
    </div>
  );
}
