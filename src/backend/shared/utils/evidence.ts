import crypto from "node:crypto";
import type { CreArtifact, CreRun, CreRunEvent } from "../../cre/types.js";

export interface EvidenceEnvelope {
  hash: string;
  cid?: string;
  artifactIds?: string[];
  policyIds?: string[];
  citations?: string[];
}

type JsonLike = null | boolean | number | string | JsonLike[] | { [key: string]: JsonLike };

function normalizeForHash(value: unknown): JsonLike {
  if (value === null || value === undefined) return null;
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeForHash(item));
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, JsonLike> = {};
    for (const key of Object.keys(obj).sort()) {
      if (key === "evidence") continue;
      const normalized = normalizeForHash(obj[key]);
      if (normalized !== null || obj[key] === null) {
        out[key] = normalized;
      }
    }
    return out;
  }
  return String(value);
}

export function hashEvidence(value: unknown): string {
  const serialized = JSON.stringify(normalizeForHash(value));
  return crypto.createHash("sha256").update(serialized).digest("hex");
}

export function extractCid(value: unknown): string | undefined {
  const seen = new Set<unknown>();
  const queue: unknown[] = [value];
  const cidPattern = /^(bafy[a-z0-9]+|baga[a-z0-9]+|Qm[1-9A-HJ-NP-Za-km-z]{44}|ipfs_[a-zA-Z0-9_-]+)$/;

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || seen.has(current)) continue;
    seen.add(current);

    if (typeof current === "string" && cidPattern.test(current)) {
      return current;
    }

    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }

    if (typeof current === "object") {
      const entries = Object.entries(current as Record<string, unknown>);
      for (const [key, entryValue] of entries) {
        if (
          typeof entryValue === "string" &&
          key.toLowerCase().includes("cid") &&
          entryValue.trim()
        ) {
          return entryValue;
        }
        queue.push(entryValue);
      }
    }
  }

  return undefined;
}

function extractCitationLabels(run: CreRun): string[] {
  return (run.provenance?.citations || []).map((citation) => citation.label);
}

export function enrichArtifactEvidence(artifact: CreArtifact): CreArtifact {
  const cid = extractCid(artifact.data);
  return {
    ...artifact,
    evidence: {
      hash: artifact.evidence?.hash || hashEvidence({
        id: artifact.id,
        type: artifact.type,
        createdAt: artifact.createdAt,
        data: artifact.data,
      }),
      signature: artifact.evidence?.signature,
      signer: artifact.evidence?.signer,
      ...(cid ? { cid } : {}),
    },
  };
}

export function enrichRunEventEvidence(
  event: CreRunEvent,
  run: CreRun,
): CreRunEvent {
  const cid = extractCid(event.payload);
  return {
    ...event,
    evidence: {
      hash: event.evidence?.hash || hashEvidence({
        id: event.id,
        runId: event.runId,
        type: event.type,
        timestamp: event.timestamp,
        stepName: event.stepName,
        payload: event.payload,
      }),
      signature: event.evidence?.signature,
      signer: event.evidence?.signer,
      artifactIds: run.artifacts.map((artifact) => artifact.id),
      citations: extractCitationLabels(run),
      ...(cid ? { cid } : {}),
    },
  };
}

export function enrichCreRunEvidence(run: CreRun): CreRun {
  const artifacts = run.artifacts.map((artifact) => enrichArtifactEvidence(artifact));
  const baseRun: CreRun = {
    ...run,
    artifacts,
    events: run.events || [],
  };
  const events = (baseRun.events || []).map((event) =>
    enrichRunEventEvidence(event, baseRun),
  );
  const runCid =
    artifacts.map((artifact) => artifact.evidence?.cid).find(Boolean) ||
    extractCid(run.provenance?.citations);

  return {
    ...baseRun,
    events,
    evidence: {
      hash: run.evidence?.hash || hashEvidence({
        runId: run.runId,
        projectId: run.projectId,
        workflow: run.workflow,
        mode: run.mode,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        ok: run.ok,
        status: run.status,
        parentRunId: run.parentRunId,
        retryCount: run.retryCount,
        approvalState: run.approvalState,
        approvalReason: run.approvalReason,
        plan: run.plan,
        metrics: run.metrics,
        provenance: run.provenance,
        steps: run.steps,
        artifacts: artifacts.map((artifact) => ({
          id: artifact.id,
          hash: artifact.evidence?.hash,
          cid: artifact.evidence?.cid,
        })),
        events: events.map((event) => ({
          id: event.id,
          hash: event.evidence?.hash,
        })),
      }),
      signature: run.evidence?.signature,
      signer: run.evidence?.signer,
      artifactIds: artifacts.map((artifact) => artifact.id),
      citations: extractCitationLabels(run),
      ...(runCid ? { cid: runCid } : {}),
    },
  };
}
