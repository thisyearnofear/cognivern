/**
 * CreditProgramController — sponsor/organiser side of sponsored credits.
 *
 * Mounted under `/api`, so it inherits the normal workspace auth stack. Every
 * handler re-checks that the addressed program belongs to `req.workspaceId`;
 * without that, a valid key for workspace A could read workspace B's cohort by
 * guessing a program id.
 *
 * The reporting endpoints are deliberately projection-aware. A sponsor never
 * gets raw rows — they get `projectForSponsor` output plus an explicit count of
 * what was withheld, so a partial picture is legible as a partial picture rather
 * than mistaken for the whole.
 */

import type { Request, Response } from "express";
import logger from "@backend/utils/logger.js";
import {
  sharedCreditProgramService,
  type CreditProgramService,
  type ProgramStatus,
} from "@backend/services/credits/CreditProgramService.js";
import {
  sharedCreditLedgerService,
  type CreditLedgerService,
} from "@backend/services/credits/CreditLedgerService.js";
import {
  projectForSponsor,
  sharedInferenceRecordStore,
  type InferenceRecordStore,
} from "@backend/services/credits/InferenceRecordStore.js";
import { nanoToUsd } from "@backend/services/credits/money.js";
import { describeTiers, isDisclosureTier } from "@backend/services/credits/disclosure.js";
import { buildFundingView, type UpstreamStatus } from "@backend/services/credits/funding.js";
import {
  sharedLedgerCommitmentService,
  type CommitmentRow,
  type LedgerCommitmentService,
} from "@backend/services/credits/LedgerCommitmentService.js";
import { verifyMerkleProof } from "@backend/services/credits/commitment.js";
import { resolveBackend } from "@backend/services/inference/backendRegistry.js";

const PROGRAM_STATUSES: ProgramStatus[] = ["draft", "active", "paused", "closed"];

export class CreditProgramController {
  constructor(
    private readonly programs: CreditProgramService = sharedCreditProgramService(),
    private readonly ledger: CreditLedgerService = sharedCreditLedgerService(),
    private readonly records: InferenceRecordStore = sharedInferenceRecordStore(),
    private readonly commitments: LedgerCommitmentService = sharedLedgerCommitmentService(),
  ) {}

  // ── Programs ─────────────────────────────────────────────────────────────

  async create(req: Request, res: Response): Promise<void> {
    const workspaceId = req.workspaceId;
    if (!workspaceId) return unauthorized(res);

    const body = (req.body ?? {}) as Record<string, unknown>;
    const baseAllocationUsd = Number(body.baseAllocationUsd);

    if (!Number.isFinite(baseAllocationUsd) || baseAllocationUsd <= 0) {
      return badRequest(res, "baseAllocationUsd must be a positive number");
    }
    if (typeof body.name !== "string" || body.name.trim().length === 0) {
      return badRequest(res, "name is required");
    }

    try {
      const program = this.programs.createProgram({
        workspaceId,
        name: body.name,
        sponsorName: typeof body.sponsorName === "string" ? body.sponsorName : undefined,
        backend: typeof body.backend === "string" ? body.backend : undefined,
        poolUsd: Number.isFinite(Number(body.poolUsd)) ? Number(body.poolUsd) : 0,
        baseAllocationUsd,
        allowedModels: Array.isArray(body.allowedModels)
          ? body.allowedModels.filter((m): m is string => typeof m === "string")
          : [],
        maxOutputTokens: readNullableInt(body.maxOutputTokens),
        maxInputTokens: readNullableInt(body.maxInputTokens),
        startsAt: readNullableString(body.startsAt),
        endsAt: readNullableString(body.endsAt),
        requireTrustMode: readNullableString(body.requireTrustMode),
        disclosureMultipliers: readMultipliers(body.disclosureMultipliers),
        multipliersMode:
          body.multipliersMode === "ceiling" || body.multipliersMode === "bonus"
            ? body.multipliersMode
            : undefined,
        status: PROGRAM_STATUSES.includes(body.status as ProgramStatus)
          ? (body.status as ProgramStatus)
          : "draft",
      });

      res.status(201).json({ success: true, data: { program: serialiseProgram(program) } });
    } catch (error) {
      logger.error(`Failed to create credit program: ${(error as Error).message}`);
      badRequest(res, (error as Error).message);
    }
  }

