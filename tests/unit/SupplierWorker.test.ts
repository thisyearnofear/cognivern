import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generateKeyPairSync } from 'node:crypto';
import {
  loadIssuerPublicKey,
  loadWorkerConfig,
  parseWorkerArgs,
  safeErrorText,
} from '../../tooling/supplier-payment/worker-common.js';

const PAYER = '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpThe9UPq5aR';
const PAYEE = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const UID = process.getuid!();

let root: string;
let paths: Record<string, string>;
let issuerPem: string;

function privateDir(name: string, mode = 0o700): string {
  const p = path.join(root, name);
  fs.mkdirSync(p, { mode });
  return p;
}

function file(name: string, content: string, mode = 0o600): string {
  const p = path.join(priv, name);
  fs.writeFileSync(p, content, { mode });
  return p;
}

let priv: string;

function baseConfig(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    enabled: true,
    workerUid: UID,
    distinctBackendUid: UID + 1,
    workspaceId: 'ws',
    mandateId: 'm',
    caseId: 'c',
    payee: PAYEE,
    subjectPayeePins: {},
    issuerPublicKeyPath: paths.issuer,
    reportRoot: paths.reports,
    signerKeyPath: paths.signer,
    signerPayerPubkey: PAYER,
    journalPath: paths.journal,
    dbPath: paths.db,
    creSnapshotPath: paths.cre,
    ...overrides,
  };
}

function writeConfig(raw: Record<string, unknown>, mode = 0o600): string {
  const p = path.join(priv, 'worker.json');
  fs.writeFileSync(p, JSON.stringify(raw), { mode });
  return p;
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'supplier-worker-'));
  fs.chmodSync(root, 0o700);
  priv = privateDir('priv');
  const kp = generateKeyPairSync('ed25519');
  issuerPem = kp.publicKey.export({ format: 'pem', type: 'spki' }) as string;
  paths = {
    issuer: file('issuer.pem', issuerPem),
    cre: file('runs.jsonl', ''),
    db: file('claims.db', ''),
    journal: path.join(priv, 'journal.db'),
    signer: path.join(priv, 'payer.json'),
    reports: privateDir('reports'),
  };
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('parseWorkerArgs', () => {
  const CFG = '/abs/worker.json';

  it('parses execute with config only', () => {
    expect(parseWorkerArgs(['execute', '--config', CFG], 'devnet')).toEqual({
      action: 'execute',
      configPath: CFG,
      envelopePath: undefined,
      simulateCrashAfterSend: false,
    });
  });

  it('parses reconcile with an envelope', () => {
    const args = parseWorkerArgs(
      ['reconcile', '--config', CFG, '--envelope', '/abs/e.json'],
      'devnet',
    );
    expect(args.envelopePath).toBe('/abs/e.json');
  });

  it('devnet rejects the local crash flag', () => {
    expect(() =>
      parseWorkerArgs(['execute', '--config', CFG, '--simulate-crash-after-send'], 'devnet'),
    ).toThrow(/unknown flag/);
  });

  it('devnet rejects an endpoint flag', () => {
    expect(() =>
      parseWorkerArgs(['execute', '--config', CFG, '--endpoint', '/x'], 'devnet'),
    ).toThrow(/unknown flag/);
  });

  it('localnet accepts the crash flag', () => {
    const args = parseWorkerArgs(
      ['execute', '--config', CFG, '--simulate-crash-after-send'],
      'localnet',
    );
    expect(args.simulateCrashAfterSend).toBe(true);
  });

  it.each([
    ['unknown flag', ['execute', '--config', CFG, '--bogus']],
    ['duplicate flag', ['execute', '--config', CFG, '--config', CFG]],
    ['missing value', ['execute', '--config']],
    ['relative path', ['execute', '--config', 'worker.json']],
    ['extra positional', ['execute', '--config', CFG, 'stray']],
    ['missing config', ['execute', '--envelope', '/abs/e.json']],
    ['bad action', ['dispatch', '--config', CFG]],
  ])('rejects %s', (_label, argv) => {
    expect(() => parseWorkerArgs(argv, 'devnet')).toThrow(/supplier worker rejected/);
  });
});

