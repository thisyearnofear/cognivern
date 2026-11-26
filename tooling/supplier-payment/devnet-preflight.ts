/**
 * Read-only devnet preflight for the supplier rail. Takes ONLY public
 * addresses — never a key file — and issues read-only JSON-RPC calls to the
 * official devnet endpoint. Writes a public-only artifact; no sends, no
 * faucet, no funding.
 *
 *   pnpm exec tsx tooling/supplier-payment/devnet-preflight.ts \
 *     --payer <PAYER_PUBKEY> --payee <PAYEE_PUBKEY> \
 *     [--out .artifacts/supplier-devnet-preflight.json]
 */
import fs from 'node:fs';
import { createSolanaRpc, isAddress } from '@solana/kit';
import { findAssociatedTokenPda, TOKEN_PROGRAM_ADDRESS } from '@solana-program/token';

const DEVNET_ENDPOINT = 'https://api.devnet.solana.com';
const DEVNET_GENESIS = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';
const DEVNET_USDC_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
const FEE_RESERVE_LAMPORTS = 10_000_000; // 0.01 SOL
const TRANSFER_BASE_UNITS = '10000';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const payer = arg('payer');
const payee = arg('payee');
const out = arg('out') ?? '.artifacts/supplier-devnet-preflight.json';

const report: Record<string, unknown> = {
  generatedAt: new Date().toISOString(),
  endpoint: DEVNET_ENDPOINT,
  pins: {
    cluster: 'devnet',
    genesisHash: DEVNET_GENESIS,
    mint: DEVNET_USDC_MINT,
    perTransferBaseUnits: TRANSFER_BASE_UNITS,
    runwayBaseUnits: TRANSFER_BASE_UNITS,
    feeReserveLamports: FEE_RESERVE_LAMPORTS,
    payer: payer ?? null,
    payee: payee ?? null,
  },
  checks: {},
  ready: false,
  blockers: [] as string[],
  note: 'Chain-side preflight only — "ready" says the deployment could pay ' +
    'on-chain. OS signer isolation, executor wiring, enabled flag and the ' +
    'manual funding gate are separate unproven gates.',
};
const blockers = report.blockers as string[];
const finish = (code: number): never => {
  fs.mkdirSync('.artifacts', { recursive: true });
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify({ ready: report.ready, funded: report.funded ?? false, blockers }, null, 2),
  );
  process.exit(code);
};

// Malformed inputs can never produce a "ready" report.
if (!payer || !payee || !isAddress(payer) || !isAddress(payee) || payer === payee) {
  blockers.push('malformed payer/payee input');
  finish(1);
}

const rpc = createSolanaRpc(DEVNET_ENDPOINT);
// Kit send() returns the RPC result value directly; methods that carry a
// context wrap it in {context, value}.
const contextSlot = (r: unknown) =>
  typeof r === 'object' && r !== null && 'context' in (r as object)
    ? (r as { context: { slot: number } }).context.slot
    : null;
const valueOf = (r: unknown) =>
  typeof r === 'object' && r !== null && 'value' in (r as object)
    ? (r as { value: unknown }).value
    : r;

// Genesis must match exactly — the whole preflight is meaningless otherwise.
// getGenesisHash carries no context slot; the snapshot below provides it.
try {
  const genesisStr = String(await rpc.getGenesisHash().send());
  (report.checks as Record<string, unknown>).genesis = {
    expected: DEVNET_GENESIS,
    actual: genesisStr,
    match: genesisStr === DEVNET_GENESIS,
  };
  if (genesisStr !== DEVNET_GENESIS) {
    blockers.push('endpoint genesis does not match canonical devnet');
  }
} catch {
  (report.checks as Record<string, unknown>).genesis = { error: 'unreadable' };
  blockers.push('devnet endpoint unreachable or unauthorized');
  finish(2);
}

const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const SYSTEM_PROGRAM = '11111111111111111111111111111111';

const [payerAta] = await findAssociatedTokenPda({
  mint: DEVNET_USDC_MINT as never,
  owner: payer as never,
  tokenProgram: TOKEN_PROGRAM_ADDRESS,
});
const [payeeAta] = await findAssociatedTokenPda({
  mint: DEVNET_USDC_MINT as never,
  owner: payee as never,
  tokenProgram: TOKEN_PROGRAM_ADDRESS,
});
(report.checks as Record<string, unknown>).derivedAtas = {
  payerAta: String(payerAta),
  payeeAta: String(payeeAta),
};

// One confirmed snapshot at a single context slot — mint, payer, payee and
// both derived ATAs are read atomically, not across separate calls.
let accounts: unknown[] = [];
try {
  const snapshot = await rpc
    .getMultipleAccounts(
      [DEVNET_USDC_MINT, payer, payee, String(payerAta), String(payeeAta)] as never,
      { encoding: 'jsonParsed', commitment: 'confirmed' },
    )
    .send();
  const slot = contextSlot(snapshot);
  report.contextSlot = slot === null ? null : Number(slot);
  accounts = valueOf(snapshot) as unknown[];
  if (!Array.isArray(accounts) || accounts.length !== 5) {
    throw new Error('snapshot shape unexpected');
  }
} catch {
  blockers.push('confirmed account snapshot unreadable — unknown state');
  finish(2);
}

