/**
 * Activity Utilities - Normalization and transformation functions
 * Extracted from UnifiedDashboard for better modularity
 */

import { ActivityItem } from './types';

/**
 * Unwrap API payload helper
 */
export const unwrapApiPayload = <T>(result: { success: boolean; data?: unknown }): T | null => {
  if (!result.success || !result.data || typeof result.data !== 'object') {
    return null;
  }

  const data = result.data as Record<string, unknown>;
  if (!data.data) {
    return null;
  }

  return data.data as T;
};

/**
 * Build audit path URL from activity data
 */
export const buildAuditPath = (activity: {
  agentId?: string;
  type?: string;
  severity?: string;
  sourceId?: string;
}): string => {
  const params = new URLSearchParams();
  if (activity.agentId) {
    params.set('agentId', activity.agentId);
  }
  if (activity.type) {
    params.set('actionType', activity.type);
  }
  if (activity.severity === 'error') {
    params.set('complianceStatus', 'non-compliant');
  }
  if (activity.sourceId) {
    params.set('eventId', activity.sourceId);
  }
  const query = params.toString();
  return query ? `/audit?${query}` : '/audit';
};

/**
 * Convert backend severity to UI severity
 */
export const toUiSeverity = (value?: string): ActivityItem['severity'] => {
  switch (value) {
    case 'compliant':
    case 'success':
    case 'low':
      return 'success';
    case 'warning':
    case 'medium':
      return 'warning';
    case 'non-compliant':
    case 'high':
    case 'critical':
    case 'error':
      return 'error';
    default:
      return 'info';
  }
};

/**
 * Map quest severity to UI severity
 */
export const mapQuestSeverity = (
  s: 'low' | 'medium' | 'high' | 'critical'
): 'success' | 'warning' | 'error' | 'info' => {
  switch (s) {
    case 'critical':
    case 'high':
      return 'error';
    case 'medium':
      return 'warning';
    case 'low':
      return 'info';
    default:
      return 'info';
  }
};

interface AuditEntry {
  id?: unknown;
  agent?: unknown;
  actionType?: unknown;
  type?: unknown;
  severity?: unknown;
  complianceStatus?: unknown;
  description?: unknown;
  action?: unknown;
  timestamp?: unknown;
  details?: {
    agentId?: unknown;
    agent?: { name?: unknown };
    projectId?: unknown;
    citations?: unknown[];
  };
  policyChecks?: Array<{ policyId?: unknown }>;
  evidence?: {
    artifactIds?: unknown[];
    hash?: unknown;
    cid?: unknown;
  };
}

/**
 * Normalize audit entry to ActivityItem
 */
export const normalizeActivity = (entry: AuditEntry): ActivityItem => ({
  id: String(entry.id || crypto.randomUUID()),
  agentId:
    typeof entry.agent === 'string'
      ? entry.agent
      : typeof entry.details?.agentId === 'string'
        ? entry.details.agentId
        : undefined,
  agentName:
    typeof entry.agent === 'string'
      ? entry.agent
      : typeof entry.details?.agent?.name === 'string'
        ? entry.details.agent.name
        : undefined,
  type: (typeof entry.actionType === 'string' ? entry.actionType : entry.type) as
    | string
    | undefined,
  severity: toUiSeverity(
    typeof entry.severity === 'string' || typeof entry.complianceStatus === 'string'
      ? ((entry.severity || entry.complianceStatus) as string)
      : undefined
  ),
  description:
    typeof entry.description === 'string'
      ? entry.description
      : typeof entry.action === 'string'
        ? entry.action
        : 'Activity',
  timestamp: typeof entry.timestamp === 'string' ? entry.timestamp : undefined,
  sourceType: 'audit',
  sourceId: typeof entry.id === 'string' ? entry.id : undefined,
  targetPath: buildAuditPath({
    agentId:
      typeof entry.agent === 'string'
        ? entry.agent
        : typeof entry.details?.agentId === 'string'
          ? entry.details.agentId
          : undefined,
    type: (typeof entry.actionType === 'string' ? entry.actionType : entry.type) as
      | string
      | undefined,
    severity:
      typeof entry.severity === 'string' || typeof entry.complianceStatus === 'string'
        ? toUiSeverity((entry.severity || entry.complianceStatus) as string)
        : undefined,
    sourceId: typeof entry.id === 'string' ? entry.id : undefined,
  }),
  evidenceLabel: typeof entry.id === 'string' ? `Audit ${entry.id}` : undefined,
  policyIds: Array.isArray(entry.policyChecks)
    ? entry.policyChecks
        .map((check) => (typeof check.policyId === 'string' ? check.policyId : null))
        .filter((value): value is string => Boolean(value))
    : [],
  artifactIds: Array.isArray(entry.evidence?.artifactIds)
    ? entry.evidence.artifactIds.filter((value): value is string => typeof value === 'string')
    : [],
  projectId: typeof entry.details?.projectId === 'string' ? entry.details.projectId : undefined,
  citations: Array.isArray(entry.details?.citations)
    ? entry.details.citations.filter((value): value is string => typeof value === 'string')
    : [],
  evidenceHash: typeof entry.evidence?.hash === 'string' ? entry.evidence.hash : undefined,
  cid: typeof entry.evidence?.cid === 'string' ? entry.evidence.cid : undefined,
});

