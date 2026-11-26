#!/usr/bin/env tsx
/**
 * LOCAL-ONLY governed supplier worker — the test-runner twin of worker.ts.
 * Same common composition, but hard-pinned to `localnet`: it requires a
 * literal loopback endpoint, an explicit non-public local genesis, and a
 * local mint — a local result can never be presented as devnet evidence.
 * No devnet flags are accepted here and no local flags exist in worker.ts.
 *
 *   tsx tooling/supplier-payment/local-worker.ts execute --config <path> \
 *     [--envelope <path>] [--simulate-crash-after-send]
 *
 * --simulate-crash-after-send exits with code 42 immediately after the rail
 * returns a receipt and before the claim is finalized. It exists only in
 * this test-runner harness — the devnet worker has no fault switch, and
 * runWorker refuses it for any non-localnet composition.
 */
import {
  loadWorkerConfig,
  parseWorkerArgs,
  readEnvelopeInput,
  runWorker,
  safeErrorText,
} from './worker-common.js';

try {
  const args = parseWorkerArgs(process.argv.slice(2), 'localnet');
  const config = loadWorkerConfig(args.configPath, 'localnet');
  const envelope = readEnvelopeInput(args.envelopePath);
  const result = await runWorker({
    network: 'localnet',
    config,
    action: args.action,
    envelope,
    simulateCrashAfterSend: args.simulateCrashAfterSend,
  });
  process.stdout.write(`${JSON.stringify({ mode: 'local-worker', action: args.action, result })}\n`);
  process.exit(result.status === 'confirmed' || result.status === 'replayed' ? 0 : 3);
} catch (err) {
  process.stderr.write(`${safeErrorText(err)}\n`);
  process.exit(2);
}
