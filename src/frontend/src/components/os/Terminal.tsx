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
import { authFetch } from "@/lib/auth-fetch";

const PROMPT = "cognivern os > ";

const BOOT_MESSAGES = [
  "[    0.000000] cognivern os v0.1 booting...",
  "[    0.001247] agent kernel: initialized",
  "[    0.002103] governance subsystem: online",
  "[    0.003451] audit trail: connected",
  "[    0.004102] cre engine: 4 cores detected",
  "[    0.005200] socket.io: transport ready",
  "[    0.006000] system ready. type your intent.",
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
  setInputValue: (text: string) => void;
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
    cmd.toLowerCase().startsWith(input.toLowerCase()),
  );
  return completions.length === 1 ? completions[0] : null;
}

async function handleLocalCommand(
  term: XTerminal,
  cmd: string,
  writePrompt: () => void,
  pushPromptAfter = true,
) {
  const lower = cmd.toLowerCase();

  if (lower === "help") {
    term.writeln("");
    term.writeln("  Available commands:");
    term.writeln("  help         Show this help");
    term.writeln("  clear        Clear terminal");
    term.writeln("  status       Show system status");
    term.writeln("  agents       List active agents");
    term.writeln("  hydra        Agent memory & recall");
    term.writeln("  ls           List virtual filesystem");
    term.writeln("  cat <path>   Read virtual file");
    term.writeln("  cd <dir>     Change virtual directory");
    term.writeln("  audit        Show recent audit logs");
    term.writeln("  history      Show command history");
    term.writeln("  suggest      Show suggested commands");
    term.writeln("");
    term.writeln(
      "  Memory system: Every command is auto-stored as a HydraDB memory. Use 'hydra search <topic>' to recall previous context.",
    );
    term.writeln("");
  } else if (lower === "clear") {
    term.clear();
  } else if (lower === "status") {
    term.writeln("");
    term.writeln("  System Status");
    term.writeln("  ────────────────────────");
    term.writeln("  Kernel:     ONLINE");
    term.writeln("  Governance: ONLINE");
    term.writeln("  Audit:      ONLINE");
    term.writeln("  CRE:        ONLINE");
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
    authFetch("/api/agents")
      .then((r) => r.json())
      .then((data) => {
        const agents = data.data || [];
        if (agents.length === 0) {
          term.writeln("  \x1b[38;2;113;113;122mNo agents registered.\x1b[0m");
        } else {
          agents.forEach(
            (a: { name: string; status: string; role: string }) => {
              const statusColor =
                a.status === "active"
                  ? "34;197;94"
                  : a.status === "paused"
                    ? "234;179;8"
                    : "113;113;122";
              term.writeln(
                `  \x1b[38;2;${statusColor}m[${a.status.toUpperCase()}]\x1b[0m ${a.name} — ${a.role}`,
              );
            },
          );
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
    term.writeln(
      "  \x1b[38;2;34;197;94m├── agents/\x1b[0m        Active agent definitions",
    );
    term.writeln(
      "  \x1b[38;2;34;197;94m├── audit/\x1b[0m         Audit trail & event logs",
    );
    term.writeln(
      "  \x1b[38;2;34;197;94m├── governance/\x1b[0m    Policy engine config",
    );
    term.writeln(
      "  \x1b[38;2;34;197;94m├── runs/\x1b[0m          CRE run ledger",
    );
    term.writeln(
      "  \x1b[38;2;34;197;94m├── policies/\x1b[0m      Governance policies",
    );
    term.writeln(
      "  \x1b[38;2;113;113;122m└── system.conf\x1b[0m   System configuration",
    );
    term.writeln("");
  } else if (lower.startsWith("cat ") || lower.startsWith("read ")) {
    const path = cmd.slice(lower.startsWith("cat ") ? 4 : 5).trim();
    term.writeln("");
    if (path === "system.conf" || path === "/system.conf") {
      term.writeln(
        "  \x1b[38;2;113;113;122m# Cognivern OS Configuration\x1b[0m",
      );
      term.writeln("  version=0.1.0");
      term.writeln("  kernel=agent-kernel-v1");
      term.writeln("  cores=4");
      term.writeln("  governance=enabled");
      term.writeln("  audit=immutable");
      term.writeln("  transport=socket.io");
    } else if (path.startsWith("agents/") || path.startsWith("/agents/")) {
      term.writeln("  \x1b[38;2;56;189;248mFetching agent directory...\x1b[0m");
      try {
        const r = await authFetch("/api/agents");
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
    } else if (
      ["agents", "audit", "governance", "runs", "policies"].includes(
        dir.replace("/", ""),
      )
    ) {
      term.writeln(
        `  \x1b[38;2;113;113;122mChanged to /${dir.replace("/", "")}\x1b[0m`,
      );
    } else {
      term.writeln(`  \x1b[38;2;234;179;8mNo such directory: ${dir}\x1b[0m`);
    }
    term.writeln("");
  } else if (lower.startsWith("hydra")) {
    const parts = cmd.slice("hydra".length).trim().split(/\s+/);
    const sub = parts[0]?.toLowerCase() || "help";

    if (sub === "help" || sub === "") {
      term.writeln("");
      term.writeln(
        "  \x1b[38;2;56;189;248mHydraDB — Agent Memory & Recall\x1b[0m",
      );
      term.writeln(
        "  \x1b[38;2;113;113;122m────────────────────────────────────────────────────\x1b[0m",
      );
      term.writeln(
        "  \x1b[38;2;34;197;94mhydra status\x1b[0m        Check memory system status",
      );
      term.writeln(
        "  \x1b[38;2;34;197;94mhydra stats\x1b[0m         Memory count + health",
      );
      term.writeln(
        "  \x1b[38;2;34;197;94mhydra recent [N]\x1b[0m   Browse recent memories",
      );
      term.writeln(
        "  \x1b[38;2;34;197;94mhydra search <q>\x1b[0m   Find memories by topic",
      );
      term.writeln(
        "  \x1b[38;2;34;197;94mhydra recall <q>\x1b[0m   Semantic search (alias)",
      );
      term.writeln(
        '  \x1b[38;2;34;197;94mhydra memory "text"\x1b[0m  Store a memory',
      );
      term.writeln(
        "  \x1b[38;2;34;197;94mhydra qna <q>\x1b[0m     Ask against memory",
      );
      term.writeln(
        "  \x1b[38;2;34;197;94mhydra prefs <q>\x1b[0m   Search preferences",
      );
      term.writeln(
        "  \x1b[38;2;34;197;94mhydra help\x1b[0m         Show this help",
      );
      term.writeln("");
      term.writeln(
        "  \x1b[38;2;113;113;122mRequires HYDRA_DB_API_KEY env var. Sign up at app.hydradb.com\x1b[0m",
      );
      term.writeln("");
    } else if (sub === "status") {
      term.writeln("");
      term.writeln("  \x1b[38;2;56;189;248mChecking HydraDB status...\x1b[0m");
      authFetch("/api/os/hydra")
        .then((r) => r.json())
        .then((res) => {
          if (res.success && res.data) {
            const d = res.data;
            const ok = d.configured && d.tenantExists;
            term.writeln(
              `  \x1b[38;2;${ok ? "34;197;94" : "234;179;8"}m[${ok ? "CONNECTED" : "DEGRADED"}]\x1b[0m HydraDB`,
            );
            term.writeln(
              `  \x1b[38;2;113;113;122mTenant:\x1b[0m ${d.tenantId || "(none)"}`,
            );
            term.writeln(
              `  \x1b[38;2;113;113;122mStatus:\x1b[0m ${d.tenantExists ? "ready" : "not found"}`,
            );
            if (d.error)
              term.writeln(`  \x1b[38;2;234;179;8mNote:\x1b[0m ${d.error}`);
          } else {
            term.writeln("  \x1b[38;2;239;68;68mFailed to get status.\x1b[0m");
          }
          term.writeln("");
          writePrompt();
        })
        .catch(() => {
          term.writeln("  \x1b[38;2;239;68;68mHydraDB unreachable.\x1b[0m");
          term.writeln("");
          writePrompt();
        });
      return;
    } else if (sub === "stats") {
      term.writeln("");
      term.writeln("  \x1b[38;2;56;189;248mHydraDB Memory System\x1b[0m");
      term.writeln(
        "  \x1b[38;2;113;113;122m─────────────────────────────────────\x1b[0m",
      );

      // Fetch status + recent memories in parallel
      Promise.all([
        authFetch("/api/os/hydra"),
        authFetch("/api/os/hydra", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "recent", limit: 3 }),
        }),
      ])
        .then(async ([statusRes, recentRes]) => {
          const statusData = (await statusRes.json()).data;
          const recentData = (await recentRes.json()).data;

          if (statusData) {
            const ok = statusData.configured && statusData.tenantExists;
            term.writeln(
              `  \x1b[38;2;${ok ? "34;197;94" : "234;179;8"}m[${
                ok ? "ACTIVE" : "INACTIVE"
              }]\x1b[0m Memory System`,
            );
            term.writeln(
              `  \x1b[38;2;113;113;122mTenant ID:  \x1b[0m${statusData.tenantId || "—"}`,
            );
            term.writeln(
              `  \x1b[38;2;113;113;122mConnection: \x1b[0m${
                statusData.configured
                  ? "\u2705 configured"
                  : "\u274c not configured"
              }`,
            );
            term.writeln(
              `  \x1b[38;2;113;113;122mTenant:     \x1b[0m${statusData.tenantExists ? "\u2705 exists" : "\u26a0 not found"}`,
            );
          }

          if (
            recentData?.results &&
            Array.isArray(recentData.results) &&
            recentData.results.length > 0
          ) {
            term.writeln("");
            term.writeln(
              `  \x1b[38;2;113;113;122mRecent memories (#${recentData.results.length} shown):\x1b[0m`,
            );
            recentData.results.forEach((r: { text?: string }) => {
              const display =
                (r.text || "").length > 60
                  ? (r.text || "").slice(0, 60) + "..."
                  : r.text || "";
              term.writeln(`    \x1b[38;2;34;197;94m\u2022\x1b[0m ${display}`);
            });
          }
          term.writeln("");
          term.writeln(
            "  \x1b[38;2;113;113;122mTip: 'hydra recent 10' to see more, 'hydra search <topic>' to find specific memories.\x1b[0m",
          );
          term.writeln("");
          writePrompt();
        })
        .catch(() => {
          term.writeln(
            "  \x1b[38;2;239;68;68mFailed to fetch memory system stats.\x1b[0m",
          );
          term.writeln("");
          writePrompt();
        });
      return;
    } else if (sub === "recent") {
      const limit = Math.min(Math.max(1, parseInt(parts[1], 10) || 5), 20);
      term.writeln("");
      term.writeln(
        `  \x1b[38;2;56;189;248mRecent memories \x1b[0m(limit: ${limit})`,
      );
      authFetch("/api/os/hydra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "recent", limit }),
      })
        .then((r) => r.json())
        .then((res) => {
          if (res.success && res.data?.results) {
            const results = res.data.results;
            if (Array.isArray(results) && results.length > 0) {
              results.forEach((r: { text?: string; score?: number }) => {
                term.writeln(
                  `  \x1b[38;2;34;197;94m\u2022\x1b[0m ${r.text || "(empty)"}`,
                );
              });
            } else {
              term.writeln(
                "  \x1b[38;2;113;113;122mNo memories stored yet. Run commands to auto-store them.\x1b[0m",
              );
            }
          } else {
            term.writeln(
              `  \x1b[38;2;239;68;68mFailed: ${res.error || "unknown"}\x1b[0m`,
            );
          }
          term.writeln("");
          writePrompt();
        })
        .catch(() => {
          term.writeln("  \x1b[38;2;239;68;68mHydraDB unreachable.\x1b[0m");
          term.writeln("");
          writePrompt();
        });
      return;
    } else if (sub === "recall" || sub === "search") {
      const query = parts.slice(1).join(" ");
      if (!query) {
        const cmdName = sub === "search" ? "search" : "recall";
        term.writeln("");
        term.writeln(
          `  \x1b[38;2;234;179;8mUsage: hydra ${cmdName} <search query>\x1b[0m`,
        );
        term.writeln(
          `  \x1b[38;2;113;113;122mExample: hydra ${cmdName} "what did I ask about governance"\x1b[0m`,
        );
        term.writeln("");
      } else {
        term.writeln("");
        term.writeln(
          `  \x1b[38;2;56;189;248mSearching memories for:\x1b[0m ${query}`,
        );
        authFetch("/api/os/hydra", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "recall", query }),
        })
          .then((r) => r.json())
          .then((res) => {
            if (res.success && res.data?.results) {
              const results = res.data.results;
              if (Array.isArray(results) && results.length > 0) {
                results.forEach((r: { text?: string; score?: number }) => {
                  const score =
                    r.score != null ? ` [${(r.score * 100).toFixed(0)}%]` : "";
                  term.writeln(
                    `  \x1b[38;2;34;197;94m•\x1b[0m ${r.text || "(empty)"}${score}`,
                  );
                });
              } else {
                term.writeln(
                  "  \x1b[38;2;113;113;122mNo relevant memories found.\x1b[0m",
                );
              }
            } else {
              term.writeln(
                `  \x1b[38;2;239;68;68mRecall failed: ${res.error || "unknown"}\x1b[0m`,
              );
            }
            term.writeln("");
            writePrompt();
          })
          .catch(() => {
            term.writeln("  \x1b[38;2;239;68;68mHydraDB unreachable.\x1b[0m");
            term.writeln("");
            writePrompt();
          });
        return;
      }
    } else if (sub === "memory" || sub === "remember") {
      const text = parts.slice(1).join(" ");
      if (!text) {
        term.writeln("");
        term.writeln(
          '  \x1b[38;2;234;179;8mUsage: hydra memory "<text to remember>"\x1b[0m',
        );
        term.writeln("");
      } else {
        term.writeln("");
        term.writeln("  \x1b[38;2;56;189;248mStoring memory...\x1b[0m");
        authFetch("/api/os/hydra", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "memory", text, title: "CLI memory" }),
        })
          .then((r) => r.json())
          .then((res) => {
            if (res.success) {
              term.writeln("  \x1b[38;2;34;197;94mMemory stored.\x1b[0m");
            } else {
              term.writeln(
                `  \x1b[38;2;239;68;68mFailed: ${res.error || "unknown"}\x1b[0m`,
              );
            }
            term.writeln("");
            writePrompt();
          })
          .catch(() => {
            term.writeln("  \x1b[38;2;239;68;68mHydraDB unreachable.\x1b[0m");
            term.writeln("");
            writePrompt();
          });
        return;
      }
    } else if (sub === "qna") {
      const question = parts.slice(1).join(" ");
      if (!question) {
        term.writeln("");
        term.writeln(
          "  \x1b[38;2;234;179;8mUsage: hydra qna <question>\x1b[0m",
        );
        term.writeln("");
      } else {
        term.writeln("");
        term.writeln(`  \x1b[38;2;56;189;248mQ&A — ${question}\x1b[0m`);
        authFetch("/api/os/hydra", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "qna", question }),
        })
          .then((r) => r.json())
          .then((res) => {
            if (res.success && res.data?.answer) {
              const answer = res.data.answer;
              try {
                const parsed = JSON.parse(answer);
                term.writeln(
                  `  \x1b[38;2;34;197;94mAnswer:\x1b[0m ${parsed.answer || JSON.stringify(parsed)}`,
                );
              } catch {
                term.writeln(`  \x1b[38;2;34;197;94mAnswer:\x1b[0m ${answer}`);
              }
            } else {
              term.writeln(
                `  \x1b[38;2;239;68;68mQ&A failed: ${res.error || "unknown"}\x1b[0m`,
              );
            }
            term.writeln("");
            writePrompt();
          })
          .catch(() => {
            term.writeln("  \x1b[38;2;239;68;68mHydraDB unreachable.\x1b[0m");
            term.writeln("");
            writePrompt();
          });
        return;
      }
    } else if (sub === "prefs" || sub === "preferences") {
      const query = parts.slice(1).join(" ");
      if (!query) {
        term.writeln("");
        term.writeln(
          "  \x1b[38;2;234;179;8mUsage: hydra prefs <search query>\x1b[0m",
        );
        term.writeln("");
      } else {
        term.writeln("");
        term.writeln(
          `  \x1b[38;2;56;189;248mSearching preferences for:\x1b[0m ${query}`,
        );
        authFetch("/api/os/hydra", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "preferences", query }),
        })
          .then((r) => r.json())
          .then((res) => {
            if (res.success && res.data?.results) {
              const results = res.data.results;
              if (Array.isArray(results) && results.length > 0) {
                results.forEach((r: { text?: string; score?: number }) => {
                  const score =
                    r.score != null ? ` [${(r.score * 100).toFixed(0)}%]` : "";
                  term.writeln(
                    `  \x1b[38;2;34;197;94m•\x1b[0m ${r.text || "(empty)"}${score}`,
                  );
                });
              } else {
                term.writeln(
                  "  \x1b[38;2;113;113;122mNo preferences found.\x1b[0m",
                );
              }
            } else {
              term.writeln(
                `  \x1b[38;2;239;68;68mFailed: ${res.error || "unknown"}\x1b[0m`,
              );
            }
            term.writeln("");
            writePrompt();
          })
          .catch(() => {
            term.writeln("  \x1b[38;2;239;68;68mHydraDB unreachable.\x1b[0m");
            term.writeln("");
            writePrompt();
          });
        return;
      }
    } else {
      term.writeln("");
      term.writeln(
        `  \x1b[38;2;234;179;8mUnknown hydra subcommand: ${sub}\x1b[0m`,
      );
      term.writeln(
        `  \x1b[38;2;113;113;122mType 'hydra help' for available commands.\x1b[0m`,
      );
      term.writeln("");
    }
  } else if (lower === "audit") {
    term.writeln("");
    term.writeln("  \x1b[38;2;56;189;248mFetching recent audit logs...\x1b[0m");
    authFetch("/api/audit/logs")
      .then((r) => r.json())
      .then((data) => {
        const logs = data.data || [];
        if (logs.length === 0) {
          term.writeln(
            "  \x1b[38;2;113;113;122mNo audit events recorded.\x1b[0m",
          );
        } else {
          logs
            .slice(0, 8)
            .forEach(
              (log: {
                eventType?: string;
                timestamp?: string;
                details?: Record<string, unknown>;
              }) => {
                const ts = log.timestamp
                  ? new Date(log.timestamp).toLocaleTimeString()
                  : "unknown";
                const type = log.eventType || "event";
                term.writeln(`  \x1b[38;2;113;113;122m[${ts}]\x1b[0m ${type}`);
              },
            );
        }
        term.writeln("");
        writePrompt();
      })
      .catch(() => {
        term.writeln(
          "  \x1b[38;2;239;68;68mFailed to fetch audit logs.\x1b[0m",
        );
        term.writeln("");
        writePrompt();
      });
    return; // prompt handled in callback
  } else {
    term.writeln("");
    term.writeln(`  \x1b[38;2;234;179;8mUnknown command: ${cmd}\x1b[0m`);
    term.writeln(
      `  \x1b[38;2;113;113;122mType 'help' for available commands.\x1b[0m`,
    );
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
    const inputBufferRef = useRef("");
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
        inputBufferRef.current = "";

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
      setInputValue: (text: string) => {
        const term = termRef.current;
        if (!term) return;

        clearCurrentInput(term, inputBufferRef.current);
        inputBufferRef.current = text;
        term.write(text);
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
      term.onKey(({ key, domEvent }) => {
        const ev = domEvent;
        const printable = !ev.altKey && !ev.ctrlKey && !ev.metaKey;

        if (ev.key === "Enter") {
          ev.preventDefault();
          term.writeln("");

          const trimmed = inputBufferRef.current.trim();
          inputBufferRef.current = "";

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
          if (inputBufferRef.current.length > 0) {
            inputBufferRef.current = inputBufferRef.current.slice(0, -1);
            term.write("\b \b");
          }
        } else if (ev.key === "ArrowUp") {
          ev.preventDefault();
          if (commandHistoryIndex.current > 0) {
            commandHistoryIndex.current--;
            clearCurrentInput(term, inputBufferRef.current);
            inputBufferRef.current =
              commandHistoryStore[commandHistoryIndex.current] || "";
            term.write(inputBufferRef.current);
          }
        } else if (ev.key === "ArrowDown") {
          ev.preventDefault();
          if (commandHistoryIndex.current < commandHistoryStore.length - 1) {
            commandHistoryIndex.current++;
            clearCurrentInput(term, inputBufferRef.current);
            inputBufferRef.current =
              commandHistoryStore[commandHistoryIndex.current] || "";
            term.write(inputBufferRef.current);
          } else {
            commandHistoryIndex.current = commandHistoryStore.length;
            clearCurrentInput(term, inputBufferRef.current);
            inputBufferRef.current = "";
          }
        } else if (ev.key === "Tab") {
          ev.preventDefault();
          const match = getTabCompletion(inputBufferRef.current);
          if (match) {
            clearCurrentInput(term, inputBufferRef.current);
            inputBufferRef.current = match;
            term.write(inputBufferRef.current);
          }
        } else if (ev.ctrlKey && ev.key === "c") {
          term.writeln("^C");
          inputBufferRef.current = "";
          promptFn();
        } else if (ev.ctrlKey && ev.key === "l") {
          term.clear();
          promptFn();
        } else if (printable) {
          inputBufferRef.current += key;
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

    return <div ref={terminalRef} className="w-full h-full" />;
  },
);
