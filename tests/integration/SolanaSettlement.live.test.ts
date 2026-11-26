import { describe, expect, it } from 'vitest';
import { createSolanaRpc } from '@solana/kit';
import {
  SolanaSettlementService,
  type SolanaCluster,
} from '../../src/backend/services/blockchain/solana/SolanaSettlementService.js';

/**
 * Opt-in live settlement test (devnet or solana-test-validator).
 *
 * CI never runs this: it moves real (devnet) USDC. Enable with:
 *
 *   SOLANA_SETTLEMENT_IT=1 \
 *   SOLANA_SETTLEMENT_PRIVATE_KEY=<base58 64-byte secret> \
 *   SOLANA_SETTLEMENT_PAYEE=<base58 payee> \
 *   SOLANA_RPC_URL=http://127.0.0.1:8899 \
 *   SOLANA_CLUSTER=devnet \
 *   SOLANA_USDC_MINT=<devnet/local USDC mint> \
 *   pnpm exec vitest run tests/integration/SolanaSettlement.live.test.ts
 *
 * The payer must already hold USDC for the mint plus ~0.01 SOL for fees and
 * the payee's ATA rent. The test sends $0.01, then replays the same intentId
 * and asserts the journal returns the same signature instead of paying twice.
 */

const enabled = process.env.SOLANA_SETTLEMENT_IT === '1';
const payee = process.env.SOLANA_SETTLEMENT_PAYEE ?? '';
const rpcUrl = process.env.SOLANA_RPC_URL ?? '';
const cluster = (process.env.SOLANA_CLUSTER ?? 'devnet') as SolanaCluster;

const service = new SolanaSettlementService({
  enabled: true,
  cluster,
  rpcUrl: rpcUrl || undefined,
  usdcMint: process.env.SOLANA_USDC_MINT || undefined,
  maxTransferUsd: 0.05,
  runwayUsd: 0.25,
  payeeAllowlist: payee ? [payee] : [],
  allowMainnet: process.env.SOLANA_ALLOW_MAINNET === 'true',
});

async function rpcReachable(): Promise<boolean> {
  if (!rpcUrl) return false;
  try {
    const rpc = createSolanaRpc(rpcUrl);
    await rpc.getHealth().send();
    return true;
  } catch {
    return false;
  }
}

const reachable = enabled && payee !== '' ? await rpcReachable() : false;

describe.skipIf(!reachable)('Solana settlement (live devnet/validator)', () => {
  it('settles once and replays the recorded signature', async ({ skip }) => {
    const amountUsd = 0.01;
    const preflight = await service.preflight({ payee, amountUsd }, undefined, 'it-workspace');
    if (!preflight.ready) {
      // A reachable RPC with an unfunded payer is an environment problem, not
      // a code failure — surface the reason and skip rather than fail CI.
      skip(`payer not ready: ${preflight.violations.join('; ')}`);
      return;
    }

    const intentId = `it-${Date.now()}`;
    const first = await service.executeTransfer({
      intentId,
      workspaceId: 'it-workspace',
      payee,
      amountUsd,
    });
    expect(first.status).toBe('settled');
    expect(first.signature).toBeTruthy();

    const replay = await service.executeTransfer({
      intentId,
      workspaceId: 'it-workspace',
      payee,
      amountUsd,
    });
    expect(replay.idempotentReplay).toBe(true);
    expect(replay.signature).toBe(first.signature);

    const record = await service.getIntentStatus('it-workspace', intentId);
    expect(record).toMatchObject({
      status: 'confirmed',
      signature: first.signature,
    });
  }, 90_000);
});
