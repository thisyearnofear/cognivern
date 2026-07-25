/**
 * OpenTelemetry instrumentation for Cognivern.
 *
 * Started before the app boots so auto-instrumentations can patch the
 * http/express/dns/etc. modules. Exports the SDK plus convenience
 * helpers (tracer, meter) used by manual spans around LLM calls,
 * governance decisions, and the agent action loop.
 *
 * Target: SigNoz Cloud (OTLP/HTTP). Set OTEL_EXPORTER_OTLP_ENDPOINT
 * and OTEL_EXPORTER_OTLP_HEADERS (or the SigNoz regional env vars)
 * in the environment.
 */

import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
} from "@opentelemetry/semantic-conventions";
import { trace, metrics, diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";

// IMPORTANT: do not import @backend/utils/logger.js here. Winston loads
// before the OTel winston instrumentation patches it, which produces a
// warning. Use plain console until the SDK is up; the structured logger
// can take over once instrumentation is registered.

const OTEL_ENABLED = (process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "").length > 0;
const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || "cognivern-backend";

let sdk: NodeSDK | null = null;

if (OTEL_ENABLED) {
  // DEBUG level logs every OTLP export request/response. Keep it on while we
  // are diagnosing why metrics are not visible in SigNoz; lower to INFO once
  // exports are healthy.
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);

  const traceExporter = new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT
      ? `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT.replace(/\/$/, "")}/v1/traces`
      : undefined,
    headers: parseOtelHeaders(),
  });

  const metricExporter = new OTLPMetricExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT
      ? `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT.replace(/\/$/, "")}/v1/metrics`
      : undefined,
    headers: parseOtelHeaders(),
  });

  const metricReader = new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: 15000,
  });

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: SERVICE_NAME,
      [ATTR_SERVICE_VERSION]: process.env.npm_package_version || "0.1.0",
      [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: process.env.NODE_ENV || "development",
    }),
    traceExporter,
    metricReader,
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-fs": { enabled: false },
        "@opentelemetry/instrumentation-dns": { enabled: false },
      }),
    ],
  });

  sdk.start();
  console.info("[otel] OpenTelemetry SDK started", {
    service: SERVICE_NAME,
    endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  });
} else {
  console.info("[otel] OpenTelemetry disabled (set OTEL_EXPORTER_OTLP_ENDPOINT to enable)");
}

function parseOtelHeaders(): Record<string, string> {
  // Support both explicit header map and the SigNoz Cloud key+region shorthand.
  const headers: Record<string, string> = {};
  if (process.env.OTEL_EXPORTER_OTLP_HEADERS) {
    for (const pair of process.env.OTEL_EXPORTER_OTLP_HEADERS.split(",")) {
      const [k, ...rest] = pair.split("=");
      if (k && rest.length) headers[k.trim()] = rest.join("=").trim();
    }
  }
  if (process.env.SIGNOZ_INGESTION_KEY) {
    headers["signoz-access-token"] = process.env.SIGNOZ_INGESTION_KEY;
  }
  return headers;
}

// Re-export for callers that need the raw trace/metrics API (e.g. to read
// the active span's traceId for deep-linking).
export { trace, metrics };
export const tracer = trace.getTracer("cognivern.governance");
export const meter = metrics.getMeter("cognivern.governance");

// --- Long-lived metric instruments ---------------------------------------

export const llmTokenCounter = meter.createObservableCounter(
  "cognivern.llm.tokens.total",
  {
    description: "Total LLM tokens consumed (input + output)",
  },
);

export const llmCostCounter = meter.createObservableCounter(
  "cognivern.llm.cost.usd.total",
  { description: "Estimated LLM cost in USD" },
);

export const governanceDecisionCounter = meter.createCounter(
  "cognivern.governance.decisions.total",
  { description: "Governance decisions evaluated" },
);

export const policyViolationCounter = meter.createCounter(
  "cognivern.governance.policy.violations.total",
  { description: "Governance policy violations detected" },
);

export const llmLatencyHistogram = meter.createHistogram(
  "cognivern.llm.latency.ms",
  { description: "LLM call latency in milliseconds" },
);

export const governanceLatencyHistogram = meter.createHistogram(
  "cognivern.governance.latency.ms",
  { description: "Governance decision latency in milliseconds" },
);

// In-memory usage buffer consumed by the observable counters above.
// MultiModelRouter records each call here; the metric reader polls and flushes.
const usageBuffer: LlmUsageRecord[] = [];

export interface LlmUsageRecord {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  taskClass: string;
  timestamp: string;
}

export function recordLlmUsage(rec: LlmUsageRecord): void {
  usageBuffer.push(rec);
  llmLatencyHistogram.record(0, {
    provider: rec.provider,
    task_class: rec.taskClass,
  });
}

// Register the observable callback once.
llmTokenCounter.addCallback((result) => {
  let inputTotal = 0;
  let outputTotal = 0;
  const byProvider: Record<string, { in: number; out: number }> = {};
  for (const rec of usageBuffer) {
    inputTotal += rec.inputTokens;
    outputTotal += rec.outputTokens;
    byProvider[rec.provider] = byProvider[rec.provider] || { in: 0, out: 0 };
    byProvider[rec.provider].in += rec.inputTokens;
    byProvider[rec.provider].out += rec.outputTokens;
  }
  result.observe(inputTotal + outputTotal, { direction: "total" });
  result.observe(inputTotal, { direction: "input" });
  result.observe(outputTotal, { direction: "output" });
});

llmCostCounter.addCallback((result) => {
  let total = 0;
  for (const rec of usageBuffer) total += rec.costUsd;
  result.observe(total);
});

export async function shutdownOtel(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    console.info("[otel] OpenTelemetry SDK shut down");
  }
}
