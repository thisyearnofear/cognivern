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

/** Performance metrics for monitoring */
interface IntentMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatencyMs: number;
  aiProviderFailures: Record<string, number>;
  fallbackCount: number;
  lastReset: number;
}

export class IntentController {
  private aiRouter: MultiModelRouter;
  private auditLogService: AuditLogService;
  private metrics: IntentMetrics;
  private circuitBreaker: {
    failures: number;
    lastFailure: number;
    state: "closed" | "open" | "half-open";
  };

  constructor() {
    this.aiRouter = new MultiModelRouter();
    this.auditLogService = new AuditLogService();
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageLatencyMs: 0,
      aiProviderFailures: {},
      fallbackCount: 0,
      lastReset: Date.now(),
    };
    this.circuitBreaker = {
      failures: 0,
      lastFailure: 0,
      state: "closed",
    };
  }

  /**
   * GET /api/intent/metrics
   * Get performance metrics for monitoring
   */
  getMetrics(): IntentMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics (for testing/admin)
   */
  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageLatencyMs: 0,
      aiProviderFailures: {},
      fallbackCount: 0,
      lastReset: Date.now(),
    };
    this.circuitBreaker = { failures: 0, lastFailure: 0, state: "closed" };
  }

  /**
   * Update running average latency
   */
  private updateLatency(latencyMs: number): void {
    const { averageLatencyMs, totalRequests } = this.metrics;
    this.metrics.averageLatencyMs =
      (averageLatencyMs * (totalRequests - 1) + latencyMs) / totalRequests;
  }

  /**
   * Check circuit breaker state
   */
  private shouldUseFallback(): boolean {
    const now = Date.now();
    const { failures, lastFailure, state } = this.circuitBreaker;

    // If circuit is open and enough time has passed, try half-open
    if (state === "open" && now - lastFailure > 60000) {
      this.circuitBreaker.state = "half-open";
      logger.info("Circuit breaker entering half-open state");
    }

    return state === "open" || state === "half-open";
  }

  /**
   * Record AI provider failure
   */
  private recordFailure(provider: string): void {
    this.metrics.failedRequests++;
    this.metrics.aiProviderFailures[provider] =
      (this.metrics.aiProviderFailures[provider] || 0) + 1;
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailure = Date.now();

    // Open circuit after 5 consecutive failures
    if (this.circuitBreaker.failures >= 5) {
      this.circuitBreaker.state = "open";
      logger.warn(
        `Circuit breaker opened after ${this.circuitBreaker.failures} failures`
      );
    }
  }

  /**
   * Record successful AI request
   */
  private recordSuccess(): void {
    this.circuitBreaker.failures = 0;
    this.circuitBreaker.state = "closed";
  }

  /**
   * POST /api/intent
   * Process natural language intent
   */
  async processIntent(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      const { query, context } = req.body as IntentRequest;

      if (!query || typeof query !== "string") {
        res.status(400).json({
          success: false,
          error: "Query is required and must be a string",
        });
        return;
      }

      // Use fallback if circuit breaker is open
      if (this.shouldUseFallback()) {
        this.metrics.fallbackCount++;
        logger.info("Using fallback due to circuit breaker state");
        await this.handleFallback(req, res, query, context);
        return;
      }

      // Classify intent using AI
      const classification = await this.classifyIntent(query);

      // Generate response using AI
      const response = await this.generateResponse(
        query,
        classification.type,
        context
      );

      // Log the intent for audit trail
      await this.auditLogService.logEvent({
        eventType: "intent_processed",
        agentType: "system",
        timestamp: new Date(),
        details: { query, intentType: classification.type },
      });

      this.recordSuccess();
      this.updateLatency(Date.now() - startTime);
      this.metrics.successfulRequests++;

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
      this.recordFailure("multi-model-router");
      logger.error("Intent processing failed:", error);
      this.metrics.fallbackCount++;

      // Handle with fallback on error
      await this.handleFallback(req, res, req.body.query, req.body.context);
    }
  }

  /**
   * Handle fallback when AI fails
   */
  private async handleFallback(
    req: Request,
    res: Response,
    query: string,
    context?: Record<string, any>
  ): Promise<void> {
    this.metrics.fallbackCount++;
    const classification = this.fallbackClassification(query || "");
    const fallbackResponse = this.getFallbackResponse(classification.type);

    // Log fallback usage
    try {
      await this.auditLogService.logEvent({
        eventType: "intent_fallback",
        agentType: "system",
        timestamp: new Date(),
        details: {
          query,
          intentType: classification.type,
          reason: "ai_provider_unavailable",
        },
      });
    } catch (e) {
      // Non-blocking
    }

    res.json({
      success: true,
      data: {
        type: classification.type,
        response: fallbackResponse.text,
        component: this.buildComponent(classification.type, context),
        context: {},
        suggestions: fallbackResponse.suggestions,
        _fallback: true, // Signal to frontend that this is fallback data
      },
    });
  }

  /**
   * Get fallback response based on intent type
   */
  private getFallbackResponse(
    intentType: IntentType
  ): { text: string; suggestions: string[] } {
    const responses: Record<IntentType, { text: string; suggestions: string[] }> = {
      forensic: {
        text: "I'm having trouble accessing the execution history right now. The AI analysis service is temporarily unavailable. Please try again in a moment.",
        suggestions: ["Show recent activity", "Check system status"],
      },
      governance: {
        text: "I'm unable to retrieve governance metrics at the moment. The AI service is temporarily unavailable. Please try again shortly.",
        suggestions: ["Check policy status", "View audit logs"],
      },
      agent: {
        text: "I'm having trouble accessing agent information right now. The AI analysis service is temporarily unavailable. Please try again in a moment.",
        suggestions: ["Browse agent marketplace", "View active agents"],
      },
      risk: {
        text: "Risk analysis is temporarily unavailable. The AI service is down. Please try again or check the audit logs for recent risk events.",
        suggestions: ["View audit logs", "Check recent transactions"],
      },
      policy: {
        text: "I'm unable to retrieve policy information right now. The AI governance service is temporarily unavailable. Please try again shortly.",
        suggestions: ["Browse policies", "View governance rules"],
      },
      stats: {
        text: "Statistics are temporarily unavailable. The AI analysis service is down. Please check back in a moment.",
        suggestions: ["View dashboard", "Check recent activity"],
      },
      create: {
        text: "I can help you create new agents and policies. The AI service is temporarily unavailable, but you can use the direct forms to create items.",
        suggestions: ["Create new agent", "Create new policy"],
      },
      unknown: {
        text: "I'm having trouble understanding your request right now due to a temporary service issue. Please try rephrasing or try again in a moment.",
        suggestions: ["Show dashboard", "View agents", "Check policies"],
      },
    };

    return (
      responses[intentType] || {
        text: "I'm temporarily unavailable. Please try again shortly.",
        suggestions: ["View dashboard", "Check status"],
      }
    );
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
