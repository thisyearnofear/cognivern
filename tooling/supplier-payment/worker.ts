#!/usr/bin/env tsx
/**
 * Governed supplier-payment worker — DEVNET ONLY, non-HTTP CLI. This is the
 * operator-facing entry point for executing or reconciling one signed
 * `cognivern.supplier-payment-devnet.v1` envelope. There is no local mode,
 * no endpoint/genesis/mint override, no crash flag, and no env-based
 * signer: every trusted input comes from a private service-owned config
 * file, and the claims schema must already exist (explicit migration —
 * the worker never provisions it).
 *
 *   tsx tooling/supplier-payment/worker.ts execute --config /path/worker.json \
 *     [--envelope /path/envelope.json]   # envelope from stdin when omitted
 *   tsx ... reconcile --config /path/worker.json --envelope /path/envelope.json
 *
 * Fail-closed gates run before any signer file, DB, or RPC is touched:
 * config file 0600 in a 0700 dir, `enabled: true`, process uid pinned and
 * distinct from the backend uid, all trusted paths private, the devnet DB
 * an existing 0600 file. See docs/internals/supplier-payment-executor.md
 * for the deployment recipe — a dedicated Unix user owns the signer and
 * DB; no funding yet.
 */
import {
  loadWorkerConfig,
  parseWorkerArgs,
  readEnvelopeInput,
  runWorker,
  safeErrorText,
} from './worker-common.js';

try {
  const args = parseWorkerArgs(process.argv.slice(2), 'devnet');
  const config = loadWorkerConfig(args.configPath, 'devnet');
  const envelope = readEnvelopeInput(args.envelopePath);
  const result = await runWorker({ network: 'devnet', config, action: args.action, envelope });
  // Result is public metadata only — never the signer, never key material.
  process.stdout.write(`${JSON.stringify({ mode: 'devnet-worker', action: args.action, result })}\n`);
  process.exit(result.status === 'confirmed' || result.status === 'replayed' ? 0 : 3);
} catch (err) {
  process.stderr.write(`${safeErrorText(err)}\n`);
  process.exit(2);
}
