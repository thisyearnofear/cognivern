/**
 * GovernanceAgent - Cloudflare Agents Implementation
 *
 * Stateful governance agent with persistent memory, multi-model AI,
 * and scheduled policy enforcement. Runs on Cloudflare Workers edge.
 */

import { Agent, callable } from "agents";
import type { GovernanceAgentState, GovernanceAction, PolicyDecision } from "./types";
import { MultiModelRouter } from "./MultiModelRouter";
import { ElevenLabsService } from "./ElevenLabsService";
import type { Env } from "./worker";

export class GovernanceAgent extends Agent<Env, GovernanceAgentState> {
  private modelRouter: MultiModelRouter;

  /**
   * Initial state for new agent instances
   */
  initialState: GovernanceAgentState = {
    agentId: "",
    agentName: "",
    createdAt: new Date().toISOString(),
    lastActive: new Date().toISOString(),
    policyVersion: "1.0.0",
    enforcementMode: "strict", // strict | advisory | disabled
    thoughtHistory: [],
    actionLog: [],
    metrics: {
      totalDecisions: 0,
      approvedActions: 0,
      rejectedActions: 0,
      avgDecisionTimeMs: 0,
    },
    configuration: {
      maxThoughtHistory: 100,
      enableAuditLogging: true,
      modelPreference: "auto", // auto | workers-ai | openai | gemini
      enableVoiceBriefing: true,
    },
    lastBriefingScript: "",
    lastBriefingAt: 0,
    briefingCount: 0,
  };

  constructor() {
    super();
    this.modelRouter = new MultiModelRouter();
  }

  /**
   * Initialize the governance agent with configuration
   */
  @callable()
  async initialize(config: {
    agentId: string;
    agentName: string;
    policyVersion?: string;
    enforcementMode?: "strict" | "advisory" | "disabled";
  }): Promise<void> {
    this.state.agentId = config.agentId;
    this.state.agentName = config.agentName;
    this.state.policyVersion = config.policyVersion || "1.0.0";
    this.state.enforcementMode = config.enforcementMode || "strict";
    this.state.lastActive = new Date().toISOString();

    // Persist initialization to durable storage
    await this.ctx.storage.put("initialized", true);
    await this.ctx.storage.put("config", this.state);

    this.addThought("Governance agent initialized", {
      agentId: config.agentId,
      enforcementMode: this.state.enforcementMode,
    });
  }

  /**
   * Evaluate an action against governance policies
   * This is the core governance decision-making method
   */
  @callable()
  async evaluateAction(action: GovernanceAction): Promise<PolicyDecision> {
    const startTime = Date.now();

    this.addThought("Evaluating action against policies", {
      actionType: action.actionType,
      agentId: action.agentId,
    });

    try {
      // 1. Quick validation checks (fast path)
      const quickValidation = await this.quickValidation(action);
      if (!quickValidation.valid) {
        return this.createDecision(action, false, quickValidation.reason, "quick_validation");
      }

      // 2. AI-powered policy analysis (slow path)
      const aiAnalysis = await this.analyzeWithAI(action);

      // 3. Make final decision
      const approved = aiAnalysis.score >= aiAnalysis.threshold;
      const decision = this.createDecision(
        action,
        approved,
        aiAnalysis.reasoning,
        "ai_analysis",
        aiAnalysis
      );

      // 4. Update metrics
      this.updateMetrics(approved, Date.now() - startTime);

      // 5. Log decision to durable storage
      if (this.state.configuration.enableAuditLogging) {
        await this.logActionToStorage(action, decision);
      }

      return decision;
    } catch (error) {
      this.logger.error("Governance evaluation failed", error);

      // Fail-safe: reject on error in strict mode
      const failSafe = this.state.enforcementMode === "strict";
      return this.createDecision(
        action,
        !failSafe,
        `Evaluation error: ${error instanceof Error ? error.message : "Unknown error"}`,
        "error_failsafe"
      );
    }
  }

  /**
   * Get agent's current thought history (cognitive transparency)
   */
  @callable()
  async getThoughtHistory(limit?: number): Promise<string[]> {
    const thoughts = this.state.thoughtHistory.slice(-(limit || 50));

    // Also check durable storage for older thoughts
    const storedThoughts = await this.ctx.storage.get<string[]>("thoughtHistory");
    if (storedThoughts) {
      return [...storedThoughts, ...thoughts].slice(-(limit || 50));
    }

    return thoughts;
  }

