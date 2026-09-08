import { describe, it, expect } from 'vitest';
import { AuditLogService } from '@backend/services/governance/AuditLogService.js';
import type { CreRun } from '@backend/cre/types.js';

/**
 * A threshold-gated hold must surface in the dashboard's "attention" state.
 *
 * The chain is: handleHold -> pauseForApproval (status paused_for_approval) ->
 * mapCreRunToAuditLog -> outcome "held" -> frontend normalizeDecisionStatus
 * -> heldCount -> deriveWorkspaceState "attention". These tests pin
 * mapCreRunToAuditLog directly so the link is verified end-to-end at the
 * mapping seam, and that the holdReason is surfaced so the hold is legible
 * (threshold vs. policy-review vs. signing-failure).
 *
 * mapCreRunToAuditLog is pure (no store needed), so we construct runs directly.
 */
function baseRun(overrides: Partial<CreRun> = {}): CreRun {
  return {
    runId: 'run-1',
    projectId: 'ws',
    workflow: 'spend',
    mode: 'cre',
    startedAt: '2026-08-09T12:00:00.000Z',
    ok: false,
    steps: [],
    artifacts: [],
    ...overrides,
  };
}

// AuditLogService constructor requires a CreRunStore; mapCreRunToAuditLog is
// pure and never touches the store, so pass a never-used stub.
const service = new AuditLogService({} as never);

describe('mapCreRunToAuditLog surfaces threshold-held spends', () => {
  it('maps a paused_for_approval run to outcome "held"', () => {
    const log = service.mapCreRunToAuditLog(
      baseRun({ status: 'paused_for_approval', requiresApproval: true, approvalState: 'pending' }),
    );
    expect(log.outcome).toBe('held');
  });

  it('surfaces holdReason "threshold" so the hold is legible in the audit feed', () => {
    const log = service.mapCreRunToAuditLog(
      baseRun({
        status: 'paused_for_approval',
        requiresApproval: true,
        approvalState: 'pending',
        artifacts: [
          {
            id: 'a1',
            type: 'error',
            createdAt: 't',
            data: { status: 'held', reason: 'meets approval threshold', holdReason: 'threshold' },
          },
        ],
      }),
    );
    expect(log.outcome).toBe('held');
    expect(log.metadata.holdReason).toBe('threshold');
  });

  it('leaves holdReason undefined for a held run that did not record a reason', () => {
    // A legacy / policy-review hold (no holdReason) must still surface as held
    // but without a threshold label.
    const log = service.mapCreRunToAuditLog(
      baseRun({
        status: 'paused_for_approval',
        requiresApproval: true,
        approvalState: 'pending',
        artifacts: [
          { id: 'a1', type: 'error', createdAt: 't', data: { status: 'held', reason: 'manual review' } },
        ],
      }),
    );
    expect(log.outcome).toBe('held');
    expect(log.metadata.holdReason).toBeUndefined();
  });

  it('does not mark a completed spend as held', () => {
    const log = service.mapCreRunToAuditLog(
      baseRun({ status: 'completed', ok: true, finishedAt: '2026-08-09T12:00:05.000Z' }),
    );
    expect(log.outcome).toBe('allowed');
  });
});
