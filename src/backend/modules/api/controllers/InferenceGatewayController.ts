/**
 * InferenceGatewayController — the OpenAI-compatible ingress.
 *
 * Mounted at `/v1` OUTSIDE the `/api` router, so it never sees
 * `apiKeyMiddleware`, `authMiddleware`, or `workspaceMiddleware`. Participants
 * authenticate with a `cvk_` gateway key in the standard
 * `Authorization: Bearer` header, which is what lets them point an unmodified
 * OpenAI SDK at this base URL.
 *
 * Error bodies use OpenAI's `{error:{message,type,code}}` envelope rather than
 * Cognivern's `{success,error}` shape. That is deliberate: every OpenAI client
 * library parses the former, and a participant should not have to write
 * special-case handling to discover they ran out of credit.
 */

import type { Request, Response } from "express";
import logger from "@backend/utils/logger.js";
import {
  GatewayDeniedError,
  sharedInferenceGatewayService,
  type GatewayContext,
  type InferenceGatewayService,
} from "@backend/services/inference/InferenceGatewayService.js";
import { sharedCreditLedgerService } from "@backend/services/credits/CreditLedgerService.js";
import { sharedCreditProgramService } from "@backend/services/credits/CreditProgramService.js";
import {
  projectForParticipant,
  projectForSponsor,
  sharedInferenceRecordStore,
} from "@backend/services/credits/InferenceRecordStore.js";
import { sharedLedgerCommitmentService } from "@backend/services/credits/LedgerCommitmentService.js";
import { nanoToUsd } from "@backend/services/credits/money.js";
import {
  DISCLOSURE_TIERS,
  describeTiers,
  isDisclosureTier,
} from "@backend/services/credits/disclosure.js";

export class InferenceGatewayController {
  constructor(
    private readonly gateway: InferenceGatewayService = sharedInferenceGatewayService(),
  ) {}

  /** POST /v1/chat/completions */
  async chatCompletions(req: Request, res: Response): Promise<void> {
    const context = this.authenticate(req, res);
    if (!context) return;

    const body = req.body as Record<string, unknown>;
    if (!body || typeof body !== "object") {
      sendError(res, 400, "invalid_request_error", "invalid_body", "Request body must be a JSON object.");
      return;
    }

    const wantsStream = body.stream === true;

    try {
      if (wantsStream) {
        await this.relayStream(context, body, res);
        return;
      }

      const outcome = await this.gateway.chatCompletion(context, body);

      // Surface metering on every response so a participant can watch their
      // balance without a second API call. Headers, not body, so the payload
      // stays byte-compatible with OpenAI's schema.
      res.setHeader("X-Cognivern-Cost-Usd", outcome.costUsd.toFixed(9));
      res.setHeader("X-Cognivern-Remaining-Usd", outcome.remainingUsd.toFixed(6));
      res.setHeader("X-Cognivern-Record-Id", outcome.recordId);

      res.status(outcome.httpStatus).json(outcome.body);
    } catch (error) {
      await this.handleError(error, context, body, res);
    }
  }

  /**
   * GET /v1/models
   *
   * Relays the backend catalog so `client.models.list()` works. Filtered to the
   * program's allowlist when one is set — a participant should not see models
   * they will be denied for using.
   */
  async models(req: Request, res: Response): Promise<void> {
    const context = this.authenticate(req, res);
    if (!context) return;

    try {
      const all = await this.gateway.listModels(context.program);
      const allowlist = context.program.allowedModels;

      const data =
        allowlist.length === 0
          ? all
          : all.filter((entry) => {
              const id = (entry as Record<string, unknown> | null)?.id;
              return typeof id === "string" && allowlist.includes(id);
            });

      res.json({ object: "list", data });
    } catch (error) {
      logger.error(`Gateway /v1/models failed: ${(error as Error).message}`);
      sendError(res, 502, "server_error", "catalog_unavailable", "Model catalog is unavailable.");
    }
  }

