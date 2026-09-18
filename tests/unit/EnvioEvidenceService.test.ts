import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { CreRun, CreArtifact } from '../../src/backend/cre/types.js';

let stateDir: string;

beforeEach(() => {
  stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'envio-sync-test-'));
});

afterEach(() => {
  fs.rmSync(stateDir, { recursive: true, force: true });
});

function inMemoryPersistence() {
  const runs: CreRun[] = [];
  return {
    runs,
    persistence: {
      async append(run: CreRun) {
        runs.unshift(run);
      },
      async loadAll() {
        return [...runs];
      },
      async writeAll(next: CreRun[]) {
        runs.length = 0;
        runs.push(...next);
      },
      async truncate() {
        runs.length = 0;
      },
    },
  };
}

const stubLedger = { record: async () => ({}) };

async function makeService(overrides: {
  fetchImpl?: typeof fetch;
  enabled?: boolean;
  runStore?: InstanceType<
    typeof import('../../src/backend/cre/storage/CreRunStore.js').CreRunStore
  >;
}) {
  const { EnvioEvidenceService } = await import(
    '../../src/backend/services/blockchain/envio/EnvioEvidenceService.js'
  );
  const { CreRunStore } = await import(
    '../../src/backend/cre/storage/CreRunStore.js'
  );
  const mem = inMemoryPersistence();
  const runStore =
    overrides.runStore ??
    new CreRunStore({
      persistence: mem.persistence,
      ledger: stubLedger as never,
    });
  const service = new EnvioEvidenceService({
    enabled: overrides.enabled ?? true,
    graphqlUrl: 'http://localhost:8080/v1/graphql',
    statePath: path.join(stateDir, 'envio-sync.json'),
    fetchImpl: overrides.fetchImpl,
    runStore,
  });
  return { service, runStore, mem };
}

/** fetch stub: returns rows keyed by the entity table parsed from the query. */
function graphqlStub(tables: Record<string, unknown[]>) {
  const calls: Array<{ table: string; where: unknown }> = [];
  const impl: typeof fetch = (async (_url: unknown, init?: { body?: string }) => {
    const body = JSON.parse(init?.body ?? '{}') as {
      query: string;
      variables?: { where?: unknown };
    };
    const match = /query Sync(\w+)/.exec(body.query);
    const table = match?.[1] ?? '';
    calls.push({ table, where: body.variables?.where });
    return {
      ok: true,
      json: async () => ({ data: { [table]: tables[table] ?? [] } }),
    } as Response;
  }) as typeof fetch;
  return { impl, calls };
}

const settlementRow = {
  id: '10143-0xabc-0',
  chainId: 10143,
  contract: '0xac0893567d43c3e7e6e35a72803df05416c1f20d',
  from: '0xsender',
  to: '0xrecipient',
  value: '5000000',
  txHash: '0xabc',
  blockNumber: 100,
  logIndex: 0,
  timestamp: 1700000000,
};

const registrationRow = {
  id: '143-0xdef-1',
  chainId: 143,
  registry: '0x8004a169fb4a3325136eb29fa0ceb6d2e539a432',
  agentId: '7',
  owner: '0xowner',
  txHash: '0xdef',
  blockNumber: 200,
  logIndex: 1,
  timestamp: 1700000100,
};

const feedbackRow = {
  id: '143-7-0xclient-1',
  chainId: 143,
  registry: '0x8004baa17c55a88189ae136b182e5fda19de9b63',
  agentId: '7',
  clientAddress: '0xclient',
  feedbackIndex: 1,
  value: '90',
  valueDecimals: 0,
  tag1: 'quality',
  tag2: '',
  endpoint: '',
  feedbackURI: '',
  txHash: '0xfee',
  blockNumber: 201,
  logIndex: 0,
  timestamp: 1700000200,
  revoked: false,
};

describe('EnvioEvidenceService', () => {
  it('refuses to sync when not configured', async () => {
    const { service } = await makeService({ enabled: false });
    const result = await service.syncOnce();
    expect('error' in result).toBe(true);
  });

  it('materializes indexed events as signed CRE artifacts in one run', async () => {
    const { impl } = graphqlStub({
      SettlementTransfer: [settlementRow],
      AgentRegistration: [registrationRow],
      AgentFeedback: [feedbackRow],
    });
    const { service, runStore } = await makeService({ fetchImpl: impl });

    const result = await service.syncOnce();
    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.newEvents).toBe(3);
    expect(result.byKind).toEqual({ settlement: 1, identity: 1, feedback: 1 });
    expect(result.runId).toBeTruthy();

    const run = await runStore.get(result.runId!);
    expect(run).toBeTruthy();
    expect(run!.artifacts).toHaveLength(3);
    const types = run!.artifacts.map((a: CreArtifact) => a.type).sort();
    expect(types).toEqual([
      'envio_feedback',
      'envio_identity',
      'envio_settlement',
    ]);
    for (const a of run!.artifacts) {
      expect(a.evidence?.hash).toBeTruthy();
      const data = a.data as Record<string, unknown>;
      expect(data.source).toBe('envio-hyperindex');
      expect(String(data.transactionLink)).toContain('monadscan');
    }
  });

  it('advances the cursor and dedupes across syncs', async () => {
    // First call returns a row; subsequent calls return empty (server-side
    // cursor filter). Verify the second call passes the cursor as `where`.
    const calls: unknown[] = [];
    let first = true;
    const impl: typeof fetch = (async (_u: unknown, init?: { body?: string }) => {
      const body = JSON.parse(init?.body ?? '{}') as {
        query: string;
        variables?: { where?: unknown };
      };
      calls.push(body.variables?.where);
      const table = /query Sync(\w+)/.exec(body.query)?.[1] ?? '';
      const rows =
        first && table === 'SettlementTransfer' ? [settlementRow] : [];
      return {
        ok: true,
        json: async () => ({ data: { [table]: rows } }),
      } as Response;
    }) as typeof fetch;

    const { service, runStore } = await makeService({ fetchImpl: impl });
    const r1 = await service.syncOnce();
    expect('error' in r1).toBe(false);
    if ('error' in r1) return;
    expect(r1.newEvents).toBe(1);
    first = false;

    const r2 = await service.syncOnce();
    expect('error' in r2).toBe(false);
    if ('error' in r2) return;
    expect(r2.newEvents).toBe(0);

    // The second settlement query carried the (block,logIndex) cursor.
    const settlementWhere = calls[calls.length - 3] as {
      _or?: unknown[];
    };
    expect(settlementWhere?._or).toBeTruthy();

    // Only one evidence run total.
    const runs = await runStore.list();
    expect(runs).toHaveLength(1);
  });

  it('links evidence to the originating run via txHash', async () => {
    const { service, runStore } = await makeService({
      fetchImpl: graphqlStub({ SettlementTransfer: [settlementRow] }).impl,
    });

    // Seed a spend run whose artifact references the same txHash.
    const { CreRunRecorder } = await import(
      '../../src/backend/cre/runRecorder.js'
    );
    const origin = new CreRunRecorder({
      workflow: 'spend',
      mode: 'local',
      projectId: 'ws-test',
    });
    await runStore.add(origin.getRun());
    await origin.addArtifact({
      type: 'receipt_verification',
      data: { transactionHash: '0xABC' },
    });
    await origin.finish(true);
    await runStore.replace(origin.getRun());

    const result = await service.syncOnce();
    if ('error' in result) throw new Error(result.error);
    const run = await runStore.get(result.runId!);
    const artifact = run!.artifacts[0].data as { linkedRunId?: string };
    expect(artifact.linkedRunId).toBe(origin.getRun().runId);
  });
});
