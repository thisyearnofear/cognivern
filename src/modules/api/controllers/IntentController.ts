/**
 * Intent Controller - Natural Language Intent Processing
 *
 * Handles natural language commands from the frontend and routes them
 * through the Multi-Model AI router for intelligent processing.
 */

import { Request, Response } from "express";
import { Logger } from "../../../shared/logging/Logger.js";
import { MultiModelRouter } from "../../cloudflare-agents/MultiModelRouter.js";
import { AuditLogService } from "../../../services/AuditLogService.js";

const logger = new Logger("IntentController");

/** Supported intent types */
export type IntentType =
  | "forensic"
  | "governance"
  | "agent"
  | "risk"
  | "policy"
  | "stats"
  | "create"
  | "unknown";

/** Intent request payload */
export interface IntentRequest {
  query: string;
  context?: {
    lastAgentId?: string;
    lastAgentName?: string;
    [key: string]: any;
  };
}

/** Structured intent response */
export interface IntentResponse {
  type: IntentType;
  response: string;
  component?: {
    type: string;
    props?: Record<string, any>;
    data?: any;
  };
  context?: Record<string, any>;
}

/** Classification prompt for the AI */
const CLASSIFICATION_PROMPT = `You are an intent classifier for a blockchain governance system called Cognivern.

Classify the user's natural language query into one of these intent types:
- forensic: Questions about execution traces, history, why something happened
- governance: Questions about policies, rules, safety, health scores
- agent: Questions about agents, bots, trading strategies
- risk: Questions about risk management, security baselines
- policy: Questions about governance policies, rules configuration
- stats: Questions about performance, statistics, metrics
- create: Requests to create new agents, policies, or configurations
- unknown: Doesn't fit other categories

User Query: {query}

Respond with ONLY a JSON object (no markdown, no explanation):
{"type": "intent_type", "reason": "brief_reason"}

Example responses:
{"type": "forensic", "reason": "asking about execution trace"}
{"type": "stats", "reason": "requesting performance metrics"}
`;

/** Response generation prompt for the AI */
const RESPONSE_PROMPT = `You are Cognivern, an AI governance assistant for blockchain trading agents.

Context:
- User's query: {query}
- Intent type: {intent_type}
- Previous context: {context}

Generate a helpful, concise response that:
1. Acknowledges the user's request
2. Provides relevant information
3. Suggests next actions if appropriate

Keep responses under 2-3 sentences. Be professional but friendly.

Respond ONLY with a JSON object:
{"response": "your response text", "suggestions": ["suggestion 1", "suggestion 2"]}

Suggestions should be relevant follow-up actions based on the intent type.`;

export class IntentController {
  private aiRouter: MultiModelRouter;
  private auditLogService: AuditLogService;

  constructor() {
    this.aiRouter = new MultiModelRouter();
    this.auditLogService = new AuditLogService();
  }

