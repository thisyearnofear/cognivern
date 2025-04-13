import { Metrics, MetricsPeriod, MetricsData } from '../types/Metrics.js';
import { AgentAction, PolicyCheck } from '../types/Agent.js';
import { RecallClient } from '@recallnet/sdk/client';
import type { Address } from 'viem';

// Define a type for the raw metrics data we store
interface RawMetricsData {
  timestamp: string;
  action: string;
  latencyMs: number;
  policyChecks: number;
  policyPassed: boolean;
}

export class MetricsService {
  private recall: RecallClient;
  private bucketAddress: Address;

  constructor(recall: RecallClient, bucketAddress: Address) {
    this.recall = recall;
    this.bucketAddress = bucketAddress;
  }

  async recordAction(action: AgentAction, checks: PolicyCheck[], latencyMs: number): Promise<void> {
    const metrics: RawMetricsData = {
      timestamp: new Date().toISOString(),
      action: action.type,
      latencyMs,
      policyChecks: checks.length,
      policyPassed: checks.every((check) => check.result),
    };

    const bucketManager = this.recall.bucketManager();
    await bucketManager.add(
      this.bucketAddress,
      `metrics/${action.id}`,
      new TextEncoder().encode(JSON.stringify(metrics)),
    );
  }

  async getMetrics(period: MetricsPeriod): Promise<Metrics> {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - this.getPeriodDuration(period));

    const bucketManager = this.recall.bucketManager();
    const { result } = await bucketManager.query(this.bucketAddress, {
      prefix: 'metrics/',
      startKey: startTime.toISOString(),
      limit: 1000,
    });

    const rawMetrics = await Promise.all(
      result.objects.map(async (obj) => {
        const { result: data } = await bucketManager.getObjectValue(this.bucketAddress, obj.key);
        return JSON.parse(
          new TextDecoder().decode(data as unknown as Uint8Array),
        ) as RawMetricsData;
      }),
    );

    const filteredMetrics = rawMetrics.filter((m) => {
      const timestamp = new Date(m.timestamp);
      return timestamp >= startTime && timestamp <= endTime;
    });

    return this.aggregateMetrics(filteredMetrics, period);
  }

  private getPeriodDuration(period: MetricsPeriod): number {
    switch (period) {
      case MetricsPeriod.HOURLY:
        return 60 * 60 * 1000;
      case MetricsPeriod.DAILY:
        return 24 * 60 * 60 * 1000;
      case MetricsPeriod.WEEKLY:
        return 7 * 24 * 60 * 60 * 1000;
      case MetricsPeriod.MONTHLY:
        return 30 * 24 * 60 * 60 * 1000;
      default:
        throw new Error(`Invalid metrics period: ${period}`);
    }
  }

  private aggregateMetrics(metrics: RawMetricsData[], period: MetricsPeriod): Metrics {
    // Default empty metrics data
    const emptyMetricsData: MetricsData = {
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
    };

    if (metrics.length === 0) {
      return {
        timestamp: new Date().toISOString(),
        period,
        data: emptyMetricsData,
      };
    }

    // Calculate metrics
    const totalActions = metrics.length;
    const totalLatency = metrics.reduce((sum, m) => sum + m.latencyMs, 0);
    const averageResponseTime = totalLatency / totalActions;

    // Sort latencies to calculate p95
    const sortedLatencies = metrics.map((m) => m.latencyMs).sort((a, b) => a - b);
    const p95Index = Math.floor(sortedLatencies.length * 0.95);
    const p95ResponseTime = sortedLatencies[p95Index] || 0;
    const maxResponseTime = sortedLatencies[sortedLatencies.length - 1] || 0;

    // Count successful, failed, and policy violations
    const successful = metrics.filter((m) => m.policyPassed).length;
    const failed = totalActions - successful;

    // Count action types
    const actionTypes = metrics.reduce(
      (acc, m) => {
        acc[m.action] = (acc[m.action] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      timestamp: new Date().toISOString(),
      period,
      data: {
        actions: {
          total: totalActions,
          successful,
          failed,
          blocked: 0, // We don't track blocked actions yet
        },
        policies: {
          total: metrics.reduce((sum, m) => sum + m.policyChecks, 0),
          violations: metrics.filter((m) => !m.policyPassed).length,
          enforced: successful,
        },
        performance: {
          averageResponseTime,
          p95ResponseTime,
          maxResponseTime,
        },
        resources: {
          cpuUsage: 0, // We don't track these yet
          memoryUsage: 0,
          storageUsage: 0,
        },
      },
    };
  }
}
