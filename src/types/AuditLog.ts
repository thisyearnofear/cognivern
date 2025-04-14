import { Server } from 'socket.io';

export interface AuditLog {
  id: string;
  timestamp: string;
  agentId: string;
  action: {
    type: string;
    description: string;
    input: string;
    decision: string;
  };
  policyChecks: {
    policyId: string;
    result: boolean;
    reason: string;
  }[];
  metadata: {
    modelVersion: string;
    governancePolicy: string;
    complianceStatus: ComplianceStatus;
    latencyMs: number;
  };
}

export type ComplianceStatus = 'compliant' | 'non-compliant' | 'warning';

export interface AuditLogSearchParams {
  startDate: string;
  endDate: string;
  agentId?: string;
  actionType?: string;
  complianceStatus?: ComplianceStatus;
}

export interface AuditLogExportParams {
  startDate: string;
  endDate: string;
  format: 'json' | 'csv';
}

export interface WebSocketEvents {
  'subscribe:audit-logs': () => void;
  'subscribe:policies': () => void;
  'policy:created': (policy: any) => void;
  'policy:updated': (policy: any) => void;
  'audit-log:created': (log: AuditLog) => void;
}
