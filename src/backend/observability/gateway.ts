/**
 * Gateway telemetry — OpenTelemetry instruments for the metered inference
 * gateway (/v1/chat/completions).
 *
 * Why this exists as a separate module: the gateway is a distinct product
 * surface from the agent LLM loop (MultiModelRouter). Its costs are METERED —
 * provider-reported token counts priced in nano-USD — whereas the agent loop's
 * are estimated (chars/4 × a per-provider table). Mixing the two into the
 * governance `llm.*` instruments would make every dashboard an untrustworthy
 * blend of real and estimated numbers. Separate instruments keep the "this is
 * actual spend" guarantee visible in the metric name.
 *
 * The instruments are module-level and created unconditionally: when OTel is
 * disabled the API's meter is a no-op, exactly like `otel.ts` does today, so
 * importing this module is safe on any deployment.
 */

import { trace, metrics } from "@opentelemetry/api";

const meter = metrics.getMeter("cognivern.gateway");
export const gatewayTracer = trace.getTracer("cognivern.gateway");

export const gatewayRequestsCounter = meter.createCounter("cognivern.gateway.requests.total", {
  description: "Gateway inference requests, by outcome",
});

export const gatewayCostCounter = meter.createCounter("cognivern.gateway.cost.usd.total", {
  description: "Metered inference cost in USD (provider-reported token counts)",
});

export const gatewayTokensCounter = meter.createCounter("cognivern.gateway.tokens.total", {
  description: "Inference tokens, input vs output",
});

export const gatewayLatencyHistogram = meter.createHistogram("cognivern.gateway.latency.ms", {
  description: "Gateway request latency in milliseconds",
});

export interface GatewayInferenceTelemetry {
  status: "ok" | "upstream_error" | "denied";
  backend: string;
  model: string;
  programId: string;
  disclosureTier: string;
  provider: string | null;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  streamed: boolean;
}

/**
 * Record one gateway request. Called from the gateway's single record funnel,
 * so denials and upstream errors are counted exactly like successes — "who hit
 * their cap, when, and on which model" is a first-class metric, not a log line.
 *
 * Labels are deliberately low-cardinality: model/backend/program/tier/status.
 * Participant handles are NOT labels (high cardinality, and at the `private`
 * tier they would leak identity into a metrics store).
 */
export function recordGatewayInference(telemetry: GatewayInferenceTelemetry): void {
  const attributes = {
    backend: telemetry.backend,
    model: telemetry.model,
    status: telemetry.status,
    streamed: telemetry.streamed ? "true" : "false",
    disclosure_tier: telemetry.disclosureTier,
  };

  gatewayRequestsCounter.add(1, attributes);

  if (telemetry.inputTokens > 0) {
    gatewayTokensCounter.add(telemetry.inputTokens, { ...attributes, direction: "input" });
  }
  if (telemetry.outputTokens > 0) {
    gatewayTokensCounter.add(telemetry.outputTokens, { ...attributes, direction: "output" });
  }
  if (telemetry.costUsd > 0) {
    gatewayCostCounter.add(telemetry.costUsd, {
      ...attributes,
      ...(telemetry.provider ? { provider: telemetry.provider } : {}),
    });
  }
  if (telemetry.latencyMs >= 0) {
    gatewayLatencyHistogram.record(telemetry.latencyMs, attributes);
  }
}