  /**
   * Get action audit log
   */
  @callable()
  async getActionLog(filters?: {
    agentId?: string;
    actionType?: string;
    approved?: boolean;
    limit?: number;
  }): Promise<GovernanceAction[]> {
    let actions = this.state.actionLog;

    if (filters) {
      if (filters.agentId) {
        actions = actions.filter(a => a.agentId === filters.agentId);
      }
      if (filters.actionType) {
        actions = actions.filter(a => a.actionType === filters.actionType);
      }
      if (filters.approved !== undefined) {
        actions = actions.filter(a => {
          const decision = this.state.actionLog.find(d => d.actionType === a.actionType);
          return decision?.metadata?.approved === filters.approved;
        });
      }
    }

    return actions.slice(-(filters?.limit || 100));
  }

  /**
   * Get agent metrics and performance stats
   */
  @callable()
  async getMetrics(): Promise<typeof this.state.metrics> {
    return this.state.metrics;
  }

  /**
   * Update agent configuration
   */
  @callable()
  async updateConfig(config: Partial<typeof this.state.configuration>): Promise<void> {
    this.state.configuration = { ...this.state.configuration, ...config };
    await this.ctx.storage.put("config", this.state.configuration);
    this.addThought("Configuration updated", config);
  }

  /**
   * Generate a voice briefing of recent governance activity
   */
  @callable()
  async generateVoiceBriefing(): Promise<{ script: string; audioResponse: Response }> {
    if (!this.state.configuration.enableVoiceBriefing) {
      throw new Error("Voice briefing is disabled in configuration");
    }

    // Rate limiting to prevent token overspend
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    if (this.state.lastBriefingAt && (now - this.state.lastBriefingAt < oneHour)) {
      if ((this.state.briefingCount || 0) >= 10) {
        throw new Error("Governance briefing limit reached (10 per hour). Please try again later.");
      }
      this.state.briefingCount = (this.state.briefingCount || 0) + 1;
    } else {
      this.state.lastBriefingAt = now;
      this.state.briefingCount = 1;
    }

    this.addThought("Generating governance voice briefing");

    // 1. Generate the briefing script using AI
    const script = await this.modelRouter.generateBriefingScript(
      this.state.thoughtHistory,
      this.state.actionLog,
      this.state.configuration.modelPreference
    );

    // 2. Persist the script for history/UI
    this.state.lastBriefingScript = script;

    // 3. Initialize ElevenLabs service
    const elevenLabs = new ElevenLabsService({
      apiKey: this.env.ELEVENLABS_API_KEY,
    });

    // 4. Generate speech
    const audioResponse = await elevenLabs.generateSpeech(script);

    this.addThought("Voice briefing generated successfully");

    return { script, audioResponse };
  }

  /**
   * Scheduled cleanup task (runs periodically via alarm)
   */
  async alarm(): Promise<void> {
    this.logger.info("Running scheduled governance cleanup");

    // 1. Trim thought history if exceeds max
    if (this.state.thoughtHistory.length > this.state.configuration.maxThoughtHistory) {
      const trimmed = this.state.thoughtHistory.slice(-this.state.configuration.maxThoughtHistory);
      this.state.thoughtHistory = trimmed;
      await this.ctx.storage.put("thoughtHistory", trimmed);
    }

    // 2. Archive old action logs
    await this.archiveOldActions();

    // 3. Update metrics summary
    await this.updateMetricsSummary();

    // Schedule next alarm (1 hour from now)
    this.ctx.storage.setAlarm(Date.now() + 60 * 60 * 1000);
  }

  // ========== Private Helper Methods ==========

  private async quickValidation(action: GovernanceAction): Promise<{ valid: boolean; reason: string }> {
    // Check required fields
    if (!action.agentId || !action.actionType) {
      return { valid: false, reason: "Missing required fields" };
    }

    // Check if agent is registered and active
    const agentStatus = await this.ctx.storage.get<{ status: string }>(`agent:${action.agentId}:status`);
    if (!agentStatus || agentStatus.status !== "active") {
      return { valid: false, reason: "Agent not active" };
    }

    // Check rate limiting (simple in-memory + storage check)
    const rateKey = `rate:${action.agentId}`;
    const rateData = await this.ctx.storage.get<{ count: number; resetAt: number }>(rateKey);
    const now = Date.now();

    if (rateData && now < rateData.resetAt) {
      if (rateData.count >= 100) { // 100 actions per minute
        return { valid: false, reason: "Rate limit exceeded" };
      }
      rateData.count++;
      await this.ctx.storage.put(rateKey, rateData);
    } else {
      await this.ctx.storage.put(rateKey, { count: 1, resetAt: now + 60 * 1000 });
    }

    return { valid: true, reason: "OK" };
  }

