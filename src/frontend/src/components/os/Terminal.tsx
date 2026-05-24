"use client";

import {
  useEffect,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Terminal as XTerminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";

const PROMPT = "\x1b[38;2;56;189;248mcognivern\x1b[0m \x1b[38;2;113;113;122mos\x1b[0m \x1b[38;2;34;197;94m>\x1b[0m ";

const BOOT_MESSAGES = [
  "\x1b[38;2;113;113;122m[    0.000000] cognivern os v0.1 booting...\x1b[0m",
  "\x1b[38;2;113;113;122m[    0.001247] agent kernel: initialized\x1b[0m",
  "\x1b[38;2;113;113;122m[    0.002103] governance subsystem: online\x1b[0m",
  "\x1b[38;2;113;113;122m[    0.003451] audit trail: connected\x1b[0m",
  "\x1b[38;2;113;113;122m[    0.004102] cre engine: 4 cores detected\x1b[0m",
  "\x1b[38;2;113;113;122m[    0.005200] socket.io: transport ready\x1b[0m",
  "\x1b[38;2;34;197;94m[    0.006000] system ready. type your intent.\x1b[0m",
  "",
];

const SUGGESTED_COMMANDS = [
  "show me active agents",
  "what are the recent audit logs",
  "check governance health score",
  "create a new agent",
  "show performance stats",
  "explain the last execution trace",
  "ls",
  "cat system.conf",
  "audit",
  "status",
];

/** Imperative handle exposed to parent via ref */
export interface TerminalHandle {
  /** Simulate typing a command character-by-character, then press Enter */
  typeCommand: (text: string, charDelay?: number) => Promise<void>;
}

export interface TerminalProps {
  onCommand?: (command: string) => Promise<string>;
  onBoot?: () => void;
}

function clearCurrentInput(term: XTerminal, input: string) {
  for (let i = 0; i < input.length; i++) {
    term.write("\b \b");
  }
}

function getTabCompletion(input: string): string | null {
  if (!input) return null;
  const completions = SUGGESTED_COMMANDS.filter((cmd) =>
    cmd.toLowerCase().startsWith(input.toLowerCase())
  );
  return completions.length === 1 ? completions[0] : null;
}

async function handleLocalCommand(term: XTerminal, cmd: string, writePrompt: () => void, pushPromptAfter = true) {
  const lower = cmd.toLowerCase();

  if (lower === "help") {
    term.writeln("");
    term.writeln("  \x1b[38;2;56;189;248mAvailable commands:\x1b[0m");
    term.writeln("  \x1b[38;2;34;197;94mhelp\x1b[0m         Show this help");
    term.writeln("  \x1b[38;2;34;197;94mclear\x1b[0m        Clear terminal");
    term.writeln("  \x1b[38;2;34;197;94mstatus\x1b[0m       Show system status");
    term.writeln("  \x1b[38;2;34;197;94magents\x1b[0m       List active agents");
    term.writeln("  \x1b[38;2;34;197;94mls\x1b[0m           List virtual filesystem");
    term.writeln("  \x1b[38;2;34;197;94mcat <path>\x1b[0m   Read virtual file");
    term.writeln("  \x1b[38;2;34;197;94mcd <dir>\x1b[0m     Change virtual directory");
    term.writeln("  \x1b[38;2;34;197;94maudit\x1b[0m        Show recent audit logs");
    term.writeln("  \x1b[38;2;34;197;94mhistory\x1b[0m      Show command history");
    term.writeln("  \x1b[38;2;34;197;94msuggest\x1b[0m      Show suggested commands");
    term.writeln("");
    term.writeln("  \x1b[38;2;113;113;122mOr type any natural language command.\x1b[0m");
    term.writeln("");
  } else if (lower === "clear") {
    term.clear();
  } else if (lower === "status") {
    term.writeln("");
    term.writeln("  \x1b[38;2;56;189;248mSystem Status\x1b[0m");
    term.writeln("  \x1b[38;2;113;113;122m────────────────────────\x1b[0m");
    term.writeln("  Kernel:     \x1b[38;2;34;197;94mONLINE\x1b[0m");
    term.writeln("  Governance: \x1b[38;2;34;197;94mONLINE\x1b[0m");
    term.writeln("  Audit:      \x1b[38;2;34;197;94mONLINE\x1b[0m");
    term.writeln("  CRE:        \x1b[38;2;34;197;94mONLINE\x1b[0m");
    term.writeln("");
  } else if (lower === "suggest") {
    term.writeln("");
    term.writeln("  \x1b[38;2;56;189;248mSuggested commands:\x1b[0m");
    SUGGESTED_COMMANDS.forEach((sug) => {
      term.writeln("  \x1b[38;2;34;197;94m>\x1b[0m " + sug);
    });
    term.writeln("");
  } else if (lower === "agents") {
    term.writeln("");
    term.writeln("  \x1b[38;2;56;189;248mFetching agents...\x1b[0m");
    fetch("/api/agents")
      .then((r) => r.json())
      .then((data) => {
        const agents = data.data || [];
        if (agents.length === 0) {
          term.writeln("  \x1b[38;2;113;113;122mNo agents registered.\x1b[0m");
        } else {
          agents.forEach((a: { name: string; status: string; role: string }) => {
            const statusColor = a.status === "active" ? "34;197;94" : a.status === "paused" ? "234;179;8" : "113;113;122";
            term.writeln(`  \x1b[38;2;${statusColor}m[${a.status.toUpperCase()}]\x1b[0m ${a.name} — ${a.role}`);
          });
        }
        term.writeln("");
        writePrompt();
      })
      .catch(() => {
        term.writeln("  \x1b[38;2;239;68;68mFailed to fetch agents.\x1b[0m");
        term.writeln("");
        writePrompt();
      });
    return; // prompt handled in callback
  } else if (lower === "history") {
    term.writeln("");
    commandHistoryStore.forEach((h, i) => {
      term.writeln(`  \x1b[38;2;113;113;122m${i + 1}\x1b[0m  ${h}`);
    });
    term.writeln("");
  } else if (lower.startsWith("ls") || lower === "dir") {
    term.writeln("");
    term.writeln("  \x1b[38;2;56;189;248m/\x1b[0m");
    term.writeln("  \x1b[38;2;34;197;94m├── agents/\x1b[0m        Active agent definitions");
    term.writeln("  \x1b[38;2;34;197;94m├── audit/\x1b[0m         Audit trail & event logs");
    term.writeln("  \x1b[38;2;34;197;94m├── governance/\x1b[0m    Policy engine config");
    term.writeln("  \x1b[38;2;34;197;94m├── runs/\x1b[0m          CRE run ledger");
    term.writeln("  \x1b[38;2;34;197;94m├── policies/\x1b[0m      Governance policies");
    term.writeln("  \x1b[38;2;113;113;122m└── system.conf\x1b[0m   System configuration");
    term.writeln("");
  } else if (lower.startsWith("cat ") || lower.startsWith("read ")) {
    const path = cmd.slice(lower.startsWith("cat ") ? 4 : 5).trim();
    term.writeln("");
    if (path === "system.conf" || path === "/system.conf") {
      term.writeln("  \x1b[38;2;113;113;122m# Cognivern OS Configuration\x1b[0m");
      term.writeln("  version=0.1.0");
      term.writeln("  kernel=agent-kernel-v1");
      term.writeln("  cores=4");
      term.writeln("  governance=enabled");
      term.writeln("  audit=immutable");
      term.writeln("  transport=socket.io");
    } else if (path.startsWith("agents/") || path.startsWith("/agents/")) {
      term.writeln("  \x1b[38;2;56;189;248mFetching agent directory...\x1b[0m");
      try {
        const r = await fetch("/api/agents");
        const data = await r.json();
        const agents = data.data || [];
        if (agents.length === 0) {
          term.writeln("  \x1b[38;2;113;113;122m(empty)\x1b[0m");
        } else {
          agents.forEach((a: { name: string; id: string }) => {
            term.writeln(`  \x1b[38;2;34;197;94m- ${a.name}\x1b[0m (${a.id})`);
          });
        }
      } catch {
        term.writeln("  \x1b[38;2;239;68;68mFailed to read directory.\x1b[0m");
      }
    } else {
      term.writeln(`  \x1b[38;2;234;179;8mNo such file: ${path}\x1b[0m`);
    }
    term.writeln("");
  } else if (lower.startsWith("cd ")) {
    const dir = cmd.slice(3).trim();
    term.writeln("");
    if (dir === "/" || dir === "~") {
      term.writeln("  \x1b[38;2;113;113;122mChanged to /\x1b[0m");
    } else if (["agents", "audit", "governance", "runs", "policies"].includes(dir.replace("/", ""))) {
      term.writeln(`  \x1b[38;2;113;113;122mChanged to /${dir.replace("/", "")}\x1b[0m`);
    } else {
      term.writeln(`  \x1b[38;2;234;179;8mNo such directory: ${dir}\x1b[0m`);
    }
    term.writeln("");
  } else if (lower === "audit") {
    term.writeln("");
    term.writeln("  \x1b[38;2;56;189;248mFetching recent audit logs...\x1b[0m");
    fetch("/api/audit/logs")
      .then((r) => r.json())
      .then((data) => {
        const logs = data.data || [];
        if (logs.length === 0) {
          term.writeln("  \x1b[38;2;113;113;122mNo audit events recorded.\x1b[0m");
        } else {
          logs.slice(0, 8).forEach((log: { eventType?: string; timestamp?: string; details?: Record<string, unknown> }) => {
            const ts = log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : "unknown";
            const type = log.eventType || "event";
            term.writeln(`  \x1b[38;2;113;113;122m[${ts}]\x1b[0m ${type}`);
          });
        }
        term.writeln("");
        writePrompt();
      })
      .catch(() => {
        term.writeln("  \x1b[38;2;239;68;68mFailed to fetch audit logs.\x1b[0m");
        term.writeln("");
        writePrompt();
      });
    return; // prompt handled in callback
  } else {
    term.writeln("");
    term.writeln(`  \x1b[38;2;234;179;8mUnknown command: ${cmd}\x1b[0m`);
    term.writeln(`  \x1b[38;2;113;113;122mType 'help' for available commands.\x1b[0m`);
    term.writeln("");
  }

  if (pushPromptAfter) {
    writePrompt();
  }
}

/** Module-level history store so local command handler can access it */
const commandHistoryStore: string[] = [];

export const Terminal = forwardRef<TerminalHandle, TerminalProps>(
  function Terminal({ onCommand, onBoot }, ref) {
    const terminalRef = useRef<HTMLDivElement>(null);
    const termRef = useRef<XTerminal | null>(null);
    const onCommandRef = useRef(onCommand);
    const onBootRef = useRef(onBoot);
    const commandHistoryIndex = useRef(-1);
    /** Expose programmatic typing to parent (auto-demo, tests) */
    const resolveCommandRef = useRef<((text: string) => void) | null>(null);

    useEffect(() => {
      onCommandRef.current = onCommand;
    }, [onCommand]);

    useEffect(() => {
      onBootRef.current = onBoot;
    }, [onBoot]);

    useImperativeHandle(ref, () => ({
      typeCommand: async (text: string, charDelay = 60) => {
        const term = termRef.current;
        if (!term) return;

        // Wait for any prior command to finish
        if (resolveCommandRef.current) {
          await new Promise<void>((r) => {
            const prev = resolveCommandRef.current;
            resolveCommandRef.current = () => {
              prev?.(text);
              r();
            };
          });
        }

        // Type each character with a visible delay
        for (const ch of text) {
          term.write(ch);
          await new Promise((r) => setTimeout(r, charDelay));
        }

        // Simulate Enter — dispatches through the real onCommand path
        term.writeln("");
        commandHistoryStore.push(text);
        commandHistoryIndex.current = commandHistoryStore.length;

        const handler = onCommandRef.current;
        if (handler) {
          await new Promise<void>((resolve) => {
            resolveCommandRef.current = () => resolve();
            handler(text).then((response) => {
              if (response) {
                term.writeln("");
                response.split("\n").forEach((line) => {
                  term.writeln("  " + line);
                });
                term.writeln("");
              }
              term.write(PROMPT);
              resolveCommandRef.current = null;
              resolve();
            });
          });
        }
      },
    }));

    const writePrompt = useCallback(() => {
      termRef.current?.write(PROMPT);
    }, []);

    useEffect(() => {
      if (!terminalRef.current || termRef.current) return;

      const term = new XTerminal({
        cursorBlink: true,
        cursorStyle: "bar",
        fontFamily: "'Geist Mono', 'SF Mono', 'Fira Code', monospace",
        fontSize: 14,
        lineHeight: 1.4,
        theme: {
          background: "#0a0a0a",
          foreground: "#e4e4e7",
          cursor: "#22c55e",
          cursorAccent: "#0a0a0a",
          selectionBackground: "#38bdf840",
          selectionForeground: "#ffffff",
        },
      });

      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();

      term.loadAddon(fitAddon);
      term.loadAddon(webLinksAddon);
      term.open(terminalRef.current);
      fitAddon.fit();

      termRef.current = term;

      const promptFn = () => term.write(PROMPT);

      // Boot sequence
      let lineIndex = 0;
      const bootInterval = setInterval(() => {
        if (lineIndex < BOOT_MESSAGES.length) {
          term.writeln(BOOT_MESSAGES[lineIndex]);
          lineIndex++;
        } else {
          clearInterval(bootInterval);
          promptFn();
          onBootRef.current?.();
        }
      }, 150);

      // Input handling
      let inputBuffer = "";

      term.onKey(({ key, domEvent }) => {
        const ev = domEvent;
        const printable = !ev.altKey && !ev.ctrlKey && !ev.metaKey;

        if (ev.key === "Enter") {
          ev.preventDefault();
          term.writeln("");

          const trimmed = inputBuffer.trim();
          inputBuffer = "";

          if (trimmed) {
            commandHistoryStore.push(trimmed);
            commandHistoryIndex.current = commandHistoryStore.length;

            const handler = onCommandRef.current;
            if (handler) {
              handler(trimmed).then((response) => {
                if (response) {
                  term.writeln("");
                  response.split("\n").forEach((line) => {
                    term.writeln("  " + line);
                  });
                  term.writeln("");
                }
                promptFn();
              });
              return;
            }

            handleLocalCommand(term, trimmed, promptFn);
          } else {
            promptFn();
          }
        } else if (ev.key === "Backspace") {
          if (inputBuffer.length > 0) {
            inputBuffer = inputBuffer.slice(0, -1);
            term.write("\b \b");
          }
        } else if (ev.key === "ArrowUp") {
          ev.preventDefault();
          if (commandHistoryIndex.current > 0) {
            commandHistoryIndex.current--;
            clearCurrentInput(term, inputBuffer);
            inputBuffer = commandHistoryStore[commandHistoryIndex.current] || "";
            term.write(inputBuffer);
          }
        } else if (ev.key === "ArrowDown") {
          ev.preventDefault();
          if (commandHistoryIndex.current < commandHistoryStore.length - 1) {
            commandHistoryIndex.current++;
            clearCurrentInput(term, inputBuffer);
            inputBuffer = commandHistoryStore[commandHistoryIndex.current] || "";
            term.write(inputBuffer);
          } else {
            commandHistoryIndex.current = commandHistoryStore.length;
            clearCurrentInput(term, inputBuffer);
            inputBuffer = "";
          }
        } else if (ev.key === "Tab") {
          ev.preventDefault();
          const match = getTabCompletion(inputBuffer);
          if (match) {
            clearCurrentInput(term, inputBuffer);
            inputBuffer = match;
            term.write(inputBuffer);
          }
        } else if (ev.ctrlKey && ev.key === "c") {
          term.writeln("^C");
          inputBuffer = "";
          promptFn();
        } else if (ev.ctrlKey && ev.key === "l") {
          term.clear();
          promptFn();
        } else if (printable) {
          inputBuffer += key;
          term.write(key);
        }
      });

      const handleResize = () => fitAddon.fit();
      window.addEventListener("resize", handleResize);

      return () => {
        window.removeEventListener("resize", handleResize);
        term.dispose();
        termRef.current = null;
      };
    }, [writePrompt]);

    return (
      <div ref={terminalRef} className="w-full h-full" />
    );
  }
);
