/**
 * On-chain receipt verification for the supplier transfer. A receipt is
 * built only from chain state — never from the journal alone — and every
 * bound field must match the pinned proposal or the check fails closed.
 */
import type { Rpc, SolanaRpcApi, Address } from '@solana/kit';
import type { SupplierPaymentRailReceipt } from '../../src/backend/services/telegraph/SupplierPaymentExecutor.js';

export interface ExpectedTransfer {
  payer: string;
  payee: string;
  mint: string;
  amountBaseUnits: string;
  sourceAta: string;
  destAta: string;
  intentId: string;
  cluster: string;
}

type AnyRpc = Rpc<SolanaRpcApi>;

export type ChainCheck =
  | { status: 'confirmed' | 'finalized'; receipt: SupplierPaymentRailReceipt }
  | { status: 'pending'; reason: string }
  | { status: 'invalid'; reason: string };

const CONFIRMED = new Set(['confirmed', 'finalized']);
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const ASSOCIATED_TOKEN_PROGRAM = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
const SYSTEM_PROGRAM = '11111111111111111111111111111111';

export async function verifyTransferOnChain(
  rpc: AnyRpc,
  signature: string,
  expected: ExpectedTransfer,
): Promise<ChainCheck> {
  const statusRes = await rpc
    .getSignatureStatuses([signature as never], { searchTransactionHistory: true })
    .send();
  const status = statusRes.value[0];
  if (!status) return { status: 'pending', reason: 'signature not found on chain' };
  if (status.err !== null) return { status: 'invalid', reason: 'transaction failed on chain' };
  const confirmationStatus = status.confirmationStatus as string;
  if (!CONFIRMED.has(confirmationStatus)) {
    return { status: 'pending', reason: `status is ${confirmationStatus}` };
  }

  const txRes = await rpc
    .getTransaction(signature as never, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
      encoding: 'jsonParsed',
    })
    .send();
  const tx = txRes as Record<string, unknown> | null;
  if (!tx) return { status: 'pending', reason: 'transaction not yet readable' };
  const meta = tx.meta as Record<string, unknown> | null;
  if (!meta || meta.err !== null) return { status: 'invalid', reason: 'transaction meta err' };

  // The returned transaction must be the one we asked about — same first
  // signature — and signed by exactly one account: the pinned payer.
  const txBody = tx.transaction as Record<string, unknown>;
  const signatures = txBody.signatures as string[] | undefined;
  if (!Array.isArray(signatures) || signatures[0] !== signature) {
    return { status: 'invalid', reason: 'returned transaction identity does not match' };
  }
  const message = txBody.message as Record<string, unknown>;
  const rawKeys = message.accountKeys as Array<Record<string, unknown> | string>;
  const accountKeys = rawKeys.map((k) => (typeof k === 'string' ? k : (k.pubkey as string)));
  const signerCount = rawKeys.filter(
    (k) => typeof k === 'object' && k !== null && (k as Record<string, unknown>).signer === true,
  ).length;
  const firstKey = rawKeys[0];
  if (
    accountKeys[0] !== expected.payer ||
    typeof firstKey !== 'object' ||
    firstKey === null ||
    (firstKey as Record<string, unknown>).signer !== true ||
    signerCount !== 1
  ) {
    return { status: 'invalid', reason: 'fee payer is not the single pinned signer' };
  }

  const instructions = message.instructions as Array<Record<string, unknown>>;
  if (!Array.isArray(instructions) || instructions.length !== 2) {
    return { status: 'invalid', reason: 'expected exactly the ATA create + transferChecked pair' };
  }

  const [ataIx, transferIx] = instructions;
  const ataParsed = ataIx.parsed as Record<string, unknown> | undefined;
  const ataInfo = ataParsed?.info as Record<string, unknown> | undefined;
  if (
    ataIx.programId !== ASSOCIATED_TOKEN_PROGRAM ||
    ataParsed?.type !== 'createIdempotent' ||
    ataInfo?.wallet !== expected.payee ||
    ataInfo?.mint !== expected.mint ||
    ataInfo?.account !== expected.destAta ||
    ataInfo?.source !== expected.payer ||
    // If the parser emits the inner program pins they must be the canonical
    // programs — never a substituted program address.
    (ataInfo?.systemProgram !== undefined && ataInfo.systemProgram !== SYSTEM_PROGRAM) ||
    (ataInfo?.tokenProgram !== undefined && ataInfo.tokenProgram !== TOKEN_PROGRAM) ||
    (ataInfo?.associatedTokenProgram !== undefined &&
      ataInfo.associatedTokenProgram !== ASSOCIATED_TOKEN_PROGRAM)
  ) {
    return { status: 'invalid', reason: 'ATA creation instruction does not match the proposal' };
  }

  const transferParsed = transferIx.parsed as Record<string, unknown> | undefined;
  const transferInfo = transferParsed?.info as Record<string, unknown> | undefined;
  if (
    transferIx.programId !== TOKEN_PROGRAM ||
    transferParsed?.type !== 'transferChecked' ||
    transferInfo?.source !== expected.sourceAta ||
    transferInfo?.destination !== expected.destAta ||
    transferInfo?.mint !== expected.mint ||
    transferInfo?.authority !== expected.payer ||
    String((transferInfo?.tokenAmount as Record<string, unknown>)?.amount) !==
      expected.amountBaseUnits ||
    Number((transferInfo?.tokenAmount as Record<string, unknown>)?.decimals) !== 6
  ) {
    return { status: 'invalid', reason: 'transferChecked instruction does not match the proposal' };
  }

  // Token balance deltas must show exactly -amount at the payer ATA and
  // +amount at the payee ATA for the pinned mint — no other token movement.
  // Every balance row is validated: integer unique accountIndex, canonical
  // Token program (when emitted), correct mint, 6 decimals, and a
  // nonnegative raw amount. A row sitting at the bound ATAs with the wrong
  // mint or owner is a mismatch, not an absence.
  const amount = BigInt(expected.amountBaseUnits);
  const amountRe = /^\d+$/;
  const collectRows = (balances: unknown, into: Map<string, bigint>): boolean => {
    const seen = new Set<number>();
    for (const entry of (balances as Array<Record<string, unknown>>) ?? []) {
      const idx = entry.accountIndex;
      if (
        typeof idx !== 'number' ||
        !Number.isInteger(idx) ||
        idx < 0 ||
        idx >= accountKeys.length ||
        seen.has(idx)
      ) {
        return false;
      }
      seen.add(idx);
      const account = accountKeys[idx];
      const mint = entry.mint as string;
      const owner = entry.owner as string;
      const programId = entry.programId as string | undefined;
      const ui = entry.uiTokenAmount as Record<string, unknown> | undefined;
      const amountStr = ui?.amount;
      if (
        typeof mint !== 'string' ||
        typeof owner !== 'string' ||
        (programId !== undefined && programId !== TOKEN_PROGRAM) ||
        typeof amountStr !== 'string' ||
        !amountRe.test(amountStr) ||
        ui?.decimals !== 6
      ) {
        return false;
      }
      if (account === expected.destAta && (mint !== expected.mint || owner !== expected.payee)) {
        return false;
      }
      if (account === expected.sourceAta && (mint !== expected.mint || owner !== expected.payer)) {
        return false;
      }
      if (mint !== expected.mint) continue;
      into.set(`${account}:${owner}`, (into.get(`${account}:${owner}`) ?? 0n) + BigInt(amountStr));
    }
    return true;
  };
  const pre = new Map<string, bigint>();
  const post = new Map<string, bigint>();
  if (!collectRows(meta.preTokenBalances, pre) || !collectRows(meta.postTokenBalances, post)) {
    return { status: 'invalid', reason: 'token balance rows are malformed' };
  }
  const sourceKey = `${expected.sourceAta}:${expected.payer}`;
  const destKey = `${expected.destAta}:${expected.payee}`;
  // The source pre+post rows and the destination post row must actually be
  // present — a missing row is not a zero.
  if (!pre.has(sourceKey) || !post.has(sourceKey) || !post.has(destKey)) {
    return { status: 'invalid', reason: 'required token balance rows are missing' };
  }
  const sourceDelta = post.get(sourceKey)! - pre.get(sourceKey)!;
  const destDelta = post.get(destKey)! - (pre.get(destKey) ?? 0n);
  if (sourceDelta !== -amount || destDelta !== amount) {
    return { status: 'invalid', reason: 'token balance deltas do not match the proposal' };
  }
  // No other token-account movement for this mint.
  const keys = new Set([...pre.keys(), ...post.keys()]);
  for (const key of keys) {
    if (key === sourceKey || key === destKey) continue;
    if ((post.get(key) ?? 0n) - (pre.get(key) ?? 0n) !== 0n) {
      return { status: 'invalid', reason: 'unexpected token balance movement' };
    }
  }

  return {
    status: confirmationStatus === 'finalized' ? 'finalized' : 'confirmed',
    receipt: {
      cluster: expected.cluster,
      mint: expected.mint,
      payee: expected.payee,
      payer: expected.payer,
      amountBaseUnits: expected.amountBaseUnits,
      confirmationStatus,
      intentId: expected.intentId,
      signature,
    },
  };
}