  /**
   * GET /v1/credits
   *
   * Participant self-service: balance, disclosure tier, and the tier options
   * with what each one unlocks. Not part of the OpenAI surface, but it lives
   * here because it uses the same gateway key — a participant should not need a
   * dashboard login to answer "how much do I have left".
   */
  async credits(req: Request, res: Response): Promise<void> {
    const context = this.authenticate(req, res);
    if (!context) return;

    const balance = sharedCreditLedgerService().getBalance(context.participant.id);
    if (!balance) {
      sendError(res, 404, "invalid_request_error", "no_balance", "No balance found for this key.");
      return;
    }

    res.json({
      participant: {
        handle: context.participant.handle,
        projectTag: context.participant.projectTag,
        disclosureTier: context.participant.disclosureTier,
        status: context.participant.status,
      },
      program: {
        id: context.program.id,
        name: context.program.name,
        sponsor: context.program.sponsorName,
        status: context.program.status,
        startsAt: context.program.startsAt,
        endsAt: context.program.endsAt,
        allowedModels: context.program.allowedModels,
        backend: context.program.backend,
      },
      balance: {
        allocatedUsd: nanoToUsd(balance.allocatedNano),
        consumedUsd: nanoToUsd(balance.consumedNano),
        reservedUsd: nanoToUsd(balance.heldNano),
        availableUsd: nanoToUsd(balance.availableNano),
        requestCount: balance.requestCount,
      },
      disclosureOptions: describeTiers(context.program.disclosureMultipliers).map((tier) => ({
        ...tier,
        allocationUsd: nanoToUsd(
          Math.floor(context.participant.baseAllocationNano * tier.multiplier),
        ),
        current: tier.tier === context.participant.disclosureTier,
      })),
    });
  }

  /**
   * GET /v1/credits/verification
   *
   * The participant's own verifiability receipt: their balance state, the leaf
   * hash over it, the Merkle inclusion proof, and the anchored root. Anyone
   * they hand this to can independently verify it against the root — which is
   * retrievable from the 0G/Filecoin anchor — without trusting this server.
   */
  async verification(req: Request, res: Response): Promise<void> {
    const context = this.authenticate(req, res);
    if (!context) return;

    const receipt = sharedLedgerCommitmentService().receipt(
      context.program.id,
      context.participant.id,
    );
    if (!receipt) {
      sendError(
        res,
        404,
        "invalid_request_error",
        "no_commitment",
        "No anchored commitment exists for this program yet.",
      );
      return;
    }

    res.json({
      participant: {
        handle: context.participant.handle,
        programId: context.program.id,
      },
      commitment: receipt.commitment,
      state: receipt.state,
      proof: receipt.proof,
      // What a verifier must do: recompute root from leaf+index+path and
      // compare with commitment.commitmentRoot, then check that root against
      // the 0G/Filecoin anchors (offline, no Cognivern involved).
      verifyHint: {
        endpoint: "POST /verify/credit-commitment",
        body: {
          root: receipt.commitment.commitmentRoot,
          leaf: receipt.proof.leaf,
          index: receipt.proof.index,
          path: receipt.proof.path,
        },
      },
    });
  }

  /**
   * PUT /v1/credits/disclosure
   *
   * The participant changes their own tier. There is deliberately no
   * sponsor-side equivalent: an organiser who could set someone's disclosure
   * level has not obtained consent, they have issued an instruction. The budget
   * change is a consequence of the participant's choice, not a lever for the
   * person holding the money.
   */
  async setDisclosure(req: Request, res: Response): Promise<void> {
    const context = this.authenticate(req, res);
    if (!context) return;

    const tier = (req.body as Record<string, unknown>)?.tier;
    if (!isDisclosureTier(tier)) {
      sendError(
        res,
        400,
        "invalid_request_error",
        "invalid_tier",
        `'tier' must be one of: ${DISCLOSURE_TIERS.join(", ")}.`,
      );
      return;
    }

    try {
      const { participant, previousTier } = sharedCreditProgramService().setDisclosureTier(
        context.participant.id,
        tier,
      );
      const balance = sharedCreditLedgerService().getBalance(participant.id);

      res.json({
        previousTier,
        currentTier: participant.disclosureTier,
        allocationUsd: nanoToUsd(participant.allocatedNano),
        availableUsd: nanoToUsd(balance?.availableNano ?? 0),
        // Stated explicitly because it is the most surprising property of the
        // design and the one most likely to be assumed otherwise.
        note: "Raising your tier applies to future calls only. Calls already made keep the disclosure level they were made under.",
      });
    } catch (error) {
      logger.error(`Failed to change disclosure tier: ${(error as Error).message}`);
      sendError(res, 500, "server_error", "tier_change_failed", "Could not change disclosure tier.");
    }
  }

