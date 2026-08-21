/**
 * InferenceGatewayService — the metered ingress.
 *
 * Every participant request follows the same path:
 *
 *   authorise key
 *     -> preflight (program active, in window, model allowed, caps respected)
 *       -> HOLD an upper-bound cost on the ledger      [atomic]
 *         -> call the backend
 *           -> SETTLE the real cost from provider token counts   [atomic]
 *             -> write one inference record (tier-gated)
 *               -> write one audit record
 *
 * Two properties are non-negotiable and shape everything else:
 *
 * 1. No unmetered path. A request either gets a hold or gets rejected. There is
 *    no branch where a call reaches the provider without credit reserved first,
 *    which is what stops one participant's runaway loop from draining a shared
 *    upstream balance. 0G's Router bills a single account and does not document
 *    per-key caps, so this is the only place that limit can exist.
 *
 * 2. Holds are always resolved. `settle` on success, `release` on any failure,
 *    in a `finally`. An abandoned hold silently shrinks a participant's budget
 *    for the rest of the event with no visible cause.
 *
 * The audit record is written even for denied and failed requests. A trail that
 * only contains successes cannot answer "did they hit their cap and when",
 * which is exactly the question an organiser asks.
 */

import { createHash } from "node:crypto";
import logger from "@backend/utils/logger.js";
import { AuditLogService } from "@backend/services/governance/AuditLogService.js";
import type { AgentAction, PolicyCheck } from "@backend/types/Agent.js";
import {
  CreditLedgerService,
  InsufficientCreditsError,
  sharedCreditLedgerService,
  type HoldReceipt,
} from "@backend/services/credits/CreditLedgerService.js";
import {
  CreditProgramService,
  sharedCreditProgramService,
  type CreditParticipant,
  type CreditProgram,
} from "@backend/services/credits/CreditProgramService.js";
import {
  InferenceRecordStore,
  sharedInferenceRecordStore,
} from "@backend/services/credits/InferenceRecordStore.js";
import { fieldsPersistedAt, tierAtLeast } from "@backend/services/credits/disclosure.js";
import { hydraDbIngestion } from "@backend/services/hydradb/HydraDbIngestionService.js";
import {
  flattenMessages,
  redactSecrets,
  redactedExcerpt,
} from "@backend/services/credits/redaction.js";
import { classifyTask } from "@backend/services/credits/taskClassifier.js";
import { nanoToUsd } from "@backend/services/credits/money.js";
import { ModelPricingService } from "./ModelPricingService.js";
import { listBackends, resolveBackend } from "./backendRegistry.js";
import { recordGatewayInference } from "@backend/observability/gateway.js";
import { ZERO_USAGE, type InferenceBackend, type UpstreamUsage } from "./types.js";
import { hashPolicyContent } from "../../../shared/governance-proof-v2.js";

const EXCERPT_MAX_CHARS = Number(process.env.GATEWAY_EXCERPT_MAX_CHARS || 500);
/** Hard ceiling on requested output tokens when neither client nor program set one. */
const DEFAULT_MAX_OUTPUT_TOKENS = Number(process.env.GATEWAY_DEFAULT_MAX_OUTPUT_TOKENS || 2048);

export interface GatewayContext {
  participant: CreditParticipant;
  program: CreditProgram;
}

export interface GatewayDenial {
  code: string;
  message: string;
  httpStatus: number;
}

export class GatewayDeniedError extends Error {
  constructor(readonly denial: GatewayDenial) {
    super(denial.message);
    this.name = "GatewayDeniedError";
  }
}

export interface CompletionOutcome {
  ok: boolean;
  httpStatus: number;
  body: unknown;
  recordId: string;
  costUsd: number;
  remainingUsd: number;
}

export class InferenceGatewayService {
  private readonly audit: AuditLogService;

  /**
   * `backend` and `pricing` are optional overrides. When omitted, the backend is
   * resolved per request from `program.backend` via the registry — that is the
   * production path and what makes the provider swappable per program. Tests
   * inject an explicit backend to pin behaviour.
   */
  constructor(
    private readonly backendOverride?: InferenceBackend,
    private readonly pricingOverride?: ModelPricingService,
    private readonly programs: CreditProgramService = sharedCreditProgramService(),
    private readonly ledger: CreditLedgerService = sharedCreditLedgerService(),
    private readonly records: InferenceRecordStore = sharedInferenceRecordStore(),
    audit?: AuditLogService,
  ) {
    this.audit = audit ?? new AuditLogService();
  }