  /**
   * POST /api/intent
   * Process natural language intent
   */
  async processIntent(req: Request, res: Response): Promise<void> {
    try {
      const { query, context } = req.body as IntentRequest;

      if (!query || typeof query !== "string") {
        res.status(400).json({
          success: false,
          error: "Query is required and must be a string",
        });
        return;
      }

      // Classify intent using AI
      const classification = await this.classifyIntent(query);

      // Generate response using AI
      const response = await this.generateResponse(query, classification.type, context);

      // Log the intent for audit trail
      await this.auditLogService.logEvent({
        eventType: "intent_processed",
        agentType: "system",
        timestamp: new Date(),
        details: { query, intentType: classification.type },
      });

      res.json({
        success: true,
        data: {
          type: classification.type,
          response: response.text,
          component: this.buildComponent(classification.type, context),
          context: response.context,
          suggestions: response.suggestions,
        },
      });
    } catch (error) {
      logger.error("Intent processing failed:", error);
      res.status(500).json({
        success: false,
        error: "Failed to process intent",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Classify intent using AI
   */
  private async classifyIntent(query: string): Promise<{ type: IntentType; reason: string }> {
    try {
      const prompt = CLASSIFICATION_PROMPT.replace("{query}", query);
      const result = await this.aiRouter.analyzeGovernance(prompt);

      // Parse JSON response
      const parsed = JSON.parse(result.trim());
      return {
        type: parsed.type as IntentType,
        reason: parsed.reason || "",
      };
    } catch (error) {
      // Fallback to keyword-based classification
      logger.warn("AI classification failed, using fallback:", error);
      return this.fallbackClassification(query);
    }
  }

  /**
   * Generate response using AI
   */
  private async generateResponse(
    query: string,
    intentType: IntentType,
    context?: Record<string, any>
  ): Promise<{ text: string; suggestions: string[]; context: Record<string, any> }> {
    try {
      const contextStr = JSON.stringify(context || {});
      const prompt = RESPONSE_PROMPT
        .replace("{query}", query)
        .replace("{intent_type}", intentType)
        .replace("{context}", contextStr);

      const result = await this.aiRouter.analyzeGovernance(prompt);
      const parsed = JSON.parse(result.trim());

      return {
        text: parsed.response || "I've processed your request.",
        suggestions: parsed.suggestions || [],
        context: this.extractContext(intentType, context),
      };
    } catch (error) {
      // Fallback response
      logger.warn("AI response generation failed, using fallback:", error);
      return {
        text: "I've analyzed your request. How can I help you further?",
        suggestions: ["Show audit logs", "Check agent status"],
        context: {},
      };
    }
  }

  /**
   * Build UI component based on intent type
   */
  private buildComponent(
    intentType: IntentType,
    context?: Record<string, any>
  ): IntentResponse["component"] | undefined {
    switch (intentType) {
      case "forensic":
        return {
          type: "forensic-timeline",
          props: {
            agentName: context?.lastAgentName || "System",
          },
        };
      case "governance":
      case "risk":
        return {
          type: "governance-score",
          props: {},
        };
      case "agent":
        return {
          type: "agent",
          props: {},
        };
      case "policy":
        return {
          type: "policy",
          props: {},
        };
      case "stats":
        return {
          type: "stat",
          props: {
            title: "Performance Metrics",
          },
        };
      case "create":
        return {
          type: "action-form",
          props: {
            title: "Create New",
          },
        };
      default:
        return undefined;
    }
  }

  /**
   * Extract context updates from intent
   */
  private extractContext(
    intentType: IntentType,
    existingContext?: Record<string, any>
  ): Record<string, any> {
    const newContext = { ...existingContext };

    // Add relevant context based on intent type
    if (intentType === "agent" && existingContext?.lastAgentId) {
      newContext.lastAgentId = existingContext.lastAgentId;
      newContext.lastAgentName = existingContext.lastAgentName;
    }

    return newContext;
  }

  /**
   * Fallback keyword-based classification
   */
  private fallbackClassification(query: string): { type: IntentType; reason: string } {
    const lowercaseQuery = query.toLowerCase();

    if (
      lowercaseQuery.includes("forensic") ||
      lowercaseQuery.includes("trace") ||
      lowercaseQuery.includes("explain") ||
      lowercaseQuery.includes("why")
    ) {
      return { type: "forensic", reason: "query contains forensic/trace keywords" };
    }

    if (
      lowercaseQuery.includes("risk") ||
      lowercaseQuery.includes("safety") ||
      lowercaseQuery.includes("security baseline")
    ) {
      return { type: "risk", reason: "query contains risk/security keywords" };
    }

    if (
      lowercaseQuery.includes("governance") ||
      lowercaseQuery.includes("health") ||
      lowercaseQuery.includes("score")
    ) {
      return { type: "governance", reason: "query contains governance keywords" };
    }

    if (
      lowercaseQuery.includes("policy") ||
      lowercaseQuery.includes("rules")
    ) {
      return { type: "policy", reason: "query contains policy keywords" };
    }

    if (
      lowercaseQuery.includes("stats") ||
      lowercaseQuery.includes("performance")
    ) {
      return { type: "stats", reason: "query contains stats/performance keywords" };
    }

    if (
      lowercaseQuery.includes("create") &&
      (lowercaseQuery.includes("agent") || lowercaseQuery.includes("bot"))
    ) {
      return { type: "create", reason: "query requests agent creation" };
    }

    if (
      lowercaseQuery.includes("agent") ||
      lowercaseQuery.includes("bot")
    ) {
      return { type: "agent", reason: "query mentions agent/bot" };
    }

    return { type: "unknown", reason: "no matching keywords" };
  }
}