  async list(req: Request, res: Response): Promise<void> {
    const workspaceId = req.workspaceId;
    if (!workspaceId) return unauthorized(res);

    const programs = this.programs.listPrograms(workspaceId).map((program) => ({
      ...serialiseProgram(program),
      totals: serialiseTotals(this.ledger.programTotals(program.id)),
    }));

    res.json({ success: true, data: { programs } });
  }

  async get(req: Request, res: Response): Promise<void> {
    const program = this.requireProgram(req, res);
    if (!program) return;

    res.json({
      success: true,
      data: {
        program: serialiseProgram(program),
        totals: serialiseTotals(this.ledger.programTotals(program.id)),
        disclosureTiers: describeTiers(program.disclosureMultipliers),
      },
    });
  }

  async update(req: Request, res: Response): Promise<void> {
    const program = this.requireProgram(req, res);
    if (!program) return;

    const body = (req.body ?? {}) as Record<string, unknown>;
    if (body.status !== undefined && !PROGRAM_STATUSES.includes(body.status as ProgramStatus)) {
      return badRequest(res, `status must be one of: ${PROGRAM_STATUSES.join(", ")}`);
    }

    try {
      const updated = this.programs.updateProgram(program.id, {
        name: typeof body.name === "string" ? body.name : undefined,
        sponsorName: typeof body.sponsorName === "string" ? body.sponsorName : undefined,
        status: body.status as ProgramStatus | undefined,
        allowedModels: Array.isArray(body.allowedModels)
          ? body.allowedModels.filter((m): m is string => typeof m === "string")
          : undefined,
        maxOutputTokens: body.maxOutputTokens === undefined ? undefined : readNullableInt(body.maxOutputTokens),
        maxInputTokens: body.maxInputTokens === undefined ? undefined : readNullableInt(body.maxInputTokens),
        startsAt: body.startsAt === undefined ? undefined : readNullableString(body.startsAt),
        endsAt: body.endsAt === undefined ? undefined : readNullableString(body.endsAt),
        requireTrustMode:
          body.requireTrustMode === undefined ? undefined : readNullableString(body.requireTrustMode),
        multipliersMode:
          body.multipliersMode === "ceiling" || body.multipliersMode === "bonus"
            ? body.multipliersMode
            : undefined,
        poolUsd: Number.isFinite(Number(body.poolUsd)) ? Number(body.poolUsd) : undefined,
      });

      // Closing freezes the books: anchor a final commitment so the balance
      // state at close is externally provable. Best-effort and non-blocking.
      if (updated.status === "closed") {
        void this.commitments.anchor(updated.id).catch(() => {});
      }

      res.json({ success: true, data: { program: serialiseProgram(updated) } });
    } catch (error) {
      badRequest(res, (error as Error).message);
    }
  }

  // ── Ledger commitments (verifiable anchoring) ────────────────────────────

  /**
   * GET /api/credit-programs/:programId/commitments
   *
   * The anchored-commitment history. Each row is a Merkle root over every
   * participant's balance at a point in time, with the 0G/Filecoin anchors
   * that make it externally verifiable. Status is 'anchored' when at least one
   * store accepted the payload, 'pending' otherwise.
   */
  async listCommitments(req: Request, res: Response): Promise<void> {
    const program = this.requireProgram(req, res);
    if (!program) return;
    res.json({
      success: true,
      data: { commitments: this.commitments.list(program.id).map(serialiseCommitment) },
    });
  }

  /**
   * POST /api/credit-programs/:programId/commitments
   *
   * Anchor now — the manual trigger for "freeze the books before judging".
   * Also fires automatically on close and on a background interval while the
   * program is active.
   */
  async anchorNow(req: Request, res: Response): Promise<void> {
    const program = this.requireProgram(req, res);
    if (!program) return;

    const commitment = await this.commitments.anchor(program.id);
    if (!commitment) {
      return badRequest(res, "Nothing to anchor: program has no participants");
    }
    res.json({ success: true, data: { commitment: serialiseCommitment(commitment) } });
  }

