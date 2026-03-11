import { CreRunEvent } from "./creApi";

export enum AgUiEventType {
  RUN_STARTED = "RUN_STARTED",
  RUN_FINISHED = "RUN_FINISHED",
  RUN_ERROR = "RUN_ERROR",
  STEP_STARTED = "STEP_STARTED",
  STEP_FINISHED = "STEP_FINISHED",
  TEXT_MESSAGE_CONTENT = "TEXT_MESSAGE_CONTENT",
  TOOL_CALL_START = "TOOL_CALL_START",
  TOOL_CALL_RESULT = "TOOL_CALL_RESULT",
  CUSTOM = "CUSTOM",
}

export interface AgUiEvent {
  id: string;
  runId: string;
  agUiType: AgUiEventType;
  agUiName?: string;
  creType: string;
  timestamp: number;
  stepName?: string;
  payload?: Record<string, unknown>;
}

const CRE_TO_AGUI_MAP: Record<string, { type: AgUiEventType; name?: string }> =
  {
    run_started: { type: AgUiEventType.RUN_STARTED },
    run_finished: { type: AgUiEventType.RUN_FINISHED },
    run_failed: { type: AgUiEventType.RUN_ERROR },
    message_delta: { type: AgUiEventType.TEXT_MESSAGE_CONTENT },
    tool_call_started: { type: AgUiEventType.TOOL_CALL_START },
    tool_result: { type: AgUiEventType.TOOL_CALL_RESULT },
    run_paused_for_approval: {
      type: AgUiEventType.CUSTOM,
      name: "approval_required",
    },
    run_cancel_requested: {
      type: AgUiEventType.CUSTOM,
      name: "cancel_requested",
    },
    run_cancelled: { type: AgUiEventType.CUSTOM, name: "run_cancelled" },
    run_retry_requested: {
      type: AgUiEventType.CUSTOM,
      name: "retry_requested",
    },
  };

export const toAgUiEvent = (event: CreRunEvent): AgUiEvent => {
  const mapping = CRE_TO_AGUI_MAP[event.type] ?? { type: AgUiEventType.CUSTOM };

  return {
    id: event.id,
    runId: event.runId,
    agUiType: mapping.type,
    agUiName: mapping.name,
    creType: event.type,
    timestamp: new Date(event.timestamp).getTime(),
    stepName: event.stepName,
    payload: event.payload,
  };
};

export const toAgUiStream = (events: CreRunEvent[]): AgUiEvent[] =>
  events.map(toAgUiEvent).sort((a, b) => a.timestamp - b.timestamp);

// Re-export from agentRunAdapter so consumers can import from one place
export { toAgentRunViewModel, toForensicEvents } from "./agentRunAdapter";
export type { AgentRunViewModel, AgentRunStatus } from "./agentRunAdapter";