  private async analyzeWithAI(action: GovernanceAction): Promise<{
    score: number;
    threshold: number;
    reasoning: string;
  }> {
    // Build prompt for AI analysis
    const prompt = this.buildGovernancePrompt(action);

    // Route to appropriate model based on configuration
    const modelChoice = this.state.configuration.modelPreference;
    const response = await this.modelRouter.analyzeGovernance(prompt, modelChoice);

    // Parse AI response
    const parsed = this.parseAIResponse(response);

    return {
      score: parsed.score,
      threshold: parsed.threshold || 0.7,
      reasoning: parsed.reasoning,
    };
  }

  private buildGovernancePrompt(action: GovernanceAction): string {
    return `
You are a governance evaluator for autonomous AI agents.

Agent ID: ${action.agentId}
Action Type: ${action.actionType}
Action Data: ${JSON.stringify(action.data, null, 2)}
Context: ${JSON.stringify(action.context, null, 2)}

Evaluate this action against governance policies:
1. Is this action safe and compliant?
2. What is the risk level (0-100)?
3. Provide clear reasoning.

Respond in JSON format:
{
  "score": 0-100,
  "threshold": 70,
  "reasoning": "clear explanation",
  "riskFactors": ["list", "of", "risks"]
}
`.trim();
  }

  private parseAIResponse(response: string): {
    score: number;
    threshold: number;
    reasoning: string;
  } {
    try {
      // Try to parse JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          score: parsed.score || 50,
          threshold: parsed.threshold || 70,
          reasoning: parsed.reasoning || "AI analysis complete",
        };
      }
    } catch (e) {
      this.logger.warn("Failed to parse AI response as JSON", e);
    }

    // Fallback: simple heuristic
    return {
      score: 75,
      threshold: 70,
      reasoning: "Default approval (parse fallback)",
    };
  }

  private createDecision(
    action: GovernanceAction,
    approved: boolean,
    reasoning: string,
    decisionType: string,
    metadata?: Record<string, unknown>
  ): PolicyDecision {
    return {
      id: crypto.randomUUID(),
      actionId: action.id || crypto.randomUUID(),
      agentId: action.agentId,
      approved,
      reasoning,
      decisionType,
      timestamp: new Date().toISOString(),
      policyVersion: this.state.policyVersion,
      metadata: {
        ...metadata,
        enforcementMode: this.state.enforcementMode,
      },
    };
  }

  private addThought(thought: string, context?: Record<string, unknown>): void {
    const timestampedThought = `[${new Date().toISOString()}] ${thought}${
      context ? ` | Context: ${JSON.stringify(context)}` : ""
    }`;

    this.state.thoughtHistory.push(timestampedThought);
    this.state.lastActive = new Date().toISOString();

    // Persist to storage periodically
    if (this.state.thoughtHistory.length % 10 === 0) {
      this.ctx.storage.put("thoughtHistory", this.state.thoughtHistory);
    }
  }

  private updateMetrics(approved: boolean, decisionTimeMs: number): void {
    this.state.metrics.totalDecisions++;
    if (approved) {
      this.state.metrics.approvedActions++;
    } else {
      this.state.metrics.rejectedActions++;
    }

    // Update rolling average
    const total = this.state.metrics.totalDecisions;
    const prevAvg = this.state.metrics.avgDecisionTimeMs;
    this.state.metrics.avgDecisionTimeMs =
      ((prevAvg * (total - 1)) + decisionTimeMs) / total;
  }

  private async logActionToStorage(action: GovernanceAction, decision: PolicyDecision): Promise<void> {
    const logKey = `action_log:${decision.id}`;
    await this.ctx.storage.put(logKey, {
      action,
      decision,
      timestamp: new Date().toISOString(),
    });

    // Keep index for querying
    const indexKey = "action_log_index";
    const index = (await this.ctx.storage.get<string[]>(indexKey)) || [];
    index.push(logKey);
    await this.ctx.storage.put(indexKey, index);
  }

  private async archiveOldActions(): Promise<void> {
    // Archive actions older than 30 days
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const index = (await this.ctx.storage.get<string[]>("action_log_index")) || [];

    for (const key of index) {
      const entry = await this.ctx.storage.get<{ timestamp: string }>(key);
      if (entry && new Date(entry.timestamp).getTime() < thirtyDaysAgo) {
        // Move to archive storage
        await this.ctx.storage.put(`archive:${key}`, entry);
        await this.ctx.storage.delete(key);
      }
    }
  }

  private async updateMetricsSummary(): Promise<void> {
    await this.ctx.storage.put("metrics_summary", {
      ...this.state.metrics,
      lastUpdated: new Date().toISOString(),
    });
  }
}
