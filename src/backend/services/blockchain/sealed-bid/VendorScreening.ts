/**
 * VendorScreening
 *
 * Anjoman-delegated vendor due-diligence for sealed-bid rounds: before the
 * manager reveals a winner, each bidder can be screened by one delegated
 * Anjoman task — Anjoman fans the brief out to ranked specialists
 * (sanctions screening, company/fraud reputation, wallet risk), combines
 * their evidence, and returns one assessment.
 *
 * The loop is auditable end to end:
 *   screenBidders → one governed telegraph run per bidder (telegraph.signal
 *     artifact, paymentMethod "anjoman_api_key", held for review fail-safe)
 *   → sealed_bid.vendor_screened events appended to the round's governance
 *     run (latest verdict per bidder is the screening state)
 *   → requireScreened on /reveal reads that state back from the timeline and
 *     refuses to award an unscreened or hit vendor.
 *
 * Fail-safe contract mirrors TelegraphCompliance: only an explicit "clear"
 * verdict lets a vendor through. Ambiguous or missing evidence is "unknown",
 * which the gate treats as not-cleared — never silently a pass.
 */

import { Logger } from '@backend/shared/logging/Logger.js';
import { telegraphGovernanceHelper } from '@backend/services/telegraph/TelegraphGovernanceHelper.js';
import { recordTelegraphGovernedCall } from '@backend/services/telegraph/TelegraphRunRecorder.js';
import {
  evaluateComplianceVerdict,
  type ComplianceVerdict,
} from '@backend/services/telegraph/TelegraphCompliance.js';
import {
  recordSealedBidEvent,
  type GovernanceEvent,
} from '@backend/cre/workflows/sealedBidGovernance.js';
import type { AnjomanTaskResult } from '@backend/services/anjoman/types.js';
import type { TelegraphMinerResponse } from '@backend/services/telegraph/types.js';
import type { SealedBidRound } from './types.js';

const logger = new Logger('VendorScreening');

export type VendorVerdict = ComplianceVerdict;

export interface VendorScreenResult {
  bidder: string;
  verdict: VendorVerdict;
  detail?: string;
  /** The governed telegraph run persisting this screen (null without workspace). */
  runId: string | null;
  jobId?: string;
  costUsd?: string;
  /** How many ranked specialists were paid inside the Anjoman task. */
  sources?: number;
}

export interface ScreenBiddersParams {
  roundId: string;
  agentId: string;
  /** Workspace the governed runs persist under; unset → runs are not persisted. */
  workspaceId?: string;
  mandateId?: string;
  /** Screen only these bidders; defaults to every bid on the round. */
  bidders?: string[];
  /** Extra per-bidder context (company name, wallet, domain) for the brief. */
  vendorDetails?: Record<string, string>;
  /** Per-task spend cap forwarded to Anjoman. */
  maxSpendUsd?: number;
}

export interface ScreenBiddersResult {
  roundId: string;
  screenings: VendorScreenResult[];
  screenedBidders: number;
  /** Names asked for that are not bidders on the round. */
  unknownBidders: string[];
  /** Bidders not screened because the cap kicked in. */
  skippedBidders: string[];
  totalCostUsd: string;
  governanceRunId?: string;
}

export interface ScreeningGateCheck {
  allowed: boolean;
  reason: string;
  verdicts: Record<string, VendorVerdict>;
}

// ---------------------------------------------------------------------------
// Verdict evaluation
// ---------------------------------------------------------------------------

const VERDICT_LINE = /VERDICT:\s*(CLEAR|HIT|UNKNOWN)\b/i;

// Clear-phrase matches are stripped before scanning for hit language so
// "not sanctioned" / "no sanctions match" can't false-positive as a hit.
const CLEAR_RE =
  /\b(no sanctions|not sanctioned|not on (the )?(ofac|sdn|sanction|watchlist)|no adverse|no red flags|clear of sanctions|no match|not listed|no listing|clean record)\b/gi;
const HIT_RE =
  /\b(sanctioned|on the ofac|on the sdn|sdn list|sanctions? (hit|match|list)|listed on (the )?(ofac|sdn|sanction|blacklist|watchlist)|blacklisted?|flagged)\b/i;

/**
 * Interpret an Anjoman screening answer as clear|hit|unknown.
 *
 * Precedence: the instructed `VERDICT: X` contract line → structured-answer
 * scan via the shared compliance evaluator → guarded text scan → unknown.
 */
