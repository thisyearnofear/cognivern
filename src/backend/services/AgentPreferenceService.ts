import { Logger } from "../shared/logging/Logger.js";
import { getDb } from "../db/index.js";

const logger = new Logger("AgentPreferenceService");

export interface AgentPreferences {
  agentId: string;
  style: "conservative" | "aggressive" | "balanced";
  preferredModels: string[];
  preferredChains: string[];
  riskTolerance: number;
  customRules: Array<{ condition: string; action: string }>;
  learnedAt: string;
}

export class AgentPreferenceService {
  private cache: Map<string, AgentPreferences> = new Map();

  async getPreferences(agentId: string): Promise<AgentPreferences | null> {
    if (this.cache.has(agentId)) return this.cache.get(agentId)!;

    try {
      const db = getDb();
      const row = db
        .prepare("SELECT preferences FROM agent_preferences WHERE agent_id = ?")
        .get(agentId) as { preferences: string } | undefined;

      if (!row) return null;

      const prefs = JSON.parse(row.preferences) as AgentPreferences;
      this.cache.set(agentId, prefs);
      return prefs;
    } catch {
      return null;
    }
  }

  async savePreferences(prefs: AgentPreferences): Promise<void> {
    try {
      const db = getDb();
      db.exec(`
        CREATE TABLE IF NOT EXISTS agent_preferences (
          agent_id TEXT PRIMARY KEY,
          preferences TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
      db.prepare(
        "INSERT OR REPLACE INTO agent_preferences (agent_id, preferences, updated_at) VALUES (?, ?, ?)",
      ).run(prefs.agentId, JSON.stringify(prefs), new Date().toISOString());

      this.cache.set(prefs.agentId, prefs);
      logger.info(`Preferences saved for agent ${prefs.agentId}`, {
        style: prefs.style,
        riskTolerance: prefs.riskTolerance,
      });
    } catch (error) {
      logger.error("Failed to save agent preferences", {
        agentId: prefs.agentId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async learnPreferences(
    agentId: string,
    auditHistory: Array<{
      action: string;
      amount?: number;
      decision: string;
      chain?: string;
      model?: string;
      timestamp: string;
    }>,
  ): Promise<AgentPreferences> {
    if (auditHistory.length === 0) {
      return {
        agentId,
        style: "balanced",
        preferredModels: [],
        preferredChains: [],
        riskTolerance: 0.5,
        customRules: [],
        learnedAt: new Date().toISOString(),
      };
    }

    const approvedActions = auditHistory.filter((h) => h.decision === "approved");
    const deniedActions = auditHistory.filter((h) => h.decision === "denied");
    const approvalRate = approvedActions.length / auditHistory.length;

    const avgAmount =
      approvedActions.reduce((sum, a) => sum + (a.amount || 0), 0) /
      Math.max(approvedActions.length, 1);

    let style: "conservative" | "aggressive" | "balanced";
    if (approvalRate < 0.5 || avgAmount < 100) {
      style = "conservative";
    } else if (approvalRate > 0.85 && avgAmount > 500) {
      style = "aggressive";
    } else {
      style = "balanced";
    }

    const riskTolerance = Math.min(1, Math.max(0, approvalRate));

    const chainCounts: Record<string, number> = {};
    for (const h of approvedActions) {
      if (h.chain) chainCounts[h.chain] = (chainCounts[h.chain] || 0) + 1;
    }
    const preferredChains = Object.entries(chainCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([chain]) => chain);

    const modelCounts: Record<string, number> = {};
    for (const h of auditHistory) {
      if (h.model) modelCounts[h.model] = (modelCounts[h.model] || 0) + 1;
    }
    const preferredModels = Object.entries(modelCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([model]) => model);

    const prefs: AgentPreferences = {
      agentId,
      style,
      preferredModels,
      preferredChains,
      riskTolerance,
      customRules: [],
      learnedAt: new Date().toISOString(),
    };

    await this.savePreferences(prefs);

    logger.info(`Learned preferences for agent ${agentId}`, {
      historySize: auditHistory.length,
      style,
      riskTolerance,
      deniedCount: deniedActions.length,
    });

    return prefs;
  }

  async resetPreferences(agentId: string): Promise<void> {
    this.cache.delete(agentId);
    try {
      const db = getDb();
      db.prepare("DELETE FROM agent_preferences WHERE agent_id = ?").run(agentId);
      logger.info(`Preferences reset for agent ${agentId}`);
    } catch {
      // Table may not exist yet
    }
  }
}

export const sharedAgentPreferenceService = new AgentPreferenceService();
