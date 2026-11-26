/**
 * SupplierPaymentExecutor — Gate 2 server-side executor for a signed
 * supplier-payment authorization.
 *
 * This is a backend composition only: there is NO HTTP route, no env kill
 * switch on legacy paths, and NO installed real broadcast adapter. The rail
 * is an explicitly injected, uniquely-scoped dependency — tests supply a
 * fake sender — so nothing in this module can reach an RPC, a wallet, or
 * production persistence on its own.
 *
 * Order of checks (each fail-closed):
 *   1. deployment `enabled` + exact configured workspace/mandate;
 *   2. strict `cognivern.supplier-payment-devnet.v1` envelope, Ed25519
 *      signature verified against a server-pinned public key — rehearsal
 *      envelopes and other workspaces are rejected before anything loads;
 *   3. durable claim lookup — a completed identical claim replays its stored
 *      signature, a pending claim is never redispatched;
 *   4. internal report loaded by content address from a trusted report root
 *      and fully re-reviewed by the shared Gate 1 verifier;
 *   5. payee pinned per subjectHash by trusted config — not any wallet the
 *      caller happened to allow;
 *   6. rail config pinned to devnet + the fixed mint + a ≤0.01 cap, and the
 *      chain's genesis hash verified against the server-pinned canonical
 *      devnet genesis BEFORE any dispatch;
 *   7. report freshness (configurable, default 24h) and a fresh envelope;
 *   8. the active funded mandate via resolveSettlementPolicy — no env
 *      fallback, unsupported mandate constraints deny;
 *   9. full CRE lineage: both parent runs and both screening runs re-read
 *      from the CRE store, artifact and bundle hashes recomputed, pinned
 *      collector specialist ids/intents and recomputed paramsHash from the
 *      reviewed supplier — ambiguous or missing lineage denies;
 *  10. atomic claim → single dispatch → receipt fields validated against the
 *      proposal → atomic finalize (claim confirmed + mandate debit in one
 *      transaction).
 *
 * Pending claims survive restarts and are never redispatched; unresolved
 * claims wait for receipt reconciliation against the trusted adapter, not
 * an operator-supplied receipt.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { KeyObject } from 'node:crypto';
import { isAddress } from '@solana/kit';
import type { CreRunStore } from '@backend/cre/storage/CreRunStore.js';
import type { CreRun } from '@backend/cre/types.js';
import { FundedMandateService } from '@backend/services/governance/FundedMandateService.js';
import { resolveSettlementPolicy } from '@backend/services/blockchain/solana/SettlementPolicy.js';
import type { SettlementLimits } from '@backend/services/blockchain/solana/SolanaSettlementService.js';
import { sha256CanonicalJson, telegraphArtifactDataHash } from './stableJson.js';
import {
  DEVNET_SCHEMA,
  LOCAL_SCHEMA,
  reviewSupplierDevnetPayment,
  reviewSupplierLocalPayment,
  verifyEnvelopeSignature,
  verifyLocalEnvelopeSignature,
  type ProposedTransfer,
  type SupplierPaymentAuthorizationBody,
} from './SupplierPaymentAuthorization.js';
import { SupplierPaymentStore } from './SupplierPaymentStore.js';
import { supplierParentRiskSignals } from './SupplierPaymentEvidence.js';

export const DEVNET_GENESIS_HASH = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';
const MAINNET_GENESIS_HASH = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d';
const TESTNET_GENESIS_HASH = '4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY';
const PUBLIC_GENESIS_HASHES = new Set([
  DEVNET_GENESIS_HASH,
  MAINNET_GENESIS_HASH,
  TESTNET_GENESIS_HASH,
]);
// A local executor may never be pinned to the canonical devnet USDC mint —
// its address would make local receipts indistinguishable in mint terms.
const DEVNET_USDC_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
const EVIDENCE_BUNDLE_SCHEMA = 'cognivern.telegraph.compliant-call-evidence.v1';
const DEFAULT_EVIDENCE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const TRANSFER_USD = 0.01;
const HEX64 = /^[0-9a-f]{64}$/;

// Specialist ids, intents, and request params pinned from the checked-in
// collector fixture (tooling/scripts/agents/telegraph-diligence-cases.json).
// The executor recomputes paramsHash itself — caller-supplied mappings are
// never trusted.
interface StepLineage {
  step: number;
  screenMinerId: string;
  screenIntent: string;
  screenParams: Record<string, string>;
  parentMinerId: string;
  parentIntent: string;
  parentParams: Record<string, string>;
}
const EXPECTED_LINEAGE: StepLineage[] = [
  {
    step: 1,
    screenMinerId: '731002',
    screenIntent: 'SANCTIONS_SCREENING_MATCH',
    screenParams: { name: '$name', type: '$type' },
    parentMinerId: '7393',
    parentIntent: 'CORPORATE_REGISTRY_LOOKUP',
    parentParams: { name: '$name' },
  },
  {
    step: 2,
    screenMinerId: '710637',
    screenIntent: 'SANCTIONS_SCREENING_MATCH',
    screenParams: { name: '$name' },
    parentMinerId: '7396',
    parentIntent: 'VENDOR_VERIFY',
    parentParams: { name: '$name' },
  },
];

export interface SupplierPaymentRailReceipt {
  cluster: string;
  mint: string;
  payee: string;
  payer: string;
  amountBaseUnits: string;
  confirmationStatus: string;
  intentId: string;
  signature: string | null;
}

/** Injected rail — uniquely scoped to this executor, never a shared singleton. */
export interface SupplierPaymentRail {
  getGenesisHash(): Promise<string>;
  sendTransfer(transfer: ProposedTransfer): Promise<SupplierPaymentRailReceipt>;
  /**
   * Read a previously issued receipt by intent — the only input to manual
   * reconciliation. Absent on adapters that cannot look receipts up; an
   * operator-pasted receipt is never accepted.
   */
  fetchReceipt?(intentId: string): Promise<SupplierPaymentRailReceipt | null>;
}

