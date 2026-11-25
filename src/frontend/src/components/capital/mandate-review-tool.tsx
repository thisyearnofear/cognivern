'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import {
  type AllocationRecommendation,
  type FundedMandate,
  type FundedMandateStatement,
  type MandateContext,
  type OutcomeObservation,
  type PublishedMandateStatementSummary,
} from '@/lib/api-client';
import { jwtSecondsRemaining } from '@/lib/jwt';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Browser-agent read access to the /spend Attribution view.
 *
 * Registers a single WebMCP-style tool, `get_mandate_review`, on
 * `document.modelContext` when the browser supports it. The tool is
 * read-only: it returns a bounded projection of review state already loaded
 * for the currently selected mandate — never fetched, generated, or
 * workspace-wide. Citations are limited to evidence whose own
 * mandateId/workspaceId match the selection, so a tool call can never read
 * across mandate or workspace boundaries. Raw context chunks, unscoped
 * source listings, observation notes, credentials, and untyped blobs are
 * never returned.
 *
 * The registration is scoped to the connected identity (user + workspace +
 * mode + route + selection) and is aborted on scope change or unmount; a
 * callback that still fires afterwards fails closed.
 */

export type ReviewAction = 'select' | 'context' | 'recommendation' | 'statement' | 'publish' | 'done';

export interface ReviewProgress {
  activeStep: number;
  title: string;
  description: string;
  action: ReviewAction;
  actionLabel?: string;
}

/**
 * The operator-facing review stages for a selected mandate — shared by the
 * Attribution view UI and the get_mandate_review tool projection so both
 * describe the same phase.
 */
export function getReviewProgress(
  selectedMandateId: string,
  context: MandateContext | null,
  recommendation: AllocationRecommendation | null,
  statement: FundedMandateStatement | null,
  published: PublishedMandateStatementSummary[] | null,
): ReviewProgress {
  if (!selectedMandateId) {
    return {
      activeStep: 0,
      title: 'Choose a mandate to begin',
      description: 'Choose a funded mandate to see what happened, what is missing, and what to do next.',
      action: 'select',
      actionLabel: 'Choose a mandate',
    };
  }
  if (!context) {
    return {
      activeStep: 1,
      title: 'Build the cited decision history',
      description: 'Collect the spend, receipt, outcome, and policy evidence for this mandate.',
      action: 'context',
      actionLabel: 'Build cited history',
    };
  }
  if (!recommendation) {
    return {
      activeStep: 2,
      title: 'Review the next allocation',
      description: 'Use the evidence to generate a bounded next-allocation recommendation for operator review.',
      action: 'recommendation',
      actionLabel: 'Review recommendation',
    };
  }
  if (!statement) {
    return {
      activeStep: 3,
      title: 'Preview the review report',
      description: 'Inspect the read-only review report before publishing a versioned snapshot.',
      action: 'statement',
      actionLabel: 'Preview review report',
    };
  }
  if (!published || published.length === 0) {
    return {
      activeStep: 3,
      title: 'Freeze the review snapshot',
      description: 'Publish an immutable, hashed version of this report for your team.',
      action: 'publish',
      actionLabel: 'Publish review snapshot',
    };
  }
  return {
    activeStep: 4,
    title: 'Review complete',
    description: 'A versioned snapshot is published. Revisit this flow when new governed spend or measured outcomes change the evidence.',
    action: 'done',
  };
}

const TOOL_NAME = 'get_mandate_review';
const MAX_LIST = 10;
const MAX_TEXT = 200;

type LoadState<T> = 'not_loaded' | 'unavailable' | T;

/** Load provenance for data fetched against a specific selection. */
export type ScopedEvidence<T> =
  | { status: 'not_loaded' }
  | { status: 'unavailable' }
  | { status: 'ready'; items: T };

