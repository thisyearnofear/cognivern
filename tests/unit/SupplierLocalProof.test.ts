import { describe, expect, it, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Guard/cleanup coverage for tooling/supplier-payment/local-proof.sh —
// sourced helpers + disposable `sleep` children only. NO real validator,
// no downloads, no disk images: these tests never invoke the chain path.
const SCRIPT = path.resolve(__dirname, '../../tooling/supplier-payment/local-proof.sh');

const madeDirs: string[] = [];
function tmpDir(prefix: string): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  madeDirs.push(d);
  return d;
}
afterEach(() => {
  while (madeDirs.length) fs.rmSync(madeDirs.pop()!, { recursive: true, force: true });
});

function run(args: string[]): { status: number; out: string } {
  const r = spawnSync('bash', [SCRIPT, ...args], { encoding: 'utf8', timeout: 15000 });
  return { status: r.status ?? -1, out: `${r.stdout}${r.stderr}` };
}

// Sourcing defines the helpers only (no cd, no umask change); the snippet
// runs inside its own disposable cwd so diagnostics land in the fixture.
function sourced(code: string, cwd: string): { status: number; out: string } {
  const r = spawnSync('bash', ['-c', `source '${SCRIPT}'; ${code}`], {
    cwd,
    encoding: 'utf8',
    timeout: 30000,
  });
  return { status: r.status ?? -1, out: `${r.stdout}${r.stderr}` };
}

const DARWIN = process.platform === 'darwin';

describe('local-proof.sh flag parsing', () => {
  it('rejects unknown flags before any filesystem work', () => {
    const r = run(['--bogus']);
    expect(r.status).not.toBe(0);
    expect(r.out).toMatch(/unknown flag/);
  });

  it('rejects a bare extra positional', () => {
    const r = run(['stray']);
    expect(r.status).not.toBe(0);
    expect(r.out).toMatch(/unknown flag/);
  });

  it('rejects --scratch-dir without a value', () => {
    const r = run(['--scratch-dir']);
    expect(r.status).not.toBe(0);
    expect(r.out).toMatch(/requires a path/);
  });

  it('rejects --scratch-dir when the value is another flag', () => {
    const r = run(['--scratch-dir', '--governed']);
    expect(r.status).not.toBe(0);
    expect(r.out).toMatch(/must be a path, not a flag|requires a path/);
  });

  it('--help exits 0 without touching the disk policy', () => {
    const r = run(['--help']);
    expect(r.status).toBe(0);
    expect(r.out).toMatch(/usage:/);
  });
});

describe('local-proof.sh platform guard', () => {
  it.skipIf(!DARWIN)('denies macOS by default before temp creation', () => {
    const r = run(['--governed']);
    expect(r.status).not.toBe(0);
    expect(r.out).toMatch(/not permitted without --allow-macos/);
  });

  it.skipIf(!DARWIN)('denies --allow-macos without a scratch mount', () => {
    const r = run(['--allow-macos']);
    expect(r.status).not.toBe(0);
    expect(r.out).toMatch(/requires --scratch-dir/);
  });

  it.skipIf(!DARWIN)('denies --allow-macos on a non-mounted scratch (shared Data volume)', () => {
    const r = run(['--allow-macos', '--scratch-dir', '/tmp']);
    expect(r.status).not.toBe(0);
    expect(r.out).toMatch(/not an approved scratch mount/);
  });

  it.skipIf(DARWIN)('linux: rejects a symlinked scratch dir', () => {
    const tmp = tmpDir('proof-guard-');
    const real = path.join(tmp, 'real');
    const link = path.join(tmp, 'link');
    fs.mkdirSync(real);
    fs.symlinkSync(real, link);
    const r = run(['--scratch-dir', link]);
    expect(r.status).not.toBe(0);
    expect(r.out).toMatch(/symlink/);
  });

  it.skipIf(DARWIN)('linux: rejects a relative scratch dir', () => {
    const r = run(['--scratch-dir', 'relative/dir']);
    expect(r.status).not.toBe(0);
    expect(r.out).toMatch(/absolute path/);
  });

  it.skipIf(DARWIN)('linux: rejects a missing scratch dir (never mkdir -p)', () => {
    const r = run(['--scratch-dir', path.join(os.tmpdir(), 'proof-no-such-dir')]);
    expect(r.status).not.toBe(0);
    expect(r.out).toMatch(/must already exist/);
  });
});

