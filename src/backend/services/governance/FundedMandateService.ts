import { randomUUID } from "node:crypto";
import { getDb } from "@backend/db/index.js";

export type FundedMandateStatus = "draft" | "active" | "paused" | "closed";

export interface MandateBudgetAsset {
  authorizedAmount: string;
  allocatedAmount: string;
  consumedAmount: string;
  pendingAmount: string;
}

export interface MandateSettlementConstraints {
  /** When true, A-Pass screening is required for spends under this mandate. */
  requireCleanverseIdentity?: boolean;
  /** When set, intent.asset must be one of these (e.g. ["aUSD-D"]). */
  allowedAssets?: string[];
  /** When set, wallet/spend chain must match (e.g. [10143]). */
  chainIds?: number[];
  /** When true, consumed spend must settle via Cleanverse CVA (aUSD-D). */
  requireVerifiedSettlement?: boolean;
}

export interface FundedMandate {
  id: string;
  workspaceId: string;
  name: string;
  objective: string;
  agentIds: string[];
  status: FundedMandateStatus;
  budget: { byAsset: Record<string, MandateBudgetAsset> };
  policyIds: string[];
  measurementWindow?: { startsAt: string; endsAt?: string };
  successMetrics: Array<{
    id: string;
    name: string;
    unit: string;
    target?: string;
  }>;
  settlement?: MandateSettlementConstraints;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFundedMandateInput {
  name: string;
  objective: string;
  agentIds?: string[];
  status?: FundedMandateStatus;
  budget?: { byAsset?: Record<string, Partial<MandateBudgetAsset>> };
  policyIds?: string[];
  measurementWindow?: { startsAt: string; endsAt?: string };
  successMetrics?: FundedMandate["successMetrics"];
  settlement?: MandateSettlementConstraints;
}

export type UpdateFundedMandateInput = Partial<CreateFundedMandateInput>;
type Row = Record<string, unknown>;

const INTEGER_AMOUNT = /^\d+$/;

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeAmount(value: unknown): string {
  if (typeof value !== "string" || !INTEGER_AMOUNT.test(value)) {
    throw new Error("Mandate amounts must be non-negative integer base-unit strings");
  }
  return value;
}

function normalizeBudget(
  budget: CreateFundedMandateInput["budget"] | undefined,
  base: FundedMandate["budget"] = { byAsset: {} },
): FundedMandate["budget"] {
  const byAsset: Record<string, MandateBudgetAsset> = { ...base.byAsset };
  for (const [asset, values] of Object.entries(budget?.byAsset || {})) {
    if (!asset.trim()) throw new Error("Mandate budget asset is required");
    const previous = base.byAsset[asset];
    const authorizedAmount = normalizeAmount(values.authorizedAmount ?? previous?.authorizedAmount ?? "0");
    const allocatedAmount = normalizeAmount(values.allocatedAmount ?? previous?.allocatedAmount ?? "0");
    const consumedAmount = normalizeAmount(values.consumedAmount ?? previous?.consumedAmount ?? "0");
    const pendingAmount = normalizeAmount(values.pendingAmount ?? previous?.pendingAmount ?? "0");
    const authorized = BigInt(authorizedAmount);
    const allocated = BigInt(allocatedAmount);
    const consumed = BigInt(consumedAmount);
    const pending = BigInt(pendingAmount);
    if (allocated > authorized) {
      throw new Error(`Mandate allocated amount for ${asset} exceeds its authorized amount`);
    }
    if (consumed > allocated) {
      throw new Error(`Mandate consumed amount for ${asset} exceeds its allocated amount`);
    }
    if (pending !== allocated - consumed) {
      throw new Error(`Mandate pending amount for ${asset} must equal allocated minus consumed`);
    }
    byAsset[asset] = { authorizedAmount, allocatedAmount, consumedAmount, pendingAmount };
  }
  return { byAsset };
}

function normalizeSettlement(
  settlement: MandateSettlementConstraints | undefined,
): MandateSettlementConstraints | undefined {
  if (!settlement) return undefined;
  const allowedAssets = settlement.allowedAssets
    ?.map((asset) => asset.trim())
    .filter(Boolean);
  const chainIds = settlement.chainIds?.filter((id) => Number.isFinite(id));
  const next: MandateSettlementConstraints = {
    requireCleanverseIdentity: settlement.requireCleanverseIdentity === true,
    requireVerifiedSettlement: settlement.requireVerifiedSettlement === true,
    ...(allowedAssets && allowedAssets.length > 0 ? { allowedAssets } : {}),
    ...(chainIds && chainIds.length > 0 ? { chainIds } : {}),
  };
  if (
    !next.requireCleanverseIdentity &&
    !next.requireVerifiedSettlement &&
    !next.allowedAssets &&
    !next.chainIds
  ) {
    return undefined;
  }
  return next;
}

function rowToMandate(row: Row): FundedMandate {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    name: row.name as string,
    objective: row.objective as string,
    agentIds: parseJson(row.agent_ids, []),
    status: row.status as FundedMandateStatus,
    budget: { byAsset: parseJson(row.budget_by_asset, {}) },
    policyIds: parseJson(row.policy_ids, []),
    measurementWindow: parseJson(row.measurement_window, undefined),
    successMetrics: parseJson(row.success_metrics, []),
    settlement: normalizeSettlement(parseJson(row.settlement, undefined)),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function validateWorkspaceReferences(
  workspaceId: string,
  agentIds: string[],
  policyIds: string[],
): void {
  const db = getDb();
  if (agentIds.length > 0) {
    const placeholders = agentIds.map(() => "?").join(",");
    const rows = db
      .prepare(
        `SELECT id FROM workspace_agents WHERE workspace_id = ? AND id IN (${placeholders})`,
      )
      .all(workspaceId, ...agentIds) as Array<{ id: string }>;
    if (rows.length !== new Set(agentIds).size) {
      throw new Error("Every mandate agent must belong to the current workspace");
    }
  }
  if (policyIds.length > 0) {
    const placeholders = policyIds.map(() => "?").join(",");
    const rows = db
      .prepare(
        `SELECT id FROM workspace_policies WHERE workspace_id = ? AND id IN (${placeholders})`,
      )
      .all(workspaceId, ...policyIds) as Array<{ id: string }>;
    if (rows.length !== new Set(policyIds).size) {
      throw new Error("Every mandate policy must belong to the current workspace");
    }
  }
}

export const FundedMandateService = {
  list(workspaceId: string): FundedMandate[] {
    const rows = getDb()
      .prepare(
        "SELECT * FROM funded_mandates WHERE workspace_id = ? ORDER BY created_at DESC",
      )
      .all(workspaceId) as Row[];
    return rows.map(rowToMandate);
  },

  get(workspaceId: string, mandateId: string): FundedMandate | undefined {
    const row = getDb()
      .prepare("SELECT * FROM funded_mandates WHERE id = ? AND workspace_id = ?")
      .get(mandateId, workspaceId) as Row | undefined;
    return row ? rowToMandate(row) : undefined;
  },

  create(workspaceId: string, input: CreateFundedMandateInput): FundedMandate {
    const name = input.name.trim();
    const objective = input.objective.trim();
    if (!name || !objective) throw new Error("Mandate name and objective are required");
    const agentIds = [...new Set(input.agentIds || [])];
    const policyIds = [...new Set(input.policyIds || [])];
    validateWorkspaceReferences(workspaceId, agentIds, policyIds);
    const budget = normalizeBudget(input.budget);
    const settlement = normalizeSettlement(input.settlement);
    const id = `mandate-${randomUUID().slice(0, 12)}`;
    const now = new Date().toISOString();
    getDb()
      .prepare(
        `INSERT INTO funded_mandates
          (id, workspace_id, name, objective, agent_ids, status, budget_by_asset, policy_ids, measurement_window, success_metrics, settlement, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        workspaceId,
        name,
        objective,
        JSON.stringify(agentIds),
        input.status || "draft",
        JSON.stringify(budget.byAsset),
        JSON.stringify(policyIds),
        input.measurementWindow ? JSON.stringify(input.measurementWindow) : null,
        JSON.stringify(input.successMetrics || []),
        settlement ? JSON.stringify(settlement) : null,
        now,
        now,
      );
    return FundedMandateService.get(workspaceId, id)!;
  },

  update(
    workspaceId: string,
    mandateId: string,
    updates: UpdateFundedMandateInput,
  ): FundedMandate | undefined {
    const existing = FundedMandateService.get(workspaceId, mandateId);
    if (!existing) return undefined;
    const agentIds = updates.agentIds ? [...new Set(updates.agentIds)] : existing.agentIds;
    const policyIds = updates.policyIds ? [...new Set(updates.policyIds)] : existing.policyIds;
    validateWorkspaceReferences(workspaceId, agentIds, policyIds);
    const budget = updates.budget ? normalizeBudget(updates.budget, existing.budget) : existing.budget;
    const settlement =
      updates.settlement !== undefined
        ? normalizeSettlement(updates.settlement)
        : existing.settlement;
    const next: FundedMandate = {
      ...existing,
      name: updates.name?.trim() || existing.name,
      objective: updates.objective?.trim() || existing.objective,
      agentIds,
      status: updates.status || existing.status,
      budget,
      policyIds,
      measurementWindow: updates.measurementWindow ?? existing.measurementWindow,
      successMetrics: updates.successMetrics ?? existing.successMetrics,
      settlement,
      updatedAt: new Date().toISOString(),
    };
    if (!next.name || !next.objective) throw new Error("Mandate name and objective are required");
    getDb()
      .prepare(
        `UPDATE funded_mandates SET name = ?, objective = ?, agent_ids = ?, status = ?, budget_by_asset = ?, policy_ids = ?, measurement_window = ?, success_metrics = ?, settlement = ?, updated_at = ? WHERE id = ? AND workspace_id = ?`,
      )
      .run(
        next.name,
        next.objective,
        JSON.stringify(next.agentIds),
        next.status,
        JSON.stringify(next.budget.byAsset),
        JSON.stringify(next.policyIds),
        next.measurementWindow ? JSON.stringify(next.measurementWindow) : null,
        JSON.stringify(next.successMetrics),
        next.settlement ? JSON.stringify(next.settlement) : null,
        next.updatedAt,
        mandateId,
        workspaceId,
      );
    return FundedMandateService.get(workspaceId, mandateId);
  },
};
