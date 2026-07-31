import { createHash } from 'node:crypto';

export type AgentSourceKind = 'tool_output';

export interface AgentSourceProvenance {
  sources: Array<{
    id: string;
    kind: AgentSourceKind;
    locator: string;
    contentHash: string;
  }>;
  recipientIntroducedByUntrustedSource: boolean;
}

/**
 * Tracks content that entered an agent run through an MCP retrieval tool. The
 * tracker does not decide whether content is malicious: its purpose is to
 * ensure downstream authority checks know it was not operator-authored.
 */
export class AgentSourceProvenanceTracker {
  private readonly sources = new Map<string, AgentSourceProvenance['sources'][number]>();

  recordToolOutput(toolName: string, result: unknown): void {
    const serialized = JSON.stringify(result) ?? 'undefined';
    const contentHash = createHash('sha256').update(serialized).digest('hex');
    const id = `tool:${toolName}:${contentHash.slice(0, 16)}`;
    this.sources.set(id, {
      id,
      kind: 'tool_output',
      locator: toolName,
      contentHash,
    });
  }

  toSpendProvenance(): AgentSourceProvenance | undefined {
    const sources = [...this.sources.values()];
    if (sources.length === 0) return undefined;
    return {
      sources,
      // A retrieval tool must not be able to introduce a payment destination.
      // The operator-issued authorization remains the only authority for one.
      recipientIntroducedByUntrustedSource: true,
    };
  }
}
