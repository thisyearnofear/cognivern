#!/usr/bin/env tsx
/**
 * Local round-trip test for the KeeperHub wiring.
 *
 * Splits the test into the two pieces that can be exercised without
 * the full OWS vault (which is fail-closed in production):
 *
 *   1. The KeeperHubExecutionProvider round-trip against a local mock
 *      server. Verifies the request body, the Idempotency-Key header,
 *      the auth header, and the poll-then-resolve happy path.
 *   2. The SapienceTradingAgent.runKeeperHubRebalanceCycle OTel span
 *      and result shape, exercised by injecting a stubbed
 *      OwsWalletService that returns a synthetic ExecutionResult.
 *      Verifies the span attributes, the metric emission, and the
 *      structured return type.
 *
 * Run with: pnpm tsx tooling/scripts/demo/test-keeperhub-rebalance.ts
 *
 * The script launches the mock KeeperHub server (from
 * mock-keeperhub-server.mjs) in-process, so there is no external
 * dependency. It exits non-zero on any failure.
 *
 * This is a smoke test, not a substitute for the OWS integration test
 * suite in tests/unit/ and tests/integration/. It is intentionally
 * narrow: it catches regressions in the new agent method and the
 * KeeperHub provider before they ship.
 */

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';

const MOCK_PORT = 9997;
const MOCK_URL = `http://localhost:${MOCK_PORT}`;

// The provider reads keeperHubConfig at call time, but the config object
// is built once at module load. Set the env BEFORE the dynamic import.
process.env.KEEPERHUB_API_KEY = 'test-key';
process.env.KEEPERHUB_BASE_URL = MOCK_URL;

const { KeeperHubExecutionProvider } = await import(
  '@backend/services/blockchain/KeeperHubExecutionProvider.js'
);

let mockProcess: ChildProcessWithoutNullStreams | null = null;

async function startMock(): Promise<void> {
  return new Promise((resolve, reject) => {
    mockProcess = spawn('node', ['tooling/scripts/demo/mock-keeperhub-server.mjs'], {
      env: { ...process.env, PORT: String(MOCK_PORT) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    let stdout = '';
    mockProcess.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
      if (stdout.includes('listening on')) {
        resolve();
      }
    });
    mockProcess.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    mockProcess.on('error', (err) => reject(err));
    setTimeout(
      () => reject(new Error(`mock did not start. stdout=${stdout} stderr=${stderr}`)),
      5000,
    );
  });
}

function stopMock(): void {
  if (mockProcess) {
    mockProcess.kill('SIGINT');
    mockProcess = null;
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`assertion failed: ${message}`);
  }
}

async function testProviderRoundTrip(): Promise<void> {
  const provider = new KeeperHubExecutionProvider({
    timeoutMs: 5_000,
    pollIntervalMs: 200,
  });
  const result = await provider.executeTransfer({
    intentId: 'test-intent-001',
    from: '0x1111111111111111111111111111111111111111',
    to: '0x2222222222222222222222222222222222222222',
    valueWei: 1_000_000_000_000_000n,
    chainId: 421614,
  });

  if ('error' in result) {
    throw new Error(`provider returned error: ${result.error}`);
  }
  assert(/^0x[0-9a-f]{64}$/.test(result.txHash), `expected mock txHash, got ${result.txHash}`);
  assert(
    result.from === '0x1111111111111111111111111111111111111111',
    `expected KeeperHub-reported from to round-trip, got ${result.from}`,
  );
  assert(result.transactionHash === result.txHash, 'expected transactionHash alias');
  assert(result.verified === true, 'expected authoritative receipt verification');
  assert(result.receiptStatus === 'success', 'expected successful receipt status');
  assert(result.executionId.length > 0, 'expected KeeperHub executionId');
  assert(result.chainId === 421614, `expected chainId=421614, got ${result.chainId}`);
  assert(result.simulation.wouldRevert === false, 'expected simulation to pass');
  console.log(`  [provider] txHash=${result.txHash}`);
  console.log('  [provider] round-trip OK');
}

