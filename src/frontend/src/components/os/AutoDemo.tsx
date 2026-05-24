"use client";

import type { TerminalHandle } from "./Terminal";

const DEMO_COMMANDS = [
  { text: "show me active agents", pause: 4000 },
  { text: "check governance health score", pause: 5000 },
  { text: "create a new trading agent for DeFi", pause: 5000 },
  { text: "show performance stats", pause: 4000 },
  { text: "explain the last execution trace", pause: 5000 },
];

interface AutoDemoOptions {
  terminalRef: React.RefObject<TerminalHandle | null>;
  onComplete?: () => void;
}

export async function runAutoDemo({ terminalRef, onComplete }: AutoDemoOptions) {
  for (const cmd of DEMO_COMMANDS) {
    const handle = terminalRef.current;
    if (!handle) break;
    await handle.typeCommand(cmd.text, 55);
    await new Promise((r) => setTimeout(r, cmd.pause));
  }
  onComplete?.();
}

export { DEMO_COMMANDS };