  /**
   * POST /api/verify/credit-commitment — PUBLIC, deliberately outside the auth
   * stack (mounted on the app root in ApiModule, like /ingest/runs).
   *
   * Pure cryptographic check of a receipt against a root: recompute
   * root = f(leaf, index, path) and compare. It discloses nothing and touches
   * no database — the trust lives in the anchored root, which anyone can fetch
   * from 0G/Filecoin, not in this server.
   */
  async verifyCommitment(req: Request, res: Response): Promise<void> {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const root = typeof body.root === "string" ? body.root : null;
    const leaf = typeof body.leaf === "string" ? body.leaf : null;
    const index = Number(body.index);
    const path = Array.isArray(body.path)
      ? body.path.filter((p): p is string => typeof p === "string")
      : [];

    if (!root || !leaf || !Number.isInteger(index) || index < 0 || path.length === 0) {
      return badRequest(
        res,
        "root, leaf, index and a non-empty path are required to verify a commitment",
      );
    }

    res.json({
      success: true,
      data: { valid: verifyMerkleProof(root, leaf, index, path), root },
    });
  }

  /**
   * GET /verify/credit-commitment/:id — PUBLIC, the GET sibling of the POST
   * above. Powers the shareable verification page: the aggregate metadata
   * behind one anchored commitment (program name, timestamp, participant
   * count, root, anchor references). Deliberately excludes all
   * per-participant content — leaf data is only ever disclosed by its owner.
   */
  async getPublicCommitment(req: Request, res: Response): Promise<void> {
    const commitment = this.commitments.get(req.params.id);
    if (!commitment) return notFound(res, "Commitment not found");

    const program = this.programs.getProgram(commitment.programId);
    res.json({
      success: true,
      data: {
        commitment: {
          ...serialiseCommitment(commitment),
          highWaterMarkUsd:
            commitment.highWaterMark !== null && Number.isFinite(Number(commitment.highWaterMark))
              ? nanoToUsd(Number(commitment.highWaterMark))
              : null,
          program: program
            ? { name: program.name, sponsorName: program.sponsorName, status: program.status }
            : null,
        },
      },
    });
  }

  // ── Participants ─────────────────────────────────────────────────────────

  /**
   * POST /api/credit-programs/:programId/participants
   *
   * Bulk provisioning. Accepts either a list of objects or a list of bare
   * handle strings, because the common case really is pasting 50 usernames.
   *
   * The response contains raw keys ONCE. They are not retrievable afterwards —
   * only a scrypt hash is stored — so the caller must capture them here.
   */
  async provisionParticipants(req: Request, res: Response): Promise<void> {
    const program = this.requireProgram(req, res);
    if (!program) return;

    const raw = (req.body ?? {}) as Record<string, unknown>;
    const list = Array.isArray(raw.participants) ? raw.participants : null;
    if (!list || list.length === 0) {
      return badRequest(res, "participants must be a non-empty array");
    }
    if (list.length > 500) {
      return badRequest(res, "provision at most 500 participants per request");
    }

    const entries: Array<{
      handle: string;
      displayName?: string;
      projectTag?: string;
      disclosureTier?: "private" | "standard" | "detailed" | "open";
      baseAllocationUsd?: number;
    }> = [];

    for (const item of list) {
      if (typeof item === "string") {
        entries.push({ handle: item });
        continue;
      }
      if (!item || typeof item !== "object") {
        return badRequest(res, "each participant must be a string handle or an object");
      }

      const obj = item as Record<string, unknown>;
      if (typeof obj.handle !== "string" || obj.handle.trim().length === 0) {
        return badRequest(res, "each participant needs a non-empty 'handle'");
      }
      if (obj.disclosureTier !== undefined && !isDisclosureTier(obj.disclosureTier)) {
        return badRequest(res, `invalid disclosureTier for '${obj.handle}'`);
      }

      entries.push({
        handle: obj.handle,
        displayName: typeof obj.displayName === "string" ? obj.displayName : undefined,
        projectTag: typeof obj.projectTag === "string" ? obj.projectTag : undefined,
        disclosureTier: isDisclosureTier(obj.disclosureTier) ? obj.disclosureTier : undefined,
        baseAllocationUsd: Number.isFinite(Number(obj.baseAllocationUsd))
          ? Number(obj.baseAllocationUsd)
          : undefined,
      });
    }

    try {
      const provisioned = this.programs.provisionParticipants(program.id, entries);

      res.status(201).json({
        success: true,
        data: {
          warning:
            "Gateway keys are shown once and cannot be retrieved later. Distribute them now; use the rotate endpoint if one is lost.",
          participants: provisioned.map(({ participant, key }) => ({
            id: participant.id,
            handle: participant.handle,
            disclosureTier: participant.disclosureTier,
            allocationUsd: nanoToUsd(participant.allocatedNano),
            gatewayKey: key,
          })),
        },
      });
    } catch (error) {
      logger.error(`Provisioning failed for program ${program.id}: ${(error as Error).message}`);
      badRequest(res, (error as Error).message);
    }
  }

