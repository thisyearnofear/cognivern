/**
 * Shared worker composition for the supplier payment CLI workers. Both the
 * devnet worker and the local-only harness build the same executor deps
 * here; the network arm is a discriminated literal chosen by the entry
 * point, never by config content.
 *
 * Fail-closed order — nothing touches the signer file, the DB, or the RPC
 * until every gate below passes:
 *   1. config file: absolute path, private parent (0700, uid or root
 *      owned, no symlinks), regular file 0600 owned by worker or root;
 *   2. `enabled` explicitly true;
 *   3. uid pin: real uid === configured workerUid, !== distinctBackendUid,
 *      not root;
 *   4. every trusted input path absolute inside a private parent;
 *   5. only then: DB_PATH env set, dynamic imports, signer load, rail.
 *
 * The worker never reads env-based signers, default wallet paths, dotenv,
 * or live persistence: the SQLite DB path and the read-only CRE snapshot
 * path are explicit config values.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createPublicKey, type KeyObject } from 'node:crypto';
import { isAddress } from '@solana/kit';
import type { SupplierPaymentExecutorResult } from '../../src/backend/services/telegraph/SupplierPaymentExecutor.js';

const HEX64 = /^[0-9a-f]{64}$/;

function fail(msg: string): never {
  throw new Error(`supplier worker rejected: ${msg}`);
}

export interface WorkerIdentity {
  workerUid: number;
  distinctBackendUid: number;
}

export interface DevnetWorkerConfig extends WorkerIdentity {
  enabled: boolean;
  workspaceId: string;
  mandateId: string;
  caseId: string;
  payee: string;
  subjectPayeePins: Record<string, string>;
  issuerPublicKeyPath: string;
  reportRoot: string;
  signerKeyPath: string;
  signerPayerPubkey: string;
  journalPath: string;
  dbPath: string;
  creSnapshotPath: string;
}

export interface LocalWorkerConfig extends DevnetWorkerConfig {
  endpoint: string;
  mint: string;
  genesisHash: string;
}

const DEVNET_KEYS = new Set([
  'enabled', 'workerUid', 'distinctBackendUid', 'workspaceId', 'mandateId',
  'caseId', 'payee', 'subjectPayeePins', 'issuerPublicKeyPath', 'reportRoot',
  'signerKeyPath', 'signerPayerPubkey', 'journalPath', 'dbPath',
  'creSnapshotPath', 'evidenceMaxAgeMs',
]);
const LOCAL_KEYS = new Set([...DEVNET_KEYS, 'endpoint', 'mint', 'genesisHash']);
// Network pins are literals in code — config keys trying to move the chain
// are refused outright.
const FORBIDDEN_KEYS = new Set([
  'cluster', 'rpcUrl', 'rpcEndpoint', 'genesis', 'env', 'home',
  'solanaConfig', 'keypair', 'keypairPath', 'wallet', 'envLimits',
]);

function checkPrivateParent(filePath: string, uid: number): void {
  const dir = path.dirname(filePath);
  const st = fs.lstatSync(dir, { throwIfNoEntry: false });
  if (!st?.isDirectory() || st.isSymbolicLink()) {
    fail(`parent directory of ${filePath} missing or is a symlink`);
  }
  if ((st.mode & 0o777) !== 0o700) fail(`parent directory of ${filePath} must be mode 0700`);
  if (st.uid !== uid && st.uid !== 0) fail(`parent directory of ${filePath} is not worker/root owned`);
}

function checkPrivateFile(filePath: string, uid: number, mode = 0o600): void {
  const st = fs.lstatSync(filePath, { throwIfNoEntry: false });
  if (!st) fail(`trusted file missing: ${filePath}`);
  if (st.isSymbolicLink() || !st.isFile()) fail(`trusted file is not a regular file: ${filePath}`);
  if ((st.mode & 0o777) !== mode) fail(`trusted file ${filePath} must be mode ${mode.toString(8)}`);
  if (st.uid !== uid && st.uid !== 0) fail(`trusted file ${filePath} is not worker/root owned`);
}

function checkPrivateDir(dirPath: string, uid: number): void {
  const st = fs.lstatSync(dirPath, { throwIfNoEntry: false });
  if (!st?.isDirectory() || st.isSymbolicLink()) {
    fail(`trusted directory ${dirPath} missing or is a symlink`);
  }
  if ((st.mode & 0o777) !== 0o700) fail(`trusted directory ${dirPath} must be mode 0700`);
  if (st.uid !== uid && st.uid !== 0) fail(`trusted directory ${dirPath} is not worker/root owned`);
}

// Files that may legitimately not exist yet (journal/DB on first run on the
// local harness) still may never be reached through a symlink or a foreign
// owner — a planted link would redirect writes outside the private dir.
function checkNoSymlinkFile(filePath: string, uid: number): void {
  const st = fs.lstatSync(filePath, { throwIfNoEntry: false });
  if (!st) return;
  if (st.isSymbolicLink() || !st.isFile()) fail(`trusted file is not a regular file: ${filePath}`);
  if (st.uid !== uid && st.uid !== 0) fail(`trusted file ${filePath} is not worker/root owned`);
}

function nonblank(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function absPath(v: unknown, name: string): string {
  if (!nonblank(v) || !path.isAbsolute(v)) fail(`config ${name} must be an absolute path`);
  if (v !== path.normalize(v)) fail(`config ${name} is not normalized`);
  return v;
}

function parseConfig(raw: unknown, network: 'devnet' | 'localnet'): DevnetWorkerConfig | LocalWorkerConfig {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) fail('config is not an object');
  const cfg = raw as Record<string, unknown>;
  const allowed = network === 'devnet' ? DEVNET_KEYS : LOCAL_KEYS;
  for (const key of Object.keys(cfg)) {
    if (FORBIDDEN_KEYS.has(key)) fail(`config key ${key} is not permitted`);
    if (!allowed.has(key)) fail(`config key ${key} is not recognized for the ${network} worker`);
  }
  if (cfg.enabled !== true) fail('worker is not explicitly enabled');
  if (
    typeof cfg.workerUid !== 'number' ||
    !Number.isInteger(cfg.workerUid) ||
    cfg.workerUid <= 0
  ) {
    fail('workerUid must be a positive integer (never root)');
  }
  if (
    typeof cfg.distinctBackendUid !== 'number' ||
    !Number.isInteger(cfg.distinctBackendUid) ||
    cfg.distinctBackendUid <= 0
  ) {
    fail('distinctBackendUid must be a positive integer (never root)');
  }
  if (!nonblank(cfg.workspaceId) || !nonblank(cfg.mandateId) || !nonblank(cfg.caseId)) {
    fail('workspaceId/mandateId/caseId are required');
  }
  if (typeof cfg.payee !== 'string' || !isAddress(cfg.payee)) fail('payee is not a valid address');
  if (typeof cfg.signerPayerPubkey !== 'string' || !isAddress(cfg.signerPayerPubkey)) fail('signerPayerPubkey is not a valid address');
  if (cfg.signerPayerPubkey === cfg.payee) fail('payer must differ from payee');
  if (typeof cfg.subjectPayeePins !== 'object' || cfg.subjectPayeePins === null) {
    fail('subjectPayeePins must be an object');
  }
  for (const [k, v] of Object.entries(cfg.subjectPayeePins as Record<string, unknown>)) {
    if (!HEX64.test(k) || typeof v !== 'string' || !isAddress(v)) fail('subjectPayeePins must map subjectHash → address');
  }
  const out: Record<string, unknown> = {
    enabled: true,
    workerUid: cfg.workerUid,
    distinctBackendUid: cfg.distinctBackendUid,
    workspaceId: cfg.workspaceId,
    mandateId: cfg.mandateId,
    caseId: cfg.caseId,
    payee: cfg.payee,
    subjectPayeePins: cfg.subjectPayeePins,
    issuerPublicKeyPath: absPath(cfg.issuerPublicKeyPath, 'issuerPublicKeyPath'),
    reportRoot: absPath(cfg.reportRoot, 'reportRoot'),
    signerKeyPath: absPath(cfg.signerKeyPath, 'signerKeyPath'),
    signerPayerPubkey: cfg.signerPayerPubkey,
    journalPath: absPath(cfg.journalPath, 'journalPath'),
    dbPath: absPath(cfg.dbPath, 'dbPath'),
    creSnapshotPath: absPath(cfg.creSnapshotPath, 'creSnapshotPath'),
  };
  if (network === 'localnet') {
    if (!nonblank(cfg.endpoint)) fail('local endpoint is required');
    if (typeof cfg.mint !== 'string' || !isAddress(cfg.mint)) fail('local mint is not a valid address');
    if (!nonblank(cfg.genesisHash)) fail('local genesisHash is required');
    out.endpoint = cfg.endpoint;
    out.mint = cfg.mint;
    out.genesisHash = cfg.genesisHash;
  }
  return out as unknown as DevnetWorkerConfig | LocalWorkerConfig;
}

export function loadWorkerConfig(
  configPath: string,
  network: 'devnet' | 'localnet',
): DevnetWorkerConfig | LocalWorkerConfig {
  if (!path.isAbsolute(configPath)) fail('config path must be absolute');
  const uid = typeof process.getuid === 'function' ? process.getuid() : undefined;
  if (uid === undefined || uid === 0) fail('worker must run as a non-root user');
  checkPrivateParent(configPath, uid);
  checkPrivateFile(configPath, uid, 0o600);
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    // Generic only — a raw read/parse message could echo file contents.
    fail('config is not readable JSON');
  }
  const cfg = parseConfig(raw, network);
  // Identity pin before anything else touches signer/DB/RPC.
  if (uid !== cfg.workerUid) fail('process uid does not match the pinned workerUid');
  if (uid === cfg.distinctBackendUid) fail('worker must not run as the backend uid');
  // Every trusted input must live under a private parent.
  for (const p of [
    cfg.issuerPublicKeyPath,
    cfg.signerKeyPath,
    cfg.journalPath,
    cfg.dbPath,
    cfg.creSnapshotPath,
  ]) {
    checkPrivateParent(p, uid);
  }
  // reportRoot is a trusted directory itself — 0700, worker/root owned,
  // no symlinks — not merely one with a private parent.
  checkPrivateDir(cfg.reportRoot, uid);
  // Trusted files themselves: regular, private, worker/root owned.
  checkPrivateFile(cfg.issuerPublicKeyPath, uid, 0o600);
  checkPrivateFile(cfg.creSnapshotPath, uid);
  if (network === 'devnet') {
    // The devnet claims/mandate DB is provisioned by an explicit migration
    // before the worker ever runs — it must already exist, 0600-owned.
    checkPrivateFile(cfg.dbPath, uid, 0o600);
  } else {
    checkNoSymlinkFile(cfg.dbPath, uid);
  }
  checkNoSymlinkFile(cfg.journalPath, uid);
  return cfg;
}

export interface WorkerArgs {
  action: 'execute' | 'reconcile';
  configPath: string;
  envelopePath?: string;
  simulateCrashAfterSend?: boolean;
}

/** Strict argv parse: every flag is known, appears at most once, and takes
 *  exactly one non-flag value; no extra positionals are ignored. */
