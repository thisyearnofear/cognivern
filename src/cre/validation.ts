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
});

export const creRunSchema = z.object({
  runId: z.string(),
  projectId: z.string().optional(),
  workflow: z.string(),
  mode: z.string(),
  startedAt: z.string(),
  finishedAt: z.string().optional(),
  ok: z.boolean(),
  steps: z.array(stepSchema),
  artifacts: z.array(artifactSchema),
});

export type CreRunInput = z.infer<typeof creRunSchema>;