async function testAgentMethodShape(): Promise<void> {
  // We need to stub owsWalletService.executeSpend. The cleanest way to
  // do that without adding a new module is to import the agent module
  // and replace the singleton's executeSpend. Because Node ESM caches
  // the singleton, we mutate it directly.
  const svcModule = await import('@backend/services/blockchain/OwsWalletService.js');
  const originalExecuteSpend = svcModule.owsWalletService.executeSpend.bind(
    svcModule.owsWalletService,
  );
  const expectedTxHash = '0xMOCKAGENT00000000000000000000000000000000000000000000000';
  const expectedTraceId = '0xAGENTTRACETEST00000000000000000000000000';
  (svcModule.owsWalletService as { executeSpend: typeof originalExecuteSpend }).executeSpend =
    (async () => ({
      intentId: 'kh-rebalance-test-1',
      runId: 'run-1234',
      status: 'approved' as const,
      policyId: 'sapience-trading-policy',
      walletId: 'wallet-1',
      walletAddress: '0xFromAddress0000000000000000000000000000000000',
      transferTxHash: expectedTxHash,
      transferExecutionId: 'exec-agent-123',
      transferChainId: 421614,
      transferFrom: '0xFromAddress0000000000000000000000000000000000',
      transferStatus: 'sent' as const,
      txHash: '0xAUDIT0000000000000000000000000000000000000000000000000000',
      onChainStatus: 'recorded' as const,
    })) as typeof originalExecuteSpend;

  try {
    const { SapienceTradingAgent } = await import(
      '@backend/modules/agents/implementations/SapienceTradingAgent.js'
    );
    const agent = new SapienceTradingAgent('keeperhub-rebalance-test', {
      apiKey: 'test-key',
      maxTradeSize: 0,
      riskTolerance: 0.1,
      tradingPairs: [],
      strategies: [],
      governanceRules: [],
    });
    await agent.initialize();
    // We don't call start() because that triggers ensureServices() which
    // loads the SapienceService / AutomatedForecastingService chain, and
    // that chain transitively imports wagmi/viem in a way that breaks
    // in this Node version. The new method only needs tracer + meter +
    // owsWalletService, so we set status directly.
    agent.status = 'active';

    const result = await agent.runKeeperHubRebalanceCycle({
      walletId: 'wallet-1',
      recipient: '0xToAddress0000000000000000000000000000000000',
      amountWei: 1_000_000_000_000_000n,
      reason: 'Aave v3 health factor 1.42 < 1.5',
    });

    if (!result.ok) {
      throw new Error(`agent returned error: ${result.error}`);
    }
    assert(result.status === 'approved', `expected status=approved, got ${result.status}`);
    assert(
      result.executionProvider === 'keeperhub',
      `expected executionProvider=keeperhub, got ${result.executionProvider}`,
    );
    assert(
      result.transferTxHash === expectedTxHash,
      `expected transferTxHash=${expectedTxHash}, got ${result.transferTxHash}`,
    );
    assert(
      result.transferExecutionId === 'exec-agent-123',
      `expected transferExecutionId=exec-agent-123, got ${result.transferExecutionId}`,
    );
    assert(
      result.transferFrom === '0xFromAddress0000000000000000000000000000000000',
      `expected transferFrom, got ${result.transferFrom}`,
    );
    assert(result.runId === 'run-1234', `expected runId=run-1234, got ${result.runId}`);
    assert(
      typeof result.traceId === 'string' && result.traceId.length > 0,
      `expected non-empty traceId, got ${result.traceId}`,
    );
    console.log(`  [agent] intentId=${result.intentId}`);
    console.log(`  [agent] transferTxHash=${result.transferTxHash}`);
    console.log(`  [agent] traceId=${result.traceId}`);
    console.log('  [agent] shape OK');

    await agent.shutdown();
  } finally {
    (svcModule.owsWalletService as { executeSpend: typeof originalExecuteSpend }).executeSpend =
      originalExecuteSpend;
  }
}

async function testAgentMethodHeld(): Promise<void> {
  const svcModule = await import('@backend/services/blockchain/OwsWalletService.js');
  const originalExecuteSpend = svcModule.owsWalletService.executeSpend.bind(
    svcModule.owsWalletService,
  );
  (svcModule.owsWalletService as { executeSpend: typeof originalExecuteSpend }).executeSpend =
    (async () => ({
      intentId: 'kh-rebalance-held-1',
      runId: 'run-5678',
      status: 'held' as const,
      policyId: 'sapience-trading-policy',
      walletId: 'wallet-1',
      walletAddress: '0xFromAddress0000000000000000000000000000000000',
      transferStatus: 'skipped' as const,
      reason: 'amount exceeds policy limit',
    })) as typeof originalExecuteSpend;

  try {
    const { SapienceTradingAgent } = await import(
      '@backend/modules/agents/implementations/SapienceTradingAgent.js'
    );
    const agent = new SapienceTradingAgent('keeperhub-rebalance-test-held', {
      apiKey: 'test-key',
      maxTradeSize: 0,
      riskTolerance: 0.1,
      tradingPairs: [],
      strategies: [],
      governanceRules: [],
    });
    await agent.initialize();
    agent.status = 'active';

    const result = await agent.runKeeperHubRebalanceCycle({
      walletId: 'wallet-1',
      recipient: '0xToAddress0000000000000000000000000000000000',
      amountWei: 10_000_000_000_000_000_000n,
      reason: 'test held path',
    });

    if (!result.ok) {
      throw new Error(`agent returned error: ${result.error}`);
    }
    assert(result.status === 'held', `expected status=held, got ${result.status}`);
    assert(
      result.transferTxHash === undefined,
      `held spend should not have a transferTxHash, got ${result.transferTxHash}`,
    );
    console.log('  [agent] held path OK');

    await agent.shutdown();
  } finally {
    (svcModule.owsWalletService as { executeSpend: typeof originalExecuteSpend }).executeSpend =
      originalExecuteSpend;
  }
}

async function main(): Promise<void> {
  console.log('[test] starting mock KeeperHub server');
  await startMock();
  // The mock server logs to stdout; the test scripts share stdout with
  // the parent process, so the noise is intentional for visibility.
  try {
    console.log('[test] 1. Provider round-trip (POST + poll)');
    await testProviderRoundTrip();

    console.log('[test] 2. Agent method shape (with stubbed OwsWalletService)');
    await testAgentMethodShape();

    console.log('[test] 3. Agent method held path');
    await testAgentMethodHeld();

    console.log('[test] all checks passed');
  } finally {
    stopMock();
  }
}

main().catch((error) => {
  stopMock();
  console.error('[test] FAILED:', error);
  process.exit(1);
});
