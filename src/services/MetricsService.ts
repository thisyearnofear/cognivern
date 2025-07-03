import { Metrics, MetricsPeriod, MetricsData } from '../types/Metrics.js';
import { AgentAction, PolicyCheck } from '../types/Agent.js';
import logger from '../utils/logger.js';
import { RecallClient } from '@recallnet/sdk/client';
import { Address } from 'viem';

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
    logger.info('MetricsService initialized');
  }

  async recordAction(action: AgentAction, checks: PolicyCheck[], latencyMs: number): Promise<void> {
    const metrics: RawMetricsData = {
      timestamp: new Date().toISOString(),
      action: action.type,
      latencyMs,
      policyChecks: checks.length,
      policyPassed: checks.every((check) => check.result),
    };

    try {
      const bucketManager = this.recall.bucketManager();
      logger.info('Adding metrics to bucket:', {
        bucket: this.bucketAddress,
        actionId: action.id,
      });

      // Use a unique key based on timestamp and action ID
      const metricKey = `metrics/${new Date().toISOString().replace(/[:.]/g, '-')}-${action.id}`;

      // Properly encode the data as a Uint8Array
      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify(metrics));

      // Add the metrics to the bucket with proper type checking
      if (!(data instanceof Uint8Array)) {
        throw new Error('Failed to encode metrics data');
      }

      await bucketManager.add(this.bucketAddress, metricKey, data);
      logger.info('Successfully added metrics to bucket:', { key: metricKey });
    } catch (error) {
      logger.error(
        'Error adding metrics to bucket:',
        error instanceof Error ? error.message : 'Unknown error',
      );
      throw error;
    }
  }

  async getMetrics(period: MetricsPeriod): Promise<Metrics> {
    logger.info('Getting metrics for period:', period);
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - this.getPeriodDuration(period));

    try {
      // Try with 3 retries
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const bucketManager = this.recall.bucketManager();
          logger.debug(`Querying bucket for metrics (attempt ${attempt}/3):`, {
            bucket: this.bucketAddress,
            prefix: 'metrics/',
          });

          // Query for metrics with the metrics/ prefix
          const { result } = await bucketManager.query(this.bucketAddress, {
            prefix: 'metrics/',
          });

          logger.debug(`Found ${result.objects.length} metric objects in bucket`);

          if (result.objects.length === 0) {
            logger.info('No metrics found in Recall bucket, generating from governance data');
            return await this.createEmptyMetrics(period);
          }

          // Process each metric object
          const rawMetrics: RawMetricsData[] = [];

          for (const obj of result.objects) {
            try {
              logger.debug(`Fetching metric object: ${obj.key}`);
              const { result: data } = await bucketManager.get(this.bucketAddress, obj.key);
              const value = new TextDecoder().decode(data);
              const metric = JSON.parse(value) as RawMetricsData;
              rawMetrics.push(metric);
            } catch (objError) {
              console.error(
                `Error reading metric object ${obj.key}:`,
                objError instanceof Error ? objError.message : 'Unknown error',
              );
              // Continue to next object
            }
          }

          // Filter metrics by time period
          const filteredMetrics = rawMetrics.filter((m) => {
            const timestamp = new Date(m.timestamp);
            return timestamp >= startTime && timestamp <= endTime;
          });

          console.log(
            `Successfully filtered to ${filteredMetrics.length} valid metrics for the period`,
          );

          if (filteredMetrics.length === 0) {
            return this.createEmptyMetrics(period);
          }

          return this.aggregateMetrics(filteredMetrics, period);
        } catch (attemptError) {
          console.error(
            `Error in metrics fetch attempt ${attempt}/3:`,
            attemptError instanceof Error ? attemptError.message : 'Unknown error',
          );

          if (attempt < 3) {
            // Wait before retrying (exponential backoff)
            const delay = Math.pow(2, attempt) * 500;
            logger.debug(`Retrying metrics query in ${delay}ms...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
          } else {
            // Last attempt failed, throw the error
            throw attemptError;
          }
        }
      }

      // This shouldn't be reached due to the throw in the loop
      throw new Error('All retry attempts failed');
    } catch (error) {
      console.error(
        'Error fetching metrics from bucket:',
        error instanceof Error ? error.message : 'Unknown error',
      );

      // Return empty metrics on error
      return this.createEmptyMetrics(period);
    }
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

  private aggregateMetrics(metrics: RawMetricsData[], period: MetricsPeriod): Metrics {
    if (metrics.length === 0) {
      return this.createEmptyMetrics(period);
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
