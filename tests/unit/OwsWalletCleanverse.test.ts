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

  it('denies spend when a party fails the institutional country rule', async () => {
    process.env.CLEANVERSE_ALLOW_COUNTRIES = 'US,SG';
    try {
      const {
        OwsWalletService,
        owsLocalVaultService,
        cleanverseIdentityService,
        cleanverseExecutionProvider,
      } = await loadModules();
      const { access, token } = await seedScopedAccess(owsLocalVaultService);
      const sender = access!.wallet.accounts[0]!.address;

      await owsLocalVaultService.updateWalletMetadata(access!.wallet.id, {
        ...(access!.wallet.metadata || {}),
        executionProvider: 'cleanverse',
        chainId: 10143,
        cleanverseSenderAddress: sender,
      });

      const aPass = (address: string, countries: string[]) => ({
        chain: 'monad',
        address,
        status: 1,
        tier: '50',
        group: 'CLEANVERSE_USER',
        countries,
      });
      vi.spyOn(cleanverseIdentityService, 'screenAddresses').mockResolvedValue({
        required: true,
        chain: 'monad',
        sender: { address: sender, ok: true, aPass: aPass(sender, ['US']) },
        recipient: {
          address: RECIPIENT,
          ok: true,
          aPass: aPass(RECIPIENT, ['CN']),
        },
        ok: true,
      });
      const execSpy = vi.spyOn(cleanverseExecutionProvider, 'executeTransfer');

      const service = new OwsWalletService();
      const result = await service.executeSpend(
        {
          id: 'intent-country-deny',
          agentId: 'agent-1',
          recipient: RECIPIENT,
          amount: '1000000',
          asset: 'aUSD-D',
          reason: 'Country rule deny path',
          timestamp: new Date().toISOString(),
        },
        { apiKeyToken: token },
      );

      expect(result.status).toBe('denied');
      expect(result.reason).toMatch(/country compliance/i);
      expect(result.reason).toMatch(/CN/);
      expect(execSpy).not.toHaveBeenCalled();
    } finally {
      delete process.env.CLEANVERSE_ALLOW_COUNTRIES;
    }
  });

  it('refuses to resume a held run whose screening failed country compliance', async () => {
    const {
      OwsWalletService,
      owsLocalVaultService,
      cleanverseExecutionProvider,
    } = await loadModules();
    const { access } = await seedScopedAccess(owsLocalVaultService);

    const execSpy = vi.spyOn(cleanverseExecutionProvider, 'executeTransfer');
    const service = new OwsWalletService();
    const intent = {
      id: 'intent-held-country',
      agentId: 'agent-1',
      recipient: RECIPIENT,
      amount: '1000000',
      asset: 'aUSD-D',
      reason: 'held then blocked by country rule',
      timestamp: new Date().toISOString(),
    };

    const { CreRunRecorder } = await import('../../src/backend/cre/runRecorder.js');
    const heldRecorder = new CreRunRecorder({ workflow: 'spend', mode: 'cre' });
    await heldRecorder.addArtifact({ type: 'spend_intent', data: intent });
    // Persist the screening verdict the way executeSpend does (cleanverse_apass
    // artifact carries policySignals; spend_intent is snapshotted pre-screen).
    await heldRecorder.addArtifact({
      type: 'cleanverse_apass',
      data: {
        policySignals: {
          countryCompliant: false,
          countryDenyReason:
            'Recipient failed country compliance: A-Pass country CN is not in the allowed list',
        },
      },
    });
    const held = await (service as any).handleHold(
      intent,
      heldRecorder,
      'needs review',
      'policy-1',
      access,
    );
    expect(held.status).toBe('held');

    const result = await service.resumeHeldSpend(held.runId, 'operator-42');
    expect(result.status).toBe('denied');
    expect(result.error).toMatch(/country compliance/i);
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
