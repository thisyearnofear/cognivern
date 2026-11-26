/**
 * Supplier payment rail — real `SupplierPaymentRail` implementations.
 *
 * Two factories share one production code path:
 *   - `createSupplierDevnetRail` — fixed to the official devnet endpoint, the
 *     canonical devnet genesis hash, and the canonical USDC devnet mint.
 *     Nothing about the network pins is overridable.
 *   - `createLocalSupplierRail` — local-validator proof only: requires a
 *     literal loopback-IP endpoint, a genesis hash that is NOT any public
 *     cluster's, a temp signer, and a separate journal. Receipts are labelled
 *     cluster `localnet` and can never be passed off as devnet evidence.
 *
 * Neither factory is imported by the API; there is no raw-send CLI or route.
 * OS-level signer isolation (a distinct Unix user whose key ACL denies the
 * backend user) is a documented precondition, not implemented here.
 */
import {
  address,
  appendTransactionMessageInstructions,
  createSolanaRpc,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  getSignatureFromTransaction,
  isAddress,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type TransactionSigner,
} from '@solana/kit';
import {
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstruction,
  getTransferCheckedInstruction,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';
import type {
  SupplierPaymentRail,
  SupplierPaymentRailReceipt,
} from '../../src/backend/services/telegraph/SupplierPaymentExecutor.js';
import type { ProposedTransfer } from '../../src/backend/services/telegraph/SupplierPaymentAuthorization.js';
import { sha256CanonicalJson } from '../../src/backend/services/telegraph/stableJson.js';
import { loadDedicatedSigner } from './signer.js';
import { SupplierJournal } from './journal.js';
import { verifyTransferOnChain } from './receipt.js';

export const DEVNET_ENDPOINT = 'https://api.devnet.solana.com';
export const DEVNET_GENESIS = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';
export const DEVNET_USDC_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
const MAINNET_GENESIS = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d';
const TESTNET_GENESIS = '4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY';
const FIXED_AMOUNT_BASE_UNITS = '10000'; // 0.01 USDC, 6 decimals
const CONFIRM_DEADLINE_MS = 60_000;
const CONFIRM_POLL_MS = 1_000;

export interface SupplierRailScope {
  workspaceId: string;
  mandateId: string;
  caseId: string;
  /** Dedicated payee pinned for this deployment — the only allowed payee. */
  payee: string;
}

export interface SupplierRailOptions {
  signerKeyPath: string;
  /** Pinned expected public key of the signer file. */
  payer: string;
  journalPath: string;
  scope: SupplierRailScope;
}

export interface LocalSupplierRailOptions extends SupplierRailOptions {
  /** Literal loopback-IP endpoint, e.g. http://127.0.0.1:8899. */
  endpoint: string;
  /** Local mint — must be an actual address on the local validator. */
  mint: string;
}

function fail(message: string): never {
  throw new Error(`supplier rail rejected: ${message}`);
}

function nonblank(value: string): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Deployment scope fields are immutable configuration — blank is invalid. */
function assertScopeConfig(scope: SupplierRailScope): void {
  if (!nonblank(scope.workspaceId)) fail('scope workspaceId is blank');
  if (!nonblank(scope.mandateId)) fail('scope mandateId is blank');
  if (!nonblank(scope.caseId)) fail('scope caseId is blank');
  if (!isAddress(scope.payee)) fail('scope payee is not a valid address');
}

function expiresMsOrFail(expiresAt: string): number {
  const ms = Date.parse(expiresAt);
  if (!Number.isFinite(ms)) fail('authorization expiry is not a valid timestamp');
  if (ms <= Date.now()) fail('authorization is expired');
  return ms;
}

function assertScope(
  transfer: ProposedTransfer,
  scope: SupplierRailScope,
  cluster: string,
  mint: string,
  signer: TransactionSigner,
) {
  if (!nonblank(transfer.intentId)) fail('transfer intentId is blank');
  if (transfer.cluster !== cluster) fail(`transfer cluster ${transfer.cluster} is not ${cluster}`);
  if (transfer.mint !== mint) fail('transfer mint is not the pinned mint');
  if (transfer.payee !== scope.payee) fail('transfer payee is not the deployment payee');
  if (transfer.amountBaseUnits !== FIXED_AMOUNT_BASE_UNITS) fail('transfer amount is not 10000');
  if (transfer.workspaceId !== scope.workspaceId) fail('transfer workspace is not the deployment');
  if (transfer.mandateId !== scope.mandateId) fail('transfer mandate is not the deployment');
  if (transfer.caseId !== scope.caseId) fail('transfer case is not the deployment');
  if (!isAddress(transfer.payee)) fail('payee is not a valid address');
  if (signer.address === transfer.payee) fail('signer must differ from the payee');
  expiresMsOrFail(transfer.expiresAt);
}

interface RailContext {
  endpoint: string;
  cluster: string;
  mint: string;
  expectedGenesis: string;
  /** Immutable binding hash stamped into the journal at open. */
  bindingHash: string;
  scope: SupplierRailScope;
  signer: TransactionSigner;
  journal: SupplierJournal;
}

async function genesisOrFail(rpc: ReturnType<typeof createSolanaRpc>, expected: string) {
  const genesis = await rpc.getGenesisHash().send();
  if (String(genesis) !== expected) fail('chain genesis is not the pinned cluster');
}

async function sendTransferImpl(ctx: RailContext, transfer: ProposedTransfer): Promise<SupplierPaymentRailReceipt> {
  const { scope, signer, journal, cluster, mint, expectedGenesis } = ctx;
  assertScope(transfer, scope, cluster, mint, signer);
  const rpc = createSolanaRpc(ctx.endpoint);
  // The same RPC proves the cluster before every dispatch or recovery —
  // a different chain can never reuse the journal.
  await genesisOrFail(rpc, expectedGenesis);

  const proposalHash = sha256CanonicalJson({
    ...transfer,
    payer: signer.address,
  });
  const claim = journal.claim({
    intentId: transfer.intentId,
    proposalHash,
    payer: signer.address,
    payee: transfer.payee,
    mint,
    amountBaseUnits: transfer.amountBaseUnits,
  });
  if (claim.status === 'conflict') {
    const existing = claim.record;
    // Recovery is allowed only for the IDENTICAL binding — changed terms on
    // the same intent can never resolve through the chain record.
    if (existing && existing.proposalHash === proposalHash && existing.signature) {
      // Same intent already signed: never re-sign or re-send — the chain
      // decides. Unknown confirmed status stays pending, not ok.
      const check = await recoverReceipt(ctx, transfer.intentId);
      if (check) return check;
      throw new Error('intent already claimed; receipt not yet confirmed on chain');
    }
    throw new Error(claim.reason ?? 'intent already claimed');
  }

  const mintAddr = address(mint);
  const [source] = await findAssociatedTokenPda({
    mint: mintAddr,
    owner: signer.address,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  const [destination] = await findAssociatedTokenPda({
    mint: mintAddr,
    owner: address(transfer.payee),
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  const createAta = getCreateAssociatedTokenIdempotentInstruction({
    payer: signer,
    ata: destination,
    owner: address(transfer.payee),
    mint: mintAddr,
  });
  const transferChecked = getTransferCheckedInstruction({
    source,
    mint: mintAddr,
    destination,
    authority: signer,
    amount: BigInt(transfer.amountBaseUnits),
    decimals: 6,
  });

  const { value: latestBlockhash } = await rpc
    .getLatestBlockhash({ commitment: 'confirmed' })
    .send();
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayerSigner(signer, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) => appendTransactionMessageInstructions([createAta, transferChecked], tx),
  );
  const signed = await signTransactionMessageWithSigners(message);
  const signature = getSignatureFromTransaction(signed);

  // Journal commit before broadcast — durable or nothing.
  journal.recordSigned({
    intentId: transfer.intentId,
    proposalHash,
    signature: String(signature),
    sourceAta: String(source),
    destAta: String(destination),
  });

  // Expiry is re-checked immediately before broadcast — the authorization
  // must still be fresh after all async work above.
  expiresMsOrFail(transfer.expiresAt);

  await rpc
    .sendTransaction(getBase64EncodedWireTransaction(signed), {
      encoding: 'base64',
      skipPreflight: false,
      preflightCommitment: 'confirmed',
      maxRetries: BigInt(0),
    })
    .send();
  journal.markSent(transfer.intentId);

  const check = await waitForReceipt(ctx, transfer, signature);
  if (check.status === 'invalid') {
    throw new Error(`chain receipt invalid: ${check.reason}`);
  }
  if (check.status === 'pending') {
    throw new Error(`dispatch outcome unknown — ${check.reason}`);
  }
  return check.receipt;
}

async function waitForReceipt(
  ctx: RailContext,
  transfer: ProposedTransfer,
  signature: string | ReturnType<typeof getSignatureFromTransaction>,
) {
  const rpc = createSolanaRpc(ctx.endpoint);
  // ATAs come from the pinned derivation, not the journal.
  const mintAddr = address(ctx.mint);
  const [source] = await findAssociatedTokenPda({
    mint: mintAddr,
    owner: ctx.signer.address,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  const [destination] = await findAssociatedTokenPda({
    mint: mintAddr,
    owner: address(transfer.payee),
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  const deadline = Date.now() + CONFIRM_DEADLINE_MS;
  let lastPending = 'confirmation timed out';
  while (Date.now() < deadline) {
    const check = await verifyTransferOnChain(rpc, String(signature), {
      payer: ctx.signer.address,
      payee: transfer.payee,
      mint: ctx.mint,
      amountBaseUnits: transfer.amountBaseUnits,
      sourceAta: String(source),
      destAta: String(destination),
      intentId: transfer.intentId,
      cluster: ctx.cluster,
    });
    if (check.status !== 'pending') return check;
    lastPending = check.reason;
    await new Promise((r) => setTimeout(r, CONFIRM_POLL_MS));
  }
  return { status: 'pending' as const, reason: lastPending };
}

async function recoverReceipt(ctx: RailContext, intentId: string): Promise<SupplierPaymentRailReceipt | null> {
  const record = ctx.journal.get(intentId);
  if (!record?.signature) return null;
  const rpc = createSolanaRpc(ctx.endpoint);
  // Recovery re-proves the chain on the same RPC before trusting anything.
  await genesisOrFail(rpc, ctx.expectedGenesis);
  // The journal's deployment binding was verified at open; the record's own
  // fields must still match the configured deployment — the journal is a
  // hint, never the authority.
  if (
    record.payer !== ctx.signer.address ||
    record.payee !== ctx.scope.payee ||
    record.mint !== ctx.mint ||
    record.amountBaseUnits !== FIXED_AMOUNT_BASE_UNITS
  ) {
    throw new Error('journal record does not match the deployment binding');
  }
  // ATAs are recomputed from the pinned mint/owner, not read back from the
  // journal.
  const mintAddr = address(ctx.mint);
  const [source] = await findAssociatedTokenPda({
    mint: mintAddr,
    owner: ctx.signer.address,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  const [destination] = await findAssociatedTokenPda({
    mint: mintAddr,
    owner: address(ctx.scope.payee),
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  if (record.sourceAta !== String(source) || record.destAta !== String(destination)) {
    throw new Error('journal ATAs differ from the deployment derivation');
  }
  const check = await verifyTransferOnChain(rpc, record.signature, {
    payer: ctx.signer.address,
    payee: ctx.scope.payee,
    mint: ctx.mint,
    amountBaseUnits: FIXED_AMOUNT_BASE_UNITS,
    sourceAta: String(source),
    destAta: String(destination),
    intentId,
    cluster: ctx.cluster,
  });
  if (check.status === 'invalid') {
    throw new Error(`recorded receipt invalid on chain: ${check.reason}`);
  }
  if (check.status === 'pending') return null;
  return check.receipt;
}

function buildRail(ctx: RailContext): SupplierPaymentRail {
  return {
    async getGenesisHash() {
      const rpc = createSolanaRpc(ctx.endpoint);
      return String(await rpc.getGenesisHash().send());
    },
    async sendTransfer(transfer: ProposedTransfer) {
      return sendTransferImpl(ctx, transfer);
    },
    async fetchReceipt(intentId: string) {
      return recoverReceipt(ctx, intentId);
    },
  };
}

function deploymentBinding(
  cluster: string,
  expectedGenesis: string,
  mint: string,
  scope: SupplierRailScope,
  payer: string,
): string {
  return sha256CanonicalJson({
    cluster,
    genesis: expectedGenesis,
    mint,
    workspaceId: scope.workspaceId,
    mandateId: scope.mandateId,
    caseId: scope.caseId,
    payee: scope.payee,
    payer,
    amountBaseUnits: FIXED_AMOUNT_BASE_UNITS,
  });
}

/**
 * Production devnet rail. Network pins are constants — no overrides. The
 * signer key must be the dedicated file checked by `loadDedicatedSigner`,
 * and the expected payer public key is mandatory.
 */
export async function createSupplierDevnetRail(
  opts: SupplierRailOptions,
): Promise<SupplierPaymentRail> {
  if (!isAddress(opts.payer)) fail('pinned payer is not a valid address');
  const signer = await loadDedicatedSigner(opts.signerKeyPath, opts.payer);
  assertScopeConfig(opts.scope);
  if (signer.address === opts.scope.payee) fail('signer must differ from the payee');
  const scope = Object.freeze({ ...opts.scope });
  return buildRail({
    endpoint: DEVNET_ENDPOINT,
    cluster: 'devnet',
    mint: DEVNET_USDC_MINT,
    expectedGenesis: DEVNET_GENESIS,
    bindingHash: deploymentBinding('devnet', DEVNET_GENESIS, DEVNET_USDC_MINT, scope, signer.address),
    scope,
    signer,
    journal: new SupplierJournal(
      opts.journalPath,
      deploymentBinding('devnet', DEVNET_GENESIS, DEVNET_USDC_MINT, scope, signer.address),
    ),
  });
}

/**
 * Local-validator proof rail. Refuses anything that could reach a public
 * cluster: literal loopback IP only, non-public genesis required before any
 * send, temp signer + separate journal. Receipts are cluster `localnet` —
 * never usable as devnet evidence.
 */
export async function createLocalSupplierRail(
  opts: LocalSupplierRailOptions,
): Promise<SupplierPaymentRail> {
  if (!/^https?:\/\/127\.0\.0\.1:\d+\/?$/.test(opts.endpoint)) {
    fail('local rail endpoint must be a literal loopback IP with a port');
  }
  if (!isAddress(opts.payer)) fail('pinned payer is not a valid address');
  if (!isAddress(opts.mint)) fail('local mint is not a valid address');
  const signer = await loadDedicatedSigner(opts.signerKeyPath, opts.payer);
  assertScopeConfig(opts.scope);
  if (signer.address === opts.scope.payee) fail('signer must differ from the payee');
  const rpc = createSolanaRpc(opts.endpoint);
  const genesisStr = String(await rpc.getGenesisHash().send());
  if (
    genesisStr === DEVNET_GENESIS ||
    genesisStr === MAINNET_GENESIS ||
    genesisStr === TESTNET_GENESIS
  ) {
    fail('local rail must not run against a public cluster');
  }
  const scope = Object.freeze({ ...opts.scope });
  const binding = deploymentBinding('localnet', genesisStr, opts.mint, scope, signer.address);
  return buildRail({
    endpoint: opts.endpoint,
    cluster: 'localnet',
    mint: opts.mint,
    expectedGenesis: genesisStr,
    bindingHash: binding,
    scope,
    signer,
    journal: new SupplierJournal(opts.journalPath, binding),
  });
}