  /**
   * Resolve which backend serves a program.
   *
   * Throws a denial rather than silently falling back to a default: if a
   * sponsor configured a provider we cannot serve, failing loudly is correct.
   * Quietly routing to a different provider would bill their participants
   * against a model they did not choose and record a provider id that lies.
   */
  private resolve(program: CreditProgram): {
    backend: InferenceBackend;
    pricing: ModelPricingService;
  } {
    if (this.backendOverride) {
      return {
        backend: this.backendOverride,
        pricing: this.pricingOverride ?? new ModelPricingService(this.backendOverride),
      };
    }

    const registered = resolveBackend(program.backend);
    if (!registered) {
      throw new GatewayDeniedError({
        code: "backend_unknown",
        message: `No inference backend registered for '${program.backend}'.`,
        httpStatus: 503,
      });
    }
    if (!registered.backend.isConfigured()) {
      throw new GatewayDeniedError({
        code: "backend_not_configured",
        message: `Inference backend '${program.backend}' is not configured on this server.`,
        httpStatus: 503,
      });
    }
    return registered;
  }

  /** Default backend id, for status reporting when no program is in scope. */
  get backendId(): string {
    return this.backendOverride?.id ?? "zerog-router";
  }

  /**
   * True when at least one registered backend can serve traffic. Per-program
   * configuration is checked again in `resolve()`.
   */
  isConfigured(): boolean {
    if (this.backendOverride) return this.backendOverride.isConfigured();
    return listBackends().some((b) => b.configured);
  }

  /** Resolve a raw `cvk_` bearer token. Returns null for anything unusable. */
  authorize(rawKey: string | undefined | null): GatewayContext | null {
    if (!rawKey) return null;
    const resolved = this.programs.resolveGatewayKey(rawKey);
    return resolved ? { participant: resolved.participant, program: resolved.program } : null;
  }

  async listModels(program: CreditProgram): Promise<unknown[]> {
    const { pricing } = this.resolve(program);
    const entries = await pricing.listModels();
    // Relay upstream entries untouched so clients see the provider's real
    // catalog shape (pricing, context window, verifiability) rather than a
    // lossy re-serialisation of it.
    return entries.map((e) => e.raw);
  }

