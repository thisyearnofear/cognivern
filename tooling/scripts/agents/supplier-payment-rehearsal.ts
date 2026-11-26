/**
 * supplier-payment-rehearsal — offline Gate 1 verifier for a signed supplier
 * payment authorization.
 *
 * Consumes one *internal* diligence report (`--report`, the JSON written by
 * telegraph-diligence --out), one signed approval envelope (`--approval`),
 * and an operator-pinned Ed25519 public key (`--trusted-public-key` PEM).
 * It never touches a network, a wallet, env credentials, or the live
 * SettlementService, and there is no signer or execute switch: the signed
 * envelope is the sole transaction request, and this tool only decides
 * whether the bound evidence makes it eligible for a rehearsal.
 *
 * The rehearsal schema can never authorize actual funds — the executor
 * accepts only `cognivern.supplier-payment-devnet.v1` envelopes, which this
 * tool does not review.
 *
 * Operator responsibilities (outside this tool):
 *   - pin the trusted public key themselves, out of band;
 *   - review the exact transaction terms (cluster, mint, payee, amount,
 *     intentId) — the rehearsal amount is a fixed 0.01 USDC on devnet, not
 *     the supplier's nominal case payment;
 *   - confirm the workspace/subject identity the signer attested to; the
 *     report bytes alone do not authenticate a workspace.
 *
 * Usage:
 *   pnpm exec tsx tooling/scripts/agents/supplier-payment-rehearsal.ts \
 *     --report internal-diligence.json --approval approval.json \
 *     --trusted-public-key operator-pinned.pem
 */
import { readFile } from 'node:fs/promises';
import { createPublicKey, type KeyObject } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  REHEARSAL_SCHEMA,
  reviewSupplierPayment,
  type ProposedTransfer,
  type ReviewResult,
} from '../../../src/backend/services/telegraph/SupplierPaymentAuthorization.js';

export {
  REHEARSAL_SCHEMA,
  reviewSupplierPayment,
  type ProposedTransfer,
  type ReviewResult,
};

/**
 * Rehearsal seam: records at most one proposed transfer via the caller's
 * synchronous callback — eligible results only. No live adapter is provided;
 * the callback is where an operator could wire their own executor after the
 * remaining gates (authenticated evidence lineage, pinned issuer freshness,
 * atomic consume, single debit) are independently satisfied.
 */
export function rehearseSupplierPayment(
  report: unknown,
  envelope: unknown,
  trustedPublicKey: KeyObject,
  now: number,
  recordProposedTransfer: (transfer: ProposedTransfer) => void,
): ReviewResult {
  const result = reviewSupplierPayment(report, envelope, trustedPublicKey, now);
  if (result.status === 'eligible_for_rehearsal') {
    recordProposedTransfer(result.proposedTransfer);
  }
  return result;
}

interface CliArgs {
  report?: string;
  approval?: string;
  trustedPublicKey?: string;
  help: boolean;
}

function parseCliArgs(argv: string[]): CliArgs {
  const args: CliArgs = { help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--report') args.report = argv[++i];
    else if (arg === '--approval') args.approval = argv[++i];
    else if (arg === '--trusted-public-key') args.trustedPublicKey = argv[++i];
    else if (arg === '--help' || arg === '-h') args.help = true;
    else throw new Error(`unknown argument ${arg}`);
  }
  return args;
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`Usage: supplier-payment-rehearsal.ts --report <internal-report.json> \
--approval <signed-envelope.json> --trusted-public-key <operator-pinned.pem>

Offline Gate 1 review only. The signed envelope is the sole transaction
request; there is no signer, no network, and no execute switch. The verifier
checks local evidence bytes, not independent provenance or mandate balance.`);
    return;
  }
  if (!args.report || !args.approval || !args.trustedPublicKey) {
    throw new Error('requires --report, --approval, and --trusted-public-key');
  }
  const report = JSON.parse(await readFile(args.report, 'utf8')) as unknown;
  const envelope = JSON.parse(await readFile(args.approval, 'utf8')) as unknown;
  const pem = await readFile(args.trustedPublicKey, 'utf8');
  if (!pem.trimStart().startsWith('-----BEGIN PUBLIC KEY-----')) {
    throw new Error(
      '--trusted-public-key must be a PEM file beginning with "-----BEGIN PUBLIC KEY-----" (a private key is never accepted)',
    );
  }
  const trustedPublicKey = createPublicKey({ key: pem, format: 'pem' });

  const recorded: ProposedTransfer[] = [];
  const result = rehearseSupplierPayment(report, envelope, trustedPublicKey, Date.now(), (t) =>
    recorded.push(t),
  );
  const output: Record<string, unknown> = {
    mode: 'offline',
    status: result.status,
    proposedTransfer: result.status === 'eligible_for_rehearsal' ? result.proposedTransfer : null,
    ...(result.status === 'blocked' ? { reason: result.reason } : {}),
  };
  console.log(JSON.stringify(output, null, 2));
  if (result.status !== 'eligible_for_rehearsal' || recorded.length !== 1) {
    process.exit(1);
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
