import { Metrics, MetricsPeriod } from "../types/Metrics.js";
import { AgentAction, PolicyCheck } from "../types/Agent.js";
import logger from "../utils/logger.js";

export class MetricsService {
  constructor() {
    logger.info("MetricsService initialized (Local Mode)");
  }

  async recordAction(
    action: AgentAction,
    checks: PolicyCheck[],
    latencyMs: number
  ): Promise<void> {
    logger.info(`[Metrics] Action: ${action.type}`, {
      latencyMs,
      passed: checks.every(c => c.result)
    });
  }

  async getMetrics(period: MetricsPeriod): Promise<Metrics> {
    return this.createEmptyMetrics(period);
  }

  private createEmptyMetrics(period: MetricsPeriod): Metrics {
    return {
      timestamp: new Date().toISOString(),
      period,
      data: {
        actions: { total: 0, successful: 0, failed: 0, blocked: 0 },
        policies: { total: 0, violations: 0, enforced: 0 },
        performance: { averageResponseTime: 0, p95ResponseTime: 0, maxResponseTime: 0 },
        resources: { cpuUsage: 0, memoryUsage: 0, storageUsage: 0 },
      },
    };
  }
}
