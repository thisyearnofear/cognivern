import { AgentAction, PolicyCheck } from '../types/Agent';
import { RecallClient } from '@recallnet/sdk';

export interface AuditLog {
  timestamp: string;
  action: AgentAction;
  policyChecks: PolicyCheck[];
  outcome: 'allowed' | 'denied';
  metadata: Record<string, any>;
}

export class AuditLogService {
  private recall: RecallClient;
  private bucketAddress: string;

  constructor(recall: RecallClient, bucketAddress: string) {
    this.recall = recall;
    this.bucketAddress = bucketAddress;
  }

  async logAction(
    action: AgentAction,
    policyChecks: PolicyCheck[],
    allowed: boolean,
  ): Promise<void> {
    const log: AuditLog = {
      timestamp: new Date().toISOString(),
      action,
      policyChecks,
      outcome: allowed ? 'allowed' : 'denied',
      metadata: {
        environment: process.env.NODE_ENV,
        agentVersion: process.env.AGENT_VERSION || '1.0.0',
      },
    };

    const logPath = `agents/escheat-agent-1/logs/${log.timestamp}-${action.id}.json`;
    await this.recall.bucket.add(
      this.bucketAddress,
      logPath,
      Buffer.from(JSON.stringify(log, null, 2)),
    );
  }

  async getActionLogs(startTime: string, endTime: string): Promise<AuditLog[]> {
    const logs: AuditLog[] = [];
    const prefix = 'agents/escheat-agent-1/logs/';

    const objects = await this.recall.bucket.query(this.bucketAddress, {
      prefix,
      // Add time-based filtering when available in the SDK
    });

    for (const obj of objects) {
      const logData = await this.recall.bucket.get(this.bucketAddress, obj.key);
      const log = JSON.parse(logData.toString()) as AuditLog;

      if (log.timestamp >= startTime && log.timestamp <= endTime) {
        logs.push(log);
      }
    }

    return logs.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  async searchLogs(query: {
    actionType?: string;
    outcome?: 'allowed' | 'denied';
    policyId?: string;
    startTime?: string;
    endTime?: string;
  }): Promise<AuditLog[]> {
    const logs = await this.getActionLogs(
      query.startTime || '1970-01-01T00:00:00Z',
      query.endTime || new Date().toISOString(),
    );

    return logs.filter((log) => {
      if (query.actionType && log.action.type !== query.actionType) return false;
      if (query.outcome && log.outcome !== query.outcome) return false;
      if (query.policyId && !log.policyChecks.some((check) => check.policyId === query.policyId))
        return false;
      return true;
    });
  }
}