  async listParticipants(req: Request, res: Response): Promise<void> {
    const program = this.requireProgram(req, res);
    if (!program) return;

    const participants = this.programs.listParticipants(program.id).map((participant) => ({
      id: participant.id,
      handle: participant.handle,
      displayName: participant.displayName,
      projectTag: participant.projectTag,
      disclosureTier: participant.disclosureTier,
      status: participant.status,
      keyPrefix: participant.keyPrefix,
      lastUsedAt: participant.lastUsedAt,
      allocationUsd: nanoToUsd(participant.allocatedNano),
      consumedUsd: nanoToUsd(participant.consumedNano),
      reservedUsd: nanoToUsd(participant.heldNano),
      availableUsd: nanoToUsd(
        Math.max(0, participant.allocatedNano - participant.heldNano - participant.consumedNano),
      ),
      overdrawnUsd: nanoToUsd(participant.overdrawnNano),
      usage: this.records.participantSummary(participant.id),
    }));

    res.json({ success: true, data: { participants } });
  }

  async rotateParticipantKey(req: Request, res: Response): Promise<void> {
    const program = this.requireProgram(req, res);
    if (!program) return;

    const participant = this.programs.getParticipant(req.params.participantId);
    if (!participant || participant.programId !== program.id) {
      return notFound(res, "Participant not found in this program");
    }

    try {
      const key = this.programs.rotateKey(participant.id);
      res.json({
        success: true,
        data: {
          handle: participant.handle,
          gatewayKey: key,
          warning: "The previous key is now invalid. This key is shown once.",
        },
      });
    } catch (error) {
      badRequest(res, (error as Error).message);
    }
  }

  async setParticipantStatus(req: Request, res: Response): Promise<void> {
    const program = this.requireProgram(req, res);
    if (!program) return;

    const participant = this.programs.getParticipant(req.params.participantId);
    if (!participant || participant.programId !== program.id) {
      return notFound(res, "Participant not found in this program");
    }

    const status = (req.body as Record<string, unknown>)?.status;
    if (status !== "active" && status !== "suspended" && status !== "revoked") {
      return badRequest(res, "status must be one of: active, suspended, revoked");
    }

    this.programs.setParticipantStatus(participant.id, status);
    res.json({ success: true, data: { handle: participant.handle, status } });
  }

  /**
   * PATCH /api/credit-programs/:programId/participants/:participantId/allocation
   *
   * Top up (or reduce) one participant's base allocation. Their disclosure tier
   * multiplier still applies, so this changes the base rather than the final
   * spendable figure.
   */
  async setParticipantAllocation(req: Request, res: Response): Promise<void> {
    const program = this.requireProgram(req, res);
    if (!program) return;

    const participant = this.programs.getParticipant(req.params.participantId);
    if (!participant || participant.programId !== program.id) {
      return notFound(res, "Participant not found in this program");
    }

    const baseAllocationUsd = Number((req.body as Record<string, unknown>)?.baseAllocationUsd);
    if (!Number.isFinite(baseAllocationUsd) || baseAllocationUsd < 0) {
      return badRequest(res, "baseAllocationUsd must be a non-negative number");
    }

    try {
      const updated = this.programs.setBaseAllocation(participant.id, baseAllocationUsd);
      res.json({
        success: true,
        data: {
          handle: updated.handle,
          disclosureTier: updated.disclosureTier,
          baseAllocationUsd: nanoToUsd(updated.baseAllocationNano),
          allocationUsd: nanoToUsd(updated.allocatedNano),
          consumedUsd: nanoToUsd(updated.consumedNano),
          availableUsd: nanoToUsd(
            Math.max(0, updated.allocatedNano - updated.heldNano - updated.consumedNano),
          ),
        },
      });
    } catch (error) {
      badRequest(res, (error as Error).message);
    }
  }

