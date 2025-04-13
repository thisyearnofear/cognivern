import { Metrics, MetricsPeriod, MetricsData } from '../types/Metrics';
import { AgentAction, PolicyCheck } from '../types/Agent';
import { RecallClient } from '@recallnet/sdk';

export class MetricsService {
  private recall: RecallClient;
  private bucketAddress: string;
  private metricsCache: Map<string, Metrics>;
  private startTime: number;

  constructor(recall: RecallClient, bucketAddress: string) {
    this.recall = recall;
    this.bucketAddress = bucketAddress;
    this.metricsCache = new Map();
    this.startTime = Date.now();
  }

  async recordAction(
    action: AgentAction,
    policyChecks: PolicyCheck[],
    duration: number,
  ): Promise<void> {
    const timestamp = new Date().toISOString();
    const metrics = await this.getCurrentMetrics();

    // Update action counts
    metrics.data.actions.total++;
    if (policyChecks.some((check) => !check.result)) {
      metrics.data.actions.failed++;
    } else {
      metrics.data.actions.successful++;
    }

    // Update policy metrics
    metrics.data.policies.total += policyChecks.length;
    metrics.data.policies.violations += policyChecks.filter((check) => !check.result).length;
    metrics.data.policies.enforced += policyChecks.filter((check) => check.result).length;

    // Update performance metrics
    const totalTime =
      metrics.data.performance.averageResponseTime * (metrics.data.actions.total - 1);
    metrics.data.performance.averageResponseTime =
      (totalTime + duration) / metrics.data.actions.total;
    metrics.data.performance.maxResponseTime = Math.max(
      metrics.data.performance.maxResponseTime,
      duration,
    );

    // Update resource metrics (example values - replace with actual monitoring)
    metrics.data.resources = {
      cpuUsage: process.cpuUsage().user / 1000000, // Convert to seconds
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // Convert to MB
      storageUsage: 0, // To be implemented
    };

    await this.saveMetrics(metrics);
  }

  private async getCurrentMetrics(): Promise<Metrics> {
    const period = this.getCurrentPeriod();
    const cacheKey = `${period}-${new Date().toISOString().split('T')[0]}`;

    if (!this.metricsCache.has(cacheKey)) {
      try {
        const metricsPath = `agents/escheat-agent-1/metrics/${cacheKey}.json`;
        const data = await this.recall.bucket.get(this.bucketAddress, metricsPath);
        this.metricsCache.set(cacheKey, JSON.parse(data.toString()));
      } catch {
        // Initialize new metrics if none exist
        this.metricsCache.set(cacheKey, this.createEmptyMetrics(period));
      }
    }

    return this.metricsCache.get(cacheKey)!;
  }

  private async saveMetrics(metrics: Metrics): Promise<void> {
    const period = this.getCurrentPeriod();
    const cacheKey = `${period}-${new Date().toISOString().split('T')[0]}`;
    const metricsPath = `agents/escheat-agent-1/metrics/${cacheKey}.json`;

    await this.recall.bucket.add(
      this.bucketAddress,
      metricsPath,
      Buffer.from(JSON.stringify(metrics, null, 2)),
    );

    this.metricsCache.set(cacheKey, metrics);
  }

  private getCurrentPeriod(): MetricsPeriod {
    const uptime = Date.now() - this.startTime;
    if (uptime < 3600000) return MetricsPeriod.HOURLY;
    if (uptime < 86400000) return MetricsPeriod.DAILY;
    if (uptime < 604800000) return MetricsPeriod.WEEKLY;
    return MetricsPeriod.MONTHLY;
  }

  private createEmptyMetrics(period: MetricsPeriod): Metrics {
    return {
      timestamp: new Date().toISOString(),
      period,
      data: {
        actions: {
          total: 0,
          successful: 0,
          failed: 0,
          blocked: 0,
        },
        policies: {
          total: 0,
          violations: 0,
          enforced: 0,
        },
        performance: {
          averageResponseTime: 0,
          p95ResponseTime: 0,
          maxResponseTime: 0,
        },
        resources: {
          cpuUsage: 0,
          memoryUsage: 0,
          storageUsage: 0,
        },
      },
    };
  }

  async getMetrics(period: MetricsPeriod): Promise<Metrics[]> {
    const prefix = `agents/escheat-agent-1/metrics/${period}`;
    const objects = await this.recall.bucket.query(this.bucketAddress, { prefix });
    const metrics: Metrics[] = [];

    for (const obj of objects) {
      const data = await this.recall.bucket.get(this.bucketAddress, obj.key);
      metrics.push(JSON.parse(data.toString()));
    }

    return metrics.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }
}