export function parseWorkerArgs(
  argv: string[],
  network: 'devnet' | 'localnet',
): WorkerArgs {
  const action = argv[0];
  if (action !== 'execute' && action !== 'reconcile') {
    fail('usage: worker <execute|reconcile> --config <path> [--envelope <path>]');
  }
  const allowed = new Set(
    network === 'localnet'
      ? ['--config', '--envelope', '--simulate-crash-after-send']
      : ['--config', '--envelope'],
  );
  const seen = new Map<string, string | true>();
  for (let i = 1; i < argv.length; i++) {
    const tok = argv[i];
    if (!tok.startsWith('--')) fail(`unexpected argument: ${tok}`);
    if (!allowed.has(tok)) fail(`unknown flag for the ${network} worker: ${tok}`);
    if (seen.has(tok)) fail(`duplicate flag: ${tok}`);
    if (tok === '--simulate-crash-after-send') {
      seen.set(tok, true);
      continue;
    }
    const v = argv[i + 1];
    if (!v || v.startsWith('--')) fail(`flag ${tok} requires a path argument`);
    if (!path.isAbsolute(v)) fail(`flag ${tok} must be an absolute path`);
    seen.set(tok, v);
    i++;
  }
  const configPath = seen.get('--config');
  if (typeof configPath !== 'string') fail('--config is required');
  return {
    action,
    configPath,
    envelopePath: seen.get('--envelope') as string | undefined,
    simulateCrashAfterSend: seen.get('--simulate-crash-after-send') === true,
  };
}

