/**
 * Observability Controller
 *
 * Surfaces the OpenTelemetry / SigNoz integration status to the frontend
 * so the Observability page can render a real "is tracing live?" badge
 * instead of pretending it is always on.
 *
 * Status is derived from process.env (read at module load + each request
 * so a redeploy with new env vars is picked up without code changes).
 * The controller never logs the ingestion key.
 */

import { Request, Response } from "express";
import { Logger } from "@backend/shared/logging/Logger.js";

const logger = new Logger("ObservabilityController");

export interface ObservabilityStatus {
  enabled: boolean;
  reachable: boolean | null;
  endpoint: string | null;
  serviceName: string;
  ingestionKeyConfigured: boolean;
  signozCloudUrl: string | null;
  dashboardEmbedUrl: string | null;
  dashboards: Array<{ title: string; description: string; status: "live" | "upcoming" }>;
  instrumentedSpans: Array<{ name: string; source: string; status: "live" | "upcoming" }>;
  instrumentedMetrics: Array<{ name: string; source: string; status: "live" | "upcoming" }>;
}

export interface ObservabilityMetrics {
  /** Time range the data covers (ISO strings) */
  timeRange: { start: string; end: string };
  /** Time-series buckets aligned for charting */
  buckets: Array<{
    timestamp: number;
    label: string;
    decisions: number;
    cost: number;
    failures: number;
    latencyP95: number;
  }>;
  /** Summary totals/averages for the same range */
  summary: {
    totalDecisions: number;
    totalCostUsd: number;
    totalFailures: number;
    avgLatencyP95Ms: number;
  };
  /** Whether the underlying SigNoz query succeeded. If false, the UI can
   *  still render empty state or audit-log fallback. */
  live: boolean;
  /** Human-readable message if live is false */
  message?: string;
}

interface SigNozQuerySpec {
  name: string;
  signal: "metrics" | "traces";
  source: string;
  stepInterval: number;
  aggregations: Array<{ timeAggregation?: string; spaceAggregation: string }>;
  filter?: { expression: string };
}

interface SigNozQueryRequest {
  start: number;
  end: number;
  requestType: "time_series";
  compositeQuery: { queries: Array<{ type: "builder_query"; spec: SigNozQuerySpec }> };
}

interface SigNozPoint {
  timestamp: number;
  value: number;
}

interface SigNozSeries {
  pointValues: SigNozPoint[];
  labels?: Record<string, string>;
}

interface SigNozResult {
  queryName: string;
  series: SigNozSeries[];
}

interface SigNozQueryResponse {
  data?: {
    results?: SigNozResult[];
  };
}

const OTEL_ENABLED = !!(process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "").trim();

// Cache the SigNoz reachability probe for 30s so we don't hammer it on
// every page load.
let reachabilityCache: { at: number; reachable: boolean } | null = null;
const REACHABILITY_TTL_MS = 30_000;

// Default time window for live metrics: last 24 hours.
const METRICS_WINDOW_MS = 24 * 60 * 60 * 1000;

// Cache live metrics for 30s so concurrent page loads and rapid refreshes
// don't hammer the SigNoz query API.
const METRICS_CACHE_TTL_MS = 30_000;