  /**
   * POST /api/credit-programs/:programId/top-up
   *
   * Add the same amount to every active participant — the mid-event "everyone
   * is running low" action. All-or-nothing.
   */
  async topUp(req: Request, res: Response): Promise<void> {
    const program = this.requireProgram(req, res);
    if (!program) return;

    const additionalUsd = Number((req.body as Record<string, unknown>)?.additionalUsd);
    if (!Number.isFinite(additionalUsd) || additionalUsd <= 0) {
      return badRequest(res, "additionalUsd must be a positive number");
    }

    try {
      const { toppedUp, participants } = this.programs.topUpAll(program.id, additionalUsd);
      res.json({
        success: true,
        data: {
          toppedUp,
          additionalBaseUsd: additionalUsd,
          totals: serialiseTotals(this.ledger.programTotals(program.id)),
          participants: participants.map((p) => ({
            handle: p.handle,
            disclosureTier: p.disclosureTier,
            baseAllocationUsd: nanoToUsd(p.baseAllocationNano),
            allocationUsd: nanoToUsd(p.allocatedNano),
          })),
          note: "Each participant's disclosure multiplier is applied to the new base, so participants on higher tiers gain proportionally more.",
        },
      });
    } catch (error) {
      badRequest(res, (error as Error).message);
    }
  }

  async participantLedger(req: Request, res: Response): Promise<void> {
    const program = this.requireProgram(req, res);
    if (!program) return;

    const participant = this.programs.getParticipant(req.params.participantId);
    if (!participant || participant.programId !== program.id) {
      return notFound(res, "Participant not found in this program");
    }

    res.json({
      success: true,
      data: {
        handle: participant.handle,
        balance: this.ledger.getBalance(participant.id),
        entries: this.ledger.listEntries(participant.id, {
          limit: readInt(req.query.limit) ?? 200,
          offset: readInt(req.query.offset) ?? 0,
        }),
      },
    });
  }

  // ── Reporting ────────────────────────────────────────────────────────────

  /**
   * GET /api/credit-programs/:programId/activity
   *
   * Per-call feed, projected to what this sponsor may see. `withheld` counts the
   * rows suppressed by participants on the `private` tier — reported rather than
   * hidden, so the number is auditable and the sponsor can see the cost of the
   * privacy they offered.
   */
  async activity(req: Request, res: Response): Promise<void> {
    const program = this.requireProgram(req, res);
    if (!program) return;

    const rows = this.records.listForProgram(program.id, {
      limit: readInt(req.query.limit) ?? 100,
      offset: readInt(req.query.offset) ?? 0,
      participantId: typeof req.query.participantId === "string" ? req.query.participantId : undefined,
      model: typeof req.query.model === "string" ? req.query.model : undefined,
    });

    const handles = new Map(
      this.programs.listParticipants(program.id).map((p) => [p.id, p.handle]),
    );

    const visible: Array<Record<string, unknown>> = [];
    let withheld = 0;

    for (const row of rows) {
      const projected = projectForSponsor(row);
      if (!projected) {
        withheld += 1;
        continue;
      }
      visible.push({ ...projected, participant: handles.get(row.participantId) ?? row.participantId });
    }

    res.json({
      success: true,
      data: {
        calls: visible,
        withheld,
        note:
          withheld > 0
            ? `${withheld} call(s) in this window are from participants on the 'private' tier. Their spend appears in totals but not per-call.`
            : undefined,
      },
    });
  }

  /**
   * GET /api/credit-programs/:programId/funding
   *
   * Layer 1 vs Layer 2 money in one frame: the real upstream balance (when the
   * backend exposes one and a management key is configured) next to the ledger
   * pool and the worst-case commitment. Pollable on its own so the dashboard
   * can refresh the funding banner without re-fetching the whole report.
   */
  async funding(req: Request, res: Response): Promise<void> {
    const program = this.requireProgram(req, res);
    if (!program) return;

    const funding = await this.fundingView(program.id);
    res.json({ success: true, data: { funding } });
  }

