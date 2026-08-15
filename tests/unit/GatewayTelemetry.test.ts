/**
 * Gateway telemetry seams.
 *
 * These test the two invariants that keep the alignment safe:
 *  1. HydraDB ingestion is a no-op when the integration is disabled — the
 *     gateway's fire-and-forget ingest must never throw or block a request.
 *  2. Emitting OTel metrics is safe with no SDK registered (the API meter is a
 *     no-op), so `recordGatewayInference` can run on any deployment.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Force HydraDB off so the no-op path is exercised. Set (not deleted) because
// config.ts loads dotenv at import, which restores deleted vars from .env — but
// dotenv never overrides a var that is already set. Same pattern as
// HydraDbMandateContextService.test.ts.
process.env.HYDRADB_ENABLED = "false";
delete process.env.HYDRADB_API_KEY;
delete process.env.HYDRADB_BASE_URL;

const { HydraDbIngestionService } = await import(
  "@backend/services/hydradb/HydraDbIngestionService.js"
);
const { recordGatewayInference } = await import("@backend/observability/gateway.js");

describe("HydraDB inference ingest seam", () => {
  const service = new HydraDbIngestionService();

  it("no-ops (returns null) when HydraDB is disabled", async () => {
    expect(service.isEnabled()).toBe(false);

    const id = await service.ingestInferenceRecord({
      recordId: "inf_test",
      programId: "prog_test",
      programName: "Test",
      workspaceId: "workspace-test",
      participantHandle: "alice",
      backend: "zerog-router",
      provider: "0xprovider",
      model: "glm-5.2",
      status: "ok",
      deniedReason: null,
      inputTokens: 100,
      outputTokens: 50,
      cachedTokens: 0,
      costUsd: 0.000123,
      latencyMs: 1200,
      streamed: false,
      trustTier: "verified",
      teeVerified: true,
      disclosureTier: "standard",
      taskClass: "code",
      projectTag: "project-x",
      promptExcerpt: null,
      responseExcerpt: null,
      createdAt: new Date().toISOString(),
    });

    expect(id).toBeNull();
  });
});

describe("gateway metric emission", () => {
  it("records without throwing when no OTel SDK is registered", () => {
    expect(() =>
      recordGatewayInference({
        status: "ok",
        backend: "zerog-router",
        model: "glm-5.2",
        programId: "prog_test",
        disclosureTier: "open",
        provider: "0xprovider",
        inputTokens: 100,
        outputTokens: 50,
        costUsd: 0.000123,
        latencyMs: 800,
        streamed: false,
      }),
    ).not.toThrow();

    expect(() =>
      recordGatewayInference({
        status: "denied",
        backend: "zerog-router",
        model: "glm-5.2",
        programId: "prog_test",
        disclosureTier: "private",
        provider: null,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        latencyMs: 0,
        streamed: false,
      }),
    ).not.toThrow();
  });
});