export class ObservabilityController {
  private metricsCache: {
    at: number;
    promise: Promise<ObservabilityMetrics>;
    result: ObservabilityMetrics | null;
  } | null = null;
  async getStatus(_req: Request, res: Response): Promise<void> {
    const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "";
    const reachable = OTEL_ENABLED ? await this.probeReachability(endpoint) : null;

    const status: ObservabilityStatus = {
      enabled: OTEL_ENABLED,
      reachable,
      endpoint: this.maskEndpoint(endpoint),
      serviceName: process.env.OTEL_SERVICE_NAME || "cognivern-backend",
      ingestionKeyConfigured: !!(process.env.SIGNOZ_INGESTION_KEY || "").trim(),
      signozCloudUrl: process.env.SIGNOZ_CLOUD_URL || null,
      dashboardEmbedUrl: process.env.SIGNOZ_DASHBOARD_EMBED_URL || null,
      dashboards: [
        {
          title: "AI Agent Governance Overview",
          description:
            "LLM token cost, governance decisions (allowed vs denied), policy violations, provider failures, agent cycle latency.",
          status: "live",
        },
        {
          title: "LLM Provider Health & Fallback Chain",
          description:
            "Per-provider latency p95, failure rate, token economics, cost per provider per minute, fallback cascade events.",
          status: "live",
        },
        {
          title: "HTTP API SLO & Audit Trail",
          description:
            "Per-route request rate, p95 latency, error rate by status class, audit log volume, governance decision traces.",
          status: "live",
        },
      ],
      instrumentedSpans: [
        { name: "llm.execute_with_fallback", source: "MultiModelRouter", status: "live" },
        { name: "llm.provider.<name>", source: "MultiModelRouter", status: "live" },
        { name: "governance.evaluate_decision", source: "PolicyEnforcementService", status: "live" },
        { name: "audit.log_action", source: "AuditLogService", status: "live" },
        { name: "agent.sapience.forecast_cycle", source: "SapienceTradingAgent", status: "live" },
        { name: "agent.user_trading.cycle", source: "UserTradingAgent", status: "upcoming" },
      ],
      instrumentedMetrics: [
        { name: "cognivern.llm.tokens.total", source: "MultiModelRouter", status: "live" },
        { name: "cognivern.llm.cost.usd.total", source: "MultiModelRouter", status: "live" },
        { name: "cognivern.llm.failures.total", source: "MultiModelRouter", status: "live" },
        { name: "cognivern.governance.decisions.total", source: "PolicyEnforcementService", status: "live" },
        { name: "cognivern.governance.policy.violations.total", source: "PolicyEnforcementService", status: "live" },
        { name: "cognivern.governance.latency.ms", source: "PolicyEnforcementService", status: "live" },
        { name: "cognivern.audit.logs.total", source: "AuditLogService", status: "live" },
        { name: "cognivern.http.requests.total", source: "SloMetricsService", status: "live" },
        { name: "cognivern.http.request.duration.ms", source: "SloMetricsService", status: "live" },
        { name: "cognivern.agent.cycles.total", source: "SapienceTradingAgent", status: "live" },
        { name: "cognivern.agent.actions.total", source: "MetricsService", status: "live" },
      ],
    };

    res.json({ success: true, data: status });
  }

  /**
   * Query SigNoz Cloud for live metrics and traces, then return chart-ready
   * time-series buckets. This endpoint keeps the SigNoz API token on the
   * backend and avoids CORS/CSP issues in the browser.
   */
  async getMetrics(_req: Request, res: Response): Promise<void> {
    const cloudUrl = process.env.SIGNOZ_CLOUD_URL?.trim();
    const apiKey = process.env.SIGNOZ_API_KEY?.trim();

    if (!cloudUrl || !apiKey) {
      const empty = this.buildEmptyMetrics();
      empty.message =
        "SigNoz query API is not configured. Set SIGNOZ_CLOUD_URL and SIGNOZ_API_KEY to enable live charts.";
      res.json({ success: true, data: empty });
      return;
    }

    try {
      const data = await this.getMetricsWithCache(cloudUrl, apiKey);
      res.json({ success: true, data });
    } catch (error) {
      const message = error instanceof Error ? error.message : "SigNoz query failed";
      const empty = this.buildEmptyMetrics();
      empty.message = message;
      res.json({ success: true, data: empty });
    }
  }

  private async getMetricsWithCache(
    cloudUrl: string,
    apiKey: string,
  ): Promise<ObservabilityMetrics> {
    const now = Date.now();
    if (this.metricsCache && now - this.metricsCache.at < METRICS_CACHE_TTL_MS) {
      return this.metricsCache.result ?? (await this.metricsCache.promise);
    }

    const promise = this.fetchMetricsFromSignoz(cloudUrl, apiKey)
      .then((data) => {
        if (this.metricsCache) this.metricsCache.result = data;
        return data;
      })
      .catch((err) => {
        this.metricsCache = null;
        throw err;
      });

    this.metricsCache = { at: now, promise, result: null };
    return promise;
  }