export interface MandateReviewSnapshot {
  selectedMandateId: string;
  mandates: FundedMandate[];
  context: MandateContext | null;
  recommendation: AllocationRecommendation | null;
  statement: FundedMandateStatement | null;
  /** Scoped fetch outcome for the selection — distinguishes failed, empty, and unfetched. */
  observations: ScopedEvidence<OutcomeObservation[]>;
  /** Spend records scoped to the selection; null unless the attribution report was loaded for it. */
  spendRecordCount: number | null;
  /** Scoped fetch outcome for published snapshots; drives the review phase only, never serialized. */
  published: ScopedEvidence<PublishedMandateStatementSummary[]>;
}

export interface MandateReviewResult {
  tool: typeof TOOL_NAME;
  status: 'ok' | 'no_selection' | 'selection_inaccessible' | 'unavailable';
  reason?: string;
  mandate?: { id: string; name: string; objective: string; status: string };
  reviewPhase?: { step: number; action: string; title: string };
  evidence?: {
    context?: LoadState<{
      syncStatus: string;
      syncedAt: string;
      provenance: Array<{ recordId?: string; kind: string; label: string; timestamp?: string }>;
    }>;
    observations?: LoadState<
      Array<{
        id: string;
        value: string;
        unit: string;
        observedAt: string;
        source: string;
        confidence: string;
        evidenceCount: number;
      }>
    >;
    recommendation?: LoadState<{
      status: string;
      stance: string;
      evidenceScore: number;
      generatedAt: string;
    }>;
    statement?: LoadState<{
      statementId: string;
      version: number;
      generatedAt: string;
      contentHash: string;
      evidenceCompleteness: FundedMandateStatement['performance']['evidenceCompleteness'];
    }>;
    governedSpendRecords?: number;
  };
  citations?: {
    provenance: string[];
    observations: string[];
    statement: string | null;
  };
  gaps?: { knownUnknowns: string[]; blockers: string[] };
  limitations: string[];
}

function clip(value: string | undefined): string | undefined {
  if (value == null) return undefined;
  return value.length > MAX_TEXT ? `${value.slice(0, MAX_TEXT)}…` : value;
}

const BASE_LIMITATIONS = [
  'Read-only view of already loaded review state; it does not fetch, generate, sync, publish, or spend.',
  'Published snapshot contents are never serialized here; scoped load state only advances the review phase.',
  'Absence is reported as not_loaded or unavailable, never as proof of non-existence.',
];

/**
 * Project the loaded review state for the current selection. Pure: same
 * inputs → same output, no reads beyond its arguments. Returns explicit
 * statuses rather than guessing at data the view has not loaded.
 */