interface SupplierExecutorConfigBase {
  /** Default false — the executor refuses everything until activated. */
  enabled: boolean;
  workspaceId: string;
  mandateId: string;
  /** Server-pinned Ed25519 public key; envelope issuer is fixed out of band. */
  trustedPublicKey: KeyObject;
  /** Trusted content-addressed report root: <root>/<reportHash>.json. */
  reportRoot: string;
  /** subjectHash → payee, pinned per reviewed subject. */
  subjectPayeePins: Record<string, string>;
  envLimits: SettlementLimits;
  evidenceMaxAgeMs?: number;
}

export interface SupplierPaymentExecutorConfig extends SupplierExecutorConfigBase {
  rail: {
    cluster: 'devnet';
    mint: string;
    payer: string;
    maxTransferUsd: number;
    /** Server-pinned canonical devnet genesis, verified before broadcast. */
    genesisHash: string;
  };
}

export interface SupplierLocalPaymentExecutorConfig extends SupplierExecutorConfigBase {
  rail: {
    cluster: 'localnet';
    mint: string;
    payer: string;
    maxTransferUsd: number;
    /**
     * Server-pinned genesis of the spawned local validator — must differ
     * from every public cluster genesis; verified live before broadcast.
     */
    genesisHash: string;
  };
}

type SupplierExecutorConfig = SupplierPaymentExecutorConfig | SupplierLocalPaymentExecutorConfig;

export interface SupplierPaymentExecutorDeps {
  config: SupplierPaymentExecutorConfig;
  rail: SupplierPaymentRail;
  creStore: Pick<CreRunStore, 'get' | 'refresh'>;
  now?: number;
}

export interface SupplierLocalExecutorDeps {
  config: SupplierLocalPaymentExecutorConfig;
  rail: SupplierPaymentRail;
  creStore: Pick<CreRunStore, 'get' | 'refresh'>;
  now?: number;
}

type SupplierExecutorDeps = SupplierPaymentExecutorDeps | SupplierLocalExecutorDeps;

/**
 * Type-discriminated network binding. The devnet arm is a singleton literal —
 * schema, cluster, canonical mint and genesis are all constants and cannot be
 * overridden. The local arm pins a localnet cluster, a valid local mint, and
 * an explicit spawned-validator genesis that must differ from every public
 * cluster genesis.
 */
export type SupplierExecutorNetwork =
  | { kind: 'devnet' }
  | { kind: 'localnet'; genesisHash: string; mint: string };

const DEVNET_NETWORK: SupplierExecutorNetwork = { kind: 'devnet' };

export type SupplierPaymentExecutorResult =
  | { status: 'confirmed'; signature: string }
  | { status: 'replayed'; signature: string }
  | { status: 'pending'; reason: string }
  | { status: 'denied'; reason: string };

const deny = (reason: string): SupplierPaymentExecutorResult => ({ status: 'denied', reason });
const pending = (reason: string): SupplierPaymentExecutorResult => ({ status: 'pending', reason });

/**
 * Rail + env readiness, shared by execute and reconcile: the deployment must
 * be devnet-only with the fixed mint, a ≤0.01 cap, an env allowlist of exactly
 * the bound payee, both env limits finite and equal to the rehearsal amount,
 * a payer address that is valid and distinct from the payee, and a live chain
 * whose genesis equals the server-pinned canonical devnet genesis.
 */
