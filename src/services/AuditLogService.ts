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

  async searchLogs(options: { startTime: string; endTime: string }): Promise<any[]> {
    const bucketManager = this.recall.bucketManager();
    const { result } = await bucketManager.query(this.bucketAddress, {
      prefix: 'audit/',
      startKey: options.startTime,
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
      return timestamp >= new Date(options.startTime) && timestamp <= new Date(options.endTime);
    });
  }
}
