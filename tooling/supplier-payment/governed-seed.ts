/**
 * Seeder for the governed local-worker proof. Creates ONLY temp artifacts:
 * a fresh worker-private SQLite DB (mandate + claims schema), a read-only
 * CRE JSONL snapshot, synthetic proceed/held diligence reports, an
 * ephemeral Ed25519 issuer keypair (public PEM only is written), a signed
 * local-domain envelope per report, and the local worker config file.
 * Prints public paths/metadata as JSON — never the issuer private key.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createPublicKey, generateKeyPairSync } from 'node:crypto';
import {
  LINEAGE,
  SUPPLIER,
  buildStepWorld,
  buildReport,
  heldStepEvidence,
  envelopeBody,
  signEnvelope,
} from '../../tests/fixtures/supplier-payment-world.js';

function arg(name: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  if (!v) {
    console.error(`missing --${name}`);
    process.exit(1);
  }
  return v;
}

const dirs = {
  db: arg('db-dir'),
  cre: arg('cre-dir'),
  reports: arg('reports-dir'),
  envelopes: arg('envelopes-dir'),
  config: arg('config-path'),
  issuer: arg('issuer-pub'),
};
const WS = 'ws-governed-local';
const mint = arg('mint');
const payee = arg('payee');
const genesis = arg('genesis');
const endpoint = arg('endpoint');
const journalPath = arg('journal');
const signerKeyPath = arg('signer-key');
const signerPayerPubkey = arg('payer');
const workerUid = Number.parseInt(arg('worker-uid'), 10);

for (const d of [dirs.db, dirs.cre, dirs.reports, dirs.envelopes]) {
  fs.mkdirSync(d, { recursive: true, mode: 0o700 });
}
const dbPath = path.join(dirs.db, 'claims.db');
const crePath = path.join(dirs.cre, 'runs.jsonl');

process.env.DB_PATH = dbPath;

const { getDb, closeDb } = await import('../../src/backend/db/index.js');
const { FundedMandateService } = await import(
  '../../src/backend/services/governance/FundedMandateService.js'
);
const { initSupplierPaymentClaims } = await import(
  '../../src/backend/services/telegraph/SupplierPaymentStore.js'
);
const { sha256CanonicalJson } = await import(
  '../../src/backend/services/telegraph/stableJson.js'
);
const { LOCAL_SCHEMA } = await import(
  '../../src/backend/services/telegraph/SupplierPaymentAuthorization.js'
);

const db = getDb();
initSupplierPaymentClaims(db);
const now = new Date().toISOString();
db.prepare('INSERT OR IGNORE INTO users (id, created_at, last_login_at) VALUES (?, ?, ?)').run(
  'user-governed',
  now,
  now,
);
db.prepare(
  "INSERT OR IGNORE INTO workspaces (id, name, owner_id, tier, created_at, updated_at) VALUES (?, ?, ?, 'live', ?, ?)",
).run(WS, WS, 'user-governed', now, now);
db.prepare(
  "INSERT OR IGNORE INTO workspace_agents (id, workspace_id, name, role, chain, created_at, updated_at) VALUES (?, ?, ?, 'executor', 'solana', ?, ?)",
).run('agent-1', WS, 'agent-1', now, now);
db.prepare(
  "INSERT OR IGNORE INTO workspace_policies (id, workspace_id, name, type, created_at, updated_at) VALUES (?, ?, ?, 'spend', ?, ?)",
).run('policy-1', WS, 'policy-1', now, now);

const mandateId = FundedMandateService.create(WS, {
  name: 'Supplier diligence mandate',
  objective: 'Pay cleared diligence suppliers',
  agentIds: ['agent-1'],
  policyIds: ['policy-1'],
  status: 'active',
  budget: {
    byAsset: {
      USDC: {
        authorizedAmount: '10000',
        allocatedAmount: '10000',
        consumedAmount: '0',
        pendingAmount: '10000',
      },
    },
  },
}).id;
closeDb();

const worlds = LINEAGE.map((lin) => buildStepWorld(WS, mandateId, lin, SUPPLIER));
fs.writeFileSync(
  crePath,
  worlds.map((w) => JSON.stringify(w.screenRun) + '\n' + JSON.stringify(w.parentRun)).join('\n') + '\n',
  { mode: 0o600 },
);

const proceedReport = buildReport(mandateId, worlds.map((w) => ({ ...w.stepEvidence })));
const heldReport = buildReport(
  mandateId,
  worlds.map((w) => heldStepEvidence(w.stepEvidence)),
);
for (const report of [proceedReport, heldReport]) {
  fs.writeFileSync(
    path.join(dirs.reports, `${sha256CanonicalJson(report)}.json`),
    JSON.stringify(report),
    { mode: 0o600 },
  );
}

const issuer = generateKeyPairSync('ed25519');
fs.writeFileSync(
  dirs.issuer,
  issuer.publicKey.export({ format: 'pem', type: 'spki' }) as string,
  { mode: 0o600 },
);

const spec = {
  schema: LOCAL_SCHEMA,
  workspaceId: WS,
  mandateId,
  cluster: 'localnet',
  mint,
  payee,
  expiresAt: '2030-01-01T00:00:00.000Z',
};
const proceedEnvelope = signEnvelope(
  issuer.privateKey,
  envelopeBody(proceedReport, { ...spec, intentId: 'governed-proceed' }),
);
const heldEnvelope = signEnvelope(
  issuer.privateKey,
  envelopeBody(heldReport, { ...spec, intentId: 'governed-held' }),
);
const proceedPath = path.join(dirs.envelopes, 'proceed.json');
const heldPath = path.join(dirs.envelopes, 'held.json');
fs.writeFileSync(proceedPath, JSON.stringify(proceedEnvelope), { mode: 0o600 });
fs.writeFileSync(heldPath, JSON.stringify(heldEnvelope), { mode: 0o600 });

const subjectHash = sha256CanonicalJson(SUPPLIER);
fs.writeFileSync(
  dirs.config,
  JSON.stringify({
    enabled: true,
    workerUid,
    distinctBackendUid: workerUid + 1,
    workspaceId: WS,
    mandateId,
    caseId: 'case-clear',
    payee,
    subjectPayeePins: { [subjectHash]: payee },
    issuerPublicKeyPath: dirs.issuer,
    reportRoot: dirs.reports,
    signerKeyPath,
    signerPayerPubkey,
    journalPath,
    dbPath,
    creSnapshotPath: crePath,
    endpoint,
    mint,
    genesisHash: genesis,
  }),
  { mode: 0o600 },
);

process.stdout.write(
  `${JSON.stringify({
    workspaceId: WS,
    mandateId,
    configPath: dirs.config,
    envelopeProceed: proceedPath,
    envelopeHeld: heldPath,
    dbPath,
    crePath,
    reportRoot: dirs.reports,
  })}\n`,
);