export function evaluateVendorVerdict(taskResult: AnjomanTaskResult): {
  verdict: VendorVerdict;
  detail?: string;
} {
  const marker = taskResult.answer?.match(VERDICT_LINE);
  if (marker) {
    const verdict = marker[1].toLowerCase() as VendorVerdict;
    return { verdict, detail: `VERDICT: ${marker[1].toUpperCase()}` };
  }

  if (taskResult.data !== undefined && taskResult.data !== null) {
    const shaped = { data: taskResult.data } as TelegraphMinerResponse<unknown>;
    const { verdict, detail } = evaluateComplianceVerdict(shaped);
    if (verdict !== 'unknown') {
      return { verdict, detail: `structured answer: ${detail ?? 'verdict field'}` };
    }
  }

  const text = taskResult.answer ?? '';
  if (text) {
    if (HIT_RE.test(text.replace(CLEAR_RE, ' '))) {
      return { verdict: 'hit', detail: 'hit language in screening answer' };
    }
    if (CLEAR_RE.test(text)) {
      return { verdict: 'clear', detail: 'clear language in screening answer' };
    }
  }

  return {
    verdict: 'unknown',
    detail: 'no VERDICT marker or recognizable verdict language in Anjoman answer',
  };
}

// ---------------------------------------------------------------------------
// Screening state from the governance timeline
// ---------------------------------------------------------------------------

/**
 * Reduce a round's governance timeline to the latest verdict per bidder.
 * Re-screens overwrite earlier verdicts — events are appended in order, so
 * the last vendor_screened event for a bidder wins.
 */
export function latestScreenVerdicts(
  events: Array<Pick<GovernanceEvent, 'eventType' | 'payload'>>,
): Record<string, VendorVerdict> {
  const verdicts: Record<string, VendorVerdict> = {};
  for (const event of events) {
    if (event.eventType !== 'vendor_screened') continue;
    const { bidder, verdict } = event.payload;
    if (
      typeof bidder === 'string' &&
      (verdict === 'clear' || verdict === 'hit' || verdict === 'unknown')
    ) {
      verdicts[bidder] = verdict;
    }
  }
  return verdicts;
}

/**
 * The reveal gate. `specific` may only award a bidder whose latest screen is
 * "clear". `lowest-bid`/`highest-bid` compute the winner on-ledger from sealed
 * amounts — the gate cannot know who wins, so it requires every bidder
 * screened and none hit or inconclusive. A hit bidder forces the manager to
 * pick a cleared vendor via "specific" (or cancel) instead of awarding blind.
 */