export function buildMandateReview(
  snapshot: MandateReviewSnapshot,
  workspaceId: string | null,
): MandateReviewResult {
  const limitations = [...BASE_LIMITATIONS];

  if (!snapshot.selectedMandateId) {
    return {
      tool: TOOL_NAME,
      status: 'no_selection',
      reason: 'No mandate is selected in the Attribution view.',
      limitations,
    };
  }

  const mandate = snapshot.mandates.find((m) => m.id === snapshot.selectedMandateId);
  if (!workspaceId || !mandate || mandate.workspaceId !== workspaceId) {
    return {
      tool: TOOL_NAME,
      status: 'selection_inaccessible',
      reason: 'The selected mandate is missing or outside the connected workspace.',
      limitations,
    };
  }

  // Only scope-matched evidence may advance the phase or be cited; foreign
  // or untagged data is reported unavailable, never attributed.
  const scopedContext =
    snapshot.context && snapshot.context.mandateId === mandate.id ? snapshot.context : null;
  const scopedRecommendation =
    snapshot.recommendation &&
    snapshot.recommendation.mandateId === mandate.id &&
    snapshot.recommendation.workspaceId === workspaceId
      ? snapshot.recommendation
      : null;
  const scopedStatement =
    snapshot.statement &&
    snapshot.statement.mandate.id === mandate.id &&
    snapshot.statement.mandate.workspaceId === workspaceId
      ? snapshot.statement
      : null;
  const scopedPublished = snapshot.published.status === 'ready' ? snapshot.published.items : null;

  const evidence: NonNullable<MandateReviewResult['evidence']> = {};

  // Context citations come from provenance only — its entries carry their
  // own mandateId/workspaceId scope tags. The flat `sources` list is
  // untagged, so it is never returned.
  if (!snapshot.context) {
    evidence.context = 'not_loaded';
  } else if (!scopedContext) {
    evidence.context = 'unavailable';
  } else {
    evidence.context = {
      syncStatus: scopedContext.syncStatus,
      syncedAt: scopedContext.syncedAt,
      provenance: scopedContext.provenance
        .filter((p) => p.mandateId === mandate.id && p.workspaceId === workspaceId)
        .slice(0, MAX_LIST)
        .map((p) => ({
          ...(p.recordId ? { recordId: clip(p.recordId) } : {}),
          kind: clip(p.kind) ?? '',
          label: clip(p.label) ?? '',
          timestamp: p.timestamp,
        })),
    };
  }

  if (snapshot.observations.status === 'ready') {
    const matched = snapshot.observations.items.filter(
      (o) => o.mandateId === mandate.id && o.workspaceId === workspaceId,
    );
    evidence.observations = matched.slice(0, MAX_LIST).map((o) => ({
      id: clip(o.id) ?? '',
      value: clip(o.value) ?? '',
      unit: clip(o.unit) ?? '',
      observedAt: o.observedAt,
      source: clip(o.source) ?? '',
      confidence: o.confidence,
      evidenceCount: o.evidence.length,
    }));
  } else {
    evidence.observations = snapshot.observations.status;
  }

  if (!snapshot.recommendation) {
    evidence.recommendation = 'not_loaded';
  } else if (!scopedRecommendation) {
    evidence.recommendation = 'unavailable';
  } else {
    evidence.recommendation = {
      status: scopedRecommendation.status,
      stance: scopedRecommendation.recommendation.stance,
      evidenceScore: scopedRecommendation.evidenceCompleteness.score,
      generatedAt: scopedRecommendation.generatedAt,
    };
  }

  if (!snapshot.statement) {
    evidence.statement = 'not_loaded';
  } else if (!scopedStatement) {
    evidence.statement = 'unavailable';
  } else {
    evidence.statement = {
      statementId: scopedStatement.statementId,
      version: scopedStatement.version,
      generatedAt: scopedStatement.generatedAt,
      contentHash: scopedStatement.contentHash,
      evidenceCompleteness: scopedStatement.performance.evidenceCompleteness,
    };
  }

  if (snapshot.spendRecordCount !== null) {
    evidence.governedSpendRecords = snapshot.spendRecordCount;
  }

  const citations: NonNullable<MandateReviewResult['citations']> = {
    provenance:
      typeof evidence.context === 'object'
        ? evidence.context.provenance
            .map((p) => p.recordId ?? p.label)
            .filter((v): v is string => Boolean(v))
        : [],
    observations: Array.isArray(evidence.observations)
      ? evidence.observations.map((o) => o.id)
      : [],
    statement: typeof evidence.statement === 'object' ? evidence.statement.statementId : null,
  };

  const gaps: NonNullable<MandateReviewResult['gaps']> = {
    knownUnknowns: scopedStatement
      ? scopedStatement.performance.knownUnknowns.slice(0, MAX_LIST).map((u) => clip(u) ?? '')
      : [],
    blockers: scopedRecommendation
      ? scopedRecommendation.evidenceCompleteness.blockers.slice(0, MAX_LIST).map((b) => clip(b) ?? '')
      : [],
  };

  const progress = getReviewProgress(
    snapshot.selectedMandateId,
    scopedContext,
    scopedRecommendation,
    scopedStatement,
    scopedPublished,
  );

  return {
    tool: TOOL_NAME,
    status: 'ok',
    mandate: {
      id: mandate.id,
      name: clip(mandate.name) ?? '',
      objective: clip(mandate.objective) ?? '',
      status: mandate.status,
    },
    reviewPhase: { step: progress.activeStep, action: progress.action, title: progress.title },
    evidence,
    citations,
    gaps,
    limitations,
  };
}