  /**
   * GET /v1/credits/activity
   *
   * The transparency endpoint. Returns, for each of the participant's own
   * calls, both what we hold (`youSee`) and the exact projection a sponsor or
   * judge receives (`sponsorSees`, null when the tier withholds the row).
   *
   * Showing both side by side is the whole point: a claim that we only share
   * billing metadata is worth little if the participant has to take it on
   * faith. Here they can diff it themselves.
   */
  async activity(req: Request, res: Response): Promise<void> {
    const context = this.authenticate(req, res);
    if (!context) return;

    const store = sharedInferenceRecordStore();
    const rows = store.listForParticipant(context.participant.id, {
      limit: readInt(req.query.limit) ?? 50,
      offset: readInt(req.query.offset) ?? 0,
    });

    const calls = rows.map((row) => ({
      youSee: projectForParticipant(row),
      sponsorSees: projectForSponsor(row),
    }));

    res.json({
      participant: context.participant.handle,
      disclosureTier: context.participant.disclosureTier,
      summary: store.participantSummary(context.participant.id),
      withheldFromSponsor: calls.filter((c) => c.sponsorSees === null).length,
      calls,
      explanation: {
        storage:
          "Fields your tier does not permit are never written to the database — they are not stored and filtered later.",
        redaction:
          "API keys, tokens, private keys and passwords are stripped from any recorded text at every tier, before storage.",
        digests:
          "Content digests are computed over the already-redacted text, so a digest cannot be used to confirm a guessed secret.",
      },
    });
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private authenticate(req: Request, res: Response): GatewayContext | null {
    if (!this.gateway.isConfigured()) {
      sendError(
        res,
        503,
        "server_error",
        "backend_not_configured",
        `Inference backend '${this.gateway.backendId}' is not configured on this server.`,
      );
      return null;
    }

    const header = req.headers.authorization;
    const bearer = header?.startsWith("Bearer ") ? header.slice(7).trim() : undefined;
    // Accept x-api-key too: some OpenAI-compatible tools send it instead.
    const key = bearer || (req.headers["x-api-key"] as string | undefined);

    const context = this.gateway.authorize(key);
    if (!context) {
      sendError(
        res,
        401,
        "invalid_request_error",
        "invalid_api_key",
        "Invalid, revoked, or missing gateway key.",
      );
      return null;
    }

    return context;
  }

  /**
   * Relay an SSE stream to the client, then settle the ledger.
   *
   * `finalize()` runs in a `finally` so the charge lands even if the client
   * disconnects mid-stream — the provider generated (and charged us for) those
   * tokens regardless of whether anyone was still listening.
   */
  private async relayStream(
    context: GatewayContext,
    body: Record<string, unknown>,
    res: Response,
  ): Promise<void> {
    const stream = await this.gateway.chatCompletionStream(context, body);

    if (!stream.ok) {
      await stream.finalize();
      res.status(stream.httpStatus).json(stream.errorBody ?? {
        error: { message: "Upstream provider error", type: "server_error" },
      });
      return;
    }

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    // Defeats proxy buffering, which otherwise makes streaming look broken.
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    try {
      for await (const chunk of stream.chunks) {
        // Stop pushing into a dead socket rather than buffering forever.
        if (res.writableEnded || res.destroyed) break;
        res.write(chunk);
      }
    } catch (error) {
      logger.warn(`Stream relay interrupted: ${(error as Error).message}`);
    } finally {
      try {
        const outcome = await stream.finalize();
        // Trailers rather than headers: the response has already begun, so this
        // is the only way to report cost without corrupting the SSE body.
        res.addTrailers?.({
          "X-Cognivern-Cost-Usd": outcome.costUsd.toFixed(9),
          "X-Cognivern-Remaining-Usd": outcome.remainingUsd.toFixed(6),
        });
      } catch (error) {
        logger.error(`Failed to settle streamed request: ${(error as Error).message}`);
      }
      if (!res.writableEnded) res.end();
    }
  }

  private async handleError(
    error: unknown,
    context: GatewayContext,
    body: Record<string, unknown>,
    res: Response,
  ): Promise<void> {
    if (error instanceof GatewayDeniedError) {
      const { denial } = error;

      // Record the denial before responding: "who hit their cap and when" is
      // one of the more useful things in the trail, and it is lost if we only
      // log successes.
      try {
        await this.gateway.recordDenial(
          context,
          typeof body.model === "string" ? body.model : "unknown",
          denial,
        );
      } catch (recordError) {
        logger.error(`Failed to record denial: ${(recordError as Error).message}`);
      }

      sendError(
        res,
        denial.httpStatus,
        denial.httpStatus === 402 ? "insufficient_quota" : "invalid_request_error",
        denial.code,
        denial.message,
      );
      return;
    }

    logger.error(`Gateway request failed: ${(error as Error).message}`);
    sendError(
      res,
      502,
      "server_error",
      "gateway_error",
      "The inference gateway could not complete this request.",
    );
  }
}

/** OpenAI-shaped error envelope, so standard client libraries parse it. */
function sendError(
  res: Response,
  status: number,
  type: string,
  code: string,
  message: string,
): void {
  res.status(status).json({ error: { message, type, code, param: null } });
}

function readInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : null;
}
