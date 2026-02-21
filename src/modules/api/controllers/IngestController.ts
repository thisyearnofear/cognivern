import { Request, Response } from "express";
import { creRunStore } from "../../../cre/storage/CreRunStore.js";
import { creRunSchema } from "../../../cre/validation.js";
import { projectRegistry } from "../../../cre/projects/projectRegistry.js";
import { usageMeter } from "../../../cre/projects/usageMeter.js";
import { tokenTelemetryStore } from "../../../cre/projects/tokenTelemetry.js";

/**
 * Ingestion endpoint for BYO agents.
 *
 * Teams can POST a CreRun (or CreRun-like) payload and Cognivern will persist it.
 */
export class IngestController {
  async listProjects(req: Request, res: Response) {
    // Do NOT leak ingest keys. This endpoint is meant for UI discovery only.
    const projects = projectRegistry.list().map((p) => ({
      projectId: p.projectId,
      name: p.name,
    }));
    res.json({ success: true, projects });
  }

  async getUsage(req: Request, res: Response) {
    const projectId = req.params.projectId;
    const usage = await usageMeter.getUsage(projectId);
    res.json({ success: true, projectId, usage });
  }

  async listTokens(req: Request, res: Response) {
    const projectId = req.params.projectId;
    const tokens = await tokenTelemetryStore.listByProject(projectId);
    res.json({ success: true, projectId, tokens });
  }

  async ingestRun(req: Request, res: Response) {
    try {
      const parsed = creRunSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: "Invalid run payload",
          issues: parsed.error.issues,
        });
        return;
      }

      const projectId =
        parsed.data.projectId ||
        ((req.headers["x-project-id"] as string) || "default");

      const ingestKey =
        (req.headers["x-ingest-key"] as string) ||
        (req.headers["authorization"] as string)?.replace(/^Bearer\s+/i, "") ||
        "";

      const match = projectRegistry.matchIngestKey(projectId, ingestKey);
      if (!match) {
        res.status(401).json({
          success: false,
          error: "Invalid ingest key for project",
        });
        return;
      }

      const quota = await usageMeter.canIngest(projectId);
      if (!quota.allowed) {
        res.status(429).json({
          success: false,
          error: quota.reason || "Quota exceeded",
          usage: quota.usage,
        });
        return;
      }

      await creRunStore.add({ ...(parsed.data as any), projectId });
      const usage = await usageMeter.recordIngest(projectId);
      const tokenTelemetry = await tokenTelemetryStore.record(
        match.projectId,
        match.ingestKeyId
      );

      // Commercially useful headers
      res.setHeader("X-Cognivern-Project", projectId);
      res.setHeader("X-Cognivern-Ingest-Key-Id", match.ingestKeyId);
      res.setHeader("X-Cognivern-Usage-Window-Start", usage.windowStart);
      res.setHeader("X-Cognivern-Usage-Window-Seconds", String(usage.windowSeconds));
      res.setHeader("X-Cognivern-Usage-Ingested", String(usage.ingestedRuns));
      const max = usageMeter.getMaxRunsForProject(projectId);

      res.setHeader(
        "X-Cognivern-Usage-Remaining",
        String(Math.max(0, max - usage.ingestedRuns))
      );

      res.json({
        success: true,
        runId: parsed.data.runId,
        projectId,
        usage,
        token: tokenTelemetry,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err?.message || "Failed to ingest run",
      });
    }
  }
}
