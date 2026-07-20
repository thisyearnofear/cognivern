import crypto from 'node:crypto';
import { creRunStore } from '@backend/cre/storage/CreRunStore.js';
import { CreRun, CreRunEvent, CreRunEventType } from '@backend/cre/types.js';

export const MAX_SETTLEMENT_AMOUNT = 100_000;
const SEALED_BID_EVENT_PREFIX = 'sealed_bid.';

export interface PolicyCheck {
  name: 'min_bids' | 'deadline_elapsed' | 'budget_within_limit';
  passed: boolean;
  detail: string;
}

export interface GovernanceEvent {
  eventType: string;
  timestamp: string;
  eventHash: string;
  payload: Record<string, unknown>;
}

export interface StartAgentRoundCreationParams {
  agentId: string;
  roundId: string;
  roundParams: {
    description: string;
    serviceCategory: string;
    maxBids: number;
    deadline: string;
    settlementAmount?: number | null;
    settlementAssetTag?: string | null;
  };
}

export interface EvaluateClosePolicyParams {
  runId: string;
  roundId: string;
  bidCount: number;
  deadline: string;
}

export interface RecordSealedBidEventParams {
  runId: string;
  eventType: 'bid_submitted' | 'round_closed' | 'winner_revealed';
  payload: Record<string, unknown>;
}

type InternalEventType =
  | 'round_created'
  | 'bid_submitted'
  | 'policy_checked'
  | 'round_closed'
  | 'winner_revealed';

interface SealedBidRunStore {
  add(run: CreRun): Promise<void>;
  get(runId: string): Promise<CreRun | undefined>;
  replace(run: CreRun): Promise<void>;
  list(): Promise<CreRun[]>;
}

