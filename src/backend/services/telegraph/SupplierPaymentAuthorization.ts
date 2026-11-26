/**
 * SupplierPaymentAuthorization — offline Gate 1 review of a signed
 * supplier-payment authorization envelope against one internal diligence
 * report.
 *
 * Two strictly separated purposes share the validation but never the schema:
 *   - `cognivern.supplier-payment-rehearsal.v1` is rehearsal-only and must
 *     never authorize actual funds;
 *   - `cognivern.supplier-payment-devnet.v1` is the executor's input.
 * The schema literal is part of the signed body, so cross-domain replay
 * fails signature validation before any evidence check.
 *
 * Pure review only: no I/O, no env reads, no clock reads beyond the `now`
 * argument. Fail-closed — any deviation from the exact expected evidence
 * shape returns blocked.
 */
import { verify as cryptoVerify, type KeyObject } from 'node:crypto';
import { isAddress } from '@solana/kit';
import { z } from 'zod';
import { canonicalJson, sha256CanonicalJson } from './stableJson.js';

export const REHEARSAL_SCHEMA = 'cognivern.supplier-payment-rehearsal.v1';
export const DEVNET_SCHEMA = 'cognivern.supplier-payment-devnet.v1';
export const LOCAL_SCHEMA = 'cognivern.supplier-payment-local.v1';
const INTERNAL_REPORT_SCHEMA = 'cognivern.telegraph.diligence-report.v1';
const REHEARSAL_CLUSTER = 'devnet';
const LOCAL_CLUSTER = 'localnet';
const REHEARSAL_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
const REHEARSAL_AMOUNT_BASE_UNITS = '10000';
const HEX64 = /^[0-9a-f]{64}$/;

const hex64 = z.string().regex(HEX64, 'expected a 64-char lowercase hex digest');
// Non-whitespace, but the signed bytes are never normalized or trimmed.
const nonempty = z.string().refine((s) => s.trim().length > 0, 'must not be blank');

/**
 * Signed network pins are part of the body schema itself: the devnet and
 * rehearsal domains require literal devnet + canonical mint; the local
 * domain requires literal localnet + the deployment-pinned local mint.
 * No code path ever reads the expected chain from the signed body.
 */
const bodySchemaFor = (schema: string, cluster: string, mint: string) =>
  z
    .object({
      schema: z.literal(schema),
      workspaceId: nonempty,
      mandateId: nonempty,
      caseId: nonempty,
      subjectHash: hex64,
      reportHash: hex64,
      cluster: z.literal(cluster),
      mint: z.literal(mint),
      payee: nonempty,
      amountBaseUnits: z.literal(REHEARSAL_AMOUNT_BASE_UNITS),
      intentId: nonempty,
      expiresAt: z.string().datetime(),
    })
    .strict();

const envelopeSchemaFor = (schema: string, cluster: string, mint: string) =>
  z
    .object({
      body: bodySchemaFor(schema, cluster, mint),
      // Standard base64 Ed25519 signature only — exactly 86 chars + "==" pad.
      signature: z.string().regex(/^[A-Za-z0-9+/]{86}==$/, 'expected base64 Ed25519 signature'),
    })
    .strict();

export type SupplierPaymentAuthorizationBody = z.infer<ReturnType<typeof bodySchemaFor>>;

export interface ProposedTransfer {
  workspaceId: string;
  mandateId: string;
  caseId: string;
  intentId: string;
  cluster: string;
  mint: string;
  payee: string;
  amountBaseUnits: string;
  expiresAt: string;
}

export type ReviewResult =
  | { status: 'blocked'; reason: string }
  | {
      status: 'eligible_for_rehearsal';
      reportHash: string;
      body: SupplierPaymentAuthorizationBody;
      proposedTransfer: ProposedTransfer;
    };

const blocked = (reason: string): ReviewResult => ({ status: 'blocked', reason });

