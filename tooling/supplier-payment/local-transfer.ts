/**
 * Local-validator proof entry points for the supplier rail. Not a general
 * send CLI: every argument is the pinned scope of this isolated deployment
 * and the rail enforces it. LOCAL clusters only — loopback IP endpoint,
 * non-public genesis, local mint.
 *
 *   pnpm exec tsx tooling/supplier-payment/local-transfer.ts send \
 *     --endpoint http://127.0.0.1:PORT --payer-key FILE --payer PUB \
 *     --payee PUB --mint MINT --journal FILE --workspace W --mandate M \
 *     --case C --intent-id I --expires ISO
 *
 *   ... recover  (same args — opens the same journal, reads the chain only)
 */
import { createLocalSupplierRail } from './rail.js';
import type { ProposedTransfer } from '../../src/backend/services/telegraph/SupplierPaymentAuthorization.js';

const sub = process.argv[2];
function arg(name: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  if (!v) {
    console.error(`missing --${name}`);
    process.exit(1);
  }
  return v;
}
if (sub !== 'send' && sub !== 'recover') {
  console.error('usage: local-transfer.ts <send|recover> --endpoint ... --journal ...');
  process.exit(1);
}

const rail = await createLocalSupplierRail({
  endpoint: arg('endpoint'),
  signerKeyPath: arg('payer-key'),
  payer: arg('payer'),
  journalPath: arg('journal'),
  mint: arg('mint'),
  scope: {
    workspaceId: arg('workspace'),
    mandateId: arg('mandate'),
    caseId: arg('case'),
    payee: arg('payee'),
  },
});

const transfer: ProposedTransfer = {
  workspaceId: arg('workspace'),
  mandateId: arg('mandate'),
  caseId: arg('case'),
  intentId: arg('intent-id'),
  cluster: 'localnet',
  mint: arg('mint'),
  payee: arg('payee'),
  amountBaseUnits: '10000',
  expiresAt: arg('expires'),
};

if (sub === 'send') {
  const receipt = await rail.sendTransfer(transfer);
  console.log(JSON.stringify({ mode: 'local', send: receipt }, null, 2));
} else {
  // Fresh process: fetchReceipt reads only the journal + chain.
  const recovered = await rail.fetchReceipt!(arg('intent-id'));
  // A replayed identical send must never broadcast again — the rail
  // resolves it from the recorded signature + chain.
  const replayed = await rail.sendTransfer(transfer);
  console.log(
    JSON.stringify({ mode: 'local', recovered, replayedSignature: replayed.signature }, null, 2),
  );
}
