import { CreRunEvent, CreRunEventType } from "./types.js";

export enum AgUiEventType {
  RUN_STARTED = "RUN_STARTED",
  RUN_FINISHED = "RUN_FINISHED",
  RUN_ERROR = "RUN_ERROR",
  TEXT_MESSAGE_CONTENT = "TEXT_MESSAGE_CONTENT",
  TOOL_CALL_START = "TOOL_CALL_START",
  TOOL_CALL_RESULT = "TOOL_CALL_RESULT",
  STEP_STARTED = "STEP_STARTED",
  STEP_FINISHED = "STEP_FINISHED",
  CUSTOM = "CUSTOM",
}

const creToAgUiMap: Record<
  CreRunEventType,
  { agUiType: AgUiEventType; agUiName?: string }
> = {
  run_started: { agUiType: AgUiEventType.RUN_STARTED },
  run_finished: { agUiType: AgUiEventType.RUN_FINISHED },
  run_failed: { agUiType: AgUiEventType.RUN_ERROR },
  message_delta: { agUiType: AgUiEventType.TEXT_MESSAGE_CONTENT },
  tool_call_started: { agUiType: AgUiEventType.TOOL_CALL_START },
  tool_result: { agUiType: AgUiEventType.TOOL_CALL_RESULT },
  run_paused_for_approval: {
    agUiType: AgUiEventType.CUSTOM,
    agUiName: "approval_required",
  },
  run_cancel_requested: {
    agUiType: AgUiEventType.CUSTOM,
    agUiName: "cancel_requested",
  },
  run_cancelled: { agUiType: AgUiEventType.CUSTOM, agUiName: "run_cancelled" },
  run_retry_requested: {
    agUiType: AgUiEventType.CUSTOM,
    agUiName: "retry_requested",
  },
};

export function translateCreEventToAgUi(event: CreRunEvent) {
  const mapping = creToAgUiMap[event.type];
  return {
    ...event,
    creType: event.type,
    agUiType: mapping.agUiType,
    ...(mapping.agUiName ? { agUiName: mapping.agUiName } : {}),
  };
}
