/**
 * EnvioEvidenceService — materializes indexed chain events into signed CRE
 * artifacts.
 *
 * The HyperIndex project in indexers/envio/ indexes Cognivern's Monad rails
 * (aUSDC settlements, ERC-8004 registrations, reputation feedback) and serves
 * them over GraphQL. This service is a pull consumer: each sync fetches rows
 * newer than a persisted (blockNumber, logIndex) cursor, dedupes by event id,
 * links each event back to the run that produced the tx when one exists, and
 * records the batch as a CRE run of `envio_*` artifacts. Chain reads stay off
 * the API path — the indexer is the only data source.
 */

import fs from "node:fs";
import path from "node:path";
import { envioConfig, monadConfig } from "@backend/shared/config/index.js";
import { creRunStore, type CreRunStore } from "@backend/cre/storage/CreRunStore.js";
import { CreRunRecorder } from "@backend/cre/runRecorder.js";
import type { CreRun } from "@backend/cre/types.js";

type EventKind = "settlement" | "identity" | "feedback";

interface IndexedRow {
  id: string;
  chainId: number;
  txHash: string;
  blockNumber: number;
  logIndex: number;
  timestamp: number;
  [key: string]: unknown;
}

interface Cursor {
  blockNumber: number;
  logIndex: number;
}

interface RecentEvent {
  kind: EventKind;
  id: string;
  chainId: number;
  txHash: string;
  blockNumber: number;
  summary: string;
  linkedRunId?: string;
  transactionLink: string;
  indexedAt: string;
}

interface EnvioSyncState {
  cursor: Partial<Record<EventKind, Cursor>>;
  lastSyncAt: string | null;
  counts: Record<EventKind, number>;
  recent: RecentEvent[];
}

const KIND_TABLE: Record<EventKind, string> = {
  settlement: "SettlementTransfer",
  identity: "AgentRegistration",
  feedback: "AgentFeedback",
};

const KIND_ARTIFACT: Record<
  EventKind,
  CreRun["artifacts"][number]["type"]
> = {
  settlement: "envio_settlement",
  identity: "envio_identity",
  feedback: "envio_feedback",
};

const KIND_FIELDS: Record<EventKind, string> = {
  settlement: "id chainId contract from to value txHash blockNumber logIndex timestamp",
  identity: "id chainId registry agentId owner txHash blockNumber logIndex timestamp",
  feedback:
    "id chainId registry agentId clientAddress feedbackIndex value valueDecimals tag1 tag2 endpoint feedbackURI txHash blockNumber logIndex timestamp revoked",
};

const PAGE_LIMIT = 500;
const RECENT_CAP = 100;

const EMPTY_STATE: EnvioSyncState = {
  cursor: {},
  lastSyncAt: null,
  counts: { settlement: 0, identity: 0, feedback: 0 },
  recent: [],
};

type FetchImpl = typeof fetch;

export class EnvioEvidenceService {
  constructor(
    private readonly deps: {
      runStore?: CreRunStore;
      fetchImpl?: FetchImpl;
      graphqlUrl?: string;
      apiKey?: string;
      statePath?: string;
      enabled?: boolean;
    } = {},
  ) {}

  private get runStore(): CreRunStore {
    return this.deps.runStore ?? creRunStore;
  }

  private get fetchImpl(): FetchImpl {
    return this.deps.fetchImpl ?? fetch;
  }

  private get graphqlUrl(): string {
    return this.deps.graphqlUrl ?? envioConfig.graphqlUrl;
  }

  private get apiKey(): string {
    return this.deps.apiKey ?? envioConfig.apiKey;
  }

  private get statePath(): string {
    return this.deps.statePath ?? envioConfig.statePath;
  }

  private get enabled(): boolean {
    return this.deps.enabled ?? envioConfig.configured;
  }

  status() {
    const state = this.readState();
    return {
      enabled: this.enabled,
      configured: this.enabled,
      graphqlUrl: this.graphqlUrl || null,
      lastSyncAt: state.lastSyncAt,
      counts: state.counts,
      cursor: state.cursor,
    };
  }

  listRecentEvents(limit = 50) {
    return this.readState().recent.slice(0, Math.max(1, limit));
  }