async function checkRailReadiness(
  network: SupplierExecutorNetwork,
  config: SupplierExecutorConfig,
  rail: SupplierPaymentRail,
  payee: string,
  mint: string,
): Promise<string | null> {
  const limits = config.envLimits;
  if (
    !Number.isFinite(limits.maxTransferUsd) ||
    limits.maxTransferUsd !== TRANSFER_USD ||
    !Number.isFinite(limits.runwayUsd) ||
    limits.runwayUsd !== TRANSFER_USD
  ) {
    return 'env limits are not pinned to the 0.01 rehearsal amount';
  }
  if (
    !Array.isArray(limits.payeeAllowlist) ||
    limits.payeeAllowlist.length !== 1 ||
    limits.payeeAllowlist[0] !== payee
  ) {
    return 'env payee allowlist is not exactly the bound payee';
  }
  if (!isAddress(config.rail.payer) || config.rail.payer === payee) {
    return 'rail payer is not a valid address distinct from the payee';
  }
  if (config.rail.maxTransferUsd !== TRANSFER_USD) {
    return 'rail cap is not the rehearsal amount';
  }
  if (network.kind === 'devnet') {
    if (config.rail.cluster !== 'devnet') return 'rail cluster is not devnet';
    if (config.rail.genesisHash !== DEVNET_GENESIS_HASH) {
      return 'rail genesis pin is not canonical devnet';
    }
  } else {
    if (config.rail.cluster !== 'localnet') return 'rail cluster is not localnet';
    if (config.rail.mint !== network.mint) return 'rail mint is not the pinned local mint';
    if (config.rail.genesisHash !== network.genesisHash) {
      return 'rail genesis pin is not the pinned local genesis';
    }
  }
  if (config.rail.mint !== mint) return 'rail mint does not match the signed mint';
  let genesisHash: string;
  try {
    genesisHash = await rail.getGenesisHash();
  } catch {
    return 'rail genesis check failed';
  }
  if (genesisHash !== config.rail.genesisHash) {
    return 'chain genesis does not match the pinned genesis';
  }
  return null;
}

function verifyBody(
  network: SupplierExecutorNetwork,
  envelope: unknown,
  config: SupplierExecutorConfig,
): SupplierPaymentAuthorizationBody | null {
  return network.kind === 'devnet'
    ? verifyEnvelopeSignature(DEVNET_SCHEMA, envelope, config.trustedPublicKey)
    : verifyLocalEnvelopeSignature(envelope, config.trustedPublicKey, network.mint);
}

function checkTimestampFreshness(value: unknown, now: number, maxAgeMs: number): boolean {
  if (typeof value !== 'string') return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && parsed <= now && now - parsed <= maxAgeMs;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fillSupplierParams(
  params: Record<string, string>,
  supplier: Record<string, unknown>,
): Record<string, unknown> | null {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && value.startsWith('$')) {
      const field = value.slice(1);
      const resolved = supplier[field];
      if (resolved === undefined || resolved === null) return null;
      out[key] = resolved;
    } else {
      out[key] = value;
    }
  }
  return out;
}

function checkRunShape(run: CreRun | undefined, workspaceId: string): string | null {
  if (!run) return 'run missing';
  if (run.projectId !== workspaceId) return 'run belongs to another workspace';
  if (run.workflow !== 'governance' || run.mode !== 'cre') return 'run is not a governance CRE run';
  if (run.provenance?.source !== 'cognivern') return 'run is not cognivern-produced';
  if (run.ok !== true || run.status !== 'completed') return 'run is not completed';
  if (run.requiresApproval === true || run.approvalState !== 'not_required') {
    return 'run holds or held an approval gate';
  }
  if (Array.isArray(run.events) && run.events.some((e) => e.type === 'run_paused_for_approval')) {
    return 'run paused for approval';
  }
  return null;
}

