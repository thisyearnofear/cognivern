export interface OsIntentData {
  type: string;
  response: string;
  suggestions?: string[];
}

export interface OsCommandResult {
  output: string;
  suggestions: string[];
  type: string | null;
}

const INTENT_TYPE_COLORS: Record<string, string> = {
  forensic: "\x1b[38;2;168;85;247m",
  governance: "\x1b[38;2;56;189;248m",
  agent: "\x1b[38;2;34;197;94m",
  risk: "\x1b[38;2;239;68;68m",
  policy: "\x1b[38;2;234;179;8m",
  stats: "\x1b[38;2;56;189;248m",
  create: "\x1b[38;2;34;197;94m",
  unknown: "\x1b[38;2;113;113;122m",
};

export const QUICK_PROMPTS = [
  "show me active agents",
  "check governance health score",
  "create a new agent",
  "show performance stats",
  "hydra status",
  "hydra help",
] as const;

export const RECENT_PROMPTS_STORAGE_KEY = "cognivern-os-recent-prompts";
export const ONBOARDING_STORAGE_KEY = "cognivern-os-onboarding-dismissed";
export const MAX_RECENT_PROMPTS = 5;

export const MOBILE_PROMPT_HINT =
  "Try: show me active agents · check governance health · hydra status · show performance stats";

export function formatIntentOutput(intent: OsIntentData): string {
  const color = INTENT_TYPE_COLORS[intent.type] || INTENT_TYPE_COLORS.unknown;
  const lines = [
    `${color}[${intent.type.toUpperCase()}]\x1b[0m ${intent.response}`,
  ];

  if (intent.suggestions && intent.suggestions.length > 0) {
    lines.push("");
    lines.push("\x1b[38;2;113;113;122mSuggestions:\x1b[0m");
    intent.suggestions.forEach((suggestion) => {
      lines.push(`  \x1b[38;2;34;197;94m>\x1b[0m ${suggestion}`);
    });
  }

  return lines.join("\n");
}

export function formatIntentResult(intent: OsIntentData): OsCommandResult {
  return {
    output: formatIntentOutput(intent),
    suggestions: intent.suggestions || [],
    type: intent.type,
  };
}

export function formatIntentError(error: string): OsCommandResult {
  return {
    output: `\x1b[38;2;239;68;68mError: ${error}\x1b[0m`,
    suggestions: [],
    type: null,
  };
}
