import { describe, expect, it } from 'vitest';
import { getRunIdForAuditLog } from '@/components/audit/audit-evidence';

describe('getRunIdForAuditLog', () => {
  it('returns the log id when the log is run-shaped (details.stepCount)', () => {
    const rawLog = {
      id: 'run-abc',
      details: { stepCount: 4, artifactCount: 3 },
      outcome: 'held',
    };
    expect(getRunIdForAuditLog(rawLog)).toBe('run-abc');
  });

  it('returns the log id when evidence.hash is present', () => {
    const rawLog = {
      id: 'run-def',
      evidence: { hash: '0xabc' },
      outcome: 'approved',
    };
    expect(getRunIdForAuditLog(rawLog)).toBe('run-def');
  });

  it('returns null for demo/synthetic logs without run-shaped fields', () => {
    const demoLog = {
      id: 'log-001',
      agent: 'Alpha Trader',
      actionType: 'swap',
      outcome: 'approved',
      latency: '45ms',
    };
    expect(getRunIdForAuditLog(demoLog)).toBeNull();
  });

  it('returns null when there is no id or the payload is not an object', () => {
    expect(getRunIdForAuditLog({ details: { stepCount: 1 } })).toBeNull();
    expect(getRunIdForAuditLog(null)).toBeNull();
    expect(getRunIdForAuditLog('log-001')).toBeNull();
  });
});