async function checkStepLineage(params: {
  step: Record<string, unknown>;
  lineage: StepLineage;
  supplier: Record<string, unknown>;
  workspaceId: string;
  mandateId: string;
  agentIds: string[];
  policyIds: string[];
  creStore: Pick<CreRunStore, 'get' | 'refresh'>;
  now: number;
  evidenceMaxAgeMs: number;
}): Promise<string | null> {
  const { step, lineage, supplier, workspaceId, mandateId, agentIds, policyIds, now, evidenceMaxAgeMs } =
    params;
  const tag = `step ${lineage.step}`;
  const fresh = (v: unknown) => checkTimestampFreshness(v, now, evidenceMaxAgeMs);

  const parentRunId = step.parentRunId;
  const run = await params.creStore.get(parentRunId as string);
  const runError = checkRunShape(run, workspaceId);
  if (runError) return `${tag}: parent ${runError}`;
  if (!fresh(run!.startedAt)) return `${tag}: parent run is stale`;

  const signals = run!.artifacts.filter((a) => a.type === 'telegraph.signal');
  if (signals.length !== 1 || !isRecord(signals[0].data)) {
    return `${tag}: parent must carry exactly one telegraph.signal`;
  }
  const artifact = signals[0];
  const data = artifact.data as Record<string, unknown>;
  if (!fresh(artifact.createdAt)) return `${tag}: parent artifact is stale`;
  if (data.workspaceId !== workspaceId || data.mandateId !== mandateId) {
    return `${tag}: parent artifact scope mismatch`;
  }
  const parentMiner = isRecord(data.miner) ? data.miner : undefined;
  if (parentMiner?.id !== lineage.parentMinerId || parentMiner?.intent !== lineage.parentIntent) {
    return `${tag}: parent artifact miner/intent mismatch`;
  }
  const parentSignal = isRecord(data.signal) ? data.signal : undefined;
  if (parentSignal?.confidenceMet !== true) return `${tag}: parent signal confidence unmet`;
  // Models decided against this exact payload — bind it to the report ref.
  if (step.parentResponseHash !== sha256CanonicalJson(parentSignal.data)) {
    return `${tag}: parent response hash does not match the report`;
  }
  const risks = supplierParentRiskSignals(lineage.parentMinerId, parentSignal.data, supplier.name);
  if (risks.length) return `${tag}: CRE parent evidence held: ${risks.join(', ')}`;
  const parentCompliance = isRecord(data.compliance) ? data.compliance : undefined;

  const bundle = data.evidenceBundle;
  if (!isRecord(bundle)) return `${tag}: parent evidence bundle missing`;
  if (bundle.schema !== EVIDENCE_BUNDLE_SCHEMA) return `${tag}: bundle schema mismatch`;
  if (!fresh(bundle.generatedAt)) return `${tag}: bundle is stale`;

  // Seal check: the recorded evidenceHash must equal the recomputed canonical
  // hash of the bundle minus its evidenceHash, and equal the report's ref.
  const { evidenceHash, ...core } = bundle;
  if (typeof evidenceHash !== 'string' || !HEX64.test(evidenceHash))
    return `${tag}: bundle evidenceHash missing`;
  if (sha256CanonicalJson(core) !== evidenceHash)
    return `${tag}: bundle hash does not recompute`;
  if (evidenceHash !== step.evidenceHash)
    return `${tag}: bundle hash does not match the report`;
  if (bundle.workspaceId !== workspaceId) return `${tag}: bundle workspace mismatch`;
  if (bundle.mandateId !== mandateId) return `${tag}: bundle mandate mismatch`;
  // When the mandate binds agents/policies, missing bindings fail — not just
  // wrong values.
  if (agentIds.length > 0 && (typeof bundle.agentId !== 'string' || !agentIds.includes(bundle.agentId)))
    return `${tag}: bundle agent outside the mandate`;
  if (policyIds.length > 0 && (typeof bundle.policyId !== 'string' || !policyIds.includes(bundle.policyId)))
    return `${tag}: bundle policy outside the mandate`;

  const gate = bundle.gate;
  if (!isRecord(gate)) return `${tag}: gate missing`;
  // A real successful bundle binds gate.runId to the parent run itself.
  if (gate.decision !== 'allow') return `${tag}: gate did not allow`;
  if (gate.runId !== run!.runId || gate.runId !== step.gateRunId || gate.runId !== parentRunId)
    return `${tag}: gate run does not bind to the parent run`;
  if (gate.artifactId !== artifact.id) return `${tag}: gate artifact id mismatch`;
  if (gate.artifactHash !== telegraphArtifactDataHash(data))
    return `${tag}: gate artifact hash does not recompute`;

  const screening = bundle.screening;
  if (!isRecord(screening)) return `${tag}: screening missing`;
  if (screening.status !== 'completed' || screening.verdict !== 'clear')
    return `${tag}: screen not completed clear`;
  if (screening.runId !== step.screeningRunId) return `${tag}: screening run mismatch`;
  if (screening.minerId !== lineage.screenMinerId || screening.intent !== lineage.screenIntent)
    return `${tag}: screening miner/intent mismatch`;

  const settlement = bundle.settlement;
  if (!isRecord(settlement)) return `${tag}: settlement missing`;
  if (settlement.status !== 'settled' || settlement.paid !== true)
    return `${tag}: parent purchase not settled`;
  if (settlement.runId !== parentRunId) return `${tag}: parent run mismatch`;
  if (settlement.minerId !== lineage.parentMinerId || settlement.intent !== lineage.parentIntent)
    return `${tag}: parent miner/intent mismatch`;
  if (settlement.artifactId !== artifact.id || settlement.artifactHash !== telegraphArtifactDataHash(data))
    return `${tag}: settlement artifact mismatch`;
  if (bundle.settlementTransfer != null) return `${tag}: bundle carries a transfer`;
  if (data.settlementTransfer != null) return `${tag}: artifact carries a transfer`;
  const cost = isRecord(data.cost) ? data.cost : undefined;
  if (!cost || cost.paid !== true) return `${tag}: parent purchase not paid`;

  const policyEvaluation = bundle.policyEvaluation;
  if (
    !isRecord(policyEvaluation) ||
    policyEvaluation.passed !== true ||
    !Array.isArray(policyEvaluation.violations) ||
    policyEvaluation.violations.length !== 0
  ) {
    return `${tag}: policy evaluation did not pass cleanly`;
  }

  // Recompute request hashes from the reviewed supplier, not the request.
  const request = bundle.request;
  if (!isRecord(request)) return `${tag}: request missing`;
  const screenParams = fillSupplierParams(lineage.screenParams, supplier);
  const parentParams = fillSupplierParams(lineage.parentParams, supplier);
  if (!screenParams || !parentParams) return `${tag}: supplier does not fill pinned params`;
  const compliance = isRecord(request.compliance) ? request.compliance : undefined;
  const intendedCall = isRecord(request.intendedCall) ? request.intendedCall : undefined;
  if (
    !compliance ||
    compliance.minerId !== lineage.screenMinerId ||
    compliance.intent !== lineage.screenIntent ||
    compliance.paramsHash !== sha256CanonicalJson(screenParams)
  ) {
    return `${tag}: compliance intent mismatch`;
  }
  if (
    !intendedCall ||
    intendedCall.minerId !== lineage.parentMinerId ||
    intendedCall.intent !== lineage.parentIntent ||
    intendedCall.paramsHash !== sha256CanonicalJson(parentParams)
  ) {
    return `${tag}: intended call mismatch`;
  }
  // The parent artifact's compliance block must link to the screening run.
  if (
    parentCompliance?.screeningRunId !== screening.runId ||
    parentCompliance?.screeningMinerId !== screening.minerId
  ) {
    return `${tag}: parent compliance does not link to the screening run`;
  }

  // Load the original screening run + artifact and recompute its hashes.
  const screenRun = await params.creStore.get(screening.runId as string);
  const screenRunError = checkRunShape(screenRun, workspaceId);
  if (screenRunError) return `${tag}: screening ${screenRunError}`;
  if (screenRun!.runId !== screening.runId || !fresh(screenRun!.startedAt)) return `${tag}: screening run mismatch or stale`;
  const screenSignals = screenRun!.artifacts.filter(
    (a) => a.type === 'telegraph.signal',
  );
  if (screenSignals.length !== 1 || screenSignals[0].id !== screening.artifactId || !isRecord(screenSignals[0].data)) {
    return `${tag}: screening artifact missing`;
  }
  const screenArtifact = screenSignals[0];
  const screenData = screenArtifact.data as Record<string, unknown>;
  if (!isRecord(screenData.cost) || screenData.cost.paid !== true) return `${tag}: screen not paid`;
  if (!fresh(screenArtifact.createdAt)) return `${tag}: screening artifact is stale`;
  if (screenData.workspaceId !== workspaceId || screenData.mandateId !== mandateId) {
    return `${tag}: screening artifact scope mismatch`;
  }
  const screenMiner = isRecord(screenData.miner) ? screenData.miner : undefined;
  if (screenMiner?.id !== lineage.screenMinerId || screenMiner?.intent !== lineage.screenIntent) {
    return `${tag}: screening artifact miner/intent mismatch`;
  }
  const screenSignal = isRecord(screenData.signal) ? screenData.signal : undefined;
  if (screenSignal?.confidenceMet !== true) return `${tag}: screening signal confidence unmet`;
  if (telegraphArtifactDataHash(screenData) !== screening.artifactHash)
    return `${tag}: screening artifact hash does not recompute`;
  // The raw provider response bound in the bundle is this payload.
  if (screening.rawResponseHash !== sha256CanonicalJson(screenSignal.data)) {
    return `${tag}: screening raw response hash does not recompute`;
  }
  if (
    screening.artifactEvidenceHash != null &&
    screenArtifact.evidence?.hash !== screening.artifactEvidenceHash
  ) {
    return `${tag}: screening artifact evidence hash mismatch`;
  }
  return null;
}
/**
 * Server-side execute path. `deps` are owned by the server composition —
 * trusted public key, report root, payee pins, rail and CRE store all come
 * from trusted configuration, never from the caller or the envelope.
 */