/** Load the issuer's Ed25519 public key from the config-pinned path. A
 *  private-key PEM in this slot is a live misconfiguration — refuse it
 *  explicitly rather than parsing past it. */
export function loadIssuerPublicKey(pemPath: string): KeyObject {
  let pem: string;
  try {
    pem = fs.readFileSync(pemPath, 'utf8');
  } catch {
    fail('issuer public key is not readable');
  }
  if (!pem.trimStart().startsWith('-----BEGIN PUBLIC KEY-----')) {
    fail('issuer key must be a PUBLIC KEY PEM');
  }
  let key: KeyObject;
  try {
    key = createPublicKey(pem);
  } catch {
    fail('issuer public key is not a valid PEM');
  }
  if (key.asymmetricKeyType !== 'ed25519' || key.type !== 'public') {
    fail('issuer key is not an Ed25519 public key');
  }
  return key;
}

// Adapter/RPC/storage error text can carry endpoints or secrets — only
// this module's own vetted rejections may be printed verbatim.
export function safeErrorText(err: unknown): string {
  const msg = err instanceof Error ? err.message : '';
  return msg.startsWith('supplier worker rejected:') ? msg : 'worker failed';
}

export function readEnvelopeInput(envelopePath: string | undefined): unknown {
  const text = envelopePath
    ? fs.readFileSync(envelopePath, 'utf8')
    : fs.readFileSync(0, 'utf8');
  try {
    return JSON.parse(text);
  } catch {
    fail('envelope input is not valid JSON');
  }
}

