import type { Request, Response } from "express";
import { z } from "zod";
import {
  OutcomeObservationService,
  type CreateOutcomeObservationInput,
} from "@backend/services/governance/OutcomeObservationService.js";
import { syncMandateOutcomes } from "@backend/services/outcomes/GitHubOutcomeConnector.js";
import { hydraDbMandateContext } from "@backend/services/hydradb/HydraDbMandateContextService.js";

const evidenceSchema = z.object({
  type: z.enum(["url", "artifact", "run", "transaction", "external_record"]),
  reference: z.string().min(1).max(2000),
  hash: z.string().min(1).max(256).optional(),
});

const bodySchema = z.object({
  metricId: z.string().min(1).max(120).optional(),
  kind: z.enum(["observed", "verified_external_state"]),
  value: z.string().min(1).max(500),
  unit: z.string().min(1).max(80),
  observedAt: z.string().datetime(),
  source: z.string().min(1).max(240),
  confidence: z.enum(["self_reported", "system_observed", "independently_verified"]),
  evidence: z.array(evidenceSchema).max(50).optional(),
  notes: z.string().max(4000).optional(),
});

function requireOperator(req: Request, res: Response): string | undefined {
  if (!req.userId || !req.workspaceId) {
    res.status(403).json({
      success: false,
      error: "Operator authentication and workspace context are required.",
    });
    return undefined;
  }
  return req.workspaceId;
}

export class OutcomeObservationController {
  async list(req: Request, res: Response): Promise<void> {
    const workspaceId = requireOperator(req, res);
    if (!workspaceId) return;
    try {
      const observations = OutcomeObservationService.list(
        workspaceId,
        req.params.mandateId,
      );
      res.json({ success: true, data: observations });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Mandate not found";
      res.status(/not found/i.test(message) ? 404 : 400).json({ success: false, error: message });
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    const workspaceId = requireOperator(req, res);
    if (!workspaceId) return;

    const rawKey = req.header("Idempotency-Key") || req.header("X-Idempotency-Key");
    const idempotencyKey = rawKey?.trim().slice(0, 160);
    if (!idempotencyKey) {
      res.status(400).json({
        success: false,
        error: "Idempotency-Key is required for outcome observations.",
      });
      return;
    }

    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: "Invalid outcome observation payload",
        details: parsed.error.format(),
      });
      return;
    }

    try {
      const result = OutcomeObservationService.create(
        workspaceId,
        req.params.mandateId,
        parsed.data as CreateOutcomeObservationInput,
        idempotencyKey,
      );
      if (!result.replayed) {
        void hydraDbMandateContext.syncMandateBestEffort(
          workspaceId,
          req.params.mandateId,
          "outcome_created",
        );
      }
      res.status(result.replayed ? 200 : 201).json({
        success: true,
        data: result.observation,
        replayed: result.replayed,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid outcome observation request";
      const status = /not found/i.test(message) ? 404 : /idempotency/i.test(message) ? 409 : 400;
      res.status(status).json({ success: false, error: message });
    }
  }

  /**
   * POST /mandates/:mandateId/outcomes/sync — operator-triggered ingestion of
   * verified outcomes from the mandate's configured GitHub sources. Per-source
   * failures surface inside the report instead of failing the whole sync, so a
   * single unreachable repo never blocks ingestion from the others.
   */
  async syncFromSources(req: Request, res: Response): Promise<void> {
    const workspaceId = requireOperator(req, res);
    if (!workspaceId) return;
    try {
      const result = await syncMandateOutcomes(workspaceId, req.params.mandateId);
      const allFailed =
        result.sources.length > 0 && result.sources.every((source) => Boolean(source.error));
      res.status(allFailed ? 502 : 200).json({ success: !allFailed, data: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Outcome source sync failed";
      const status = /not found/i.test(message)
        ? 404
        : /no outcome sources/i.test(message)
          ? 409
          : 500;
      res.status(status).json({ success: false, error: message });
    }
  }
}