  /**
   * One sync pass: fetch new indexed rows, materialize a CRE run of signed
   * artifacts. Idempotent — the persisted cursor + id dedupe mean re-syncs
   * only ever pick up genuinely new events.
   */
  async syncOnce(projectId = "envio-indexer"): Promise<
    | {
        newEvents: number;
        byKind: Record<EventKind, number>;
        runId?: string;
      }
    | { error: string }
  > {
    if (!this.enabled) {
      return {
        error:
          "Envio sync is not configured — set ENVIO_ENABLED=true and ENVIO_GRAPHQL_URL",
      };
    }

    const state = this.readState();
    const collected: Array<{ kind: EventKind; row: IndexedRow }> = [];

    for (const kind of Object.keys(KIND_TABLE) as EventKind[]) {
      const rows = await this.fetchPage(kind, state.cursor[kind] ?? null);
      collected.push(...rows.map((row) => ({ kind, row })));
      const last = rows[rows.length - 1];
      if (last) {
        state.cursor[kind] = {
          blockNumber: last.blockNumber,
          logIndex: last.logIndex,
        };
      }
    }

    if (collected.length === 0) {
      state.lastSyncAt = new Date().toISOString();
      this.writeState(state);
      return {
        newEvents: 0,
        byKind: { settlement: 0, identity: 0, feedback: 0 },
      };
    }

    // Link each event back to the run that produced its tx, when that run is
    // already in the ledger (spend_intent / receipt_verification artifacts
    // carry transactionHash).
    const runs = await this.runStore.list();
    const parentByTx = new Map<string, string>();
    for (const { row } of collected) {
      const tx = row.txHash?.toLowerCase();
      if (!tx || parentByTx.has(tx)) continue;
      const parent = runs.find((run) =>
        run.artifacts?.some((a) => {
          const data = a.data as Record<string, unknown> | undefined;
          const h =
            (data?.transactionHash as string | undefined) ??
            (data?.txHash as string | undefined);
          return h?.toLowerCase() === tx;
        }),
      );
      if (parent) parentByTx.set(tx, parent.runId);
    }

    const recorder = new CreRunRecorder({
      workflow: "generic",
      mode: "local",
      projectId,
    });
    await this.runStore.add(recorder.getRun());

    const byKind: Record<EventKind, number> = {
      settlement: 0,
      identity: 0,
      feedback: 0,
    };

    for (const { kind, row } of collected) {
      const linkedRunId = row.txHash
        ? parentByTx.get(row.txHash.toLowerCase())
        : undefined;
      const artifactData = {
        source: "envio-hyperindex",
        kind,
        chainId: row.chainId,
        txHash: row.txHash,
        transactionLink: monadConfig.explorerTxUrl(row.chainId, row.txHash),
        blockNumber: row.blockNumber,
        logIndex: row.logIndex,
        timestamp: row.timestamp,
        params: this.rowParams(row),
        linkedRunId: linkedRunId ?? null,
      };
      await recorder.addArtifact({
        type: KIND_ARTIFACT[kind],
        data: artifactData,
      });
      byKind[kind] += 1;
      state.counts[kind] += 1;
      state.recent.unshift({
        kind,
        id: row.id,
        chainId: row.chainId,
        txHash: row.txHash,
        blockNumber: row.blockNumber,
        summary: this.summarize(kind, row),
        linkedRunId,
        transactionLink: monadConfig.explorerTxUrl(row.chainId, row.txHash),
        indexedAt: new Date().toISOString(),
      });
    }
    state.recent = state.recent.slice(0, RECENT_CAP);

    await recorder.finish(true);
    await this.runStore.replace(recorder.getRun());

    state.lastSyncAt = new Date().toISOString();
    this.writeState(state);

    return {
      newEvents: collected.length,
      byKind,
      runId: recorder.getRun().runId,
    };
  }

  private rowParams(row: IndexedRow) {
    const { id, chainId, txHash, blockNumber, logIndex, timestamp, ...rest } =
      row;
    return rest;
  }

  private summarize(kind: EventKind, row: IndexedRow): string {
    if (kind === "settlement") {
      return `aUSDC transfer ${String(row.from)} → ${String(row.to)} (${String(row.value)} raw units)`;
    }
    if (kind === "identity") {
      return `ERC-8004 agent #${String(row.agentId)} registered to ${String(row.owner)}`;
    }
    const prefix = row.revoked ? "revoked feedback" : "feedback";
    return `ERC-8004 ${prefix} on agent #${String(row.agentId)} by ${String(row.clientAddress)} (value ${String(row.value)}e-${String(row.valueDecimals)})`;
  }

  private async fetchPage(
    kind: EventKind,
    cursor: Cursor | null,
  ): Promise<IndexedRow[]> {
    const table = KIND_TABLE[kind];
    const where = cursor
      ? {
          _or: [
            { blockNumber: { _gt: cursor.blockNumber } },
            {
              _and: [
                { blockNumber: { _eq: cursor.blockNumber } },
                { logIndex: { _gt: cursor.logIndex } },
              ],
            },
          ],
        }
      : {};

    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (this.apiKey) headers["x-hasura-admin-secret"] = this.apiKey;

    const res = await this.fetchImpl(this.graphqlUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: `query Sync${table}($where: ${table}_bool_exp) {
          ${table}(where: $where, order_by: [{blockNumber: asc}, {logIndex: asc}], limit: ${PAGE_LIMIT}) {
            ${KIND_FIELDS[kind]}
          }
        }`,
        variables: { where },
      }),
    });
    if (!res.ok) {
      throw new Error(`Envio GraphQL ${table} query failed: HTTP ${res.status}`);
    }
    const body = (await res.json()) as {
      data?: Record<string, IndexedRow[]>;
      errors?: Array<{ message: string }>;
    };
    if (body.errors?.length) {
      throw new Error(
        `Envio GraphQL ${table} query failed: ${body.errors[0].message}`,
      );
    }
    return body.data?.[table] ?? [];
  }

  private readState(): EnvioSyncState {
    try {
      const raw = fs.readFileSync(this.statePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<EnvioSyncState>;
      return {
        ...EMPTY_STATE,
        ...parsed,
        counts: { ...EMPTY_STATE.counts, ...(parsed.counts ?? {}) },
        cursor: parsed.cursor ?? {},
        recent: parsed.recent ?? [],
      };
    } catch {
      return { ...EMPTY_STATE, counts: { ...EMPTY_STATE.counts }, recent: [] };
    }
  }

  private writeState(state: EnvioSyncState) {
    const dir = path.dirname(this.statePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.statePath, JSON.stringify(state, null, 2));
  }
}

export const envioEvidenceService = new EnvioEvidenceService();
