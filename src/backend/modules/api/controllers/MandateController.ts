import type { Request, Response } from "express";
import { z } from "zod";
import { idempotencyStore } from "@backend/modules/api/storage/IdempotencyStore.js";
import {
  FundedMandateService,
  type CreateFundedMandateInput,
  type UpdateFundedMandateInput,
} from "@backend/services/governance/FundedMandateService.js";
import { AllocationRecommendationService } from "@backend/services/governance/AllocationRecommendationService.js";
import { PublishedStatementService } from "@backend/services/governance/PublishedStatementService.js";
import { StatementService } from "@backend/services/governance/StatementService.js";
import { hydraDbMandateContext } from "@backend/services/hydradb/HydraDbMandateContextService.js";

const metricSchema = z.object({
  id: z.string().min(1).max(120),
  name: z.string().min(1).max(160),
  unit: z.string().min(1).max(80),
  target: z.string().max(160).optional(),
});

const bodySchema = z.object({
  name: z.string().min(1).max(160),
  objective: z.string().min(1).max(2000),
  agentIds: z.array(z.string().min(1)).max(100).optional(),
  status: z.enum(["draft", "active", "paused", "closed"]).optional(),
  budget: z
    .object({
      byAsset: z
        .record(
          z.object({
            authorizedAmount: z.string().regex(/^\d+$/).optional(),
            allocatedAmount: z.string().regex(/^\d+$/).optional(),
            consumedAmount: z.string().regex(/^\d+$/).optional(),
            pendingAmount: z.string().regex(/^\d+$/).optional(),
          }),
        )
        .optional(),
    })
    .optional(),
  policyIds: z.array(z.string().min(1)).max(100).optional(),
  measurementWindow: z
    .object({ startsAt: z.string().datetime(), endsAt: z.string().datetime().optional() })
    .optional(),
  successMetrics: z.array(metricSchema).max(100).optional(),
  settlement: z
    .object({
      requireCleanverseIdentity: z.boolean().optional(),
      requireVerifiedSettlement: z.boolean().optional(),
      allowedAssets: z.array(z.string().min(1).max(40)).max(20).optional(),
      chainIds: z.array(z.number().int()).max(20).optional(),
    })
    .optional(),
});

function workspaceId(req: Request, res: Response): string | undefined {
  if (!req.userId || !req.workspaceId) {
    res.status(403).json({
      success: false,
      error: "Operator authentication and workspace context are required.",
    });
    return undefined;
  }
  return req.workspaceId;
}

function errorResponse(res: Response, error: unknown): void {
  const message = error instanceof Error ? error.message : "Invalid mandate request";
  const referenceError = /must belong|workspace/i.test(message);
  res.status(referenceError ? 409 : 400).json({ success: false, error: message });
}

export class MandateController {
  async list(req: Request, res: Response): Promise<void> {
    const id = workspaceId(req, res);
    if (!id) return;
    res.json({ success: true, data: FundedMandateService.list(id) });
  }

  async get(req: Request, res: Response): Promise<void> {
    const id = workspaceId(req, res);
    if (!id) return;
    const mandate = FundedMandateService.get(id, req.params.mandateId);
    if (!mandate) {
      res.status(404).json({ success: false, error: "Mandate not found" });
      return;
    }
    res.json({ success: true, data: mandate });
  }

  async getStatement(req: Request, res: Response): Promise<void> {
    const id = workspaceId(req, res);
    if (!id) return;
    try {
      const statement = await StatementService.generateCandidate(id, req.params.mandateId);
      res.json({ success: true, data: statement });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate mandate statement";
      const status = /not found/i.test(message) ? 404 : /cannot be generated|exceeds authorization/i.test(message) ? 409 : 500;
      res.status(status).json({ success: false, error: message });
    }
  }

  async getRecommendation(req: Request, res: Response): Promise<void> {
    const id = workspaceId(req, res);
    if (!id) return;
    try {
      const recommendation = await AllocationRecommendationService.generate(id, req.params.mandateId);
      res.json({ success: true, data: recommendation });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate allocation recommendation";
      const status = /not found/i.test(message) ? 404 : /cannot be generated|exceeds authorization/i.test(message) ? 409 : 500;
      res.status(status).json({ success: false, error: message });
    }
  }

  async getContext(req: Request, res: Response): Promise<void> {
    const id = workspaceId(req, res);
    if (!id) return;
    try {
      const context = await hydraDbMandateContext.getContext(id, req.params.mandateId);
      res.json({ success: true, data: context });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to build mandate context";
      res.status(/not found/i.test(message) ? 404 : 500).json({ success: false, error: message });
    }
  }

