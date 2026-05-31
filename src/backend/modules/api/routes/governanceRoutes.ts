import { Router } from "express";
import type { GovernanceController } from "../controllers/GovernanceController.js";
import type { McpGovernanceController } from "../controllers/McpGovernanceController.js";
import { getDb } from "../../../db/index.js";
import { randomUUID } from "node:crypto";

export function createGovernanceRoutes(
  governanceController: GovernanceController,
  mcpGovernanceController: McpGovernanceController,
): Router {
  const router = Router();

  router.get("/governance/policies", (req, res) =>
    governanceController.getPolicies(req, res),
  );
  router.post("/governance/policies", (req, res) =>
    governanceController.createPolicy(req, res),
  );
  router.post("/governance/policies/confidential", (req, res) =>
    governanceController.createConfidentialPolicy(req, res),
  );
  router.get("/governance/decisions/:decisionId", (req, res) =>
    governanceController.getDecision(req, res),
  );
  router.get("/governance/health", (req, res) =>
    governanceController.getHealth(req, res),
  );
  router.post("/governance/evaluate", (req, res) =>
    governanceController.evaluateAction(req, res),
  );

  // Policy versioning endpoints (workspace-scoped)
  router.get("/governance/policies/:policyId/versions", (req, res) => {
    const workspaceId = req.workspaceId;
    const { policyId } = req.params;
    if (!workspaceId) {
      res.status(401).json({ success: false, error: "Not authenticated" });
      return;
    }
    const db = getDb();
    const rows = db
      .prepare(
        "SELECT * FROM policy_versions WHERE policy_id = ? AND workspace_id = ? ORDER BY version DESC",
      )
      .all(policyId, workspaceId) as any[];
    res.json({
      success: true,
      data: rows.map((row) => ({
        id: row.id,
        version: row.version,
        name: row.name,
        description: row.description,
        status: row.status,
        rules: JSON.parse(row.rules || "[]"),
        snapshotAt: row.snapshot_at,
      })),
    });
  });

  router.post("/governance/policies/:policyId/rollback", (req, res) => {
    const workspaceId = req.workspaceId;
    const { policyId } = req.params;
    const { versionId } = req.body as { versionId: string };
    if (!workspaceId) {
      res.status(401).json({ success: false, error: "Not authenticated" });
      return;
    }
    if (!versionId) {
      res.status(400).json({ success: false, error: "versionId is required" });
      return;
    }

    const db = getDb();
    const version = db
      .prepare(
        "SELECT * FROM policy_versions WHERE id = ? AND policy_id = ? AND workspace_id = ?",
      )
      .get(versionId, policyId, workspaceId) as any | undefined;

    if (!version) {
      res.status(404).json({ success: false, error: "Version not found" });
      return;
    }

    const now = new Date().toISOString();
    const latestVersion = db
      .prepare(
        "SELECT MAX(version) as max_ver FROM policy_versions WHERE policy_id = ?",
      )
      .get(policyId) as { max_ver: number } | undefined;
    const nextVersion = (latestVersion?.max_ver || 0) + 1;

    // Snapshot current state before rollback
    const current = db
      .prepare(
        "SELECT * FROM workspace_policies WHERE id = ? AND workspace_id = ?",
      )
      .get(policyId, workspaceId) as any | undefined;

    if (current) {
      db.prepare(
        `INSERT INTO policy_versions (id, policy_id, workspace_id, version, name, type, description, status, rules, snapshot_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        `pv-${randomUUID().slice(0, 8)}`,
        policyId,
        workspaceId,
        nextVersion,
        current.name,
        current.type,
        current.description,
        current.status,
        current.rules,
        now,
      );
    }

    // Apply rollback
    db.prepare(
      "UPDATE workspace_policies SET name = ?, description = ?, rules = ?, status = ?, updated_at = ? WHERE id = ? AND workspace_id = ?",
    ).run(
      version.name,
      version.description,
      version.rules,
      version.status,
      now,
      policyId,
      workspaceId,
    );

    res.json({
      success: true,
      data: {
        id: policyId,
        name: version.name,
        description: version.description,
        status: version.status,
        rolledBackToVersion: version.version,
      },
    });
  });

  // MCP tool endpoints
  router.get("/mcp/governance-check", (req, res) =>
    mcpGovernanceController.getManifest(req, res),
  );
  router.post("/mcp/governance-check", (req, res) =>
    mcpGovernanceController.governanceCheck(req, res),
  );

  return router;
}
