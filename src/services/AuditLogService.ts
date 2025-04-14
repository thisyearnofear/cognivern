import { AgentAction, PolicyCheck } from '../types/Agent.js';
import { RecallClient } from '@recallnet/sdk/client';
import type { Address } from 'viem';

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
  }

  async logAction(
    action: AgentAction,
    policyChecks: PolicyCheck[],
    allowed: boolean,
  ): Promise<void> {
    const logEntry = {
      timestamp: new Date().toISOString(),
      action,
      policyChecks,
      allowed,
    };

    const bucketManager = this.recall.bucketManager();
    await bucketManager.add(
      this.bucketAddress,
      `audit/${action.id}`,
      new TextEncoder().encode(JSON.stringify(logEntry)),
    );
  }

  async getActionLogs(startTime: string, endTime: string): Promise<AuditLog[]> {
    const logs: AuditLog[] = [];
    const bucketManager = this.recall.bucketManager();
    const { result } = await bucketManager.query(this.bucketAddress, {
      prefix: 'audit/',
      startKey: startTime,
      limit: 100,
    });

    for (const obj of result.objects) {
      const { result: data } = await bucketManager.getObjectValue(this.bucketAddress, obj.key);
      const log = JSON.parse(new TextDecoder().decode(data as unknown as Uint8Array)) as AuditLog;

      if (log.timestamp >= startTime && log.timestamp <= endTime) {
        logs.push(log);
      }
    }

    return logs.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  async searchLogs(options: {
    startDate: string;
    endDate: string;
    agentId?: string;
    actionType?: string;
    complianceStatus?: string;
  }): Promise<any[]> {
    const bucketManager = this.recall.bucketManager();
    const { result } = await bucketManager.query(this.bucketAddress, {
      prefix: 'audit/',
      startKey: options.startDate,
      limit: 100,
    });

    const logs = await Promise.all(
      result.objects.map(async (obj) => {
        const { result: data } = await bucketManager.getObjectValue(this.bucketAddress, obj.key);
        return JSON.parse(new TextDecoder().decode(data as unknown as Uint8Array));
      }),
    );

    return logs.filter((log) => {
      const timestamp = new Date(log.timestamp);
      return (
        timestamp >= new Date(options.startDate) &&
        timestamp <= new Date(options.endDate) &&
        (!options.agentId || log.agentId === options.agentId) &&
        (!options.actionType || log.action.type === options.actionType) &&
        (!options.complianceStatus || log.metadata.complianceStatus === options.complianceStatus)
      );
    });
  }

  async exportLogs(startDate: string, endDate: string, format: 'json' | 'csv'): Promise<any> {
    const logs = await this.searchLogs({ startDate, endDate });

    if (format === 'csv') {
      // Convert logs to CSV format
      const headers = [
        'timestamp',
        'agentId',
        'actionType',
        'description',
        'complianceStatus',
        'latencyMs',
      ];
      const rows = logs.map((log) => [
        log.timestamp,
        log.agentId,
        log.action.type,
        log.action.description,
        log.metadata.complianceStatus,
        log.metadata.latencyMs,
      ]);

      const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

      return { format: 'csv', data: csvContent };
    }

    return { format: 'json', data: logs };
  }
}
