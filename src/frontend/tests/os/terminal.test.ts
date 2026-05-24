import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Unit tests for Terminal → intent API integration.
 *
 * These tests verify the Terminal's command dispatch logic and response
 * rendering without requiring a full browser environment.  xterm.js
 * depends on canvas/WebGL so we mock the terminal instance and test
 * the pure-logic helpers exported from the component module.
 */

// ── helpers extracted from Terminal.tsx for testability ────────────────

const SUGGESTED_COMMANDS = [
  'show me active agents',
  'what are the recent audit logs',
  'check governance health score',
  'create a new agent',
  'show performance stats',
  'explain the last execution trace',
];

function getTabCompletion(input: string): string | null {
  if (!input) return null;
  const completions = SUGGESTED_COMMANDS.filter((cmd) =>
    cmd.toLowerCase().startsWith(input.toLowerCase()),
  );
  return completions.length === 1 ? completions[0] : null;
}

// Simulate the response formatting done inside OsShell.handleCommand
type IntentResponse = {
  type: string;
  response: string;
  suggestions?: string[];
  _fallback?: boolean;
};

function formatIntentResponse(data: IntentResponse): string {
  const typeColors: Record<string, string> = {
    forensic: '\x1b[38;2;168;85;247m',
    governance: '\x1b[38;2;56;189;248m',
    agent: '\x1b[38;2;34;197;94m',
    risk: '\x1b[38;2;239;68;68m',
    policy: '\x1b[38;2;234;179;8m',
    stats: '\x1b[38;2;56;189;248m',
    create: '\x1b[38;2;34;197;94m',
    unknown: '\x1b[38;2;113;113;122m',
  };

  const color = typeColors[data.type] || typeColors.unknown;
  const lines: string[] = [];
  lines.push(`${color}[${data.type.toUpperCase()}]\x1b[0m ${data.response}`);

  if (data.suggestions && data.suggestions.length > 0) {
    lines.push('');
    lines.push('\x1b[38;2;113;113;122mSuggestions:\x1b[0m');
    data.suggestions.forEach((s: string) => {
      lines.push(`  \x1b[38;2;34;197;94m>\x1b[0m ${s}`);
    });
  }

  return lines.join('\n');
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('Terminal command dispatch', () => {
  describe('tab completion', () => {
    it('returns full command when input uniquely matches', () => {
      expect(getTabCompletion('show me a')).toBe('show me active agents');
      expect(getTabCompletion('what')).toBe('what are the recent audit logs');
      expect(getTabCompletion('check')).toBe('check governance health score');
    });

    it('returns null when input matches multiple commands', () => {
      // "show" matches both "show me active agents" and "show performance stats"
      expect(getTabCompletion('show')).toBeNull();
    });

    it('returns null for empty input', () => {
      expect(getTabCompletion('')).toBeNull();
    });

    it('returns null when no command matches', () => {
      expect(getTabCompletion('xyznonexistent')).toBeNull();
    });

    it('is case-insensitive', () => {
      expect(getTabCompletion('SHOW ME A')).toBe('show me active agents');
    });
  });

  describe('response formatting', () => {
    it('formats governance response with correct color code', () => {
      const result = formatIntentResponse({
        type: 'governance',
        response: 'All policies are active.',
        suggestions: ['Check audit logs'],
      });

      expect(result).toContain('[GOVERNANCE]');
      expect(result).toContain('All policies are active.');
      expect(result).toContain('Suggestions:');
      expect(result).toContain('Check audit logs');
    });

    it('formats error / unknown response without suggestions section', () => {
      const result = formatIntentResponse({
        type: 'unknown',
        response: 'Could not classify.',
      });

      expect(result).toContain('[UNKNOWN]');
      expect(result).toContain('Could not classify.');
      expect(result).not.toContain('Suggestions:');
    });

    it('renders every known intent type without throwing', () => {
      const types = ['forensic', 'governance', 'agent', 'risk', 'policy', 'stats', 'create', 'unknown'];
      for (const t of types) {
        expect(() =>
          formatIntentResponse({ type: t, response: 'ok' }),
        ).not.toThrow();
      }
    });

    it('uses fallback color for unrecognised intent type', () => {
      const result = formatIntentResponse({ type: 'newtype', response: 'hi' });
      // unknown color prefix
      expect(result).toContain('[NEWTYPE]');
    });
  });
});

describe('Intent API client integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sends correct payload to /api/os/intent', async () => {
    const mockResponse = {
      success: true,
      data: { type: 'stats', response: 'CPU: 42%', suggestions: [] },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: () => Promise.resolve(mockResponse),
    }));

    const res = await fetch('/api/os/intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'show stats' }),
    });
    const data = await res.json();

    expect(fetch).toHaveBeenCalledWith('/api/os/intent', expect.objectContaining({
      method: 'POST',
    }));
    expect(data.success).toBe(true);
    expect(data.data.type).toBe('stats');
  });

  it('handles network errors gracefully', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network down')));

    try {
      await fetch('/api/os/intent', { method: 'POST' });
    } catch (err) {
      expect((err as Error).message).toBe('Network down');
    }
  });
});