export async function executeSupplierPayment(
  workspaceId: string,
  envelope: unknown,
  deps: SupplierPaymentExecutorDeps,
): Promise<SupplierPaymentExecutorResult> {
  return executeSupplierPaymentImpl(DEVNET_NETWORK, workspaceId, envelope, deps);
}

async function executeSupplierPaymentImpl(
  network: SupplierExecutorNetwork,
  workspaceId: string,
  envelope: unknown,
  deps: SupplierExecutorDeps,
): Promise<SupplierPaymentExecutorResult> {
  const { config, rail, creStore } = deps;
  const now = deps.now ?? Date.now();

  if (!config.enabled) return deny('supplier payment executor is disabled');
  if (workspaceId !== config.workspaceId) return deny('workspace is not this executor deployment');

  // Domain + signature gate first: rehearsal schema and untrusted issuers
  // are rejected before any lookup is controlled by envelope contents.
  const body = verifyBody(network, envelope, config);
  if (!body) {
    return deny(
      `envelope is not a valid signed ${network.kind === 'devnet' ? 'devnet' : 'local'} authorization`,
    );
  }
  if (body.workspaceId !== config.workspaceId || body.mandateId !== config.mandateId) {
    return deny('envelope is not bound to this deployment');
  }
  const bindingHash = sha256CanonicalJson(body);

  const existing = SupplierPaymentStore.getClaim(workspaceId, body.intentId);
  if (existing) {
    if (existing.bindingHash !== bindingHash) {
      return deny('intent id already bound to different terms');
    }
    if (existing.state === 'confirmed' && existing.signature) {
      return { status: 'replayed', signature: existing.signature };
    }
    return pending('a pending claim exists — reconcile the receipt, never redispatch');
  }

  // Content-addressed report from a trusted root only.
  let report: unknown;
  try {
    report = JSON.parse(
      await readFile(path.join(config.reportRoot, `${body.reportHash}.json`), 'utf8'),
    );
  } catch {
    return deny('internal report not found under the trusted report root');
  }
  const review =
    network.kind === 'devnet'
      ? reviewSupplierDevnetPayment(report, envelope, config.trustedPublicKey, now)
      : reviewSupplierLocalPayment(report, envelope, config.trustedPublicKey, now, network.mint);
  if (review.status !== 'eligible_for_rehearsal') return deny(review.reason);
  const transfer = review.proposedTransfer;

  if (config.subjectPayeePins[body.subjectHash] !== body.payee) {
    return deny('payee is not pinned for this subject');
  }
  const maxAge = config.evidenceMaxAgeMs ?? DEFAULT_EVIDENCE_MAX_AGE_MS;
  if (!Number.isFinite(maxAge) || maxAge <= 0 || maxAge > DEFAULT_EVIDENCE_MAX_AGE_MS) {
    return deny('evidence freshness window is misconfigured');
  }
  const readiness = await checkRailReadiness(network, config, rail, body.payee, body.mint);
  if (readiness) return deny(readiness);

  // Evidence freshness: the report must be recent and not from the future.
  const execution = (report as Record<string, unknown>).execution as Record<string, unknown>;
  const generatedAt = Date.parse(
    String((report as Record<string, unknown>).generatedAt ?? execution.startedAt ?? ''),
  );
  if (!Number.isFinite(generatedAt) || generatedAt > now || now - generatedAt > maxAge) {
    return deny('report is stale or has an invalid timestamp');
  }

  // The named mandate is the only spend authority — no env fallback.
  const policy = resolveSettlementPolicy({
    workspaceId,
    mandateId: body.mandateId,
    amountUsd: TRANSFER_USD,
    envLimits: config.envLimits,
  });
  if (policy.policySource !== 'funded_mandate' || policy.violations.length > 0) {
    return deny(`mandate policy rejected: ${policy.violations.join('; ') || 'env source'}`);
  }
  const mandate = FundedMandateService.get(workspaceId, body.mandateId);
  if (!mandate) return deny('mandate not found in this workspace');

  // CRE lineage — refresh once, then validate both steps end to end.
  const cases = (report as Record<string, unknown>).cases as Record<string, unknown>[];
  const diligenceCase = cases.find((c) => c.id === body.caseId)!;
  const supplier = diligenceCase.supplier as Record<string, unknown>;
  const steps = (diligenceCase.evidence as Record<string, unknown>).steps as Record<
    string,
    unknown
  >[];
  await creStore.refresh();
  for (const lineage of EXPECTED_LINEAGE) {
    const stepError = await checkStepLineage({
      step: steps[lineage.step - 1],
      lineage,
      supplier,
      workspaceId,
      mandateId: body.mandateId,
      agentIds: mandate.agentIds,
      policyIds: mandate.policyIds,
      creStore,
      now,
      evidenceMaxAgeMs: maxAge,
    });
    if (stepError) return deny(stepError);
  }

  // Async I/O happened since the first checks: re-verify the envelope is still
  // fresh and the mandate constraints have not been revoked or rebound.
  const nowAfterIO = deps.now ?? Date.now();
  if (Date.parse(body.expiresAt) <= nowAfterIO) {
    return deny('authorization expired while evidence was being verified');
  }
  const policyAfter = resolveSettlementPolicy({
    workspaceId,
    mandateId: body.mandateId,
    amountUsd: TRANSFER_USD,
    envLimits: config.envLimits,
  });
  if (policyAfter.policySource !== 'funded_mandate' || policyAfter.violations.length > 0) {
    return deny('mandate policy changed while evidence was being verified');
  }
  const mandateAfter = FundedMandateService.get(workspaceId, body.mandateId);
  if (
    !mandateAfter ||
    JSON.stringify(mandateAfter.agentIds) !== JSON.stringify(mandate.agentIds) ||
    JSON.stringify(mandateAfter.policyIds) !== JSON.stringify(mandate.policyIds)
  ) {
    return deny('mandate bindings changed while evidence was being verified');
  }

  const claim = SupplierPaymentStore.claimIntent({
    workspaceId,
    intentId: body.intentId,
    mandateId: body.mandateId,
    reportHash: body.reportHash,
    caseId: body.caseId,
    bindingHash,
    amountUsd: TRANSFER_USD,
  });
  if (claim.status === 'replay') return { status: 'replayed', signature: claim.signature };
  if (claim.status === 'pending') {
    return pending('a pending claim exists — reconcile the receipt, never redispatch');
  }
  if (claim.status === 'conflict') return deny(claim.reason);

  // Single dispatch. Any thrown/invalid/ambiguous outcome leaves the claim
  // pending — the durable record, not memory, owns retry safety.
  let receipt: SupplierPaymentRailReceipt;
  try {
    receipt = await rail.sendTransfer(transfer);
  } catch {
    return pending('dispatch outcome unknown — reconcile before any retry');
  }
  if (
    !receiptMatches(
      receipt,
      network,
      config.rail.payer,
      {
        mint: transfer.mint,
        payee: transfer.payee,
        amountBaseUnits: transfer.amountBaseUnits,
        intentId: transfer.intentId,
      },
      new Set(['confirmed']),
    )
  ) {
    return pending('dispatch receipt does not match the proposal — reconcile before any retry');
  }

  try {
    SupplierPaymentStore.finalizeClaim({
      workspaceId,
      intentId: body.intentId,
      bindingHash,
      amountUsd: TRANSFER_USD,
      signature: receipt.signature,
    });
  } catch {
    return pending('finalize failed — reconcile before any retry');
  }
  return { status: 'confirmed', signature: receipt.signature };
}

