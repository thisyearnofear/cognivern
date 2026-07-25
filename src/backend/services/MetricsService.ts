import { Metrics, MetricsPeriod } from "@backend/types/Metrics.js";
import { AgentAction, PolicyCheck } from "@backend/types/Agent.js";
import logger from "@backend/utils/logger.js";
import { meter } from "@backend/observability/otel.js";

/**
 * MetricsService now emits real OpenTelemetry metrics for SigNoz.
 *
 * Legacy DB-backed aggregation is replaced by OTel counters/histograms
 * that flow into SigNoz dashboards. The `getMetrics` method still
 * returns a synthetic snapshot for backward compatibility with the
 * existing MetricsController, but the real data lives in SigNoz.
 */
export class MetricsService {
  private actionCounter = meter.createCounter("cognivern.agent.actions.total", {
    description: "Total agent actions recorded",
  });
  private actionLatency = meter.createHistogram(
    "cognivern.agent.action.latency.ms",
    { description: "Agent action evaluation latency" },
  );

  constructor() {
    logger.info("MetricsService initialized (OpenTelemetry Mode)");
  }

  async recordAction(
    action: AgentAction,
    checks: PolicyCheck[],
    latencyMs: number,
  ): Promise<void> {
    const passed = checks.every((c) => c.result);
    const violations = checks.filter((c) => !c.result).length;

    this.actionCounter.add(1, {
      action_type: action.type,
      outcome: passed ? "success" : "blocked",
    });
    this.actionLatency.record(latencyMs, { action_type: action.type });

    if (violations > 0) {
      meter
        .createCounter("cognivern.agent.policy.violations.total")
        .add(violations, { action_type: action.type });
    }

    logger.info("[Metrics] Action recorded", {
      actionType: action.type,
      latencyMs,
      passed,
      violations,
    });
  }

  async getMetrics(period: MetricsPeriod): Promise<Metrics> {
    // Real metrics live in SigNoz. This stub preserves the legacy API
    // shape so the existing MetricsController endpoint keeps working.
    return this.createEmptyMetrics(period);
  }

  private createEmptyMetrics(period: MetricsPeriod): Metrics {
    return {
      timestamp: new Date().toISOString(),
      period,
      data: {
        actions: { total: 0, successful: 0, failed: 0, blocked: 0 },
        policies: { total: 0, violations: 0, enforced: 0 },
        performance: {
          averageResponseTime: 0,
          p95ResponseTime: 0,
          maxResponseTime: 0,
        },
        resources: { cpuUsage: 0, memoryUsage: 0, storageUsage: 0 },
      },
    };
  }
}