describe('loadWorkerConfig', () => {
  it('loads a valid devnet config', () => {
    const cfg = loadWorkerConfig(writeConfig(baseConfig()), 'devnet');
    expect(cfg.workspaceId).toBe('ws');
    expect(cfg.dbPath).toBe(paths.db);
  });

  it('refuses before any trusted-file check when not enabled', () => {
    const cfg = baseConfig({ enabled: false, dbPath: '/does/not/exist' });
    expect(() => loadWorkerConfig(writeConfig(cfg), 'devnet')).toThrow(/not explicitly enabled/);
  });

  it('refuses a uid mismatch', () => {
    expect(() =>
      loadWorkerConfig(writeConfig(baseConfig({ workerUid: UID + 9 })), 'devnet'),
    ).toThrow(/does not match the pinned workerUid/);
  });

  it('refuses to run as the backend uid', () => {
    expect(() =>
      loadWorkerConfig(writeConfig(baseConfig({ distinctBackendUid: UID })), 'devnet'),
    ).toThrow(/must not run as the backend uid/);
  });

  it.each([
    ['workerUid', 0],
    ['workerUid', -1],
    ['distinctBackendUid', 0],
    ['distinctBackendUid', -3],
  ])('refuses non-positive %s=%d', (key, value) => {
    expect(() => loadWorkerConfig(writeConfig(baseConfig({ [key]: value })), 'devnet')).toThrow(
      /positive integer/,
    );
  });

  it('requires reportRoot itself to be a private 0700 directory', () => {
    fs.chmodSync(paths.reports, 0o755);
    expect(() => loadWorkerConfig(writeConfig(baseConfig()), 'devnet')).toThrow(
      /trusted directory.*0700/,
    );
  });

  it('refuses a symlinked reportRoot', () => {
    const real = privateDir('reports-real');
    const link = path.join(root, 'reports-link');
    fs.symlinkSync(real, link);
    expect(() =>
      loadWorkerConfig(writeConfig(baseConfig({ reportRoot: link })), 'devnet'),
    ).toThrow(/trusted directory/);
  });

  it('devnet requires an existing 0600-owned DB', () => {
    fs.rmSync(paths.db);
    expect(() => loadWorkerConfig(writeConfig(baseConfig()), 'devnet')).toThrow(
      /trusted file missing/,
    );
  });

  it('devnet refuses a world-readable DB', () => {
    fs.chmodSync(paths.db, 0o644);
    expect(() => loadWorkerConfig(writeConfig(baseConfig()), 'devnet')).toThrow(/mode 600/);
  });

  it('localnet allows an absent DB but refuses a symlinked one', () => {
    const target = file('elsewhere.db', '');
    const link = path.join(priv, 'linked.db');
    fs.symlinkSync(target, link);
    expect(() =>
      loadWorkerConfig(writeConfig({ ...baseConfig({ dbPath: link }), ...localFields() }), 'localnet'),
    ).toThrow(/not a regular file/);
  });

  it('refuses a symlinked journal path', () => {
    const target = file('elsewhere.j', '');
    fs.symlinkSync(target, paths.journal);
    expect(() => loadWorkerConfig(writeConfig(baseConfig()), 'devnet')).toThrow(
      /not a regular file/,
    );
  });

  it('refuses a config file in a non-private parent', () => {
    const open = privateDir('open', 0o755);
    const p = path.join(open, 'worker.json');
    fs.writeFileSync(p, JSON.stringify(baseConfig()), { mode: 0o600 });
    expect(() => loadWorkerConfig(p, 'devnet')).toThrow(/mode 0700/);
  });

  it('refuses forbidden and unrecognized keys', () => {
    expect(() =>
      loadWorkerConfig(writeConfig(baseConfig({ rpcUrl: 'https://x' })), 'devnet'),
    ).toThrow(/not permitted|not recognized/);
    expect(() =>
      loadWorkerConfig(writeConfig(baseConfig({ surprise: 1 })), 'devnet'),
    ).toThrow(/not recognized/);
  });

  it('never echoes raw read/parse error text', () => {
    const p = file('worker.json', '{not json');
    expect(() => loadWorkerConfig(p, 'devnet')).toThrow(/^supplier worker rejected: config is not readable JSON$/);
  });
});

function localFields(): Record<string, unknown> {
  return {
    endpoint: 'http://127.0.0.1:18899',
    mint: PAYEE,
    genesisHash: PAYER,
  };
}

describe('loadIssuerPublicKey', () => {
  it('loads an Ed25519 public PEM', () => {
    expect(loadIssuerPublicKey(paths.issuer).asymmetricKeyType).toBe('ed25519');
  });

  it('refuses a private-key PEM', () => {
    const kp = generateKeyPairSync('ed25519');
    const p = file('priv.pem', kp.privateKey.export({ format: 'pem', type: 'pkcs8' }) as string);
    expect(() => loadIssuerPublicKey(p)).toThrow(/PUBLIC KEY PEM/);
  });

  it('refuses a non-Ed25519 public key', () => {
    const kp = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const p = file('rsa.pem', kp.publicKey.export({ format: 'pem', type: 'spki' }) as string);
    expect(() => loadIssuerPublicKey(p)).toThrow(/Ed25519 public key/);
  });

  it('refuses a missing file', () => {
    expect(() => loadIssuerPublicKey(path.join(priv, 'nope.pem'))).toThrow(/not readable/);
  });
});

describe('safeErrorText', () => {
  it('passes through vetted rejections only', () => {
    expect(safeErrorText(new Error('supplier worker rejected: nope'))).toBe(
      'supplier worker rejected: nope',
    );
    expect(safeErrorText(new Error('EACCES https://internal:secret@host'))).toBe('worker failed');
    expect(safeErrorText('weird')).toBe('worker failed');
  });
});