export interface WorkerDeps {
  config: Record<string, unknown>;
  rail: unknown;
  creStore: unknown;
}

const TRANSFER_USD = 0.01;

export async function runWorker(opts: {
  network: 'devnet' | 'localnet';
  config: DevnetWorkerConfig | LocalWorkerConfig;
  action: 'execute' | 'reconcile';
  envelope: unknown;
  /** Local harness only — crash after the rail returns, before finalize. */
  simulateCrashAfterSend?: boolean;
}): Promise<SupplierPaymentExecutorResult> {
  const { network, config } = opts;
  if (opts.simulateCrashAfterSend && network !== 'localnet') {
    fail('crash simulation is a localnet-only test hook');
  }
  // The DB path must be bound before ANY backend module touches the db.
  process.env.DB_PATH = config.dbPath;
  const [
    { initSupplierPaymentClaims },
    { getDb },
    { CreRunStore },
    { JsonlCreRunPersistence },
    { createLocalSupplierExecutor, executeSupplierPayment, reconcileSupplierPayment },
    railModule,
  ] = await Promise.all([
    import('../../src/backend/services/telegraph/SupplierPaymentStore.js'),
    import('../../src/backend/db/index.js'),
    import('../../src/backend/cre/storage/CreRunStore.js'),
    import('../../src/backend/cre/persistence/CreRunPersistence.js'),
    import('../../src/backend/services/telegraph/SupplierPaymentExecutor.js'),
    import('./rail.js'),
  ]);

  if (network === 'localnet') {
    // Local harness owns a disposable DB — provisioning the claims schema
    // there is part of the fixture.
    initSupplierPaymentClaims(getDb());
  } else {
    // Devnet never provisions schema implicitly: the claims table must have
    // been created by the explicit deployment migration beforehand.
    const row = getDb()
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='supplier_payment_claims'")
      .get();
    if (!row) {
      fail('supplier_payment_claims table missing — run the claims migration before enabling the worker');
    }
  }

  const scope = {
    workspaceId: config.workspaceId,
    mandateId: config.mandateId,
    caseId: config.caseId,
    payee: config.payee,
  };
  const rail =
    network === 'devnet'
      ? await railModule.createSupplierDevnetRail({
          signerKeyPath: config.signerKeyPath,
          payer: config.signerPayerPubkey,
          journalPath: config.journalPath,
          scope,
        })
      : await railModule.createLocalSupplierRail({
          endpoint: (config as LocalWorkerConfig).endpoint,
          mint: (config as LocalWorkerConfig).mint,
          signerKeyPath: config.signerKeyPath,
          payer: config.signerPayerPubkey,
          journalPath: config.journalPath,
          scope,
        });

  if (opts.simulateCrashAfterSend) {
    // Local test-runner fault injection only — the devnet worker entry point
    // never passes this flag. Exits with code 42 after the rail returns a
    // receipt, before the claim is finalized.
    const real = rail.sendTransfer.bind(rail);
    rail.sendTransfer = async (transfer) => {
      const receipt = await real(transfer);
      process.exit(42);
    };
  }

  const trustedPublicKey = loadIssuerPublicKey(config.issuerPublicKeyPath);

  const creStore = new CreRunStore({
    persistence: new JsonlCreRunPersistence({ filePath: config.creSnapshotPath }),
  });

  const envLimits = {
    maxTransferUsd: TRANSFER_USD,
    runwayUsd: TRANSFER_USD,
    payeeAllowlist: [config.payee],
    policySource: 'env' as const,
  };

  if (network === 'devnet') {
    const deps = {
      config: {
        enabled: true,
        workspaceId: config.workspaceId,
        mandateId: config.mandateId,
        trustedPublicKey,
        reportRoot: config.reportRoot,
        subjectPayeePins: config.subjectPayeePins,
        rail: {
          cluster: 'devnet' as const,
          mint: railModule.DEVNET_USDC_MINT,
          payer: config.signerPayerPubkey,
          maxTransferUsd: TRANSFER_USD,
          genesisHash: railModule.DEVNET_GENESIS,
        },
        envLimits,
      },
      rail,
      creStore,
    };
    return opts.action === 'execute'
      ? executeSupplierPayment(config.workspaceId, opts.envelope, deps)
      : reconcileSupplierPayment(config.workspaceId, opts.envelope, deps);
  }

  const executor = createLocalSupplierExecutor({
    config: {
      enabled: true,
      workspaceId: config.workspaceId,
      mandateId: config.mandateId,
      trustedPublicKey,
      reportRoot: config.reportRoot,
      subjectPayeePins: config.subjectPayeePins,
      rail: {
        cluster: 'localnet' as const,
        mint: (config as LocalWorkerConfig).mint,
        payer: config.signerPayerPubkey,
        maxTransferUsd: TRANSFER_USD,
        genesisHash: (config as LocalWorkerConfig).genesisHash,
      },
      envLimits,
    },
    rail,
    creStore,
  });
  return opts.action === 'execute'
    ? executor.execute(config.workspaceId, opts.envelope)
    : executor.reconcile(config.workspaceId, opts.envelope);
}