function receiptMatches(
  receipt: SupplierPaymentRailReceipt | null,
  network: SupplierExecutorNetwork,
  payer: string,
  proposal: { mint: string; payee: string; amountBaseUnits: string; intentId: string },
  allowedStatuses: ReadonlySet<string>,
): receipt is SupplierPaymentRailReceipt & { signature: string } {
  return (
    isRecord(receipt) &&
    receipt.cluster === (network.kind === 'devnet' ? 'devnet' : 'localnet') &&
    receipt.mint === proposal.mint &&
    receipt.payee === proposal.payee &&
    receipt.payer === payer &&
    receipt.amountBaseUnits === proposal.amountBaseUnits &&
    receipt.intentId === proposal.intentId &&
    typeof receipt.confirmationStatus === 'string' &&
    allowedStatuses.has(receipt.confirmationStatus) &&
    typeof receipt.signature === 'string' &&
    receipt.signature.length > 0
  );
}

/**
 * Manual reconciliation for a pending claim: re-verifies the signed envelope
 * is the identical binding, pulls the issued receipt from the trusted rail
 * adapter (never re-sends, never accepts an operator-pasted receipt), and
 * finalizes atomically. Any ambiguity leaves the claim pending.
 */
export async function reconcileSupplierPayment(
  workspaceId: string,
  envelope: unknown,
  deps: SupplierPaymentExecutorDeps,
): Promise<SupplierPaymentExecutorResult> {
  return reconcileSupplierPaymentImpl(DEVNET_NETWORK, workspaceId, envelope, deps);
}