  /**
   * GET /api/credit-programs/:programId/report
   *
   * The organiser's answer to "what did my money buy". Aggregates are complete
   * across all participants regardless of tier; per-call detail is not, and the
   * `disclosureMix` block makes that ratio explicit.
   */
  async report(req: Request, res: Response): Promise<void> {
    const program = this.requireProgram(req, res);
    if (!program) return;

    const participants = this.programs.listParticipants(program.id);
    const totals = this.ledger.programTotals(program.id);

    const disclosureMix: Record<string, number> = {};
    for (const participant of participants) {
      disclosureMix[participant.disclosureTier] =
        (disclosureMix[participant.disclosureTier] ?? 0) + 1;
    }

    res.json({
      success: true,
      data: {
        program: serialiseProgram(program),
        // Layer 1 (upstream deposit) vs Layer 2 (ledger pool) lives on
        // GET /funding — the single endpoint that touches the provider's
        // balance API. Kept off /report so the ledger view never blocks on
        // (or duplicates) an upstream call.
        totals: {
          ...serialiseTotals(totals),
          poolUsd: nanoToUsd(program.poolNano),
          // Unallocated pool is what the sponsor could still hand out.
          unallocatedUsd: nanoToUsd(Math.max(0, program.poolNano - totals.allocatedNano)),
        },
        disclosureMix,
        byModel: this.records.programModelBreakdown(program.id),
        byTaskClass: this.records.programTaskClassBreakdown(program.id),
        participants: participants
          .map((participant) => ({
            handle: participant.handle,
            projectTag: participant.projectTag,
            disclosureTier: participant.disclosureTier,
            allocationUsd: nanoToUsd(participant.allocatedNano),
            consumedUsd: nanoToUsd(participant.consumedNano),
            utilisation:
              participant.allocatedNano > 0
                ? participant.consumedNano / participant.allocatedNano
                : 0,
            usage: this.records.participantSummary(participant.id),
          }))
          .sort((a, b) => b.consumedUsd - a.consumedUsd),
        caveats: [
          "Task classification is a coarse keyword heuristic. It indicates the shape of work, not whether it was on-topic, and is never used to block a request.",
          "Participants on the 'private' tier contribute to totals only; their per-call activity is not recorded.",
          "Costs are derived from provider-reported token counts, not estimates.",
        ],
      },
    });
  }

  /**
   * GET /api/credit-programs/:programId/reconcile
   *
   * Integrity check: does every participant's denormalised balance still agree
   * with the append-only ledger? Exposed as an endpoint rather than kept
   * internal because a sponsor being able to verify the books is the point.
   */
  async reconcile(req: Request, res: Response): Promise<void> {
    const program = this.requireProgram(req, res);
    if (!program) return;

    const results = this.programs.listParticipants(program.id).map((participant) => ({
      handle: participant.handle,
      ...this.ledger.reconcile(participant.id),
    }));

    const drifted = results.filter((r) => !r.ok);
    res.json({
      success: true,
      data: {
        ok: drifted.length === 0,
        checked: results.length,
        drifted,
      },
    });
  }

  // ── Internals ────────────────────────────────────────────────────────────

  /**
   * Build the funding view for a program by asking its backend for the real
   * upstream balance. Every failure mode degrades to a status the view can
   * render honestly — the report never fails because balance checking does.
   */
  private async fundingView(programId: string) {
    const program = this.programs.getProgram(programId);
    if (!program) {
      return buildFundingView({
        poolNano: 0,
        baseTotalNano: 0,
        allocatedNano: 0,
        multipliers: {},
        upstream: { status: "unavailable", message: "Program not found" },
      });
    }

    const registered = resolveBackend(program.backend);
    let upstream: UpstreamStatus;

    if (!registered || !registered.backend.fetchUpstreamBalance) {
      upstream = {
        status: "not_supported",
        message: `Backend '${program.backend}' does not expose an upstream balance, so the pool cannot be reconciled against real funding.`,
      };
    } else {
      const result = await registered.backend.fetchUpstreamBalance();
      if (result.ok) {
        upstream = {
          status: "ok",
          balanceUsd: result.balance.balanceUsd,
          balanceNative: result.balance.balanceNative,
          nativeUnit: result.balance.nativeUnit,
          fetchedAt: result.balance.fetchedAt,
        };
      } else if (result.code === "not_configured") {
        upstream = { status: "not_configured", message: result.message };
      } else {
        upstream = { status: "unavailable", message: result.message };
      }
    }

    const totals = this.ledger.programTotals(programId);
    return buildFundingView({
      poolNano: program.poolNano,
      baseTotalNano: this.programs.programBaseTotal(programId),
      allocatedNano: totals.allocatedNano,
      multipliers: program.disclosureMultipliers,
      upstream,
    });
  }