function decodeSignature(signature: string): Buffer | null {
  const buf = Buffer.from(signature, 'base64');
  return buf.length === 64 && buf.toString('base64') === signature ? buf : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const nonblankString = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0;

/**
 * Parse and signature-verify an envelope without touching evidence. Used by
 * the executor for its early replay lookup — a stored signature is only
 * replayed for bytes that already verified against the pinned key.
 */
interface NetworkPins {
  cluster: string;
  mint: string;
}

const DEVNET_PINS: NetworkPins = { cluster: REHEARSAL_CLUSTER, mint: REHEARSAL_MINT };

function verifyEnvelopeSignatureForPins(
  expectedSchema: string,
  pins: NetworkPins,
  envelope: unknown,
  trustedPublicKey: KeyObject,
): SupplierPaymentAuthorizationBody | null {
  const env = envelopeSchemaFor(expectedSchema, pins.cluster, pins.mint).safeParse(envelope);
  if (!env.success) return null;
  if (trustedPublicKey.type !== 'public' || trustedPublicKey.asymmetricKeyType !== 'ed25519') {
    return null;
  }
  const signature = decodeSignature(env.data.signature);
  if (signature === null) return null;
  const signed = Buffer.from(canonicalJson(env.data.body), 'utf8');
  if (!cryptoVerify(null, signed, trustedPublicKey, signature)) return null;
  return env.data.body;
}

/**
 * Devnet-domain signature check. The schema, cluster and canonical mint are
 * fixed literals — nothing here can be relaxed by a caller or the body.
 */
export function verifyEnvelopeSignature(
  expectedSchema: string,
  envelope: unknown,
  trustedPublicKey: KeyObject,
): SupplierPaymentAuthorizationBody | null {
  return verifyEnvelopeSignatureForPins(expectedSchema, DEVNET_PINS, envelope, trustedPublicKey);
}

/**
 * Local-domain signature check. The schema and the `localnet` literal are
 * fixed; the local mint is pinned by trusted deployment configuration and
 * baked into the body schema — a body carrying any other mint fails parsing
 * before signature verification.
 */
export function verifyLocalEnvelopeSignature(
  envelope: unknown,
  trustedPublicKey: KeyObject,
  localMint: string,
): SupplierPaymentAuthorizationBody | null {
  if (!isAddress(localMint)) return null;
  return verifyEnvelopeSignatureForPins(
    LOCAL_SCHEMA,
    { cluster: LOCAL_CLUSTER, mint: localMint },
    envelope,
    trustedPublicKey,
  );
}

function checkStep(
  step: unknown,
  expectedStep: number,
  expectedScreenMiner: string,
): string | null {
  if (!isRecord(step)) return `step ${expectedStep}: not an object`;
  if (step.step !== expectedStep) return `step ${expectedStep}: out of order`;
  if (step.screenMinerId !== expectedScreenMiner)
    return `step ${expectedStep}: unexpected screen miner`;
  if (step.status !== 'approved') return `step ${expectedStep}: status is not approved`;
  if (step.verdict !== 'clear') return `step ${expectedStep}: screen verdict is not clear`;
  if (step.parentPurchased !== true) return `step ${expectedStep}: parent not purchased`;
  if (step.settlementStatus !== 'settled')
    return `step ${expectedStep}: parent settlement not settled`;
  // Guard flags are collector-generated booleans; absent or malformed is not
  // a clear pass.
  if (step.blocked !== false) return `step ${expectedStep}: blocked flag missing or true`;
  if (step.reviewRequired !== false)
    return `step ${expectedStep}: reviewRequired flag missing or true`;
  if (step.spendGuardBlocked !== false || step.settlementGuardBlocked !== false)
    return `step ${expectedStep}: guard block flag missing or true`;
  if (step.pendingAction != null) return `step ${expectedStep}: pending action`;
  if (step.error != null) return `step ${expectedStep}: error recorded`;
  // The parent payload itself is redacted from the report, so the collector
  // records the structural risk signals it extracted. This is a report-shape
  // filter only — Gate 2 independently re-derives the signals from the CRE
  // parent signal before dispatch. Absent means the payload was never
  // inspected; non-empty means it carried a warning — the evidence cannot
  // support clearance either way.
  if (!Array.isArray(step.parentRiskSignals) || step.parentRiskSignals.length !== 0)
    return `step ${expectedStep}: parent risk signals missing or non-empty`;
  if (step.settlementTransfer != null)
    return `step ${expectedStep}: carries a transfer record`;
  if (!nonblankString(step.screeningRunId))
    return `step ${expectedStep}: missing screening run reference`;
  if (!nonblankString(step.gateRunId))
    return `step ${expectedStep}: missing gate run reference`;
  if (!nonblankString(step.parentRunId))
    return `step ${expectedStep}: missing parent run reference`;
  if (typeof step.evidenceHash !== 'string' || !HEX64.test(step.evidenceHash))
    return `step ${expectedStep}: missing evidence hash`;
  return null;
}

function checkSupplier(supplier: unknown): string | null {
  if (!isRecord(supplier)) return 'case supplier is missing or malformed';
  if (!nonblankString(supplier.name)) return 'case supplier has no usable name';
  if (supplier.type !== 'entity' && supplier.type !== 'individual')
    return 'case supplier has an unsupported type';
  if (!nonblankString(supplier.country)) return 'case supplier has no country';
  if (
    typeof supplier.paymentUsd !== 'number' ||
    !Number.isFinite(supplier.paymentUsd) ||
    supplier.paymentUsd <= 0
  )
    return 'case supplier has no positive paymentUsd';
  if (!nonblankString(supplier.paymentRail)) return 'case supplier has no paymentRail';
  return null;
}

function reviewSupplierPaymentForSchema(
  expectedSchema: string,
  pins: NetworkPins,
  report: unknown,
  envelope: unknown,
  trustedPublicKey: KeyObject,
  now: number,
): ReviewResult {
  const env = envelopeSchemaFor(expectedSchema, pins.cluster, pins.mint).safeParse(envelope);
  if (!env.success) return blocked('approval envelope does not match the v1 schema');
  const body = env.data.body;

  if (!isAddress(body.payee)) return blocked('payee is not a valid Solana address');
  if (body.payee === body.mint) return blocked('payee must not be the mint');
  if (!Number.isFinite(now)) return blocked('review clock is not finite');
  const expiresAtMs = Date.parse(body.expiresAt);
  if (expiresAtMs <= now) return blocked('authorization expired');

  if (verifyEnvelopeSignatureForPins(expectedSchema, pins, envelope, trustedPublicKey) === null) {
    return blocked('signature does not verify against the trusted key');
  }

  if (!isRecord(report) || report.schema !== INTERNAL_REPORT_SCHEMA) {
    return blocked('report is not an internal diligence-report v1');
  }
  if (sha256CanonicalJson(report) !== body.reportHash) {
    return blocked('report bytes do not match the signed reportHash');
  }
  const execution = report.execution;
  if (!isRecord(execution)) return blocked('report has no execution block');
  if (execution.dryRun !== false) return blocked('report was produced by a dry run');
  if (execution.mandateId !== body.mandateId) return blocked('report mandate does not match');

  const configuredModels = Array.isArray(execution.models) ? execution.models : [];
  if (configuredModels.length === 0) return blocked('report configured no models');
  const configuredLabelSet = new Set<string>();
  for (const m of configuredModels) {
    if (!isRecord(m) || !nonblankString(m.label) || m.skipped != null) {
      return blocked('a configured model is unlabelled or skipped');
    }
    if (configuredLabelSet.has(m.label)) return blocked('duplicate configured model label');
    configuredLabelSet.add(m.label);
  }

  const specialists = isRecord(execution.casesFile) ? execution.casesFile.specialists : undefined;
  const screenA = isRecord(specialists) ? specialists.screenA : undefined;
  const screenB = isRecord(specialists) ? specialists.screenB : undefined;
  const screenAMiner = isRecord(screenA) ? screenA.minerId : undefined;
  const screenBMiner = isRecord(screenB) ? screenB.minerId : undefined;
  if (
    !nonblankString(screenAMiner) ||
    !nonblankString(screenBMiner) ||
    screenAMiner === screenBMiner
  ) {
    return blocked('report does not configure two distinct screen miners');
  }

  const cases = Array.isArray(report.cases) ? report.cases : [];
  const matches = cases.filter((c) => isRecord(c) && c.id === body.caseId);
  if (matches.length !== 1) return blocked('report does not contain exactly one matching case');
  const diligenceCase = matches[0];

  const supplierError = checkSupplier(diligenceCase.supplier);
  if (supplierError) return blocked(supplierError);
  if (sha256CanonicalJson(diligenceCase.supplier) !== body.subjectHash) {
    return blocked('subjectHash does not match the case supplier');
  }
  if (diligenceCase.skipped != null) return blocked('case was skipped');
  if (diligenceCase.gate !== null) return blocked('case ended on a gate hold');

  const evidence = diligenceCase.evidence;
  if (!isRecord(evidence)) return blocked('case has no evidence block');
  if (evidence.settlement != null) return blocked('case evidence carries a transfer rollup');
  if (!Array.isArray(evidence.escalations) || evidence.escalations.length !== 0) {
    return blocked('case evidence records an escalation');
  }
  const steps = Array.isArray(evidence.steps) ? evidence.steps : [];
  if (steps.length !== 2) return blocked('case does not have exactly steps 1 and 2');
  const step1Error = checkStep(steps[0], 1, screenAMiner);
  if (step1Error) return blocked(step1Error);
  const step2Error = checkStep(steps[1], 2, screenBMiner);
  if (step2Error) return blocked(step2Error);
  // The two steps are distinct purchases — no run reference or evidence hash
  // may repeat between them.
  const [s1, s2] = steps as Record<string, unknown>[];
  for (const ref of ['screeningRunId', 'gateRunId', 'parentRunId', 'evidenceHash'] as const) {
    if (s1[ref] === s2[ref]) return blocked(`steps reuse the same ${ref}`);
  }

  const perModel = Array.isArray(diligenceCase.perModel) ? diligenceCase.perModel : [];
  const seenLabels = new Set<string>();
  for (const row of perModel) {
    if (!isRecord(row) || typeof row.label !== 'string') return blocked('malformed per-model row');
    if (seenLabels.has(row.label)) return blocked('duplicate per-model label');
    seenLabels.add(row.label);
    const alone = row.alone;
    const governed = row.governed;
    if (!isRecord(alone) || !isRecord(governed)) return blocked('malformed per-model row');
    if (alone.error != null || alone.skipped != null || governed.error != null) {
      return blocked(`model ${row.label}: error or skipped leg recorded`);
    }
    if (governed.modelDecision !== 'proceed') {
      return blocked(`model ${row.label}: model decision is not proceed`);
    }
    if (governed.finalDecision !== 'proceed' || governed.decidedBy !== 'model') {
      return blocked(`model ${row.label}: governed decision is not a model proceed`);
    }
  }
  if (seenLabels.size !== configuredLabelSet.size) return blocked('per-model coverage mismatch');
  for (const label of configuredLabelSet) {
    if (!seenLabels.has(label)) return blocked(`model ${label} has no per-model row`);
  }

  return {
    status: 'eligible_for_rehearsal',
    reportHash: body.reportHash,
    body,
    proposedTransfer: {
      workspaceId: body.workspaceId,
      mandateId: body.mandateId,
      caseId: body.caseId,
      intentId: body.intentId,
      cluster: body.cluster,
      mint: body.mint,
      payee: body.payee,
      amountBaseUnits: body.amountBaseUnits,
      expiresAt: body.expiresAt,
    },
  };
}

/** Gate 1 rehearsal review — never an authorization for actual funds. */
export function reviewSupplierPayment(
  report: unknown,
  envelope: unknown,
  trustedPublicKey: KeyObject,
  now: number,
): ReviewResult {
  return reviewSupplierPaymentForSchema(REHEARSAL_SCHEMA, DEVNET_PINS, report, envelope, trustedPublicKey, now);
}

/** Gate 2 review — the only schema the supplier-payment executor accepts. */
export function reviewSupplierDevnetPayment(
  report: unknown,
  envelope: unknown,
  trustedPublicKey: KeyObject,
  now: number,
): ReviewResult {
  return reviewSupplierPaymentForSchema(DEVNET_SCHEMA, DEVNET_PINS, report, envelope, trustedPublicKey, now);
}

/**
 * Local-domain review — the only schema the local executor accepts. The
 * pinned local mint is trusted deployment configuration baked into the
 * body literal, identical to how the devnet canonical mint is enforced.
 */
export function reviewSupplierLocalPayment(
  report: unknown,
  envelope: unknown,
  trustedPublicKey: KeyObject,
  now: number,
  localMint: string,
): ReviewResult {
  if (!isAddress(localMint)) return blocked('local mint is not a valid address');
  return reviewSupplierPaymentForSchema(
    LOCAL_SCHEMA,
    { cluster: LOCAL_CLUSTER, mint: localMint },
    report,
    envelope,
    trustedPublicKey,
    now,
  );
}
