import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dbPath = path.join(
  os.tmpdir(),
  `cognivern-settlement-policy-${process.pid}-${Date.now()}.db`,
);
process.env.DB_PATH = dbPath;

const { getDb, closeDb } = await import('@backend/db/index.js');
const { FundedMandateService } = await import(
  '@backend/services/governance/FundedMandateService.js'
);
const { resolveSettlementPolicy, recordSettlementConsumption } = await import(
  '@backend/services/blockchain/solana/SettlementPolicy.js'
);

const WORKSPACE = 'workspace-settlement-policy';
const ENV_LIMITS = {
  maxTransferUsd: 0.05,
  runwayUsd: 0.25,
  payeeAllowlist: ['11111111111111111111111111111111'],
  policySource: 'env' as const,
};

beforeAll(() => {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare('INSERT OR IGNORE INTO users (id, created_at, last_login_at) VALUES (?, ?, ?)').run(
    'user-settlement-policy',
    now,
    now,
  );
  db.prepare(
    "INSERT OR IGNORE INTO workspaces (id, name, owner_id, tier, created_at, updated_at) VALUES (?, ?, ?, 'live', ?, ?)",
  ).run(WORKSPACE, WORKSPACE, 'user-settlement-policy', now, now);
  db.prepare(
    "INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, role, created_at) VALUES (?, ?, 'owner', ?)",
  ).run(WORKSPACE, 'user-settlement-policy', now);
});

afterAll(() => {
  closeDb();
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      fs.unlinkSync(`${dbPath}${suffix}`);
    } catch {
      // Ignore SQLite cleanup races.
    }
  }
});

function createMandate(over: {
  status?: 'active' | 'paused';
  allocatedAmount?: string;
  consumedAmount?: string;
  settlement?: Record<string, unknown>;
}) {
  // Mandate amounts are integer base units; USDC has 6 decimals.
  const allocated = over.allocatedAmount ?? '200000';
  const consumed = over.consumedAmount ?? '0';
  return FundedMandateService.create(WORKSPACE, {
    name: `Settlement ${Math.random().toString(36).slice(2, 8)}`,
    objective: 'Bound Solana settlement',
    status: over.status ?? 'active',
    budget: {
      byAsset: {
        USDC: {
          authorizedAmount: allocated,
          allocatedAmount: allocated,
          consumedAmount: consumed,
          pendingAmount: (BigInt(allocated) - BigInt(consumed)).toString(),
        },
      },
    },
    ...(over.settlement ? { settlement: over.settlement as never } : {}),
  });
}

describe('resolveSettlementPolicy', () => {
  it('labels env-only bounds and warns when no mandate is named', () => {
    const resolved = resolveSettlementPolicy({
      workspaceId: WORKSPACE,
      amountUsd: 0.01,
      envLimits: ENV_LIMITS,
    });
    expect(resolved.policySource).toBe('env');
    expect(resolved.limits).toEqual(ENV_LIMITS);
    expect(resolved.violations).toEqual([]);
    expect(resolved.warnings.join()).toContain('no mandateId');
  });

  it('uses the mandate budget as the ceiling and keeps env caps', () => {
    const mandate = createMandate({ allocatedAmount: '30000', consumedAmount: '0' });
    const resolved = resolveSettlementPolicy({
      workspaceId: WORKSPACE,
      mandateId: mandate.id,
      amountUsd: 0.01,
      envLimits: ENV_LIMITS,
    });
    expect(resolved.policySource).toBe('funded_mandate');
    expect(resolved.limits.maxTransferUsd).toBe(0.03);
    expect(resolved.limits.runwayUsd).toBe(0.03);
    expect(resolved.limits.payeeAllowlist).toEqual(ENV_LIMITS.payeeAllowlist);
    expect(resolved.violations).toEqual([]);
  });

  it('blocks a missing mandate and an inactive mandate', () => {
    const missing = resolveSettlementPolicy({
      workspaceId: WORKSPACE,
      mandateId: 'does-not-exist',
      amountUsd: 0.01,
      envLimits: ENV_LIMITS,
    });
    expect(missing.violations.join()).toContain('not found');

    const paused = createMandate({ status: 'paused' });
    const resolved = resolveSettlementPolicy({
      workspaceId: WORKSPACE,
      mandateId: paused.id,
      amountUsd: 0.01,
      envLimits: ENV_LIMITS,
    });
    expect(resolved.violations.join()).toContain('paused');
  });

  it('blocks when the mandate budget cannot cover the transfer', () => {
    const mandate = createMandate({ allocatedAmount: '20000', consumedAmount: '15000' });
    const resolved = resolveSettlementPolicy({
      workspaceId: WORKSPACE,
      mandateId: mandate.id,
      amountUsd: 0.01,
      envLimits: ENV_LIMITS,
    });
    expect(resolved.violations.join()).toContain('remaining budget');
  });

  it('blocks mandate constraints the Solana rail cannot satisfy', () => {
    const mandate = createMandate({
      settlement: {
        allowedAssets: ['aUSDC'],
        requireCleanverseIdentity: true,
        requireVerifiedSettlement: true,
        chainIds: [10143],
      },
    });
    const resolved = resolveSettlementPolicy({
      workspaceId: WORKSPACE,
      mandateId: mandate.id,
      amountUsd: 0.01,
      envLimits: ENV_LIMITS,
    });
    const joined = resolved.violations.join('\n');
    expect(joined).toContain('only permits assets');
    expect(joined).toContain('Cleanverse identity');
    expect(joined).toContain('verified settlement');
    expect(joined).toContain('chainIds');
  });
});

describe('recordSettlementConsumption', () => {
  it('debits the mandate only when a mandate is named', () => {
    expect(recordSettlementConsumption({ workspaceId: WORKSPACE, amountUsd: 0.01 })).toEqual({
      ok: true,
    });
  });

  it('moves consumed up and pending down', () => {
    const mandate = createMandate({ allocatedAmount: '200000', consumedAmount: '50000' });
    const result = recordSettlementConsumption({
      workspaceId: WORKSPACE,
      mandateId: mandate.id,
      amountUsd: 0.05,
    });
    expect(result.ok).toBe(true);
    const updated = FundedMandateService.get(WORKSPACE, mandate.id);
    expect(updated?.budget.byAsset.USDC.consumedAmount).toBe('100000');
    expect(updated?.budget.byAsset.USDC.pendingAmount).toBe('100000');
  });

  it('refuses to overdraw the mandate budget', () => {
    const mandate = createMandate({ allocatedAmount: '20000', consumedAmount: '15000' });
    const result = recordSettlementConsumption({
      workspaceId: WORKSPACE,
      mandateId: mandate.id,
      amountUsd: 0.01,
    });
    expect(result).toMatchObject({ ok: false, reason: 'mandate budget exhausted' });
  });
});