  private async fetchMetricsFromSignoz(
    cloudUrl: string,
    apiKey: string,
  ): Promise<ObservabilityMetrics> {
    const end = Date.now();
    const start = end - METRICS_WINDOW_MS;

    const [decisions, cost, failures, latency] = await Promise.all([
      this.queryMetric(cloudUrl, apiKey, {
        name: "decisions",
        metricName: "cognivern.governance.decisions.total",
        timeAggregation: "sum",
        start,
        end,
      }),
      this.queryMetric(cloudUrl, apiKey, {
        name: "cost",
        metricName: "cognivern.llm.cost.usd.total",
        timeAggregation: "sum",
        start,
        end,
      }),
      this.queryMetric(cloudUrl, apiKey, {
        name: "failures",
        metricName: "cognivern.llm.failures.total",
        timeAggregation: "sum",
        start,
        end,
      }),
      this.queryTraces(cloudUrl, apiKey, {
        name: "latency",
        spanName: "llm.execute_with_fallback",
        aggregation: "p95",
        start,
        end,
      }),
    ]);

    const buckets = this.alignBuckets({ decisions, cost, failures, latency });

    const summary = {
      totalDecisions: this.sum(decisions),
      totalCostUsd: this.sum(cost),
      totalFailures: this.sum(failures),
      avgLatencyP95Ms: this.avg(latency),
    };

    return {
      timeRange: { start: new Date(start).toISOString(), end: new Date(end).toISOString() },
      buckets,
      summary,
      live: true,
    };
  }

  private async queryMetric(
    cloudUrl: string,
    apiKey: string,
    params: {
      name: string;
      metricName: string;
      timeAggregation: string;
      start: number;
      end: number;
    },
  ): Promise<SigNozPoint[]> {
    const body: SigNozQueryRequest = {
      start: params.start,
      end: params.end,
      requestType: "time_series",
      compositeQuery: {
        queries: [
          {
            type: "builder_query",
            spec: {
              name: params.name,
              signal: "metrics",
              source: params.metricName,
              stepInterval: 60,
              aggregations: [
                {
                  timeAggregation: params.timeAggregation,
                  spaceAggregation: "sum",
                },
              ],
              filter: {
                expression: "service.name = 'cognivern-backend'",
              },
            },
          },
        ],
      },
    };

    return this.executeSigNozQuery(cloudUrl, apiKey, body, params.name);
  }

  private async queryTraces(
    cloudUrl: string,
    apiKey: string,
    params: {
      name: string;
      spanName: string;
      aggregation: string;
      start: number;
      end: number;
    },
  ): Promise<SigNozPoint[]> {
    const body: SigNozQueryRequest = {
      start: params.start,
      end: params.end,
      requestType: "time_series",
      compositeQuery: {
        queries: [
          {
            type: "builder_query",
            spec: {
              name: params.name,
              signal: "traces",
              source: "durationNano",
              stepInterval: 60,
              aggregations: [
                {
                  spaceAggregation: params.aggregation,
                },
              ],
              filter: {
                expression: `service.name = 'cognivern-backend' AND name = '${params.spanName}'`,
              },
            },
          },
        ],
      },
    };

    const nanos = await this.executeSigNozQuery(cloudUrl, apiKey, body, params.name);
    // Convert nanoseconds to milliseconds for display.
    return nanos.map((p) => ({ timestamp: p.timestamp, value: p.value / 1_000_000 }));
  }

