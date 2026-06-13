import type { AgentAction, PolicyCheck } from "../types/Agent.js";
import type { AgentPreferences } from "./AgentPreferenceService.js";
import { Logger } from "../shared/logging/Logger.js";

const logger = new Logger("ControlEvaluationService");

export interface SuspicionDimensions {
  ruleViolations: number;
  behavioralDeviation: number;
  temporalAnomaly: number;
  scopeCreep: number;
}

export type SuspicionLabel = "normal" | "elevated" | "high" | "critical";

export interface SuspicionResult {
  composite: number;
  dimensions: SuspicionDimensions;
  label: SuspicionLabel;
  escalated: boolean;
  reasoning: string[];
}

const WEIGHTS = {
  ruleViolations: 2,
  behavioralDeviation: 1,
  temporalAnomaly: 1,
  scopeCreep: 1,
} as const;

const ESCALATION_THRESHOLD = 0.6;

export class ControlEvaluationService {
  score(params: {
    action: AgentAction;
    policyChecks: PolicyCheck[];
    preferences?: AgentPreferences | null;
    recentActions?: Array<{ type: string; timestamp: string }>;
    requestedScope?: string[];
  }): SuspicionResult {
    const reasoning: string[] = [];

    const ruleViolations = this.scoreRuleViolations(params.policyChecks, reasoning);
    const behavioralDeviation = this.scoreBehavioralDeviation(params.action, params.preferences, reasoning);
    const temporalAnomaly = this.scoreTemporalAnomaly(params.action, params.recentActions, reasoning);
    const scopeCreep = this.scoreScopeCreep(params.action, params.requestedScope, reasoning);

    const dimensions: SuspicionDimensions = {
      ruleViolations,
      behavioralDeviation,
      temporalAnomaly,
      scopeCreep,
    };

    const totalWeight =
      WEIGHTS.ruleViolations +
      WEIGHTS.behavioralDeviation +
      WEIGHTS.temporalAnomaly +
      WEIGHTS.scopeCreep;

    const composite = Math.min(
      1,
      Math.max(
        0,
        (ruleViolations * WEIGHTS.ruleViolations +
          behavioralDeviation * WEIGHTS.behavioralDeviation +
          temporalAnomaly * WEIGHTS.temporalAnomaly +
          scopeCreep * WEIGHTS.scopeCreep) /
          totalWeight,
      ),
    );

    const label = this.labelFor(composite);
    const escalated = composite >= ESCALATION_THRESHOLD;

    if (escalated) {
      logger.info(`Control evaluation escalated for agent ${params.action.metadata?.agentId || params.action.id}`, {
        composite: composite.toFixed(3),
        label,
        dimensions,
      });
    }

    return { composite, dimensions, label, escalated, reasoning };
  }

  private scoreRuleViolations(checks: PolicyCheck[], reasoning: string[]): number {
    if (checks.length === 0) return 0;

    const failed = checks.filter((c) => !c.result);
    if (failed.length === 0) return 0;

    let weightedScore = 0;
    for (const check of failed) {
      const id = check.policyId.toLowerCase();
      if (id.includes("deny") || id.includes("block")) {
        weightedScore += 1.0;
      } else if (id.includes("require")) {
        weightedScore += 0.7;
      } else if (id.includes("rate_limit")) {
        weightedScore += 0.5;
      } else {
        weightedScore += 0.6;
      }
      if (check.reason) {
        reasoning.push(`Rule violation: ${check.reason}`);
      }
    }

    return Math.min(1, weightedScore / checks.length);
  }

  private scoreBehavioralDeviation(
    action: AgentAction,
    preferences: AgentPreferences | null | undefined,
    reasoning: string[],
  ): number {
    if (!preferences) return 0;

    let score = 0;

    const amount = (action.metadata?.amount || action.metadata?.amountUsd) as number | undefined;
    if (typeof amount === "number" && preferences.riskTolerance < 0.5) {
      const threshold = preferences.riskTolerance < 0.3 ? 200 : 500;
      if (amount > threshold) {
        score += 0.3;
        reasoning.push(`Amount $${amount} exceeds conservative threshold $${threshold}`);
      }
    }

    const chain = action.metadata?.chain as string | undefined;
    if (chain && preferences.preferredChains.length > 0 && !preferences.preferredChains.includes(chain)) {
      score += 0.3;
      reasoning.push(`Unusual chain "${chain}" (preferred: ${preferences.preferredChains.join(", ")})`);
    }

    const model = action.metadata?.model as string | undefined;
    if (model && preferences.preferredModels.length > 0 && !preferences.preferredModels.includes(model)) {
      score += 0.15;
      reasoning.push(`Unusual model "${model}"`);
    }

    if (preferences.style === "conservative" && typeof amount === "number" && amount > 1000) {
      score += 0.2;
      reasoning.push("Conservative agent executing high-value action");
    }

    return Math.min(1, score);
  }

  private scoreTemporalAnomaly(
    action: AgentAction,
    recentActions?: Array<{ type: string; timestamp: string }>,
    reasoning: string[] = [],
  ): number {
    let score = 0;

    const actionTime = new Date(action.timestamp || Date.now());
    const hour = actionTime.getHours();
    if (hour < 6 || hour > 22) {
      score += 0.2;
      reasoning.push(`Action at unusual hour (${hour}:00)`);
    }

    if (recentActions && recentActions.length > 0) {
      const now = actionTime.getTime();
      const oneMinAgo = now - 60_000;
      const fiveMinAgo = now - 300_000;

      const recentOneMin = recentActions.filter(
        (a) => new Date(a.timestamp).getTime() >= oneMinAgo,
      ).length;
      const recentFiveMin = recentActions.filter(
        (a) => new Date(a.timestamp).getTime() >= fiveMinAgo,
      ).length;

      if (recentOneMin > 5) {
        score += 0.3;
        reasoning.push(`High frequency: ${recentOneMin} actions in last 60 seconds`);
      }
      if (recentFiveMin > 10) {
        score += 0.5;
        reasoning.push(`Burst detected: ${recentFiveMin} actions in last 5 minutes`);
      }
    }

    return Math.min(1, score);
  }

  private scoreScopeCreep(
    action: AgentAction,
    requestedScope?: string[],
    reasoning: string[] = [],
  ): number {
    const touched = action.metadata?.touchedResources as string[] | undefined;
    if (!touched || touched.length === 0) return 0;

    const requested = requestedScope || (action.metadata?.requestedScope as string[] | undefined) || [];
    if (requested.length === 0) return 0;

    const unrequested = touched.filter((r) => !requested.includes(r));
    if (unrequested.length === 0) return 0;

    const ratio = unrequested.length / Math.max(requested.length, 1);
    reasoning.push(
      `Scope creep: ${unrequested.length} unrequested resources touched (${unrequested.slice(0, 3).join(", ")}${unrequested.length > 3 ? "..." : ""})`,
    );

    return Math.min(1, ratio);
  }

  private labelFor(score: number): SuspicionLabel {
    if (score >= 0.8) return "critical";
    if (score >= 0.6) return "high";
    if (score >= 0.3) return "elevated";
    return "normal";
  }
}

export const sharedControlEvaluationService = new ControlEvaluationService();