export function evaluateScreeningGate(params: {
  selectionMethod: 'lowest-bid' | 'highest-bid' | 'specific';
  specificBidder?: string;
  bidders: string[];
  verdicts: Record<string, VendorVerdict>;
}): ScreeningGateCheck {
  const { verdicts } = params;

  if (params.selectionMethod === 'specific') {
    const target = params.specificBidder;
    if (!target) {
      return {
        allowed: false,
        reason: 'selectionMethod "specific" requires specificBidder',
        verdicts,
      };
    }
    const verdict = verdicts[target];
    if (verdict === 'clear') {
      return { allowed: true, reason: `${target} screened clear`, verdicts };
    }
    return {
      allowed: false,
      reason: verdict
        ? `${target} screening verdict "${verdict}" — award requires a clear screen`
        : `${target} has not been screened — run screen-bidders first`,
      verdicts,
    };
  }

  const unscreened = params.bidders.filter((b) => !(b in verdicts));
  if (unscreened.length > 0) {
    return {
      allowed: false,
      reason: `unscreened bidders: ${unscreened.join(', ')} — run screen-bidders first`,
      verdicts,
    };
  }
  const hits = params.bidders.filter((b) => verdicts[b] === 'hit');
  if (hits.length > 0) {
    return {
      allowed: false,
      reason: `hit verdicts: ${hits.join(', ')} — award a cleared vendor via selectionMethod "specific" or cancel the round`,
      verdicts,
    };
  }
  const inconclusive = params.bidders.filter((b) => verdicts[b] !== 'clear');
  if (inconclusive.length > 0) {
    return {
      allowed: false,
      reason: `inconclusive screens for: ${inconclusive.join(', ')} — re-screen or pick "specific"`,
      verdicts,
    };
  }
  return { allowed: true, reason: 'all bidders screened clear', verdicts };
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

interface RoundSource {
  getRound(roundId: string): Promise<SealedBidRound | null>;
}

export interface VendorScreeningDeps {
  sealedBidService: RoundSource;
  runTask?: typeof telegraphGovernanceHelper.governedAnjomanTask;
  recordRun?: typeof recordTelegraphGovernedCall;
  recordEvent?: typeof recordSealedBidEvent;
  maxBidders?: number;
}

/** Prompt contract: the brief asks Anjoman to end with a VERDICT line. */
export function buildScreeningBrief(
  round: Pick<SealedBidRound, 'description' | 'serviceCategory'>,
  bidder: string,
  vendorDetails?: string,
): string {
  return [
    `Screen this vendor for a procurement award decision.`,
    `Round: ${round.description} (category: ${round.serviceCategory}).`,
    `Vendor identifier: ${bidder}.`,
    vendorDetails ? `Provided details: ${vendorDetails}.` : null,
    `Investigate using ranked specialists: sanctions screening, company and fraud reputation, and wallet or on-chain risk if a crypto address is identifiable.`,
    `End your answer with exactly one line: "VERDICT: CLEAR", "VERDICT: HIT", or "VERDICT: UNKNOWN".`,
  ]
    .filter((line): line is string => line !== null)
    .join(' ');
}

export class VendorScreeningService {
  private deps: Required<
    Pick<VendorScreeningDeps, 'sealedBidService' | 'runTask' | 'recordRun' | 'recordEvent'>
  >;
  private maxBidders: number;

  constructor(deps: VendorScreeningDeps) {
    this.deps = {
      sealedBidService: deps.sealedBidService,
      runTask: deps.runTask ?? ((req) => telegraphGovernanceHelper.governedAnjomanTask(req)),
      recordRun: deps.recordRun ?? recordTelegraphGovernedCall,
      recordEvent: deps.recordEvent ?? recordSealedBidEvent,
    };
    this.maxBidders =
      deps.maxBidders ?? (parseInt(process.env.ANJOMAN_SCREEN_MAX_BIDDERS ?? '', 10) || 10);
  }

  /**
   * Screen a round's bidders. One governed Anjoman task per bidder, run
   * concurrently — a failure on one bidder is recorded as its own error
   * verdict entry instead of sinking the batch (design-for-loss).
   */
  async screenBidders(params: ScreenBiddersParams): Promise<ScreenBiddersResult> {
    const round = await this.deps.sealedBidService.getRound(params.roundId);
    if (!round) throw new Error(`Round ${params.roundId} not found`);

    const roundBidders = new Set(round.bids.map((b) => b.bidder));
    const wanted = params.bidders ?? [...roundBidders];
    const unknownBidders = wanted.filter((b) => !roundBidders.has(b));
    const targets = [...new Set(wanted)].filter((b) => roundBidders.has(b));
    const screened = targets.slice(0, this.maxBidders);
    const skippedBidders = targets.slice(this.maxBidders);

    const results = await Promise.allSettled(
      screened.map((bidder) => this.screenOne(round, bidder, params)),
    );

    const screenings = results.map((outcome, i) => {
      const bidder = screened[i];
      if (outcome.status === 'fulfilled') return outcome.value;
      logger.error('Vendor screening task failed', { roundId: round.roundId, bidder });
      return {
        bidder,
        verdict: 'unknown' as const,
        detail: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
        runId: null,
      };
    });

    const totalCost = screenings.reduce((sum, s) => sum + parseFloat(s.costUsd ?? '0'), 0);

    return {
      roundId: round.roundId,
      screenings,
      screenedBidders: screenings.length,
      unknownBidders,
      skippedBidders,
      totalCostUsd: totalCost.toFixed(4),
      governanceRunId: round.governanceRunId,
    };
  }

  private async screenOne(
    round: SealedBidRound,
    bidder: string,
    params: ScreenBiddersParams,
  ): Promise<VendorScreenResult> {
    const description = `Vendor screen: ${bidder} — ${round.serviceCategory}`;
    const result = await this.deps.runTask({
      agentId: `${params.agentId}:vendor-screen`,
      workspaceId: params.workspaceId,
      mandateId: params.mandateId,
      task: {
        message: buildScreeningBrief(round, bidder, params.vendorDetails?.[bidder]),
        maxSpendUsd: params.maxSpendUsd,
      },
      description,
    });

    const run = await this.deps.recordRun({
      result,
      projectId: params.workspaceId,
      agentId: params.agentId,
      description,
    });

    const taskResult = result.response?.data;
    const { verdict, detail } = taskResult
      ? evaluateVendorVerdict(taskResult)
      : { verdict: 'unknown' as const, detail: result.error ?? 'task failed' };

    const screen: VendorScreenResult = {
      bidder,
      verdict,
      detail,
      runId: run?.runId ?? null,
      jobId: taskResult?.jobId,
      costUsd: taskResult?.costUsd,
      sources: taskResult?.sources?.length,
    };

    // Append to the round's governance timeline when one exists — this is
    // the state requireScreened reads back at reveal time.
    if (round.governanceRunId) {
      this.deps
        .recordEvent({
          runId: round.governanceRunId,
          eventType: 'vendor_screened',
          payload: {
            roundId: round.roundId,
            bidder,
            verdict,
            detail,
            screeningRunId: run?.runId ?? null,
            jobId: taskResult?.jobId ?? null,
            costUsd: taskResult?.costUsd ?? null,
          },
        })
        .catch((err) => logger.warn('Failed to record vendor_screened governance event', err));
    }

    logger.info('Vendor screen completed', {
      roundId: round.roundId,
      bidder,
      verdict,
      costUsd: taskResult?.costUsd,
    });
    return screen;
  }
}