  private async executeSigNozQuery(
    cloudUrl: string,
    apiKey: string,
    body: SigNozQueryRequest,
    queryName: string,
  ): Promise<SigNozPoint[]> {
    const url = `${cloudUrl.replace(/\/$/, "")}/api/v5/query_range`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "SIGNOZ-API-KEY": apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "unknown");
        throw new Error(`SigNoz query "${queryName}" failed: ${response.status} ${text}`);
      }

      const raw = (await response.json()) as SigNozQueryResponse;

      if (!raw.data || !Array.isArray(raw.data.results)) {
        logger.warn(
          `SigNoz query "${queryName}" returned unexpected shape: missing data.results`,
          { queryName, response: JSON.stringify(raw).slice(0, 500) },
        );
        return [];
      }

      const result = raw.data.results.find((r) => r.queryName === queryName);
      if (!result) {
        logger.warn(
          `SigNoz query "${queryName}" returned results but no matching queryName`,
          { queryName, available: raw.data.results.map((r) => r.queryName) },
        );
        return [];
      }

      if (!Array.isArray(result.series) || result.series.length === 0) {
        logger.warn(
          `SigNoz query "${queryName}" returned no series`,
          { queryName, result },
        );
        return [];
      }

      // Flatten all series' points into one sorted array.
      const allPoints = result.series.flatMap((s) => s.pointValues ?? []);
      if (allPoints.length === 0) {
        logger.warn(
          `SigNoz query "${queryName}" returned series but no pointValues`,
          { queryName, series: result.series },
        );
        return [];
      }
      allPoints.sort((a, b) => a.timestamp - b.timestamp);
      return allPoints;
    } finally {
      clearTimeout(timeout);
    }
  }

  private alignBuckets(series: {
    decisions: SigNozPoint[];
    cost: SigNozPoint[];
    failures: SigNozPoint[];
    latency: SigNozPoint[];
  }): ObservabilityMetrics["buckets"] {
    // Collect all timestamps present across all series.
    const timestamps = new Set<number>();
    [
      ...series.decisions,
      ...series.cost,
      ...series.failures,
      ...series.latency,
    ].forEach((p) => timestamps.add(p.timestamp));

    const sorted = Array.from(timestamps).sort((a, b) => a - b);

    const getValue = (arr: SigNozPoint[], ts: number, defaultValue = 0) => {
      const found = arr.find((p) => p.timestamp === ts);
      return found ? found.value : defaultValue;
    };

    return sorted.map((ts) => ({
      timestamp: ts,
      label: new Date(ts).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      }),
      decisions: getValue(series.decisions, ts),
      cost: getValue(series.cost, ts),
      failures: getValue(series.failures, ts),
      latencyP95: getValue(series.latency, ts),
    }));
  }

  private sum(points: SigNozPoint[]): number {
    return points.reduce((acc, p) => acc + (Number.isFinite(p.value) ? p.value : 0), 0);
  }

  private avg(points: SigNozPoint[]): number {
    if (points.length === 0) return 0;
    return this.sum(points) / points.length;
  }

  private buildEmptyMetrics(): ObservabilityMetrics {
    return {
      timeRange: {
        start: new Date(Date.now() - METRICS_WINDOW_MS).toISOString(),
        end: new Date().toISOString(),
      },
      buckets: [],
      summary: {
        totalDecisions: 0,
        totalCostUsd: 0,
        totalFailures: 0,
        avgLatencyP95Ms: 0,
      },
      live: false,
    };
  }

  private maskEndpoint(endpoint: string | undefined): string | null {
    if (!endpoint) return null;
    // Show the host so users know which SigNoz instance is targeted, but
    // strip any path beyond the origin to avoid leaking sensitive paths.
    try {
      const url = new URL(endpoint);
      return `${url.protocol}//${url.host}`;
    } catch {
      return endpoint;
    }
  }

  /**
   * Lightweight reachability probe: sends a HEAD request to the OTLP
   * endpoint origin. A 200/404/405 means the server is reachable (it
   * responded, even if the path requires POST). A network error means
   * unreachable. Cached for 30s to avoid probing on every page load.
   */
  private async probeReachability(endpoint: string): Promise<boolean> {
    if (reachabilityCache && Date.now() - reachabilityCache.at < REACHABILITY_TTL_MS) {
      return reachabilityCache.reachable;
    }

    try {
      const url = new URL(endpoint);
      const origin = `${url.protocol}//${url.host}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      try {
        const res = await fetch(origin, {
          method: "HEAD",
          signal: controller.signal,
        });
        // Any HTTP response means the server is reachable. 200, 404, 405
        // are all fine - we just want to know the host is up.
        const reachable = res.status > 0;
        reachabilityCache = { at: Date.now(), reachable };
        return reachable;
      } finally {
        clearTimeout(timeout);
      }
    } catch {
      reachabilityCache = { at: Date.now(), reachable: false };
      return false;
    }
  }
}