  /**
   * Non-streaming chat completion.
   *
   * Returns an outcome rather than throwing for upstream failures: the caller
   * needs to relay the provider's own status and body, and a failed provider
   * call is a normal event to record, not an exception to propagate.
   */
  async chatCompletion(
    context: GatewayContext,
    body: Record<string, unknown>,
  ): Promise<CompletionOutcome> {
    const { backend, pricing } = this.resolve(context.program);
    const prepared = await this.prepare(context, body, pricing);
    const startedAt = Date.now();

    let hold: HoldReceipt | null = null;
    let settled = false;

    try {
      hold = this.placeHold(context, prepared.maxCostNano, prepared.model);

      const result = await backend.chatCompletion({
        body: prepared.body,
        trustMode: context.program.requireTrustMode,
      });

      const latencyMs = Date.now() - startedAt;

      if (!result.ok) {
        // Provider failed: release the hold untouched. A participant is never
        // billed for an upstream error.
        this.ledger.release(hold, { note: `upstream ${result.status}` });
        settled = true;

        const recordId = await this.record(context, {
          prepared,
          status: "upstream_error",
          deniedReason: `upstream_status_${result.status}`,
          usage: ZERO_USAGE,
          costNano: 0,
          rawCostNative: null,
          pricingSource: null,
          latencyMs,
          streamed: false,
          provider: result.provider,
          trustTier: result.trustTier,
          upstreamRequestId: result.upstreamRequestId,
          responseText: "",
        }, backend.id);

        return {
          ok: false,
          httpStatus: result.status,
          body: result.body,
          recordId,
          costUsd: 0,
          remainingUsd: nanoToUsd(this.available(context.participant.id)),
        };
      }

      const usage = result.usage;
      if (!usage) {
        // Metering failure, not a free lunch. We bill the hold estimate rather
        // than zero, and flag it loudly — silently zero-rating unmetered calls
        // is how a sponsor's pool disappears with no explanation.
        logger.error(
          `Backend '${backend.id}' returned no usage for model ${prepared.model}; ` +
            `billing the hold estimate (${prepared.maxCostNano} nano-USD) instead of zero`,
        );
      }

      const effectiveUsage = usage ?? ZERO_USAGE;
      const priced = usage
        ? await pricing.price(prepared.model, usage)
        : { costNano: prepared.maxCostNano, rawCostNative: null, source: "fallback" as const };

      this.ledger.settle(hold, priced.costNano, { note: `${prepared.model} completion` });
      settled = true;

      const recordId = await this.record(context, {
        prepared,
        status: "ok",
        deniedReason: null,
        usage: effectiveUsage,
        costNano: priced.costNano,
        rawCostNative: priced.rawCostNative,
        pricingSource: usage ? priced.source : "unmetered_fallback",
        latencyMs,
        streamed: false,
        provider: result.provider,
        trustTier: result.trustTier,
        upstreamRequestId: result.upstreamRequestId,
        responseText: result.responseText,
      }, backend.id);

      return {
        ok: true,
        httpStatus: 200,
        body: result.body,
        recordId,
        costUsd: nanoToUsd(priced.costNano),
        remainingUsd: nanoToUsd(this.available(context.participant.id)),
      };
    } finally {
      // Covers thrown errors (network, abort, bug) — an unresolved hold would
      // otherwise permanently reduce this participant's budget.
      if (hold && !settled) {
        try {
          this.ledger.release(hold, { note: "released after gateway exception" });
        } catch (releaseError) {
          logger.error(
            `Failed to release hold ${hold.holdId} for participant ${context.participant.id}: ` +
              `${(releaseError as Error).message}`,
          );
        }
      }
    }
  }

