/**
 * CreditProgramService — sponsor-side lifecycle for a sponsored inference
 * program: create the program, provision participants in bulk, mint their
 * gateway keys, and let participants change their own disclosure tier.
 *
 * Key handling mirrors `ApiKeyController` exactly (scrypt:salt:hash, 8-char
 * prefix lookup, verify-on-resolve) rather than inventing a second scheme.
 * Keys use a `cvk_` prefix ("cognivern key, gateway") to keep them visually
 * distinct from the `cvn_` workspace control-plane keys — a gateway key can
 * only spend credits, it can never read or write governance state.
 *
 * The raw key is returned exactly once, at provisioning time. We store only the
 * hash, so a lost key is re-issued, never recovered.
 */

import {
  randomUUID,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import type Database from "better-sqlite3";
import { getDb } from "@backend/db/index.js";
import logger from "@backend/utils/logger.js";
import { assertNonNegativeInteger, usdToNano } from "./money.js";
import {
  CEILING_DISCLOSURE_MULTIPLIERS,
  DISCLOSURE_TIERS,
  isDisclosureTier,
  multipliersModeOf,
  resolveMultipliers,
  type DisclosureTier,
  type MultipliersMode,
} from "./disclosure.js";
import { CreditLedgerService, sharedCreditLedgerService } from "./CreditLedgerService.js";

export const GATEWAY_KEY_PREFIX = "cvk_";

export type ProgramStatus = "draft" | "active" | "paused" | "closed";

export interface CreditProgram {
  id: string;
  workspaceId: string;
  name: string;
  sponsorName: string;
  status: ProgramStatus;
  backend: string;
  poolNano: number;
  baseAllocationNano: number;
  allowedModels: string[];
  maxOutputTokens: number | null;
  maxInputTokens: number | null;
  startsAt: string | null;
  endsAt: string | null;
  disclosureMultipliers: Partial<Record<DisclosureTier, number>>;
  multipliersMode: MultipliersMode;
  requireTrustMode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreditParticipant {
  id: string;
  programId: string;
  workspaceId: string;
  handle: string;
  displayName: string | null;
  projectTag: string | null;
  disclosureTier: DisclosureTier;
  baseAllocationNano: number;
  allocatedNano: number;
  consumedNano: number;
  heldNano: number;
  overdrawnNano: number;
  requestCount: number;
  keyPrefix: string | null;
  keyIssuedAt: string | null;
  lastUsedAt: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

/** What the gateway needs to authorise and meter a request. */
export interface ResolvedGatewayKey {
  participant: CreditParticipant;
  program: CreditProgram;
}

export class CreditProgramService {
  private readonly db: Database.Database;
  private readonly ledger: CreditLedgerService;

  constructor(db: Database.Database = getDb(), ledger?: CreditLedgerService) {
    this.db = db;
    this.ledger = ledger ?? sharedCreditLedgerService();
  }

  // ── Programs ─────────────────────────────────────────────────────────────

  createProgram(input: {
    workspaceId: string;
    name: string;
    sponsorName?: string;
    backend?: string;
    poolUsd?: number;
    baseAllocationUsd: number;
    allowedModels?: string[];
    maxOutputTokens?: number | null;
    maxInputTokens?: number | null;
    startsAt?: string | null;
    endsAt?: string | null;
    disclosureMultipliers?: Partial<Record<DisclosureTier, number>>;
    /** Preset multiplier philosophy: bonus (open 2x, needs 2x pool) or ceiling (open 1x, pool is exact). */
    multipliersMode?: "bonus" | "ceiling";
    requireTrustMode?: string | null;
    status?: ProgramStatus;
  }): CreditProgram {
    if (!input.name?.trim()) throw new Error("Program name is required");

    const poolNano = assertNonNegativeInteger(
      usdToNano(input.poolUsd ?? 0),
      "poolUsd",
    );
    const baseAllocationNano = assertNonNegativeInteger(
      usdToNano(input.baseAllocationUsd),
      "baseAllocationUsd",
    );

    // Explicit per-tier multipliers win; otherwise resolve the chosen preset
    // so the stored JSON (and therefore the derived `multipliersMode`) is an
    // exact, self-describing picture of the program's economics.
    const disclosureMultipliers = input.disclosureMultipliers
      ? input.disclosureMultipliers
      : input.multipliersMode === "ceiling"
        ? CEILING_DISCLOSURE_MULTIPLIERS
        : {};

    const id = `prog_${randomUUID()}`;
    const now = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO credit_programs
           (id, workspace_id, name, sponsor_name, status, backend, pool_nano,
            base_allocation_nano, allowed_models, max_output_tokens, max_input_tokens,
            starts_at, ends_at, disclosure_multipliers, require_trust_mode,
            created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.workspaceId,
        input.name.trim(),
        input.sponsorName?.trim() ?? "",
        input.status ?? "draft",
        input.backend ?? "zerog-router",
        poolNano,
        baseAllocationNano,
        JSON.stringify(input.allowedModels ?? []),
        input.maxOutputTokens ?? null,
        input.maxInputTokens ?? null,
        input.startsAt ?? null,
        input.endsAt ?? null,
        JSON.stringify(disclosureMultipliers),
        input.requireTrustMode ?? null,
        now,
        now,
      );

    logger.info(`Created credit program ${id} (${input.name}) for workspace ${input.workspaceId}`);
    return this.getProgram(id)!;
  }

  getProgram(programId: string): CreditProgram | null {
    const row = this.db
      .prepare(`SELECT * FROM credit_programs WHERE id = ?`)
      .get(programId) as Record<string, unknown> | undefined;
    return row ? mapProgram(row) : null;
  }

  listPrograms(workspaceId: string): CreditProgram[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM credit_programs WHERE workspace_id = ? ORDER BY created_at DESC`,
      )
      .all(workspaceId) as Array<Record<string, unknown>>;
    return rows.map(mapProgram);
  }

  updateProgram(
    programId: string,
    patch: Partial<{
      name: string;
      sponsorName: string;
      status: ProgramStatus;
      allowedModels: string[];
      maxOutputTokens: number | null;
      maxInputTokens: number | null;
      startsAt: string | null;
      endsAt: string | null;
      requireTrustMode: string | null;
      multipliersMode: "bonus" | "ceiling";
      poolUsd: number;
    }>,
  ): CreditProgram {
    const existing = this.getProgram(programId);
    if (!existing) throw new Error(`Unknown program: ${programId}`);

    const sets: string[] = [];
    const values: unknown[] = [];

    const push = (column: string, value: unknown) => {
      sets.push(`${column} = ?`);
      values.push(value);
    };

    if (patch.name !== undefined) push("name", patch.name.trim());
    if (patch.sponsorName !== undefined) push("sponsor_name", patch.sponsorName.trim());
    if (patch.status !== undefined) push("status", patch.status);
    if (patch.allowedModels !== undefined)
      push("allowed_models", JSON.stringify(patch.allowedModels));
    if (patch.maxOutputTokens !== undefined) push("max_output_tokens", patch.maxOutputTokens);
    if (patch.maxInputTokens !== undefined) push("max_input_tokens", patch.maxInputTokens);
    if (patch.startsAt !== undefined) push("starts_at", patch.startsAt);
    if (patch.endsAt !== undefined) push("ends_at", patch.endsAt);
    if (patch.requireTrustMode !== undefined)
      push("require_trust_mode", patch.requireTrustMode);
    if (patch.multipliersMode !== undefined) {
      push(
        "disclosure_multipliers",
        patch.multipliersMode === "ceiling"
          ? JSON.stringify(CEILING_DISCLOSURE_MULTIPLIERS)
          : "{}",
      );
    }
    if (patch.poolUsd !== undefined)
      push("pool_nano", assertNonNegativeInteger(usdToNano(patch.poolUsd), "poolUsd"));

    if (sets.length === 0) return existing;

    push("updated_at", new Date().toISOString());
    this.db
      .prepare(`UPDATE credit_programs SET ${sets.join(", ")} WHERE id = ?`)
      .run(...values, programId);

    return this.getProgram(programId)!;
  }

  // ── Participants ─────────────────────────────────────────────────────────

  /**
   * Provision participants and mint one gateway key each.
   *
   * Runs as a single transaction so a partial cohort is never created: with 50
   * participants, a failure on #37 would otherwise leave a half-enrolled
   * program and 37 live keys nobody has recorded.
   *
   * Returns raw keys alongside participant records. Callers must treat the
   * `key` field as write-once — it is not retrievable afterwards.
   */
  provisionParticipants(
    programId: string,
    entries: Array<{
      handle: string;
      displayName?: string;
      projectTag?: string;
      disclosureTier?: DisclosureTier;
      baseAllocationUsd?: number;
    }>,
  ): Array<{ participant: CreditParticipant; key: string }> {
    const program = this.getProgram(programId);
    if (!program) throw new Error(`Unknown program: ${programId}`);
    if (entries.length === 0) return [];

    const handles = entries.map((e) => e.handle?.trim()).filter(Boolean);
    if (handles.length !== entries.length) {
      throw new Error("Every participant needs a non-empty handle");
    }
    if (new Set(handles).size !== handles.length) {
      throw new Error("Duplicate handles in the same provisioning batch");
    }

    // Budget guard: refuse to over-commit the sponsor's pool.
    if (program.poolNano > 0) {
      const incomingBase = entries.reduce(
        (sum, e) =>
          sum +
          (e.baseAllocationUsd !== undefined
            ? usdToNano(e.baseAllocationUsd)
            : program.baseAllocationNano),
        0,
      );
      this.assertPoolCovers(program, incomingBase);
    }

    const run = this.db.transaction(() => {
      const results: Array<{ participant: CreditParticipant; key: string }> = [];
      const now = new Date().toISOString();

      for (const entry of entries) {
        const tier = entry.disclosureTier ?? "standard";
        if (!isDisclosureTier(tier)) {
          throw new Error(`Invalid disclosure tier: ${String(tier)}`);
        }

        const baseNano =
          entry.baseAllocationUsd !== undefined
            ? assertNonNegativeInteger(usdToNano(entry.baseAllocationUsd), "baseAllocationUsd")
            : program.baseAllocationNano;

        const id = `part_${randomUUID()}`;
        const rawKey = generateGatewayKey();

        this.db
          .prepare(
            `INSERT INTO credit_participants
               (id, program_id, workspace_id, handle, display_name, project_tag,
                disclosure_tier, base_allocation_nano, allocated_nano, key_hash,
                key_prefix, key_issued_at, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 'active', ?, ?)`,
          )
          .run(
            id,
            programId,
            program.workspaceId,
            entry.handle.trim(),
            entry.displayName?.trim() ?? null,
            entry.projectTag?.trim() ?? null,
            tier,
            baseNano,
            hashKeyScrypt(rawKey),
            rawKey.slice(0, 8),
            now,
            now,
            now,
          );

        // Book the opening allocation through the ledger so even the initial
        // grant is evidence, not an unexplained starting balance.
        this.ledger.allocate(id, {
          baseAllocationNano: baseNano,
          tier,
          multipliers: program.disclosureMultipliers,
          note: `initial allocation at tier '${tier}'`,
        });

        results.push({ participant: this.getParticipant(id)!, key: rawKey });
      }

      return results;
    });

    const provisioned = run();
    logger.info(`Provisioned ${provisioned.length} participant(s) for program ${programId}`);
    return provisioned;
  }

  /**
   * Change a participant's base allocation — the sponsor-side top-up.
   *
   * The base is what the disclosure multiplier is applied to, so topping up
   * respects the participant's current tier automatically: a $10 top-up for
   * someone on `open` (2x) grants them $20 more spendable credit.
   *
   * Guarded against the pool the same way provisioning is, using the worst-case
   * multiplier, because the participant can raise their tier afterwards.
   */
  setBaseAllocation(participantId: string, baseAllocationUsd: number): CreditParticipant {
    const existing = this.getParticipant(participantId);
    if (!existing) throw new Error(`Unknown participant: ${participantId}`);

    const program = this.getProgram(existing.programId);
    if (!program) throw new Error(`Unknown program: ${existing.programId}`);

    const newBaseNano = assertNonNegativeInteger(
      usdToNano(baseAllocationUsd),
      "baseAllocationUsd",
    );

    this.assertPoolCovers(program, newBaseNano - existing.baseAllocationNano);

    this.ledger.allocate(participantId, {
      baseAllocationNano: newBaseNano,
      tier: existing.disclosureTier,
      multipliers: program.disclosureMultipliers,
      note: `sponsor adjusted base allocation to ${newBaseNano} nano-USD`,
    });

    logger.info(
      `Participant ${participantId} base allocation changed ` +
        `${existing.baseAllocationNano} -> ${newBaseNano} nano-USD`,
    );
    return this.getParticipant(participantId)!;
  }

  /**
   * Add the same amount to every active participant's base allocation.
   *
   * The common mid-event action: "everyone is running low, give them another
   * $5." Runs as one transaction so a pool guard failure partway through cannot
   * leave half the cohort topped up and half not.
   */
  topUpAll(
    programId: string,
    additionalUsd: number,
  ): { toppedUp: number; participants: CreditParticipant[] } {
    const program = this.getProgram(programId);
    if (!program) throw new Error(`Unknown program: ${programId}`);

    const additionalNano = assertNonNegativeInteger(
      usdToNano(additionalUsd),
      "additionalUsd",
    );
    if (additionalNano === 0) return { toppedUp: 0, participants: [] };

    const active = this.listParticipants(programId).filter((p) => p.status === "active");
    if (active.length === 0) return { toppedUp: 0, participants: [] };

    this.assertPoolCovers(program, additionalNano * active.length);

    const run = this.db.transaction(() => {
      const updated: CreditParticipant[] = [];
      for (const participant of active) {
        this.ledger.allocate(participant.id, {
          baseAllocationNano: participant.baseAllocationNano + additionalNano,
          tier: participant.disclosureTier,
          multipliers: program.disclosureMultipliers,
          note: `cohort top-up of ${additionalNano} nano-USD`,
        });
        updated.push(this.getParticipant(participant.id)!);
      }
      return updated;
    });

    const participants = run();
    logger.info(
      `Topped up ${participants.length} participant(s) in program ${programId} ` +
        `by ${additionalNano} nano-USD each`,
    );
    return { toppedUp: participants.length, participants };
  }

  /**
   * Refuse a change that would commit more than the sponsor has funded.
   *
   * `deltaBaseNano` is the change in TOTAL base allocation across the program.
   *
   * The comparison is built from total BASE allocations, not current `allocated`
   * figures. Using `allocated` under-counts: a cohort sitting on a low-multiplier
   * tier looks cheap right up until everyone upgrades, and every participant can
   * upgrade unilaterally. Worst case is therefore
   * (total base + delta) x highest multiplier.
   */
  private assertPoolCovers(program: CreditProgram, deltaBaseNano: number): void {
    if (program.poolNano <= 0 || deltaBaseNano <= 0) return;

    const multipliers = resolveMultipliers(program.disclosureMultipliers);
    const maxMultiplier = Math.max(...DISCLOSURE_TIERS.map((t) => multipliers[t]));
    const worstCase = Math.floor(
      (this.programBaseTotal(program.id) + deltaBaseNano) * maxMultiplier,
    );

    if (worstCase > program.poolNano) {
      throw new Error(
        `Change would commit up to ${worstCase} nano-USD against a pool of ${program.poolNano}. ` +
          `The check uses the highest disclosure multiplier (${maxMultiplier}x) because participants ` +
          `can raise their own tier at any time. Either raise the pool to cover the worst case, or use ` +
          `CEILING_DISCLOSURE_MULTIPLIERS so the configured allocation is a ceiling rather than a base.`,
      );
    }
  }

  /**
   * Worst-case money the program could commit: total base allocation x the
   * highest disclosure multiplier.
   *
   * Under bonus multipliers (open 2x) this exceeds the base total; under
   * ceiling multipliers it equals it. This is the number to hold up against
   * both the ledger pool AND the real upstream deposit.
   */
  programWorstCaseCommitment(programId: string): number {
    const program = this.getProgram(programId);
    if (!program) return 0;
    const multipliers = resolveMultipliers(program.disclosureMultipliers);
    const maxMultiplier = Math.max(...DISCLOSURE_TIERS.map((t) => multipliers[t]));
    return Math.floor(this.programBaseTotal(programId) * maxMultiplier);
  }

  /** Sum of every participant's base allocation in a program, in nano-USD. */
  programBaseTotal(programId: string): number {
    const row = this.db
      .prepare(
        `SELECT COALESCE(SUM(base_allocation_nano), 0) AS total
         FROM credit_participants WHERE program_id = ?`,
      )
      .get(programId) as { total: number };
    return Number(row.total ?? 0);
  }

  getParticipant(participantId: string): CreditParticipant | null {
    const row = this.db
      .prepare(`SELECT * FROM credit_participants WHERE id = ?`)
      .get(participantId) as Record<string, unknown> | undefined;
    return row ? mapParticipant(row) : null;
  }

  getParticipantByHandle(programId: string, handle: string): CreditParticipant | null {
    const row = this.db
      .prepare(`SELECT * FROM credit_participants WHERE program_id = ? AND handle = ?`)
      .get(programId, handle) as Record<string, unknown> | undefined;
    return row ? mapParticipant(row) : null;
  }

  listParticipants(programId: string): CreditParticipant[] {
    const rows = this.db
      .prepare(`SELECT * FROM credit_participants WHERE program_id = ? ORDER BY handle ASC`)
      .all(programId) as Array<Record<string, unknown>>;
    return rows.map(mapParticipant);
  }

  /**
   * Change a participant's disclosure tier and re-allocate accordingly.
   *
   * This is participant-initiated by design — the sponsor cannot raise or lower
   * someone's disclosure on their behalf, because a coerced transparency
   * setting is not consent. The budget change is a consequence, not a lever the
   * organiser gets to pull.
   */
  setDisclosureTier(
    participantId: string,
    tier: DisclosureTier,
  ): { participant: CreditParticipant; previousTier: DisclosureTier } {
    if (!isDisclosureTier(tier)) throw new Error(`Invalid disclosure tier: ${String(tier)}`);

    const existing = this.getParticipant(participantId);
    if (!existing) throw new Error(`Unknown participant: ${participantId}`);

    const program = this.getProgram(existing.programId);
    if (!program) throw new Error(`Unknown program: ${existing.programId}`);

    const previousTier = existing.disclosureTier;
    if (previousTier === tier) return { participant: existing, previousTier };

    this.ledger.allocate(participantId, {
      baseAllocationNano: existing.baseAllocationNano,
      tier,
      multipliers: program.disclosureMultipliers,
      note: `disclosure tier changed ${previousTier} -> ${tier}`,
    });

    logger.info(
      `Participant ${participantId} changed disclosure tier ${previousTier} -> ${tier}`,
    );
    return { participant: this.getParticipant(participantId)!, previousTier };
  }

  setParticipantStatus(participantId: string, status: "active" | "suspended" | "revoked"): void {
    this.db
      .prepare(`UPDATE credit_participants SET status = ?, updated_at = ? WHERE id = ?`)
      .run(status, new Date().toISOString(), participantId);
  }

  /** Re-issue a participant's gateway key, invalidating the previous one. */
  rotateKey(participantId: string): string {
    const existing = this.getParticipant(participantId);
    if (!existing) throw new Error(`Unknown participant: ${participantId}`);

    const rawKey = generateGatewayKey();
    this.db
      .prepare(
        `UPDATE credit_participants
         SET key_hash = ?, key_prefix = ?, key_issued_at = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        hashKeyScrypt(rawKey),
        rawKey.slice(0, 8),
        new Date().toISOString(),
        new Date().toISOString(),
        participantId,
      );

    return rawKey;
  }

  // ── Gateway auth ─────────────────────────────────────────────────────────

  /**
   * Resolve a raw gateway key to its participant and program.
   *
   * Candidate lookup is by 8-char prefix, then scrypt verification per
   * candidate — the same shape as `resolveApiKeyRecord`. Returns null for
   * unknown, revoked, or suspended keys without distinguishing between them, so
   * the endpoint can't be used to enumerate valid handles.
   */
  resolveGatewayKey(rawKey: string): ResolvedGatewayKey | null {
    if (typeof rawKey !== "string" || rawKey.length < 12) return null;

    const rows = this.db
      .prepare(
        `SELECT * FROM credit_participants
         WHERE key_prefix = ? AND status = 'active' AND key_hash IS NOT NULL`,
      )
      .all(rawKey.slice(0, 8)) as Array<Record<string, unknown>>;

    for (const row of rows) {
      if (!verifyScrypt(rawKey, String(row.key_hash))) continue;

      const participant = mapParticipant(row);
      const program = this.getProgram(participant.programId);
      if (!program) return null;

      this.db
        .prepare(`UPDATE credit_participants SET last_used_at = ? WHERE id = ?`)
        .run(new Date().toISOString(), participant.id);

      return { participant, program };
    }

    return null;
  }
}

// ── Key helpers (mirrors ApiKeyController) ─────────────────────────────────

function generateGatewayKey(): string {
  return `${GATEWAY_KEY_PREFIX}${randomBytes(24).toString("base64url")}`;
}

function hashKeyScrypt(key: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(key, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

function verifyScrypt(key: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, expectedHash] = parts;
  const derived = scryptSync(key, salt, 64).toString("hex");
  const a = Buffer.from(derived, "hex");
  const b = Buffer.from(expectedHash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// ── Row mappers ────────────────────────────────────────────────────────────

function parseJsonArray(raw: unknown): string[] {
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function parseJsonObject(raw: unknown): Record<string, number> {
  if (typeof raw !== "string") return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "number") out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function mapProgram(row: Record<string, unknown>): CreditProgram {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    name: String(row.name),
    sponsorName: String(row.sponsor_name ?? ""),
    status: String(row.status) as ProgramStatus,
    backend: String(row.backend),
    poolNano: Number(row.pool_nano ?? 0),
    baseAllocationNano: Number(row.base_allocation_nano ?? 0),
    allowedModels: parseJsonArray(row.allowed_models),
    maxOutputTokens: row.max_output_tokens === null ? null : Number(row.max_output_tokens),
    maxInputTokens: row.max_input_tokens === null ? null : Number(row.max_input_tokens),
    startsAt: (row.starts_at as string | null) ?? null,
    endsAt: (row.ends_at as string | null) ?? null,
    disclosureMultipliers: parseJsonObject(row.disclosure_multipliers) as Partial<
      Record<DisclosureTier, number>
    >,
    multipliersMode: multipliersModeOf(
      parseJsonObject(row.disclosure_multipliers) as Partial<Record<DisclosureTier, number>>,
    ),
    requireTrustMode: (row.require_trust_mode as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapParticipant(row: Record<string, unknown>): CreditParticipant {
  const tier = String(row.disclosure_tier);
  return {
    id: String(row.id),
    programId: String(row.program_id),
    workspaceId: String(row.workspace_id),
    handle: String(row.handle),
    displayName: (row.display_name as string | null) ?? null,
    projectTag: (row.project_tag as string | null) ?? null,
    disclosureTier: (isDisclosureTier(tier) ? tier : "standard") as DisclosureTier,
    baseAllocationNano: Number(row.base_allocation_nano ?? 0),
    allocatedNano: Number(row.allocated_nano ?? 0),
    consumedNano: Number(row.consumed_nano ?? 0),
    heldNano: Number(row.held_nano ?? 0),
    overdrawnNano: Number(row.overdrawn_nano ?? 0),
    requestCount: Number(row.request_count ?? 0),
    keyPrefix: (row.key_prefix as string | null) ?? null,
    keyIssuedAt: (row.key_issued_at as string | null) ?? null,
    lastUsedAt: (row.last_used_at as string | null) ?? null,
    status: String(row.status),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

let shared: CreditProgramService | null = null;
export function sharedCreditProgramService(): CreditProgramService {
  if (!shared) shared = new CreditProgramService();
  return shared;
}