interface ModelContextLike {
  registerTool?: (
    tool: Record<string, unknown>,
    options?: { signal?: AbortSignal },
  ) => unknown;
}

/** Same expiry semantics as the auth store: malformed or exp-less tokens fail. */
function tokenUsable(token: string | null): boolean {
  if (!token) return false;
  const remaining = jwtSecondsRemaining(token);
  return remaining !== null && remaining > 0;
}

function attributionViewActive(): boolean {
  if (window.location.pathname !== '/spend') return false;
  const view = new URLSearchParams(window.location.search).get('view');
  return view === null || view === 'attribution';
}

export function MandateReviewTool({ snapshot }: { snapshot: MandateReviewSnapshot }) {
  const snapshotRef = useRef(snapshot);
  // Layout effect so the registered callback sees the newest snapshot before
  // paint — a stale window between render and effect would leak the previous
  // selection to an in-flight tool call.
  useLayoutEffect(() => {
    snapshotRef.current = snapshot;
  });

  const isConnected = useAuthStore((s) => s.isConnected);
  const userId = useAuthStore((s) => s.authUser?.id ?? null);
  const workspaceId = useAuthStore((s) => s.workspace?.id ?? null);
  const mode = useAuthStore((s) => s.workspaceMode);
  const selectedMandateId = snapshot.selectedMandateId;

  useEffect(() => {
    const modelContext = (document as { modelContext?: ModelContextLike }).modelContext;
    if (!modelContext || typeof modelContext.registerTool !== 'function') return;
    if (!isConnected || !workspaceId) return;

    const expected = { userId, workspaceId, mode, selectedMandateId };
    const controller = new AbortController();

    const execute = (): string => {
      if (controller.signal.aborted) {
        return JSON.stringify({
          tool: TOOL_NAME,
          status: 'unavailable',
          reason: 'This tool registration was revoked when the view or session changed.',
          limitations: BASE_LIMITATIONS,
        });
      }
      const auth = useAuthStore.getState();
      const sessionCurrent =
        auth.isConnected &&
        (auth.authUser?.id ?? null) === expected.userId &&
        (auth.workspace?.id ?? null) === expected.workspaceId &&
        auth.workspaceMode === expected.mode &&
        tokenUsable(auth.token);
      // Fail closed on selection drift too: a callback saved before the
      // operator switched mandates must not read the new selection.
      const viewCurrent =
        attributionViewActive() &&
        snapshotRef.current.selectedMandateId === expected.selectedMandateId;
      if (!sessionCurrent || !viewCurrent) {
        return JSON.stringify({
          tool: TOOL_NAME,
          status: 'unavailable',
          reason: 'Session, selection, or view changed since this tool was registered.',
          limitations: BASE_LIMITATIONS,
        });
      }
      return JSON.stringify(buildMandateReview(snapshotRef.current, expected.workspaceId));
    };

    try {
      // Some implementations return a promise for async registration —
      // rejections must abort the tool, not propagate into the page.
      void Promise.resolve(
        modelContext.registerTool(
          {
            name: TOOL_NAME,
            description:
              'Read the currently selected mandate review, its cited evidence and gaps. Does not fetch, generate or modify anything.',
            inputSchema: { type: 'object', properties: {}, additionalProperties: false },
            annotations: { readOnlyHint: true, untrustedContentHint: true },
            execute,
          },
          { signal: controller.signal },
        ),
      ).catch(() => controller.abort());
    } catch {
      // Registration is best-effort; unsupported or rejected registration
      // must never break the page.
    }

    return () => controller.abort();
  }, [isConnected, userId, workspaceId, mode, selectedMandateId]);

  return null;
}