/**
 * Deterministic JSON serialization used for sealed-bid event hashes. Objects
 * are recursively key-sorted; arrays retain their original order.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

export function hashSealedBidEvent(params: {
  runId: string;
  eventType: string;
  timestamp: string;
  payload: Record<string, unknown>;
}): string {
  const material = [
    params.runId,
    params.eventType,
    params.timestamp,
    canonicalJson(params.payload),
  ].join('|');
  return crypto.createHash('sha256').update(material).digest('hex');
}

function getSealedBidEventType(eventType: InternalEventType): CreRunEventType {
  return `${SEALED_BID_EVENT_PREFIX}${eventType}` as CreRunEventType;
}

function eventName(type: CreRunEventType): InternalEventType | undefined {
  if (!type.startsWith(SEALED_BID_EVENT_PREFIX)) return undefined;
  return type.slice(SEALED_BID_EVENT_PREFIX.length) as InternalEventType;
}

function roundCreatedPayload(run: CreRun): Record<string, unknown> {
  const event = (run.events || []).find(
    (candidate) => candidate.type === 'sealed_bid.round_created',
  );
  if (!event?.payload) {
    throw new Error(`Governance run ${run.runId} has no round_created event`);
  }
  return event.payload;
}

function currency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

export function createSealedBidGovernance(store: SealedBidRunStore = creRunStore) {
  const governanceByRoundId = new Map<
    string,
    { governanceRunId: string; createdByAgent: string }
  >();

  async function appendEvent(params: {
    run: CreRun;
    eventType: InternalEventType;
    payload: Record<string, unknown>;
  }): Promise<GovernanceEvent> {
    const timestamp = new Date().toISOString();
    const eventHash = hashSealedBidEvent({
      runId: params.run.runId,
      eventType: params.eventType,
      timestamp,
      payload: params.payload,
    });
    const event: CreRunEvent = {
      id: crypto.randomUUID(),
      runId: params.run.runId,
      type: getSealedBidEventType(params.eventType),
      timestamp,
      payload: params.payload,
      evidence: { hash: eventHash },
    };

    params.run.events = [...(params.run.events || []), event];
    return { eventType: params.eventType, timestamp, eventHash, payload: params.payload };
  }

  async function loadRun(runId: string): Promise<CreRun> {
    const run = await store.get(runId);
    if (!run || run.workflow !== 'sealed_bid') {
      throw new Error(`Sealed-bid governance run ${runId} was not found`);
    }
    return run;
  }

  return {
    async startAgentRoundCreation(
      params: StartAgentRoundCreationParams,
    ): Promise<{ runId: string }> {
      const startedAt = new Date().toISOString();
      const run: CreRun = {
        runId: crypto.randomUUID(),
        workflow: 'sealed_bid',
        mode: 'cre',
        startedAt,
        ok: false,
        status: 'running',
        retryCount: 0,
        approvalState: 'not_required',
        controls: { canCancel: false, canRetry: false, canApprove: false },
        provenance: { source: 'cognivern', model: params.agentId },
        events: [],
        steps: [],
        artifacts: [],
      };
      await appendEvent({
        run,
        eventType: 'round_created',
        payload: { roundId: params.roundId, ...params.roundParams },
      });
      await store.add(run);
      governanceByRoundId.set(params.roundId, {
        governanceRunId: run.runId,
        createdByAgent: params.agentId,
      });
      return { runId: run.runId };
    },

    async evaluateClosePolicy(
      params: EvaluateClosePolicyParams,
    ): Promise<{ allowed: boolean; reason: string; checks: PolicyCheck[] }> {
      const run = await loadRun(params.runId);
      const created = roundCreatedPayload(run);
      if (created.roundId !== params.roundId) {
        throw new Error(
          `Governance run ${params.runId} does not belong to round ${params.roundId}`,
        );
      }

      const deadlineMs = new Date(params.deadline).getTime();
      const minBidsPassed = params.bidCount >= 3;
      const deadlinePassed = Number.isFinite(deadlineMs) && Date.now() >= deadlineMs;
      const settlementAmount = created.settlementAmount;
      const hasSettlementAmount = settlementAmount !== undefined && settlementAmount !== null;
      const validSettlementAmount =
        !hasSettlementAmount ||
        (typeof settlementAmount === 'number' && Number.isFinite(settlementAmount));
      const budgetPassed =
        !hasSettlementAmount ||
        (validSettlementAmount && settlementAmount <= MAX_SETTLEMENT_AMOUNT);

      const checks: PolicyCheck[] = [
        {
          name: 'min_bids',
          passed: minBidsPassed,
          detail: minBidsPassed
            ? `${params.bidCount} bids received (min: 3)`
            : `${params.bidCount} bids received (min: 3 — not met)`,
        },
        {
          name: 'deadline_elapsed',
          passed: deadlinePassed,
          detail: !Number.isFinite(deadlineMs)
            ? `Invalid deadline (${params.deadline})`
            : deadlinePassed
              ? `Deadline elapsed at ${params.deadline}`
              : `Deadline not elapsed (closes at ${params.deadline})`,
        },
        {
          name: 'budget_within_limit',
          passed: budgetPassed,
          detail: !hasSettlementAmount
            ? 'No settlement amount — budget check skipped'
            : !validSettlementAmount
              ? 'Invalid settlement amount — budget check failed'
              : budgetPassed
                ? `Settlement amount ${currency(settlementAmount)} within budget limit ${currency(MAX_SETTLEMENT_AMOUNT)}`
                : `Settlement amount ${currency(settlementAmount)} exceeds budget limit ${currency(MAX_SETTLEMENT_AMOUNT)}`,
        },
      ];
      const allowed = checks.every((check) => check.passed);
      const reason = allowed
        ? 'Close policy passed'
        : checks
            .filter((check) => !check.passed)
            .map((check) => check.detail)
            .join('; ');

      await appendEvent({
        run,
        eventType: 'policy_checked',
        payload: { roundId: params.roundId, allowed, checks },
      });
      await store.replace(run);
      return { allowed, reason, checks };
    },

    async recordSealedBidEvent(
      params: RecordSealedBidEventParams,
    ): Promise<{ eventHash: string; timestamp: string }> {
      const run = await loadRun(params.runId);
      const event = await appendEvent({
        run,
        eventType: params.eventType,
        payload: params.payload,
      });
      await store.replace(run);
      return { eventHash: event.eventHash, timestamp: event.timestamp };
    },

    async getGovernanceTimeline(runId: string): Promise<{
      runId: string;
      agentId: string;
      events: GovernanceEvent[];
    }> {
      const run = await loadRun(runId);
      return {
        runId: run.runId,
        agentId: run.provenance?.model || 'unknown-agent',
        events: (run.events || [])
          .map<GovernanceEvent | undefined>((event) => {
            const type = eventName(event.type);
            if (!type || !event.payload || !event.evidence?.hash) return undefined;
            return {
              eventType: type,
              timestamp: event.timestamp,
              eventHash: event.evidence.hash,
              payload: event.payload,
            };
          })
          .filter((event): event is GovernanceEvent => Boolean(event)),
      };
    },

    /**
     * Rebuild the round→governance mapping from persisted CRE runs.
     * Returns a map of roundId to governance metadata so callers can store it
     * in their own in-memory index (e.g. SealedBidService.governanceByRoundId).
     */
    async rebuildRoundMapping(): Promise<
      Map<string, { governanceRunId: string; createdByAgent: string }>
    > {
      const mapping = new Map<
        string,
        { governanceRunId: string; createdByAgent: string }
      >();
      const runs = await store.list();
      for (const run of runs) {
        if (run.workflow !== 'sealed_bid') continue;
        const created = (run.events || []).find(
          (event) => event.type === 'sealed_bid.round_created',
        );
        if (!created?.payload || typeof created.payload !== 'object') continue;
        const payload = created.payload as Record<string, unknown>;
        const roundId = payload.roundId;
        const agentId = run.provenance?.model;
        if (typeof roundId === 'string' && typeof agentId === 'string') {
          mapping.set(roundId, {
            governanceRunId: run.runId,
            createdByAgent: agentId,
          });
        }
      }
      return mapping;
    },
  };
}

const governance = createSealedBidGovernance();

export const startAgentRoundCreation = governance.startAgentRoundCreation;
export const evaluateClosePolicy = governance.evaluateClosePolicy;
export const recordSealedBidEvent = governance.recordSealedBidEvent;
export const getGovernanceTimeline = governance.getGovernanceTimeline;
export const rebuildSealedBidRoundMapping = governance.rebuildRoundMapping;
