import { z } from "zod";

const stepSchema = z.object({
  kind: z.string(),
  name: z.string(),
  startedAt: z.string(),
  finishedAt: z.string().optional(),
  ok: z.boolean(),
  summary: z.string().optional(),
  details: z.record(z.unknown()).optional(),
});

const artifactSchema = z.object({
  id: z.string(),
  type: z.string(),
  createdAt: z.string(),
  data: z.unknown(),
  evidence: z
    .object({
      hash: z.string(),
      cid: z.string().optional(),
    })
    .optional(),
});

const eventSchema = z.object({
  id: z.string(),
  runId: z.string(),
  type: z.string(),
  timestamp: z.string(),
  stepName: z.string().optional(),
  payload: z.record(z.unknown()).optional(),
  evidence: z
    .object({
      hash: z.string(),
      cid: z.string().optional(),
      artifactIds: z.array(z.string()).optional(),
      citations: z.array(z.string()).optional(),
    })
    .optional(),
});

const planStepSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  enabled: z.boolean(),
  status: z.enum(["pending", "approved", "rejected"]).optional(),
});

const planSchema = z.object({
  version: z.number(),
  updatedAt: z.string(),
  summary: z.string().optional(),
  steps: z.array(planStepSchema),
});

export const creRunSchema = z.object({
  runId: z.string(),
  projectId: z.string().optional(),
  workflow: z.string(),
  mode: z.string(),
  startedAt: z.string(),
  finishedAt: z.string().optional(),
  ok: z.boolean(),
  status: z.string().optional(),
  parentRunId: z.string().optional(),
  retryCount: z.number().optional(),
  currentStepName: z.string().optional(),
  requiresApproval: z.boolean().optional(),
  approvalState: z.string().optional(),
  approvalReason: z.string().optional(),
  plan: planSchema.optional(),
  controls: z
    .object({
      canCancel: z.boolean(),
      canRetry: z.boolean(),
      canApprove: z.boolean(),
    })
    .optional(),
  metrics: z
    .object({
      latencyMs: z.number().optional(),
      stepCount: z.number().optional(),
      artifactCount: z.number().optional(),
      estimatedTokens: z.number().optional(),
      estimatedCostUsd: z.number().optional(),
    })
    .optional(),
  provenance: z
    .object({
      source: z.string(),
      workflowVersion: z.string().optional(),
      model: z.string().optional(),
      citations: z
        .array(z.object({ label: z.string(), value: z.string() }))
        .optional(),
    })
    .optional(),
  evidence: z
    .object({
      hash: z.string(),
      cid: z.string().optional(),
      artifactIds: z.array(z.string()).optional(),
      citations: z.array(z.string()).optional(),
    })
    .optional(),
  events: z.array(eventSchema).optional(),
  steps: z.array(stepSchema),
  artifacts: z.array(artifactSchema),
});

export type CreRunInput = z.infer<typeof creRunSchema>;