  /**
   * Load the program and confirm it belongs to the caller's workspace.
   * Returns 404 (not 403) for a foreign program so the endpoint cannot be used
   * to probe which program ids exist in other workspaces.
   */
  private requireProgram(req: Request, res: Response) {
    const workspaceId = req.workspaceId;
    if (!workspaceId) {
      unauthorized(res);
      return null;
    }

    const program = this.programs.getProgram(req.params.programId);
    if (!program || program.workspaceId !== workspaceId) {
      notFound(res, "Credit program not found");
      return null;
    }
    return program;
  }
}

// ── Serialisation ──────────────────────────────────────────────────────────

function serialiseProgram(program: {
  id: string;
  name: string;
  sponsorName: string;
  status: string;
  backend: string;
  poolNano: number;
  baseAllocationNano: number;
  allowedModels: string[];
  maxOutputTokens: number | null;
  maxInputTokens: number | null;
  startsAt: string | null;
  endsAt: string | null;
  disclosureMultipliers: Partial<Record<string, number>>;
  multipliersMode: string;
  requireTrustMode: string | null;
  createdAt: string;
  updatedAt: string;
}): Record<string, unknown> {
  return {
    id: program.id,
    name: program.name,
    sponsorName: program.sponsorName,
    status: program.status,
    backend: program.backend,
    poolUsd: nanoToUsd(program.poolNano),
    baseAllocationUsd: nanoToUsd(program.baseAllocationNano),
    allowedModels: program.allowedModels,
    maxOutputTokens: program.maxOutputTokens,
    maxInputTokens: program.maxInputTokens,
    startsAt: program.startsAt,
    endsAt: program.endsAt,
    disclosureMultipliers: program.disclosureMultipliers,
    multipliersMode: program.multipliersMode,
    requireTrustMode: program.requireTrustMode,
    createdAt: program.createdAt,
    updatedAt: program.updatedAt,
  };
}

function serialiseTotals(totals: {
  participantCount: number;
  allocatedNano: number;
  consumedNano: number;
  heldNano: number;
  requestCount: number;
}): Record<string, unknown> {
  return {
    participantCount: totals.participantCount,
    allocatedUsd: nanoToUsd(totals.allocatedNano),
    consumedUsd: nanoToUsd(totals.consumedNano),
    reservedUsd: nanoToUsd(totals.heldNano),
    requestCount: totals.requestCount,
  };
}

// ── Response helpers ───────────────────────────────────────────────────────

function unauthorized(res: Response): void {
  res.status(401).json({ success: false, error: "Not authenticated" });
}

function badRequest(res: Response, error: string): void {
  res.status(400).json({ success: false, error });
}

function notFound(res: Response, error: string): void {
  res.status(404).json({ success: false, error });
}

function readInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : null;
}

function readNullableInt(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

function readNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function serialiseCommitment(c: CommitmentRow): Record<string, unknown> {
  return {
    id: c.id,
    programId: c.programId,
    status: c.status,
    commitmentRoot: c.commitmentRoot,
    participantCount: c.participantCount,
    highWaterMark: c.highWaterMark,
    createdAt: c.createdAt,
    anchors: {
      zerogRootHash: c.zerogRootHash,
      zerogTxHash: c.zerogTxHash,
      filecoinCid: c.filecoinCid,
      filecoinTxHash: c.filecoinTxHash,
      filecoinActionId: c.filecoinActionId,
    },
  };
}

function readMultipliers(value: unknown): Record<string, number> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const out: Record<string, number> = {};
  for (const [tier, multiplier] of Object.entries(value as Record<string, unknown>)) {
    if (isDisclosureTier(tier) && Number.isFinite(Number(multiplier))) {
      out[tier] = Number(multiplier);
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
