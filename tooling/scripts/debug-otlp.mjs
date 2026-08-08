import http from "node:http";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
} from "@opentelemetry/semantic-conventions";
import { metrics, trace, diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import "dotenv/config";

const PORT = 9999;
let captured = null;

// Minimal proxy that records what the OTLP exporter sends, then returns 200.
const proxy = http.createServer((req, res) => {
  console.log(`[proxy] ${req.method} ${req.url}`);
  let body = "";
  req.setEncoding("utf8");
  req.on("data", (chunk) => {
    body += chunk;
  });
  req.on("end", () => {
    captured = {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body,
    };
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ partialSuccess: {} }));
  });
});

await new Promise((resolve) => proxy.listen(PORT, resolve));
console.log(`[proxy] listening on http://localhost:${PORT}`);

function parseOtelHeaders() {
  const headers = {};
  if (process.env.OTEL_EXPORTER_OTLP_HEADERS) {
    for (const pair of process.env.OTEL_EXPORTER_OTLP_HEADERS.split(",")) {
      const [k, ...rest] = pair.split("=");
      if (k && rest.length) {
        const key = k.trim().toLowerCase();
        const value = rest.join("=").trim();
        if (key === "signoz-ingestion-key") {
          headers["signoz-access-token"] = value;
        } else {
          headers[key] = value;
        }
      }
    }
  }
  if (process.env.SIGNOZ_INGESTION_KEY) {
    headers["signoz-access-token"] = process.env.SIGNOZ_INGESTION_KEY.trim();
  }
  return headers;
}

const endpoint = `http://localhost:${PORT}`;
process.env.OTEL_EXPORTER_OTLP_ENDPOINT = endpoint;

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);

const meter = metrics.getMeter("cognivern.governance");
const counter = meter.createCounter("cognivern.test.debug.counter", {
  description: "Debug counter for OTLP payload inspection",
});

process.on("uncaughtException", (err) => {
  console.error("[debug] uncaught exception:", err);
  process.exit(1);
});

try {

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || "cognivern-backend",
    [ATTR_SERVICE_VERSION]: "0.1.0",
    [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: "debug",
  }),
  traceExporter: new OTLPTraceExporter({
    url: `${endpoint}/v1/traces`,
    headers: parseOtelHeaders(),
  }),
  metricReaders: [new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: `${endpoint}/v1/metrics`,
      headers: parseOtelHeaders(),
    }),
    exportIntervalMillis: 3000,
  })],
});

sdk.start();

// Increment the counter so the export has data.
counter.add(1, { decision: "approved" });

// Wait for an export cycle.
setTimeout(async () => {
  await sdk.shutdown();
  proxy.close();

  if (!captured) {
    console.log("[debug] no request captured");
    process.exit(1);
  }

  console.log("[debug] captured OTLP metrics request:");
  console.log("  method:", captured.method);
  console.log("  url:", captured.url);
  console.log("  headers:", JSON.stringify(captured.headers, null, 2));
  try {
    const payload = JSON.parse(captured.body);
    console.log("  body JSON parsed, resourceMetrics count:", payload.resourceMetrics?.length);
    for (const rm of payload.resourceMetrics || []) {
      console.log("  resource attributes:", JSON.stringify(rm.resource?.attributes, null, 2));
      for (const sm of rm.scopeMetrics || []) {
        console.log("  scope:", sm.scope?.name);
        for (const m of sm.metrics || []) {
          console.log("    metric name:", m.name);
        }
      }
    }
    // Save full payload for inspection.
    const fs = await import("node:fs");
    fs.writeFileSync("/tmp/otlp-payload.json", JSON.stringify(payload, null, 2));
    console.log("[debug] full payload saved to /tmp/otlp-payload.json");
  } catch (e) {
    console.log("  body (raw first 500 chars):", captured.body.slice(0, 500));
  }
}, 10000);

} catch (err) {
  console.error("[debug] error during SDK setup/export:", err);
  process.exit(1);
}