interface RunStreamEntry {
  id?: unknown;
  runId?: unknown;
  workflow?: unknown;
  type?: unknown;
  summary?: unknown;
  timestamp?: unknown;
  projectId?: unknown;
  artifactCount?: unknown;
  evidence?: {
    artifactIds?: unknown[];
    hash?: unknown;
    cid?: unknown;
  };
  runEvidence?: {
    artifactIds?: unknown[];
    hash?: unknown;
    cid?: unknown;
  };
  citationLabels?: unknown[];
  model?: unknown;
  workflowVersion?: unknown;
}

/**
 * Normalize run stream entry to ActivityItem
 */
export const normalizeRunStreamActivity = (entry: RunStreamEntry): ActivityItem => ({
  id: String(entry.id || crypto.randomUUID()),
  agentId: typeof entry.runId === 'string' ? entry.runId : undefined,
  agentName: typeof entry.workflow === 'string' ? entry.workflow : 'CRE Run',
  type: typeof entry.type === 'string' ? entry.type : 'run_event',
  severity:
    entry.type === 'run_failed'
      ? 'error'
      : entry.type === 'run_paused_for_approval'
        ? 'warning'
        : 'info',
  description:
    typeof entry.summary === 'string' && entry.summary.trim().length > 0
      ? entry.summary
      : `${entry.workflow || 'workflow'} emitted ${entry.type || 'run_event'}`,
  timestamp: typeof entry.timestamp === 'string' ? entry.timestamp : undefined,
  sourceType: 'run',
  sourceId: typeof entry.id === 'string' ? entry.id : undefined,
  runId: typeof entry.runId === 'string' ? entry.runId : undefined,
  targetPath: typeof entry.runId === 'string' ? `/runs/${entry.runId}` : '/runs',
  evidenceLabel: typeof entry.runId === 'string' ? `Run ${entry.runId}` : undefined,
  projectId: typeof entry.projectId === 'string' ? entry.projectId : undefined,
  workflow: typeof entry.workflow === 'string' ? entry.workflow : undefined,
  artifactCount: typeof entry.artifactCount === 'number' ? entry.artifactCount : undefined,
  artifactIds: Array.isArray(entry.evidence?.artifactIds)
    ? entry.evidence.artifactIds.filter((value): value is string => typeof value === 'string')
    : Array.isArray(entry.runEvidence?.artifactIds)
      ? entry.runEvidence.artifactIds.filter((value): value is string => typeof value === 'string')
      : [],
  citations: Array.isArray(entry.citationLabels)
    ? entry.citationLabels.filter((value): value is string => typeof value === 'string')
    : [],
  model: typeof entry.model === 'string' ? entry.model : undefined,
  workflowVersion: typeof entry.workflowVersion === 'string' ? entry.workflowVersion : undefined,
  evidenceHash:
    typeof entry.evidence?.hash === 'string'
      ? entry.evidence.hash
      : typeof entry.runEvidence?.hash === 'string'
        ? entry.runEvidence.hash
        : undefined,
  cid:
    typeof entry.evidence?.cid === 'string'
      ? entry.evidence.cid
      : typeof entry.runEvidence?.cid === 'string'
        ? entry.runEvidence.cid
        : undefined,
});

/**
 * Build evidence facts from activity
 */
export const buildEvidenceFacts = (activity: ActivityItem): string[] => {
  const facts: string[] = [];

  if (activity.projectId) {
    facts.push(`Project ${activity.projectId}`);
  }
  if (activity.workflow) {
    facts.push(`Workflow ${activity.workflow}`);
  }
  if (activity.policyIds && activity.policyIds.length > 0) {
    facts.push(`Policies ${activity.policyIds.slice(0, 2).join(', ')}`);
  }
  if (typeof activity.artifactCount === 'number') {
    facts.push(`${activity.artifactCount} artifacts`);
  }
  if (activity.model) {
    facts.push(`Model ${activity.model}`);
  }
  if (activity.workflowVersion) {
    facts.push(`Version ${activity.workflowVersion}`);
  }
  if (activity.cid) {
    facts.push(`CID ${activity.cid.slice(0, 12)}…`);
  }
  if (activity.evidenceHash) {
    facts.push(`Hash ${activity.evidenceHash.slice(0, 12)}…`);
  }
  if (activity.artifactIds && activity.artifactIds.length > 0) {
    facts.push(`Artifacts ${activity.artifactIds.slice(0, 2).join(', ')}`);
  }
  if (activity.citations && activity.citations.length > 0) {
    facts.push(`Citations ${activity.citations.slice(0, 2).join(', ')}`);
  }

  return facts;
};

/**
 * Build trust signals from activity
 */
export const buildTrustSignals = (activity: ActivityItem) => {
  const signals: Array<{
    label: string;
    variant: 'success' | 'secondary' | 'warning' | 'outline';
    hint: string;
  }> = [];

  if (activity.evidenceHash) {
    signals.push({
      label: 'hash-backed',
      variant: 'success',
      hint: 'Stable evidence hash is present for this event.',
    });
  }
  if (activity.cid) {
    signals.push({
      label: 'cid-linked',
      variant: 'secondary',
      hint: 'Event points to content-addressed evidence or artifact storage.',
    });
  }
  if (activity.policyIds && activity.policyIds.length > 0) {
    signals.push({
      label: 'policy-enforced',
      variant: 'warning',
      hint: `Mapped to ${activity.policyIds.length} policy check${activity.policyIds.length > 1 ? 's' : ''}.`,
    });
  }
  if (activity.sourceType === 'run' && activity.runId) {
    signals.push({
      label: 'run-linked',
      variant: 'outline',
      hint: 'Trace links back to a persisted run record.',
    });
  }

  return signals.slice(0, 3);
};
