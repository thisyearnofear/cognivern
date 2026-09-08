import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { CreRun } from '@backend/cre/types.js';
import type { SpendIntent } from '@backend/services/blockchain/OwsWalletService.js';

/**
 * Threshold-gated signing approval flow.
 *
 * A spend at/above the policy's approvalThreshold is held; on operator approval
 * the wallet's configured signing provider signs it before execution, and the
 * signature + signer are recorded. These tests pin the *resume* half of that
 * loop against an isolated temp vault, mocking only the actual broadcast.
 */

const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const RECIPIENT = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

let tmpDir: string;
const savedEnv: Record<string, string | undefined> = {};

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ows-threshold-test-'));
  process.env.OWS_VAULT_PATH = path.join(tmpDir, 'ows-vault.json');
  process.env.OWS_VAULT_SECRET = 'test-vault-secret-threshold';
  process.env.CRE_RUNS_FILE = path.join(tmpDir, 'cre-runs.jsonl');
  for (const key of ['MONGODB_URI', 'XLAYER_PRIVATE_KEY']) {
    savedEnv[key] = process.env[key];
    process.env[key] = '';
  }
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.OWS_VAULT_PATH;
  delete process.env.OWS_VAULT_SECRET;
  delete process.env.CRE_RUNS_FILE;
  for (const [key, val] of Object.entries(savedEnv)) {
    if (val === undefined) delete process.env[key];
    else process.env[key] = val;
  }
});

function resetVaultFile() {
  fs.writeFileSync(
    process.env.OWS_VAULT_PATH!,
    JSON.stringify({ version: 1, wallets: [], apiKeys: [], agents: [] }),
  );
}

async function loadModules() {
  const { OwsWalletService } = await import(
    '../../src/backend/services/blockchain/OwsWalletService.js'
  );
  const { owsLocalVaultService } = await import(
    '../../src/backend/services/blockchain/OwsLocalVaultService.js'
  );
  const { creRunStore } = await import('../../src/backend/cre/storage/CreRunStore.js');
  return { OwsWalletService, owsLocalVaultService, creRunStore };
}

function makeIntent(id: string, amount: string): SpendIntent {
  return {
    id,
    agentId: 'agent-1',
    recipient: RECIPIENT,
    amount,
    asset: 'OKB',
    reason: 'threshold test',
    timestamp: new Date().toISOString(),
  };
}

/** Build a paused_for_approval CreRun with the artifacts resumeHeldSpendInner reads. */
async function seedHeldRun(
  creRunStore: any,
  intent: SpendIntent,
  walletId: string,
  policyId: string,
  holdReason: string | undefined,
): Promise<string> {
  const runId = `run-${intent.id}`;
  const now = new Date().toISOString();
  const heldRun: CreRun = {
    runId,
    projectId: 'test-workspace',
    workflow: 'spend',
    mode: 'cre',
    startedAt: now,
    ok: false,
    status: 'paused_for_approval',
    steps: [],
    artifacts: [
      { id: 'a1', type: 'spend_intent', createdAt: now, data: intent },
      {
        id: 'a2',
        type: 'error',
        createdAt: now,
        data: {
          intentId: intent.id,
          status: 'held',
          reason: 'threshold',
          holdReason,
          policyId,
          walletId,
        },
      },
    ],
  };
  await creRunStore.add(heldRun);
  return runId;
}


describe('Threshold-gated signing approval flow', () => {
  beforeEach(async () => {
    resetVaultFile();
    const { creRunStore } = await loadModules();
    await creRunStore.reset();
    vi.restoreAllMocks();
  });

  it('resumes a threshold-gated hold by signing via the wallet provider (signature present)', async () => {
    const { OwsWalletService, owsLocalVaultService, creRunStore } = await loadModules();
    const wallet = await owsLocalVaultService.importWallet({
      name: 'Treasury',
      privateKey: TEST_PRIVATE_KEY,
      metadata: { signingProvider: 'local' },
    });

    const sendSpy = vi
      .spyOn(owsLocalVaultService, 'sendNativeTransfer')
      .mockResolvedValue({ txHash: '0x' + 'f'.repeat(64), from: wallet.accounts[0]?.address });

    const intent = makeIntent('intent-thr', '1000');
    const runId = await seedHeldRun(creRunStore, intent, wallet.id, 'policy-1', 'threshold');

    const service = new OwsWalletService();
    vi.spyOn(service as any, 'verifyTransferReceipt').mockResolvedValue({ outcome: 'verified' });

    const result = await service.resumeHeldSpend(runId, 'operator-1');

    expect(result.status).toBe('approved');
    expect(result.transferStatus).toBe('sent');
    // The threshold-resume path signs via the configured provider, so a real
    // signature is produced (the operator path passes signature=undefined).
    expect(result.signature).toBeTruthy();
    expect(typeof result.signature).toBe('string');
    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy.mock.calls[0][0].to).toBe(RECIPIENT);
  });

  it('keeps the operator broadcast path for a non-threshold hold (no provider signature)', async () => {
    const { OwsWalletService, owsLocalVaultService, creRunStore } = await loadModules();
    const wallet = await owsLocalVaultService.importWallet({
      name: 'Treasury',
      privateKey: TEST_PRIVATE_KEY,
    });

    vi.spyOn(owsLocalVaultService, 'sendNativeTransfer').mockResolvedValue({
      txHash: '0x' + '1'.repeat(64),
      from: wallet.accounts[0]?.address,
    });

    const intent = makeIntent('intent-non-thr', '1000');
    // No holdReason → existing operator-broadcast path (regression guard).
    const runId = await seedHeldRun(creRunStore, intent, wallet.id, 'policy-1', undefined);

    const service = new OwsWalletService();
    vi.spyOn(service as any, 'verifyTransferReceipt').mockResolvedValue({ outcome: 'verified' });

    const result = await service.resumeHeldSpend(runId, 'operator-1');

    expect(result.status).toBe('approved');
    // Operator path does not invoke the SigningProvider → signature is undefined.
    expect(result.signature).toBeUndefined();
  });

  it('denies (no execution) when signing fails on threshold resume', async () => {
    const { OwsWalletService, owsLocalVaultService, creRunStore } = await loadModules();
    const wallet = await owsLocalVaultService.importWallet({
      name: 'Treasury',
      privateKey: TEST_PRIVATE_KEY,
      metadata: { signingProvider: 'speculos' },
    });

    const sendSpy = vi.spyOn(owsLocalVaultService, 'sendNativeTransfer').mockResolvedValue({
      txHash: '0x' + '2'.repeat(64),
      from: wallet.accounts[0]?.address,
    });
    // External (speculos) signing fails → resume must deny without broadcasting.
    vi.spyOn(owsLocalVaultService, 'signWithExternalWallet').mockResolvedValue(null);

    const intent = makeIntent('intent-sign-fail', '1000');
    const runId = await seedHeldRun(creRunStore, intent, wallet.id, 'policy-1', 'threshold');

    const service = new OwsWalletService();
    const result = await service.resumeHeldSpend(runId, 'operator-1');

    expect(result.status).toBe('denied');
    expect(result.error).toMatch(/signing via the configured provider failed/i);
    // No broadcast must have happened on a signing failure.
    expect(sendSpy).not.toHaveBeenCalled();
  });
});
