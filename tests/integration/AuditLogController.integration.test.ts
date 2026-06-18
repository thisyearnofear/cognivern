import { describe, it, expect, vi } from 'vitest';

// Mock FilecoinStorageService to avoid config import issues in vitest
vi.mock('../../src/backend/services/blockchain/FilecoinStorageService.js', () => ({
  FilecoinStorageService: class {
    enabled = false;
  },
}));

const { AuditLogController } = await import(
  '../../src/backend/modules/api/controllers/AuditLogController.js'
);
const { owsWalletService } = await import('../../src/backend/services/blockchain/OwsWalletService.js');

class MockRes {
  statusCode = 200;
  payload: any = null;

  status(code: number) {
    this.statusCode = code;
    return this;
  }

  json(body: any) {
    this.payload = body;
    return this;
  }
}

function makeReq(body: any = {}) {
  return { body } as any;
}

describe('AuditLogController', () => {
  it('issuePermit returns permit payload', async () => {
    const controller = new AuditLogController();
    const res = new MockRes();

    const originalIssue = owsWalletService.issueAuditPermit;
    owsWalletService.issueAuditPermit = (async () => '0xabc123') as any;

    try {
      await controller.issuePermit(
        makeReq({
          auditor: '0xAuditor',
          policyId: 'policy-confidential',
        }),
        res as any,
      );
    } finally {
      owsWalletService.issueAuditPermit = originalIssue;
    }

    expect(res.statusCode).toBe(200);
    expect(res.payload?.success).toBe(true);
    expect(res.payload?.data?.permit).toBe('0xabc123');
  });

  it('issuePermit validates payload', async () => {
    const controller = new AuditLogController();
    const res = new MockRes();

    await controller.issuePermit(
      makeReq({ auditor: '0xAuditor' }), // missing required policyId
      res as any,
    );

    expect(res.statusCode).toBe(400);
    expect(res.payload?.success).toBe(false);
  });
});