async function reconcileSupplierPaymentImpl(
  network: SupplierExecutorNetwork,
  workspaceId: string,
  envelope: unknown,
  deps: SupplierExecutorDeps,
): Promise<SupplierPaymentExecutorResult> {
  const { config, rail } = deps;

  if (!config.enabled) return deny('supplier payment executor is disabled');
  if (workspaceId !== config.workspaceId) return deny('workspace is not this executor deployment');

  const body = verifyBody(network, envelope, config);
  if (!body) {
    return deny(
      `envelope is not a valid signed ${network.kind === 'devnet' ? 'devnet' : 'local'} authorization`,
    );
  }
  if (body.workspaceId !== config.workspaceId || body.mandateId !== config.mandateId) {
    return deny('envelope is not bound to this deployment');
  }
  const bindingHash = sha256CanonicalJson(body);

  const readiness = await checkRailReadiness(network, config, rail, body.payee, body.mint);
  if (readiness) return deny(readiness);

  const claim = SupplierPaymentStore.getClaim(workspaceId, body.intentId);
  if (!claim || claim.bindingHash !== bindingHash) {
    return deny('no identical claim exists for this envelope');
  }
  if (claim.state === 'confirmed' && claim.signature && !rail.fetchReceipt) {
    return { status: 'replayed', signature: claim.signature };
  }
  if (!rail.fetchReceipt) {
    return pending('the rail adapter cannot look up receipts — reconcile manually off-chain');
  }

  let receipt: SupplierPaymentRailReceipt | null;
  try {
    receipt = await rail.fetchReceipt(body.intentId);
  } catch {
    return pending('receipt lookup failed — no redispatch');
  }
  if (
    !receiptMatches(
      receipt,
      network,
      config.rail.payer,
      {
        mint: body.mint,
        payee: body.payee,
        amountBaseUnits: body.amountBaseUnits,
        intentId: body.intentId,
      },
      new Set(['confirmed', 'finalized']),
    )
  ) {
    return pending('no matching confirmed receipt on the trusted rail — claim stays pending');
  }
  if (claim.state === 'confirmed') {
    if (claim.signature === receipt.signature) {
      return { status: 'confirmed', signature: claim.signature };
    }
    return deny('the rail reports a different signature for a confirmed claim');
  }

  try {
    SupplierPaymentStore.finalizeClaim({
      workspaceId,
      intentId: body.intentId,
      bindingHash,
      amountUsd: TRANSFER_USD,
      signature: receipt.signature,
    });
  } catch {
    return pending('finalize failed — reconcile before any retry');
  }
  return { status: 'confirmed', signature: receipt.signature };
}