  /**
   * Streaming chat completion.
   *
   * The caller drives the relay: it consumes `chunks`, writes them to the HTTP
   * response, then awaits `finalize()` to settle the ledger from the usage the
   * stream carried. Splitting it this way keeps Express plumbing out of this
   * service while guaranteeing settlement happens exactly once.
   */
  async chatCompletionStream(
    context: GatewayContext,
    body: Record<string, unknown>,
  ): Promise<{
    ok: boolean;
    httpStatus: number;
    errorBody?: unknown;
    chunks: AsyncIterable<Uint8Array>;
    finalize: () => Promise<CompletionOutcome>;
  }> {
    const { backend, pricing } = this.resolve(context.program);
    const prepared = await this.prepare(context, body, pricing);
    const startedAt = Date.now();
    const hold = this.placeHold(context, prepared.maxCostNano, prepared.model);

    let stream;
    try {
      stream = await backend.chatCompletionStream({
        body: prepared.body,
        trustMode: context.program.requireTrustMode,
      });
    } catch (error) {
      this.ledger.release(hold, { note: "stream open failed" });
      throw error;
    }

    if (!stream.ok) {
      this.ledger.release(hold, { note: `upstream ${stream.status}` });
      const recordId = await this.record(context, {
        prepared,
        status: "upstream_error",
        deniedReason: `upstream_status_${stream.status}`,
        usage: ZERO_USAGE,
        costNano: 0,
        rawCostNative: null,
        pricingSource: null,
        latencyMs: Date.now() - startedAt,
        streamed: true,
        provider: null,
        trustTier: stream.collected.trustTier,
        upstreamRequestId: stream.collected.upstreamRequestId,
        responseText: "",
      }, backend.id);

      return {
        ok: false,
        httpStatus: stream.status,
        errorBody: stream.errorBody,
        chunks: stream.chunks,
        finalize: async () => ({
          ok: false,
          httpStatus: stream.status,
          body: stream.errorBody,
          recordId,
          costUsd: 0,
          remainingUsd: nanoToUsd(this.available(context.participant.id)),
        }),
      };
    }

    let finalized = false;

    const finalize = async (): Promise<CompletionOutcome> => {
      // Idempotent: a client disconnect can race the normal completion path,
      // and settling twice would double-bill.
      if (finalized) {
        return {
          ok: true,
          httpStatus: 200,
          body: null,
          recordId: "",
          costUsd: 0,
          remainingUsd: nanoToUsd(this.available(context.participant.id)),
        };
      }
      finalized = true;

      const collected = stream.collected;
      const latencyMs = Date.now() - startedAt;

      if (collected.usageMissing || !collected.usage) {
        // Stream ended without usage — most often a client disconnect mid-
        // stream. Bill the hold estimate so partial generation isn't free.
        logger.warn(
          `Stream for participant ${context.participant.id} ended without usage; ` +
            `billing hold estimate ${hold.amountNano} nano-USD`,
        );
        this.ledger.settle(hold, hold.amountNano, {
          note: `${prepared.model} stream, usage unreported`,
        });

        const recordId = await this.record(context, {
          prepared,
          status: "ok",
          deniedReason: null,
          usage: collected.usage ?? ZERO_USAGE,
          costNano: hold.amountNano,
          rawCostNative: null,
          pricingSource: "unmetered_fallback",
          latencyMs,
          streamed: true,
          provider: collected.provider,
          trustTier: collected.trustTier,
          upstreamRequestId: collected.upstreamRequestId,
          responseText: collected.responseText,
        }, backend.id);

        return {
          ok: true,
          httpStatus: 200,
          body: null,
          recordId,
          costUsd: nanoToUsd(hold.amountNano),
          remainingUsd: nanoToUsd(this.available(context.participant.id)),
        };
      }

      const priced = await pricing.price(prepared.model, collected.usage);
      this.ledger.settle(hold, priced.costNano, { note: `${prepared.model} stream` });

      const recordId = await this.record(context, {
        prepared,
        status: "ok",
        deniedReason: null,
        usage: collected.usage,
        costNano: priced.costNano,
        rawCostNative: priced.rawCostNative,
        pricingSource: priced.source,
        latencyMs,
        streamed: true,
        provider: collected.provider,
        trustTier: collected.trustTier,
        upstreamRequestId: collected.upstreamRequestId,
        responseText: collected.responseText,
      }, backend.id);

      return {
        ok: true,
        httpStatus: 200,
        body: null,
        recordId,
        costUsd: nanoToUsd(priced.costNano),
        remainingUsd: nanoToUsd(this.available(context.participant.id)),
      };
    };

    return { ok: true, httpStatus: 200, chunks: stream.chunks, finalize };
  }

  // ── Preflight ────────────────────────────────────────────────────────────

  /**
   * Validate the request against program constraints and compute the hold size.
   *
   * These are the *structural* controls — the ones that are cheap and reliable.
   * Deliberately absent: any attempt to judge whether the prompt is
   * "hackathon-related". See `taskClassifier` for why that stays a reporting
   * signal rather than a gate.
   */
  private async prepare(
    context: GatewayContext,
    rawBody: Record<string, unknown>,
    pricing: ModelPricingService,
  ): Promise<PreparedRequest> {
    const { program, participant } = context;

    if (program.status !== "active") {
      throw new GatewayDeniedError({
        code: "program_inactive",
        message: `Credit program '${program.name}' is ${program.status}.`,
        httpStatus: 403,
      });
    }

    if (participant.status !== "active") {
      throw new GatewayDeniedError({
        code: "participant_inactive",
        message: `Participant access is ${participant.status}.`,
        httpStatus: 403,
      });
    }

    const now = Date.now();
    if (program.startsAt && now < Date.parse(program.startsAt)) {
      throw new GatewayDeniedError({
        code: "program_not_started",
        message: `Credits become spendable at ${program.startsAt}.`,
        httpStatus: 403,
      });
    }
    if (program.endsAt && now > Date.parse(program.endsAt)) {
      throw new GatewayDeniedError({
        code: "program_ended",
        message: `Credits expired at ${program.endsAt}.`,
        httpStatus: 403,
      });
    }

    const model = typeof rawBody.model === "string" ? rawBody.model : "";
    if (!model) {
      throw new GatewayDeniedError({
        code: "model_required",
        message: "Request body must include a 'model'.",
        httpStatus: 400,
      });
    }

    if (program.allowedModels.length > 0 && !program.allowedModels.includes(model)) {
      throw new GatewayDeniedError({
        code: "model_not_allowed",
        message: `Model '${model}' is not in this program's allowlist. Allowed: ${program.allowedModels.join(", ")}.`,
        httpStatus: 403,
      });
    }

    if (!Array.isArray(rawBody.messages) || rawBody.messages.length === 0) {
      throw new GatewayDeniedError({
        code: "messages_required",
        message: "Request body must include a non-empty 'messages' array.",
        httpStatus: 400,
      });
    }

    // Clamp output tokens to the program cap. Clamping rather than rejecting
    // keeps naive clients working while still bounding the hold — and the
    // bound is what makes the hold a real upper limit.
    const requestedMax = readPositiveInt(rawBody.max_tokens ?? rawBody.max_completion_tokens);
    const programCap = program.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS;
    const maxOutputTokens = Math.min(requestedMax ?? programCap, programCap);

    const promptText = flattenMessages(rawBody.messages);

    if (program.maxInputTokens !== null) {
      // Rough char-based guard, intentionally generous — the authoritative
      // input accounting happens at settle time from the provider's counts.
      const approxInputTokens = Math.ceil(promptText.length / 4);
      if (approxInputTokens > program.maxInputTokens) {
        throw new GatewayDeniedError({
          code: "input_too_large",
          message: `Prompt is approximately ${approxInputTokens} tokens, above this program's limit of ${program.maxInputTokens}.`,
          httpStatus: 413,
        });
      }
    }

    const maxCostNano = await pricing.estimateMaxCost(
      model,
      promptText.length,
      maxOutputTokens,
    );

    return {
      model,
      maxOutputTokens,
      promptText,
      maxCostNano,
      body: { ...rawBody, max_tokens: maxOutputTokens },
    };
  }

