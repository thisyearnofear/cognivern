/**
 * useFheProgress — Shared hook for async FHE evaluation progress tracking.
 *
 * Encapsulates the SSE connection lifecycle and 4-step progress state that
 * is used identically by both GovernanceCheck (full page) and
 * CompactGovernanceCheck (onboarding wizard).
 *
 * Steps tracked:
 *   0 — Loading confidential policy
 *   1 — Encrypting spend parameters
 *   2 — Submitting & confirming on Fhenix
 *   3 — Recording audit trail
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { apiClient } from "@/lib/api-client";

// ── Types ────────────────────────────────────────────────────────────────

export type FheStepStatus = "pending" | "active" | "done" | "error";

export interface FheStep {
  label: string;
  status: FheStepStatus;
}

export interface FheSseCallbacks {
  /** Called when the evaluation completes successfully with the result payload */
  onComplete: (resultData: Record<string, unknown>) => void;
  /** Called when the evaluation errors out */
  onError: (errMsg: string) => void;
}

export interface UseFheProgressReturn {
  /** Current FHE run ID (null when no async evaluation is in progress) */
  fheRunId: string | null;
  /** Update fheRunId externally */
  setFheRunId: (id: string | null) => void;
  /** The 4-step progress array */
  fheSteps: FheStep[];
  /** Reset all steps to pending */
  resetFheSteps: () => void;
  /** Update a single step's status */
  updateFheStep: (index: number, status: FheStepStatus) => void;
  /**
   * Connect SSE for a given runId and manage step transitions automatically.
   * Returns an AbortController that can be used to disconnect.
   */
  connectToFheSse: (runId: string, callbacks: FheSseCallbacks) => AbortController;
}

// ── Constants ────────────────────────────────────────────────────────────

const DEFAULT_FHE_STEPS: FheStep[] = [
  { label: "Loading confidential policy", status: "pending" },
  { label: "Encrypting spend parameters", status: "pending" },
  { label: "Submitting & confirming on Fhenix", status: "pending" },
  { label: "Recording audit trail", status: "pending" },
];

/** Maps CreRun step names to our display step indices */
const STEP_NAME_TO_INDEX: Record<string, number> = {
  load_policy: 0,
  encrypt_params: 1,
  submit_to_fhenix: 2,
  record_audit: 3,
};

// ── Hook ─────────────────────────────────────────────────────────────────

export function useFheProgress(): UseFheProgressReturn {
  const [fheRunId, setFheRunId] = useState<string | null>(null);
  const [fheSteps, setFheSteps] = useState<FheStep[]>(DEFAULT_FHE_STEPS);
  const fheAbortRef = useRef<AbortController | null>(null);

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => {
      if (fheAbortRef.current) {
        fheAbortRef.current.abort();
        fheAbortRef.current = null;
      }
    };
  }, []);

  const resetFheSteps = useCallback(() => {
    setFheSteps((prev) => prev.map((s) => ({ ...s, status: "pending" as const })));
  }, []);

  const updateFheStep = useCallback(
    (index: number, status: FheStepStatus) => {
      setFheSteps((prev) => {
        const next = [...prev];
        if (next[index]) next[index] = { ...next[index], status };
        return next;
      });
    },
    [],
  );

  /** Mark a step as active when a tool_call_started event arrives */
  const handleToolCallStarted = useCallback(
    (stepName: string | undefined) => {
      if (!stepName) return;
      const idx = STEP_NAME_TO_INDEX[stepName];
      if (idx !== undefined) updateFheStep(idx, "active");
    },
    [updateFheStep],
  );

  /** Mark a step as done and advance to the next pending step */
  const handleToolResult = useCallback(
    (stepName: string | undefined) => {
      if (!stepName) return;
      const idx = STEP_NAME_TO_INDEX[stepName];
      if (idx === undefined) return;
      updateFheStep(idx, "done");
      // Mark the next pending step as active
      setFheSteps((prev) => {
        const next = [...prev];
        const nextPending = next.findIndex(
          (s, i) => i > idx && s.status === "pending",
        );
        if (nextPending !== -1 && nextPending < next.length) {
          next[nextPending] = { ...next[nextPending], status: "active" };
        }
        return next;
      });
    },
    [updateFheStep],
  );

  /** Mark remaining pending/active steps as error */
  const handleRunFailed = useCallback(() => {
    setFheSteps((prev) =>
      prev.map((s) =>
        s.status === "active" || s.status === "pending"
          ? { ...s, status: "error" as const }
          : s,
      ),
    );
  }, []);

  /** Mark all steps as done */
  const markAllDone = useCallback(() => {
    setFheSteps((prev) => prev.map((s) => ({ ...s, status: "done" as const })));
  }, []);

  const connectToFheSse = useCallback(
    (runId: string, callbacks: FheSseCallbacks): AbortController => {
      // Defensively abort any prior SSE connection
      if (fheAbortRef.current) {
        fheAbortRef.current.abort();
        fheAbortRef.current = null;
      }
      // Mark first step as active immediately
      updateFheStep(0, "active");

      const abortController = apiClient.connectFheSse(runId, {
        onEvent: (event) => {
          if (event.type === "tool_call_started") {
            handleToolCallStarted(event.stepName);
          } else if (event.type === "tool_result") {
            handleToolResult(event.stepName);
          } else if (event.type === "run_failed") {
            handleRunFailed();
          }
        },
        onComplete: (resultData) => {
          markAllDone();
          callbacks.onComplete(resultData);
        },
        onError: (errMsg) => {
          handleRunFailed();
          callbacks.onError(errMsg);
        },
      });

      fheAbortRef.current = abortController;
      return abortController;
    },
    [updateFheStep, handleToolCallStarted, handleToolResult, handleRunFailed, markAllDone],
  );

  return {
    fheRunId,
    setFheRunId,
    fheSteps,
    resetFheSteps,
    updateFheStep,
    connectToFheSse,
  };
}
