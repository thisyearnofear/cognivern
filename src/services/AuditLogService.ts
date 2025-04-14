import { AgentAction, PolicyCheck } from '../types/Agent.js';
import { RecallClient } from '@recallnet/sdk/client';
import type { Address } from 'viem';
import logger from '../utils/logger.js';

export interface AuditLog {
  timestamp: string;
  action: AgentAction;
  policyChecks: PolicyCheck[];
  outcome: 'allowed' | 'denied';
  metadata: Record<string, any>;
}

export class AuditLogService {
  private recall: RecallClient;
  private bucketAddress: Address;

  constructor(recall: RecallClient, bucketAddress: Address) {
    this.recall = recall;
    this.bucketAddress = bucketAddress;
    logger.info('AuditLogService initialized');
  }

  async logAction(
    action: AgentAction,
    policyChecks: PolicyCheck[],
    allowed: boolean,
  ): Promise<void> {
    try {
      const logEntry = {
        timestamp: new Date().toISOString(),
        action,
        policyChecks,
        outcome: allowed ? 'allowed' : 'denied',
        metadata: {
          complianceStatus: allowed ? 'compliant' : 'non-compliant',
          latencyMs: 0, // You might want to pass this as a parameter
        },
      };

      const bucketManager = this.recall.bucketManager();
      await bucketManager.add(
        this.bucketAddress,
        `audit/${action.id}`,
        new TextEncoder().encode(JSON.stringify(logEntry)),
      );
      logger.info(`Successfully logged audit entry for action ${action.id}`);
    } catch (error) {
      logger.error(
        'Error logging audit entry:',
        error instanceof Error ? error.message : 'Unknown error',
      );
      // We don't rethrow to prevent cascading failures
    }
  }

  async getActionLogs(startTime: string, endTime: string): Promise<AuditLog[]> {
    try {
      logger.info('Retrieving audit logs', {
        startTime,
        endTime,
        bucketAddress: this.bucketAddress,
      });
      const bucketManager = this.recall.bucketManager();

      // First check if the bucket exists
      try {
        const { result: buckets } = await bucketManager.list();
        const foundBucket = buckets.find(
          (b) => b.addr.toLowerCase() === this.bucketAddress.toLowerCase(),
        );

        if (!foundBucket) {
          logger.warn('Bucket not found in account list', {
            bucketAddress: this.bucketAddress,
            availableBuckets: buckets.map((b) => b.addr),
          });
          return [];
        }

        logger.info('Found bucket for audit logs', {
          bucketAddress: this.bucketAddress,
          bucketName: foundBucket.metadata?.name,
        });
      } catch (listError) {
        logger.error(
          'Error listing buckets:',
          listError instanceof Error ? listError.message : 'Unknown error',
        );
        return [];
      }

      // Query the bucket
      const { result } = await bucketManager.query(this.bucketAddress, {
        prefix: 'audit/',
      });

      if (!result || !result.objects || result.objects.length === 0) {
        logger.info('No audit logs found', { prefix: 'audit/' });
        return [];
      }

      logger.info(`Found ${result.objects.length} audit log objects`);

      const logs: AuditLog[] = [];
      for (const obj of result.objects) {
        try {
          // Use get instead of getObjectValue
          const { result: data } = await bucketManager.get(this.bucketAddress, obj.key);

          // Handle different types of results
          let logData: AuditLog;
          if (typeof data === 'string') {
            logData = JSON.parse(data) as AuditLog;
          } else if (
            typeof data === 'object' &&
            data !== null &&
            ('byteLength' in data || Object.prototype.toString.call(data) === '[object Uint8Array]')
          ) {
            const content = new TextDecoder().decode(data as unknown as Uint8Array);
            logData = JSON.parse(content) as AuditLog;
          } else {
            // Try to stringify and parse as a last resort
            logData = JSON.parse(JSON.stringify(data)) as AuditLog;
          }

          if (logData.timestamp >= startTime && logData.timestamp <= endTime) {
            logs.push(logData);
          }
        } catch (objError) {
          logger.error(
            `Error processing audit log ${obj.key}:`,
            objError instanceof Error ? objError.message : 'Unknown error',
          );
          // Continue to next object
        }
      }

      return logs.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    } catch (error) {
      logger.error(
        'Error retrieving audit logs:',
        error instanceof Error ? error.message : 'Unknown error',
      );
      return [];
    }
  }

  async searchLogs(options: {
    startDate: string;
    endDate: string;
    agentId?: string;
    actionType?: string;
    complianceStatus?: string;
  }): Promise<any[]> {
    try {
      logger.info('Searching audit logs', { ...options, bucketAddress: this.bucketAddress });

      // Get all logs in the date range
      const logs = await this.getActionLogs(options.startDate, options.endDate);

      // Filter based on additional criteria
      return logs.filter((log) => {
        return (
          (!options.agentId || log.action.metadata?.agent === options.agentId) &&
          (!options.actionType || log.action.type === options.actionType) &&
          (!options.complianceStatus ||
            (options.complianceStatus === 'compliant' && log.outcome === 'allowed') ||
            (options.complianceStatus === 'non-compliant' && log.outcome === 'denied'))
        );
      });
    } catch (error) {
      logger.error(
        'Error searching audit logs:',
        error instanceof Error ? error.message : 'Unknown error',
      );
      return [];
    }
  }

  async exportLogs(startDate: string, endDate: string, format: 'json' | 'csv'): Promise<any> {
    try {
      const logs = await this.searchLogs({ startDate, endDate });

      if (format === 'csv') {
        // Convert logs to CSV format
        const headers = [
          'timestamp',
          'agentId',
          'actionType',
          'description',
          'outcome',
          'latencyMs',
        ];
        const rows = logs.map((log) => [
          log.timestamp,
          log.action.metadata?.agent || 'unknown',
          log.action.type,
          log.action.description,
          log.outcome,
          log.metadata?.latencyMs || 0,
        ]);

        const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

        return { format: 'csv', data: csvContent };
      }

      return { format: 'json', data: logs };
    } catch (error) {
      logger.error(
        'Error exporting audit logs:',
        error instanceof Error ? error.message : 'Unknown error',
      );
      return {
        format: format,
        data: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