  private placeHold(
    context: GatewayContext,
    maxCostNano: number,
    model: string,
  ): HoldReceipt {
    try {
      return this.ledger.hold(context.participant.id, maxCostNano, {
        refType: "inference",
        note: `hold for ${model}`,
      });
    } catch (error) {
      if (error instanceof InsufficientCreditsError) {
        // 402 mirrors what an upstream provider returns when a balance is
        // exhausted, so OpenAI-compatible clients handle it without special
        // casing. The message states the shortfall in dollars rather than
        // nano-USD because a participant has to act on it.
        throw new GatewayDeniedError({
          code: "insufficient_credits",
          message:
            `This request needs up to ${nanoToUsd(error.requiredNano).toFixed(6)} USD of credit ` +
            `but only ${nanoToUsd(error.availableNano).toFixed(6)} USD remains. ` +
            `Raising your disclosure tier increases your allocation.`,
          httpStatus: 402,
        });
      }
      throw error;
    }
  }

  private available(participantId: string): number {
    return this.ledger.getBalance(participantId)?.availableNano ?? 0;
  }

  // ── Recording ────────────────────────────────────────────────────────────

  /**
   * Persist one inference record and one audit record.
   *
   * Content handling is the important part: `fieldsPersistedAt(tier)` decides
   * what may be written, redaction runs before any excerpt is taken, and
   * digests are computed over the redacted text so a digest can never be used
   * to confirm a guessed secret.
   */
  private async record(
    context: GatewayContext,
    input: {
      prepared: PreparedRequest;
      status: "ok" | "upstream_error" | "denied";
      deniedReason: string | null;
      usage: UpstreamUsage;
      costNano: number;
      rawCostNative: string | null;
      pricingSource: string | null;
      latencyMs: number;
      streamed: boolean;
      provider: string | null;
      trustTier: string | null;
      upstreamRequestId: string | null;
      responseText: string;
    },
    backendId: string,
  ): Promise<string> {
    const tier = context.participant.disclosureTier;
    const allowed = fieldsPersistedAt(tier);

    // Redact first, always — even when nothing will be persisted, so the
    // redaction counters we show the participant are accurate.
    const promptRedaction = redactSecrets(input.prepared.promptText);
    const responseRedaction = redactSecrets(input.responseText);
    const redactionCount = promptRedaction.count + responseRedaction.count;
    const redactionCategories = [
      ...new Set([...promptRedaction.categories, ...responseRedaction.categories]),
    ].sort();

    let promptExcerpt: string | null = null;
    let responseExcerpt: string | null = null;
    if (allowed.excerpts) {
      promptExcerpt = redactedExcerpt(input.prepared.promptText, EXCERPT_MAX_CHARS).excerpt;
      responseExcerpt = redactedExcerpt(input.responseText, EXCERPT_MAX_CHARS).excerpt;
    }

    // Computed once, shared by the record, the metric, and the HydraDB ingest.
    const taskClass = allowed.taskClass ? classifyTask(promptRedaction.text) : null;
    const projectTag = allowed.projectTag ? context.participant.projectTag : null;
    const teeVerified = input.trustTier === "private" || input.trustTier === "verified";

    const recordId = this.records.insert({
      programId: context.program.id,
      participantId: context.participant.id,
      workspaceId: context.program.workspaceId,
      disclosureTier: tier,
      backend: backendId,
      provider: input.provider,
      model: input.prepared.model,
      status: input.status,
      deniedReason: input.deniedReason,
      inputTokens: input.usage.inputTokens,
      outputTokens: input.usage.outputTokens,
      cachedTokens: input.usage.cachedTokens,
      costNano: input.costNano,
      rawCostNative: input.rawCostNative,
      pricingSource: input.pricingSource,
      latencyMs: input.latencyMs,
      streamed: input.streamed,
      trustTier: input.trustTier,
      teeVerified,
      upstreamRequestId: input.upstreamRequestId,
      promptDigest: allowed.promptDigest ? sha256(promptRedaction.text) : null,
      responseDigest: allowed.responseDigest ? sha256(responseRedaction.text) : null,
      redactionCount,
      redactionCategories,
      taskClass,
      projectTag,
      promptExcerpt,
      responseExcerpt,
    });

    // One metric per request, from the same funnel that writes the record — so
    // SigNoz and the ledger always tell the same story.
    recordGatewayInference({
      status: input.status,
      backend: backendId,
      model: input.prepared.model,
      programId: context.program.id,
      disclosureTier: tier,
      provider: input.provider,
      inputTokens: input.usage.inputTokens,
      outputTokens: input.usage.outputTokens,
      costUsd: nanoToUsd(input.costNano),
      latencyMs: input.latencyMs,
      streamed: input.streamed,
    });

    // Mirror the sponsor projection into HydraDB for cross-source retrieval
    // ("how did the $1000 get spent, per participant, per model"). Fire and
    // forget — the request must never block on an external store — and the
    // ingest is tier-gated: private-tier calls are skipped, and content is
    // exactly the sponsor view, so the retrieval store is never richer than
    // the dashboard.
    if (tierAtLeast(tier, "standard")) {
      void hydraDbIngestion
        .ingestInferenceRecord({
          recordId,
          programId: context.program.id,
          programName: context.program.name,
          workspaceId: context.program.workspaceId,
          participantHandle: context.participant.handle,
          backend: backendId,
          provider: input.provider,
          model: input.prepared.model,
          status: input.status,
          deniedReason: input.deniedReason,
          inputTokens: input.usage.inputTokens,
          outputTokens: input.usage.outputTokens,
          cachedTokens: input.usage.cachedTokens,
          costUsd: nanoToUsd(input.costNano),
          latencyMs: input.latencyMs,
          streamed: input.streamed,
          trustTier: input.trustTier,
          teeVerified,
          disclosureTier: tier,
          taskClass,
          projectTag,
          promptExcerpt,
          responseExcerpt,
          createdAt: new Date().toISOString(),
        })
        .catch((error: unknown) => {
          logger.warn(`[hydradb] inference ingest failed: ${(error as Error).message}`);
        });
    }

    await this.writeAuditRecord(context, input, recordId, backendId);
    return recordId;
  }