const [mintAcct, payerAcct, payeeAcct, payerAtaAcct, payeeAtaAcct] =
  accounts as Array<Record<string, unknown> | null>;

// Mint: owned by the canonical Token program, initialized 6-decimal SPL mint.
if (mintAcct === null) {
  (report.checks as Record<string, unknown>).mint = { status: 'absent' };
  blockers.push('devnet USDC mint account absent');
} else {
  const data = mintAcct.data as Record<string, unknown> | undefined;
  const info = (data?.parsed as Record<string, unknown>)?.info as Record<string, unknown>;
  (report.checks as Record<string, unknown>).mint = {
    status: 'present',
    owner: mintAcct.owner,
    decimals: info?.decimals,
    isInitialized: info?.isInitialized,
  };
  if (
    mintAcct.owner !== TOKEN_PROGRAM ||
    info?.decimals !== 6 ||
    info?.isInitialized !== true
  ) {
    blockers.push('devnet USDC mint is not an initialized 6-decimal SPL mint');
  }
}

// A present payer/payee system account must be owned by the System program
// and non-executable — anything else is not a plain wallet.
const systemAccount = (name: string, acct: Record<string, unknown> | null) => {
  if (acct === null) return { status: 'absent', lamports: '0' };
  const ok = acct.owner === SYSTEM_PROGRAM && acct.executable === false;
  if (!ok) blockers.push(`${name} is not a plain system-owned wallet`);
  return {
    status: 'present',
    lamports: String(acct.lamports),
    owner: acct.owner,
    executable: acct.executable,
    plainWallet: ok,
  };
};

// Canonical ATA: parsed spl-token account bound to the expected owner and
// mint, initialized (not frozen), 6 decimals, integer amount.
const ataCheck = (
  name: string,
  wallet: string,
  acct: Record<string, unknown> | null,
): { status: string; usdcBaseUnits: string | null; [k: string]: unknown } => {
  if (acct === null) return { status: 'absent', usdcBaseUnits: '0' };
  const data = acct.data as Record<string, unknown> | undefined;
  const parsed = data?.parsed as Record<string, unknown> | undefined;
  const info = parsed?.info as Record<string, unknown> | undefined;
  const tokenAmount = info?.tokenAmount as Record<string, unknown> | undefined;
  const amountStr = tokenAmount?.amount;
  const wellFormed =
    acct.owner === TOKEN_PROGRAM &&
    data?.program === 'spl-token' &&
    parsed?.type === 'account' &&
    info?.owner === wallet &&
    info?.mint === DEVNET_USDC_MINT &&
    info?.state === 'initialized' &&
    tokenAmount?.decimals === 6 &&
    typeof amountStr === 'string' &&
    /^\d+$/.test(amountStr);
  if (!wellFormed) {
    blockers.push(`${name} ATA is not a well-formed pinned USDC token account`);
    return { status: 'malformed', usdcBaseUnits: null };
  }
  return {
    status: 'present',
    usdcBaseUnits: String(amountStr),
    owner: info?.owner,
    mint: info?.mint,
    state: info?.state,
  };
};

const payerSystem = systemAccount('payer', payerAcct);
const payeeSystem = systemAccount('payee', payeeAcct);
const payerAtaCheck = ataCheck('payer', payer!, payerAtaAcct);
const payeeAtaCheck = ataCheck('payee', payee!, payeeAtaAcct);
(report.checks as Record<string, unknown>).balances = {
  payer: { sol: payerSystem, ata: payerAtaCheck },
  payee: { sol: payeeSystem, ata: payeeAtaCheck },
};

// Funding: exactly the deployment cap — 10000 base units — plus the SOL fee
// reserve. Over the cap is NOT ready: the deployment is limited to one
// transfer of exactly 0.01 USDC.
const payerLamports = payerAcct === null ? 0n : BigInt(String(payerAcct.lamports));
const hasFeeReserve = payerLamports >= BigInt(FEE_RESERVE_LAMPORTS);
const payerUsdcStr = payerAtaCheck.usdcBaseUnits;
const payerUsdcExact = payerUsdcStr === TRANSFER_BASE_UNITS;
report.funded = hasFeeReserve && payerUsdcExact;
if (payerAtaCheck.status === 'present' && payerUsdcStr !== null && BigInt(payerUsdcStr) > BigInt(TRANSFER_BASE_UNITS)) {
  blockers.push('payer ATA holds more than the 10000-base-unit deployment cap');
} else if (payerAtaCheck.status === 'present' && BigInt(payerUsdcStr!) < BigInt(TRANSFER_BASE_UNITS)) {
  blockers.push('payer ATA holds less than the 0.01 USDC transfer amount');
} else if (payerAtaCheck.status === 'absent' || payerAtaCheck.status === 'malformed') {
  blockers.push(`payer ATA ${payerAtaCheck.status} — manual funding gate`);
}
if (!hasFeeReserve) blockers.push('payer lacks the 0.01 SOL fee reserve');

report.ready = blockers.length === 0;
finish(report.ready ? 0 : 1);