  async syncContext(req: Request, res: Response): Promise<void> {
    const id = workspaceId(req, res);
    if (!id) return;
    try {
      const sync = await hydraDbMandateContext.syncMandate(id, req.params.mandateId);
      res.json({ success: true, data: sync });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to sync mandate context";
      res.status(/not found/i.test(message) ? 404 : 500).json({ success: false, error: message });
    }
  }

  async publishStatement(req: Request, res: Response): Promise<void> {
    const id = workspaceId(req, res);
    if (!id || !req.userId) return;
    try {
      const published = PublishedStatementService.publish(id, req.params.mandateId, req.userId);
      res.status(201).json({ success: true, data: published });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to publish mandate statement";
      const status = /not found/i.test(message) ? 404 : /exceeds authorization|cannot be generated/i.test(message) ? 409 : 500;
      res.status(status).json({ success: false, error: message });
    }
  }

  async listStatements(req: Request, res: Response): Promise<void> {
    const id = workspaceId(req, res);
    if (!id) return;
    if (!FundedMandateService.get(id, req.params.mandateId)) {
      res.status(404).json({ success: false, error: "Mandate not found" });
      return;
    }
    res.json({ success: true, data: PublishedStatementService.list(id, req.params.mandateId) });
  }

  async getPublishedStatement(req: Request, res: Response): Promise<void> {
    const id = workspaceId(req, res);
    if (!id) return;
    const published = PublishedStatementService.get(id, req.params.mandateId, req.params.statementId);
    if (!published) {
      res.status(404).json({ success: false, error: "Published statement not found" });
      return;
    }
    res.json({ success: true, data: published });
  }

  async exportStatement(req: Request, res: Response): Promise<void> {
    const id = workspaceId(req, res);
    if (!id) return;
    const exported = PublishedStatementService.export(id, req.params.mandateId, req.params.statementId);
    if (!exported) {
      res.status(404).json({ success: false, error: "Published statement not found" });
      return;
    }
    res.json({ success: true, data: exported });
  }

  async create(req: Request, res: Response): Promise<void> {
    const id = workspaceId(req, res);
    if (!id) return;
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: "Invalid mandate payload", details: parsed.error.format() });
      return;
    }
    const rawKey = req.header("Idempotency-Key") || req.header("X-Idempotency-Key");
    const idemKey = rawKey?.trim() ? `mandate:create:${id}:${rawKey.trim().slice(0, 120)}` : undefined;
    if (idemKey) {
      const cached = await idempotencyStore.getRecord(idemKey);
      if (cached) {
        res.status(cached.statusCode).json(cached.body);
        return;
      }
    }
    try {
      const mandate = FundedMandateService.create(id, parsed.data as CreateFundedMandateInput);
      void hydraDbMandateContext.syncMandateBestEffort(id, mandate.id, "mandate_created");
      const body = { success: true, data: mandate } as Record<string, unknown>;
      if (idemKey) {
        await idempotencyStore.setRecord(idemKey, { statusCode: 201, body, createdAtMs: Date.now() });
      }
      res.status(201).json(body);
    } catch (error) {
      errorResponse(res, error);
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    const id = workspaceId(req, res);
    if (!id) return;
    const parsed = bodySchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: "Invalid mandate payload", details: parsed.error.format() });
      return;
    }
    const rawKey = req.header("Idempotency-Key") || req.header("X-Idempotency-Key");
    const idemKey = rawKey?.trim() ? `mandate:update:${id}:${req.params.mandateId}:${rawKey.trim().slice(0, 120)}` : undefined;
    if (idemKey) {
      const cached = await idempotencyStore.getRecord(idemKey);
      if (cached) {
        res.status(cached.statusCode).json(cached.body);
        return;
      }
    }
    try {
      const mandate = FundedMandateService.update(id, req.params.mandateId, parsed.data as UpdateFundedMandateInput);
      if (!mandate) {
        res.status(404).json({ success: false, error: "Mandate not found" });
        return;
      }
      void hydraDbMandateContext.syncMandateBestEffort(id, mandate.id, "mandate_updated");
      const body = { success: true, data: mandate } as Record<string, unknown>;
      if (idemKey) {
        await idempotencyStore.setRecord(idemKey, { statusCode: 200, body, createdAtMs: Date.now() });
      }
      res.json(body);
    } catch (error) {
      errorResponse(res, error);
    }
  }
}
