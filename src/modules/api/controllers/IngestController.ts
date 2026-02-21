import { Request, Response } from "express";
import { creRunStore } from "../../../cre/storage/CreRunStore.js";
import { creRunSchema } from "../../../cre/validation.js";
import { projectRegistry } from "../../../cre/projects/projectRegistry.js";

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

      if (!projectRegistry.verifyIngestKey(projectId, ingestKey)) {
        res.status(401).json({
          success: false,
          error: "Invalid ingest key for project",
        });
        return;
      }

      await creRunStore.add({ ...(parsed.data as any), projectId });

      res.json({ success: true, runId: parsed.data.runId, projectId });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err?.message || "Failed to ingest run",
      });
    }
  }
}