/**
 * Validate local network pins once: mint must be a real address and the
 * genesis must be an explicit spawned-validator hash that is not any public
 * cluster genesis — a local receipt can never be relabelled as devnet.
 */
function localNetworkOrNull(mint: string, genesisHash: string): SupplierExecutorNetwork | null {
  if (!isAddress(mint) || mint === DEVNET_USDC_MINT) return null;
  if (typeof genesisHash !== 'string' || !nonblank(genesisHash)) return null;
  if (PUBLIC_GENESIS_HASHES.has(genesisHash)) return null;
  return { kind: 'localnet', genesisHash, mint };
}

function nonblank(v: string): boolean {
  return v.trim().length > 0;
}

export interface LocalSupplierExecutor {
  execute(workspaceId: string, envelope: unknown): Promise<SupplierPaymentExecutorResult>;
  reconcile(workspaceId: string, envelope: unknown): Promise<SupplierPaymentExecutorResult>;
}

/**
 * Local-only executor composition for the governed worker proof. Same
 * orchestration as the devnet executor, but the network binding is a
 * `localnet` discriminant whose mint and genesis are validated up front:
 * local mint must be a valid address and the genesis must be explicitly
 * non-public. The config's rail pins must match the same local mint and
 * genesis — mismatched configuration fails closed.
 *
 * `deps` are server-owned exactly as in the devnet path — trusted public
 * key, report root, payee pins, rail and CRE store never come from the
 * caller or the envelope.
 */
export function createLocalSupplierExecutor(deps: SupplierLocalExecutorDeps): LocalSupplierExecutor {
  const network = localNetworkOrNull(deps.config.rail.mint, deps.config.rail.genesisHash);
  if (!network || network.kind !== 'localnet') {
    throw new Error('local executor rejected: mint/genesis pins are not a valid non-public local deployment');
  }
  return {
    execute(workspaceId, envelope) {
      return executeSupplierPaymentImpl(network, workspaceId, envelope, deps);
    },
    reconcile(workspaceId, envelope) {
      return reconcileSupplierPaymentImpl(network, workspaceId, envelope, deps);
    },
  };
}

/** Unbound local execute — same validation as the factory, one-shot use. */
export async function executeLocalSupplierPayment(
  workspaceId: string,
  envelope: unknown,
  deps: SupplierLocalExecutorDeps,
): Promise<SupplierPaymentExecutorResult> {
  const network = localNetworkOrNull(deps.config.rail.mint, deps.config.rail.genesisHash);
  if (!network || network.kind !== 'localnet') {
    return deny('local executor pins are not a valid non-public local deployment');
  }
  return executeSupplierPaymentImpl(network, workspaceId, envelope, deps);
}

export async function reconcileLocalSupplierPayment(
  workspaceId: string,
  envelope: unknown,
  deps: SupplierLocalExecutorDeps,
): Promise<SupplierPaymentExecutorResult> {
  const network = localNetworkOrNull(deps.config.rail.mint, deps.config.rail.genesisHash);
  if (!network || network.kind !== 'localnet') {
    return deny('local executor pins are not a valid non-public local deployment');
  }
  return reconcileSupplierPaymentImpl(network, workspaceId, envelope, deps);
}

export { LOCAL_SCHEMA };