  /**
   * One audit record per call, routed through the existing governance audit
   * trail so gateway spend lands in the same evidence store (and the same 0G
   * Storage / Filecoin anchoring) as every other governed action.
   *
   * Never allowed to fail a request: the participant's inference already
   * happened and their credit is already settled, so an anchoring or storage
   * problem is an operational alert, not a client-visible error.
   */
  private async writeAuditRecord(
    context: GatewayContext,
    input: {
      prepared: PreparedRequest;
      status: string;
      deniedReason: string | null;
      usage: UpstreamUsage;
      costNano: number;
      latencyMs: number;
      streamed: boolean;
      provider: string | null;
      trustTier: string | null;
    },
    recordId: string,
    backendId: string,
  ): Promise<void> {
    try {
      const policyVersion = context.program.updatedAt;
      const policyContentHash = hashPolicyContent({
        id: `program:${context.program.id}`,
        version: policyVersion,
        name: context.program.name,
        description: `Sponsored inference constraints for ${context.program.id}`,
        status: context.program.status,
        rules: {
          allowedModels: context.program.allowedModels,
          maxOutputTokens: context.program.maxOutputTokens,
          maxInputTokens: context.program.maxInputTokens,
          disclosureMultipliers: context.program.disclosureMultipliers,
          multipliersMode: context.program.multipliersMode,
          requireTrustMode: context.program.requireTrustMode,
        },
        metadata: { backend: context.program.backend },
      });
      const policyChecks: PolicyCheck[] = [
        {
          policyId: `program:${context.program.id}`,
          result: input.status === "ok",
          reason:
            input.status === "ok"
              ? "within program constraints and credit allocation"
              : (input.deniedReason ?? input.status),
          metadata: {
            allowedModels: context.program.allowedModels,
            maxOutputTokens: input.prepared.maxOutputTokens,
            disclosureTier: context.participant.disclosureTier,
            policyVersion,
            policyContentHash,
          },
        },
      ];

      const action: AgentAction = {
        id: recordId,
        type: "sponsored_inference",
        description:
          `${context.participant.handle} ran ${input.prepared.model} ` +
          `(${input.usage.inputTokens}+${input.usage.outputTokens} tokens, ` +
          `${nanoToUsd(input.costNano).toFixed(6)} USD)`,
        timestamp: new Date().toISOString(),
        policyChecks,
        metadata: {
          workspaceId: context.program.workspaceId,
          agentId: context.participant.handle,
          programId: context.program.id,
          participantId: context.participant.id,
          inferenceRecordId: recordId,
          model: input.prepared.model,
          provider: input.provider,
          trustTier: input.trustTier,
          streamed: input.streamed,
          status: input.status,
          deniedReason: input.deniedReason,
          amountUsd: nanoToUsd(input.costNano),
          disclosureTier: context.participant.disclosureTier,
          durationMs: input.latencyMs,
        },
      };

      const runId = await this.audit.logAction(action, policyChecks, input.status === "ok", {
        projectId: context.program.workspaceId,
        aiUsage: {
          provider: input.provider ?? backendId,
          model: input.prepared.model,
          inputTokens: input.usage.inputTokens,
          outputTokens: input.usage.outputTokens,
          costUsd: nanoToUsd(input.costNano),
          taskClass: "sponsored_inference",
        },
      });

      this.records.setAuditRunId(recordId, runId);
    } catch (error) {
      logger.error(
        `Failed to write audit record for inference ${recordId}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Record a request that was rejected in preflight.
   *
   * Denials are the most operationally interesting events in the trail — "who
   * hit their cap, when, and on which model" is the question an organiser
   * actually asks — so they get a record even though no credit moved.
   */
  async recordDenial(
    context: GatewayContext,
    model: string,
    denial: GatewayDenial,
  ): Promise<string> {
    return this.record(context, {
      prepared: {
        model: model || "unknown",
        maxOutputTokens: 0,
        promptText: "",
        maxCostNano: 0,
        body: {},
      },
      status: "denied",
      deniedReason: denial.code,
      usage: ZERO_USAGE,
      costNano: 0,
      rawCostNative: null,
      pricingSource: null,
      latencyMs: 0,
      streamed: false,
      provider: null,
      trustTier: null,
      upstreamRequestId: null,
      responseText: "",
    }, this.backendOverride?.id ?? context.program.backend);
  }
}

interface PreparedRequest {
  model: string;
  maxOutputTokens: number;
  promptText: string;
  maxCostNano: number;
  body: Record<string, unknown>;
}

function readPositiveInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return Math.floor(value);
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

let shared: InferenceGatewayService | null = null;
export function sharedInferenceGatewayService(): InferenceGatewayService {
  if (!shared) shared = new InferenceGatewayService();
  return shared;
}
