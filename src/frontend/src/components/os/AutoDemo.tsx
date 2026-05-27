"use client";

import type { TerminalHandle } from "./Terminal";
import { QUICK_PROMPTS } from "./os-content";

const DEMO_COMMANDS = [
  // 1. Show the memory system is alive
  { text: "hydra status", pause: 3000 },
  // 2. Check what memories already exist
  { text: "hydra recent 5", pause: 3000 },
  // 3. Run a real intent — auto-stored as memory
  { text: QUICK_PROMPTS[0], pause: 4000 },
  // 4. Another intent — builds the memory graph
  { text: QUICK_PROMPTS[1], pause: 5000 },
  // 5. Create an agent — this is what judges want to see
  { text: "create a new trading agent for DeFi", pause: 5000 },
  // 6. Show performance stats
  { text: QUICK_PROMPTS[3], pause: 4000 },
  // 7. Explicitly store a user preference
  {
    text: 'hydra memory "I prefer detailed explanations with data tables"',
    pause: 3000,
  },
  // 8. Now recall — demonstrate that HydraDB remembers across intents
  { text: 'hydra search "what kind of explanations do I prefer"', pause: 4000 },
  // 9. Show memory system health with recent context
  { text: "hydra stats", pause: 4000 },
];

interface AutoDemoOptions {
  terminalRef: React.RefObject<TerminalHandle | null>;
  onComplete?: () => void;
}

export async function runAutoDemo({
  terminalRef,
  onComplete,
}: AutoDemoOptions) {
  for (const cmd of DEMO_COMMANDS) {
    const handle = terminalRef.current;
    if (!handle) break;
    await handle.typeCommand(cmd.text, 55);
    await new Promise((r) => setTimeout(r, cmd.pause));
  }
  onComplete?.();
}

export { DEMO_COMMANDS };