describe('macos_scratch_ok (sourced)', () => {
  it.skipIf(!DARWIN)('rejects /tmp — not a separate mount', () => {
    expect(sourced('macos_scratch_ok /tmp', os.tmpdir()).status).not.toBe(0);
  });
  it.skipIf(!DARWIN)('rejects / — the root volume is never a scratch disk', () => {
    expect(sourced('macos_scratch_ok /', os.tmpdir()).status).not.toBe(0);
  });
  it.skipIf(!DARWIN)('rejects a symlink even to a real dir', () => {
    const cwd = tmpDir('proof-link-');
    fs.mkdirSync(path.join(cwd, 'real'));
    fs.symlinkSync(path.join(cwd, 'real'), path.join(cwd, 'link'));
    const r = sourced('macos_scratch_ok ./link', cwd);
    expect(r.status).not.toBe(0);
  });
});

describe('cleanup (sourced, disposable child only)', () => {
  it('stops only the captured pid, removes only this run\'s workspace, preserves siblings', () => {
    const cwd = tmpDir('proof-cleanup-');
    const scratch = fs.mkdtempSync(path.join(cwd, 'scratch-'));
    const sibling = path.join(scratch, 'supplier-local-proof.SIBLING');
    fs.mkdirSync(sibling);
    const code = `
      TMP="$(mktemp -d "${scratch}/supplier-local-proof.XXXXXX")"
      mkdir "\${TMP}/ledger" "\${TMP}/keys"; touch "\${TMP}/keys/payer.json"
      sleep 60 >/dev/null 2>&1 & VALIDATOR_PID=$!
      SLEEP_PID=$VALIDATOR_PID
      PROOF_RC=0; GOVERNED=0; KEEP_FAILED_LEDGER=0; DIAG=".artifacts/diag.txt"
      cleanup
      kill -0 "$SLEEP_PID" 2>/dev/null && echo "validator still alive"
      [ -d "\${TMP}" ] && echo "tmp still exists"
      [ -d "${sibling}" ] || echo "sibling destroyed"
      echo "done"
    `;
    const r = sourced(code, cwd);
    expect(r.out).not.toMatch(/validator still alive/);
    expect(r.out).not.toMatch(/tmp still exists/);
    expect(r.out).not.toMatch(/sibling destroyed/);
    expect(r.out).toMatch(/done/);
  });

  it('cleanup returns the original exit code unmasked', () => {
    const cwd = tmpDir('proof-rc-');
    const scratch = fs.mkdtempSync(path.join(cwd, 'scratch-'));
    const code = `
      TMP="$(mktemp -d "${scratch}/supplier-local-proof.XXXXXX")"
      PROOF_RC=3; GOVERNED=0; KEEP_FAILED_LEDGER=0; DIAG=".artifacts/diag.txt"
      cleanup
      echo "rc=$?"
    `;
    const r = sourced(code, cwd);
    expect(r.out).toMatch(/rc=3/);
  });

  it('--keep-failed-ledger on failure retains ONLY the ledger, not keys/db/config', () => {
    const cwd = tmpDir('proof-keep-');
    const scratch = fs.mkdtempSync(path.join(cwd, 'scratch-'));
    const code = `
      TMP="$(mktemp -d "${scratch}/supplier-local-proof.XXXXXX")"
      mkdir "\${TMP}/ledger" "\${TMP}/keys" "\${TMP}/worker-db"
      touch "\${TMP}/keys/payer.json" "\${TMP}/worker-db/claims.db" "\${TMP}/cli-config.yml"
      PROOF_RC=3; GOVERNED=0; KEEP_FAILED_LEDGER=1; DIAG=".artifacts/diag.txt"
      cleanup
      [ -d "\${TMP}/ledger" ] || echo "ledger missing"
      [ -e "\${TMP}/keys" ] && echo "keys survived"
      [ -e "\${TMP}/worker-db" ] && echo "db survived"
      [ -e "\${TMP}/cli-config.yml" ] && echo "cli config survived"
      echo "done"
    `;
    const r = sourced(code, cwd);
    expect(r.out).toMatch(/retained ONLY .*ledger/);
    expect(r.out).not.toMatch(/ledger missing/);
    expect(r.out).not.toMatch(/keys survived|db survived|cli config survived/);
  });

  it('keeps nothing on success even with --keep-failed-ledger', () => {
    const cwd = tmpDir('proof-nostay-');
    const scratch = fs.mkdtempSync(path.join(cwd, 'scratch-'));
    const code = `
      TMP="$(mktemp -d "${scratch}/supplier-local-proof.XXXXXX")"
      mkdir "\${TMP}/ledger"; PROOF_RC=0; KEEP_FAILED_LEDGER=1; DIAG=".artifacts/diag.txt"
      cleanup
      [ -d "\${TMP}" ] && echo "tmp still exists"
      echo "done"
    `;
    const r = sourced(code, cwd);
    expect(r.out).not.toMatch(/tmp still exists/);
  });

  it('writes a bounded diagnostic with fixed fields only, inside the fixture cwd', () => {
    const cwd = tmpDir('proof-diag-');
    const scratch = fs.mkdtempSync(path.join(cwd, 'scratch-'));
    const code = `
      TMP="$(mktemp -d "${scratch}/supplier-local-proof.XXXXXX")"
      PROOF_PHASE="health check"; PROOF_RC=2; GOVERNED=1
      KEEP_FAILED_LEDGER=0; OUT=".artifacts/o.json"; DIAG=".artifacts/supplier-proof-diagnostic.txt"
      cleanup
      wc -c < "\${DIAG}"
      cat "\${DIAG}"
    `;
    const r = sourced(code, cwd);
    const bytes = Number.parseInt(r.out.split('\n')[0], 10);
    expect(bytes).toBeLessThanOrEqual(4096);
    expect(r.out).toMatch(/phase=health check/);
    expect(r.out).toMatch(/exit=2/);
    expect(r.out).toMatch(/mode=governed/);
    // The diagnostic must land in the fixture cwd, never the repo — the
    // side-effect test below is what guards against a cwd/umask leak.
    expect(fs.existsSync(path.join(cwd, '.artifacts', 'supplier-proof-diagnostic.txt'))).toBe(true);
  });

  it('TERM-then-KILL: an unkillable-by-TERM child is killed only after the bounded wait', () => {
    const cwd = tmpDir('proof-kill-');
    const scratch = fs.mkdtempSync(path.join(cwd, 'scratch-'));
    const code = `
      TMP="$(mktemp -d "${scratch}/supplier-local-proof.XXXXXX")"
      (trap '' TERM; touch ready; exec sleep 60) >/dev/null 2>&1 & VALIDATOR_PID=$!
      while [ ! -e ready ]; do sleep 0.01; done
      SLEEP_PID=$VALIDATOR_PID
      PROOF_RC=0; GOVERNED=0; KEEP_FAILED_LEDGER=0; DIAG=".artifacts/diag.txt"
      cleanup
      kill -0 "$SLEEP_PID" 2>/dev/null && echo "validator still alive"
      echo "done"
    `;
    const r = sourced(code, cwd);
    expect(r.out).not.toMatch(/validator still alive/);
    expect(r.out).toMatch(/done/);
  });

  it('sourcing has no side effects: caller cwd and umask are untouched', () => {
    const cwd = tmpDir('proof-source-');
    const r = sourced('pwd; umask', cwd);
    expect(r.out.split('\n')[0]).toBe(fs.realpathSync(cwd));
    expect(r.out.split('\n')[1]).not.toBe('0077');
  });
});
