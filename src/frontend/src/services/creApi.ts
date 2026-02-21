import { ApiResponse } from "./types";
import { getApiUrl } from "../utils/api";

const DEFAULT_HEADERS = {
  "Content-Type": "application/json",
  "X-API-KEY": import.meta.env.VITE_API_KEY || "development-api-key",
};

export interface CreRun {
  runId: string;
  workflow: string;
  mode: string;
  startedAt: string;
  finishedAt?: string;
  ok: boolean;
  steps: Array<{
    kind: string;
    name: string;
    startedAt: string;
    finishedAt?: string;
    ok: boolean;
    summary?: string;
    details?: Record<string, unknown>;
  }>;
  artifacts: Array<{
    id: string;
    type: string;
    createdAt: string;
    data: unknown;
  }>;
}

async function request<T>(endpoint: string, options: RequestInit = {}) {
  const res = await fetch(getApiUrl(endpoint), {
    headers: { ...DEFAULT_HEADERS, ...(options.headers || {}) },
    ...options,
  });

  const json = await res.json();
  if (!res.ok) {
    return { success: false, error: json?.error || res.statusText } as ApiResponse<T>;
  }

  return { success: true, data: json } as ApiResponse<T>;
}

export const creApi = {
  listRuns: async (projectId: string = "default") =>
    request<{ success: boolean; runs: CreRun[] }>(
      `/api/cre/runs?projectId=${encodeURIComponent(projectId)}`
    ),
  getRun: async (runId: string) =>
    request<{ success: boolean; run: CreRun }>(`/api/cre/runs/${runId}`),
  triggerForecast: async (params: { writeAttestation?: boolean } = {}) =>
    request<{ success: boolean; runId: string; run: CreRun }>("/api/cre/forecast", {
      method: "POST",
      body: JSON.stringify({ writeAttestation: Boolean(params.writeAttestation) }),
    }),
};
