import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const RECIPIENT = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

let tmpDir: string;
const savedEnv: Record<string, string | undefined> = {};

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ows-cleanverse-test-'));
  process.env.OWS_VAULT_PATH = path.join(tmpDir, 'ows-vault.json');
  process.env.OWS_VAULT_SECRET = 'test-vault-secret-cleanverse';
  process.env.CRE_RUNS_FILE = path.join(tmpDir, 'cre-runs.jsonl');
  process.env.CLEANVERSE_API_ID = 'test-cleanverse-id';
  process.env.CLEANVERSE_API_KEY = 'test-cleanverse-key';
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
  delete process.env.CLEANVERSE_API_ID;
  delete process.env.CLEANVERSE_API_KEY;
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
  const { cleanverseIdentityService } = await import(
    '../../src/backend/services/blockchain/cleanverse/CleanverseIdentityService.js'
  );
  const { cleanverseExecutionProvider } = await import(
    '../../src/backend/services/blockchain/cleanverse/CleanverseExecutionProvider.js'
  );
  return {
    OwsWalletService,
    owsLocalVaultService,
    creRunStore,
    cleanverseIdentityService,
    cleanverseExecutionProvider,
  };
}

async function seedScopedAccess(owsLocalVaultService: any) {
  const wallet = await owsLocalVaultService.importWallet({
    name: 'Cleanverse Treasury',
    privateKey: TEST_PRIVATE_KEY,
  });
  const { token } = await owsLocalVaultService.createApiKey({
    name: 'scoped',
    walletIds: [wallet.id],
    policyIds: [],
  });
  const access = await owsLocalVaultService.resolveAccess({
    apiKeyToken: token,
  });
  return { wallet, token, access };
}

describe('OwsWalletService — Cleanverse CVI/CVA rail', () => {
  beforeEach(async () => {
    resetVaultFile();
    const { creRunStore } = await loadModules();
    await creRunStore.reset();
    vi.restoreAllMocks();
  });

  it('denies spend when Cleanverse A-Pass screening fails', async () => {
    const {
      OwsWalletService,
      owsLocalVaultService,
      cleanverseIdentityService,
      cleanverseExecutionProvider,
    } = await loadModules();
    const { access, token } = await seedScopedAccess(owsLocalVaultService);

    await owsLocalVaultService.updateWalletMetadata(access!.wallet.id, {
      ...(access!.wallet.metadata || {}),
      executionProvider: 'cleanverse',
      chainId: 10143,
    });

    vi.spyOn(cleanverseIdentityService, 'screenAddresses').mockResolvedValue({
      required: true,
      chain: 'monad',
      sender: {
        address: access!.wallet.accounts[0]!.address,
        ok: false,
        reason: 'No A-Pass found for address',
      },
      recipient: { address: RECIPIENT, ok: true },
      ok: false,
      reason: 'Sender failed CVI screening: No A-Pass found for address',
    });
    const execSpy = vi.spyOn(cleanverseExecutionProvider, 'executeTransfer');

    const service = new OwsWalletService();
    const result = await service.executeSpend(
      {
        id: 'intent-cvi-deny',
        agentId: 'agent-1',
        recipient: RECIPIENT,
        amount: '1000000',
        asset: 'aUSD-D',
        reason: 'Cleanverse deny path',
        timestamp: new Date().toISOString(),
      },
      { apiKeyToken: token },
    );

    expect(result.status).toBe('denied');
    expect(result.reason).toMatch(/CVI|A-Pass|Cleanverse/i);
    expect(execSpy).not.toHaveBeenCalled();
  });

  it('routes approved Cleanverse spends through the aUSD-D provider', async () => {
    const {
      OwsWalletService,
      owsLocalVaultService,
      cleanverseExecutionProvider,
      creRunStore,
    } = await loadModules();
    const { access, token } = await seedScopedAccess(owsLocalVaultService);
    const sender = access!.wallet.accounts[0]!.address;

    await owsLocalVaultService.updateWalletMetadata(access!.wallet.id, {
      ...(access!.wallet.metadata || {}),
      executionProvider: 'cleanverse',
      chainId: 10143,
      cleanverseSenderAddress: sender,
    });
    // Re-resolve access so metadata is fresh
    const refreshed = await owsLocalVaultService.resolveAccess({ apiKeyToken: token });

    const txHash = '0x' + 'ab'.repeat(32);
    vi.spyOn(cleanverseExecutionProvider, 'executeTransfer').mockResolvedValue({
      txHash,
      from: sender,
      to: RECIPIENT,
      amount: '1000000',
      chainId: 10143,
      tokenAddress: '0xbD14cFAf1Fb8b08858E3FfcCeffEfe09cC013892',
      tokenSymbol: 'aUSD-D',
      transactionLink: `https://testnet.monadscan.com/tx/${txHash}`,
      recipientMatches: true,
      valueMatches: true,
      verified: true,
      receiptStatus: 'success',
    });

    const { CreRunRecorder } = await import('../../src/backend/cre/runRecorder.js');
    const service = new OwsWalletService();
    const intent = {
      id: 'intent-cva-ok',
      agentId: 'agent-1',
      recipient: RECIPIENT,
      amount: '1000000',
      asset: 'aUSD-D',
      reason: 'Cleanverse approve path',
      timestamp: new Date().toISOString(),
      metadata: {
        cleanverseIdentity: {
          required: true,
          chain: 'monad',
          ok: true,
          sender: { address: sender, ok: true },
          recipient: { address: RECIPIENT, ok: true },
        },
      },
    };

    const result = await (service as any).handleApprove(
      intent,
      new CreRunRecorder({ workflow: 'spend', mode: 'cre' }),
      'policy-1',
      refreshed,
      token,
    );

    expect(result.status).toBe('approved');
    expect(result.transferStatus).toBe('sent');
    expect(result.transferTxHash).toBe(txHash);
    expect(cleanverseExecutionProvider.executeTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        to: RECIPIENT,
        amount: 1000000n,
        chainId: 10143,
      }),
    );

    if (result.runId) {
      const run = await creRunStore.get(result.runId);
      expect(
        run?.artifacts.some((a) => a.type === 'attestation_result'),
      ).toBe(true);
    }
  });
});
