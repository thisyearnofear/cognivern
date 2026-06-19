import type { AgentAction, PolicyCheck } from "@backend/types/Agent.js";
import type { AgentPreferences } from "@backend/services/ai/AgentPreferenceService.js";
import { Logger } from "@backend/shared/logging/Logger.js";

const logger = new Logger("ControlEvaluationService");

export interface SuspicionDimensions {
  ruleViolations: number;
  behavioralDeviation: number;
  temporalAnomaly: number;
  scopeCreep: number;
  statisticalAnomaly: number;
}

export type SuspicionLabel = "normal" | "elevated" | "high" | "critical";

export interface SuspicionResult {
  composite: number;
  dimensions: SuspicionDimensions;
  label: SuspicionLabel;
  escalated: boolean;
  reasoning: string[];
}

export interface AgentActionHistory {
  amount: number;
  vendor?: string;
  timestamp: string;
}

const WEIGHTS = {
  ruleViolations: 2,
  behavioralDeviation: 1,
  temporalAnomaly: 1,
  scopeCreep: 1,
  statisticalAnomaly: 1.5,
} as const;

const ESCALATION_THRESHOLD = 0.6;

export class ControlEvaluationService {
  score(params: {
    action: AgentAction;
    policyChecks: PolicyCheck[];
    preferences?: AgentPreferences | null;
    recentActions?: Array<{ type: string; timestamp: string }>;
    requestedScope?: string[];
    agentHistory?: AgentActionHistory[];
  }): SuspicionResult {
    const reasoning: string[] = [];

    const ruleViolations = this.scoreRuleViolations(params.policyChecks, reasoning);
    const behavioralDeviation = this.scoreBehavioralDeviation(params.action, params.preferences, reasoning);
    const temporalAnomaly = this.scoreTemporalAnomaly(params.action, params.recentActions, reasoning);
    const scopeCreep = this.scoreScopeCreep(params.action, params.requestedScope, reasoning);
    const statisticalAnomaly = this.scoreStatisticalAnomaly(params.action, params.agentHistory, reasoning);

    const dimensions: SuspicionDimensions = {
      ruleViolations,
      behavioralDeviation,
      temporalAnomaly,
      scopeCreep,
      statisticalAnomaly,
    };

    const totalWeight =
      WEIGHTS.ruleViolations +
      WEIGHTS.behavioralDeviation +
      WEIGHTS.temporalAnomaly +
      WEIGHTS.scopeCreep +
      WEIGHTS.statisticalAnomaly;

    const composite = Math.min(
      1,
      Math.max(
        0,
        (ruleViolations * WEIGHTS.ruleViolations +
          behavioralDeviation * WEIGHTS.behavioralDeviation +
          temporalAnomaly * WEIGHTS.temporalAnomaly +
          scopeCreep * WEIGHTS.scopeCreep +
          statisticalAnomaly * WEIGHTS.statisticalAnomaly) /
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

      const meta = action.metadata || {};
      const effectiveAmount = (meta.actualAmount as number | undefined) || (meta.amount as number | undefined) || (meta.amountUsd as number | undefined);
      if (typeof effectiveAmount === "number" && effectiveAmount > 750) {
        score += 0.7;
        reasoning.push(`High-value action ($${effectiveAmount}) during off-hours — combined signal is highly suspicious`);
      }
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

  /**
   * Statistical Anomaly Detection — detects deviations from the agent's
   * established behavioral baseline using real audit history.
   *
   * Three sub-signals (each 0-1, combined max 1):
   *   1. Spend z-score: current amount vs. agent's 30-day mean ± std dev
   *   2. Frequency anomaly: current action rate vs. agent's 7-day average
   *   3. Vendor concentration: sudden shift to a single vendor
   */
  private scoreStatisticalAnomaly(
    action: AgentAction,
    history: AgentActionHistory[] | undefined,
    reasoning: string[],
  ): number {
    if (!history || history.length < 3) return 0;

    let score = 0;
    const meta = action.metadata || {};
    const currentAmount = (meta.amount as number | undefined) || (meta.amountUsd as number | undefined);

    // ── Sub-signal 1: Spend z-score ──
    if (typeof currentAmount === "number" && currentAmount > 0) {
      const amounts = history.map((h) => h.amount).filter((a) => a > 0);
      if (amounts.length >= 3) {
        const mean = amounts.reduce((s, a) => s + a, 0) / amounts.length;
        const variance = amounts.reduce((s, a) => s + (a - mean) ** 2, 0) / amounts.length;
        const stdDev = Math.sqrt(variance);

        if (stdDev > 0) {
          const zScore = (currentAmount - mean) / stdDev;
          if (zScore > 3) {
            score += 0.5;
            reasoning.push(`Spend anomaly: $${currentAmount.toFixed(2)} is ${zScore.toFixed(1)}σ above agent mean ($${mean.toFixed(2)})`);
          } else if (zScore > 2) {
            score += 0.35;
            reasoning.push(`Spend anomaly: $${currentAmount.toFixed(2)} is ${zScore.toFixed(1)}σ above agent mean ($${mean.toFixed(2)})`);
          } else if (zScore > 1.5) {
            score += 0.15;
            reasoning.push(`Spend anomaly: $${currentAmount.toFixed(2)} is ${zScore.toFixed(1)}σ above agent mean ($${mean.toFixed(2)})`);
          }
        }
      }
    }

    // ── Sub-signal 2: Frequency anomaly ──
    const now = new Date(action.timestamp || Date.now()).getTime();
    const oneHourAgo = now - 3_600_000;
    const sevenDaysAgo = now - 7 * 86_400_000;

    const recentHourCount = history.filter((h) => new Date(h.timestamp).getTime() >= oneHourAgo).length;
    const sevenDayCount = history.filter((h) => new Date(h.timestamp).getTime() >= sevenDaysAgo).length;

    if (sevenDayCount >= 10) {
      const expectedPerHour = sevenDayCount / (7 * 24);
      if (expectedPerHour > 0) {
        const frequencyRatio = recentHourCount / expectedPerHour;
        if (frequencyRatio > 5) {
          score += 0.4;
          reasoning.push(`Frequency anomaly: ${recentHourCount} actions in last hour vs. expected ${expectedPerHour.toFixed(1)} (${frequencyRatio.toFixed(1)}x baseline)`);
        } else if (frequencyRatio > 3) {
          score += 0.25;
          reasoning.push(`Frequency anomaly: ${recentHourCount} actions in last hour vs. expected ${expectedPerHour.toFixed(1)} (${frequencyRatio.toFixed(1)}x baseline)`);
        }
      }
    }

    // ── Sub-signal 3: Vendor concentration ──
    const currentVendor = meta.vendor as string | undefined || meta.recipient as string | undefined;
    if (currentVendor) {
      const vendorCounts: Record<string, number> = {};
      for (const h of history) {
        if (h.vendor) {
          vendorCounts[h.vendor] = (vendorCounts[h.vendor] || 0) + 1;
        }
      }
      const uniqueVendors = Object.keys(vendorCounts).length;
      if (uniqueVendors >= 3) {
        const currentVendorHistory = vendorCounts[currentVendor] || 0;
        const vendorShare = currentVendorHistory / history.length;
        if (vendorShare < 0.1 && history.length >= 10) {
          score += 0.3;
          reasoning.push(`Vendor concentration: spending at new vendor "${currentVendor}" — agent normally uses ${uniqueVendors} vendors`);
        }
      } else if (uniqueVendors === 1 && history.length >= 5) {
        const soleVendor = Object.keys(vendorCounts)[0];
        if (soleVendor !== currentVendor) {
          score += 0.35;
          reasoning.push(`Vendor switch: agent previously only used "${soleVendor}", now spending at "${currentVendor}"`);
        }
      }
    }

    return Math.min(1, score);
  }

  private labelFor(score: number): SuspicionLabel {
    if (score >= 0.8) return "critical";
    if (score >= 0.6) return "high";
    if (score >= 0.3) return "elevated";
    return "normal";
  }
}

export const sharedControlEvaluationService = new ControlEvaluationService();
