import { CreRunEvent } from "./creApi";

/**
 * Minimal AG-UI compatible event envelope.
 * This lets us keep Cognivern internals while exposing protocol-shaped events.
 */
export interface AgUiEvent {
  id: string;
  runId: string;
  type: string;
  ts: number;
  data?: Record<string, unknown>;
}

export const toAgUiEvent = (event: CreRunEvent): AgUiEvent => ({
  id: event.id,
  runId: event.runId,
  type: event.type,
  ts: new Date(event.timestamp).getTime(),
  data: {
    stepName: event.stepName,
    ...(event.payload || {}),
  },
});

export const toAgUiStream = (events: CreRunEvent[]): AgUiEvent[] =>
  events
    .map(toAgUiEvent)
    .sort((a, b) => a.ts - b.ts);
