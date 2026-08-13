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
  queryConfigured: boolean;
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
  range?: ObservabilityRange;
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
  source?: string;
  stepInterval: number;
  aggregations: Array<{
    timeAggregation?: string;
    spaceAggregation?: string;
    metricName?: string;
    expression?: string;
  }>;
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
  pointValues?: SigNozPoint[];
  values?: SigNozPoint[];
  labels?: Record<string, string>;
}

interface SigNozAggregation {
  index?: number;
  alias?: string;
  meta?: Record<string, unknown>;
  series?: SigNozSeries[];
}

interface SigNozResult {
  queryName: string;
  series?: SigNozSeries[];
  aggregations?: SigNozAggregation[];
}

interface SigNozQueryResponse {
  status?: string;
  data?: {
    type?: string;
    meta?: unknown;
    results?: SigNozResult[];
    data?: {
      results?: SigNozResult[];
    };
  };
}

const METRICS_WINDOWS = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
} as const;
export type ObservabilityRange = keyof typeof METRICS_WINDOWS;

const OTEL_ENABLED = !!(process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "").trim();

// Cache the SigNoz reachability probe for 30s so we don't hammer it on
// every page load.
let reachabilityCache: { at: number; reachable: boolean } | null = null;
const REACHABILITY_TTL_MS = 30_000;

// Cache live metrics for 30s so concurrent page loads and rapid refreshes
// don't hammer the SigNoz query API.
const METRICS_CACHE_TTL_MS = 30_000;

export class ObservabilityController {
  private metricsCache: {
    at: number;
    range: ObservabilityRange;
    workspaceId?: string;
    promise: Promise<ObservabilityMetrics>;
    result: ObservabilityMetrics | null;
  } | null = null;
  async getStatus(_req: Request, res: Response): Promise<void> {
    const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "";
    const reachable = OTEL_ENABLED ? await this.probeReachability(endpoint) : null;

    const status: ObservabilityStatus = {
      enabled: OTEL_ENABLED,
      reachable,
      queryConfigured: this.queryAuthConfigured(),
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
        { name: "spend.cleanverse.cvi_screen", source: "CleanverseIdentityService", status: "live" },
        { name: "spend.cleanverse.cva_transfer", source: "CleanverseExecutionProvider", status: "live" },
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
        { name: "cognivern.hydradb.sync.jobs.total", source: "HydraDbMandateContextService", status: "live" },
        { name: "cognivern.hydradb.sync.retries.total", source: "HydraDbMandateContextService", status: "live" },
        { name: "cognivern.hydradb.sync.duration.ms", source: "HydraDbMandateContextService", status: "live" },
      ],
    };

    res.json({ success: true, data: status });
  }

  /**
   * Query SigNoz Cloud for live metrics and traces, then return chart-ready
   * time-series buckets. This endpoint keeps the SigNoz API token on the
   * backend and avoids CORS/CSP issues in the browser.
   */
  async getMetrics(req: Request, res: Response): Promise<void> {
    const requestedRange = typeof req.query.range === "string" ? req.query.range : "24h";
    const range: ObservabilityRange = requestedRange in METRICS_WINDOWS
      ? (requestedRange as ObservabilityRange)
      : "24h";
    const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId.trim() : undefined;
    const cloudUrl = process.env.SIGNOZ_CLOUD_URL?.trim();
    const apiKey = process.env.SIGNOZ_API_KEY?.trim() ?? "";

    if (!cloudUrl || !this.queryAuthConfigured()) {
      const empty = this.buildEmptyMetrics(range);
      empty.message =
        "SigNoz query API is not configured. Set SIGNOZ_CLOUD_URL plus SIGNOZ_API_KEY (SigNoz Cloud) or SIGNOZ_USER_EMAIL/SIGNOZ_USER_PASSWORD/SIGNOZ_ORG_ID (self-hosted without an enterprise license).";
      res.json({ success: true, data: empty });
      return;
    }

    try {
      const data = await this.getMetricsWithCache(cloudUrl, apiKey, range, workspaceId);
      res.json({ success: true, data });
    } catch (error) {
      const message = error instanceof Error ? error.message : "SigNoz query failed";
      const empty = this.buildEmptyMetrics(range);
      empty.message = message;
      res.json({ success: true, data: empty });
    }
  }

  private async getMetricsWithCache(
    cloudUrl: string,
    apiKey: string,
    range: ObservabilityRange,
    workspaceId?: string,
  ): Promise<ObservabilityMetrics> {
    const now = Date.now();
    if (this.metricsCache && this.metricsCache.range === range && this.metricsCache.workspaceId === workspaceId && now - this.metricsCache.at < METRICS_CACHE_TTL_MS) {
      return this.metricsCache.result ?? (await this.metricsCache.promise);
    }

    const promise = this.fetchMetricsFromSignoz(cloudUrl, apiKey, range, workspaceId)
      .then((data) => {
        if (this.metricsCache) this.metricsCache.result = data;
        return data;
      })
      .catch((err) => {
        this.metricsCache = null;
        throw err;
      });

    this.metricsCache = { at: now, promise, result: null, range, workspaceId };
    return promise;
  }

  private async fetchMetricsFromSignoz(
    cloudUrl: string,
    apiKey: string,
    range: ObservabilityRange,
    workspaceId?: string,
  ): Promise<ObservabilityMetrics> {
    const end = Date.now();
    const start = end - METRICS_WINDOWS[range];

    const [decisions, cost, failures, latency] = await Promise.all([
      this.queryMetric(cloudUrl, apiKey, {
        name: "decisions",
        metricName: "cognivern.governance.decisions.total",
        timeAggregation: "sum",
        start,
        end,
        workspaceId,
      }),
      this.queryMetric(cloudUrl, apiKey, {
        name: "cost",
        metricName: "cognivern.llm.cost.usd.total",
        timeAggregation: "sum",
        start,
        end,
        workspaceId,
      }),
      this.queryMetric(cloudUrl, apiKey, {
        name: "failures",
        metricName: "cognivern.llm.failures.total",
        timeAggregation: "sum",
        start,
        end,
        workspaceId,
      }),
      this.queryTraces(cloudUrl, apiKey, {
        name: "latency",
        spanName: "llm.execute_with_fallback",
        aggregation: "p95",
        start,
        end,
        workspaceId,
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
      range,
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
      workspaceId?: string;
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
              stepInterval: 60,
              aggregations: [
                {
                  metricName: params.metricName,
                  timeAggregation: params.timeAggregation,
                  spaceAggregation: "sum",
                },
              ],
              filter: {
                expression: this.metricFilter(params.workspaceId),
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
      workspaceId?: string;
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
              stepInterval: 60,
              aggregations: [
                {
                  expression: `${params.aggregation}(durationNano)`,
                },
              ],
              filter: {
                expression: `${this.metricFilter(params.workspaceId)} AND name = '${params.spanName}'`,
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

  /**
   * Self-hosted session auth for the query API.
   *
   * OSS self-hosted SigNoz without an enterprise license cannot authorize
   * service-account API keys for builder queries (authz_forbidden on
   * builder_query/* — the fine-grained RBAC layer is license-gated). On such
   * instances the only working programmatic auth is a USER session. We log in
   * via /api/v2/sessions/email_password (SIGNOZ_USER_EMAIL /
   * SIGNOZ_USER_PASSWORD / SIGNOZ_ORG_ID), cache the JWT until its exp, and
   * re-login once on 401.
   *
   * Identity note: on unlicensed OSS, only the seeded install admin's session
   * passes builder-query authz — role-granted accounts (viewer or admin
   * bindings on a metastore-created user) still get authz_forbidden.
   * SIGNOZ_USER_EMAIL should therefore be that admin user. SigNoz Cloud is
   * unaffected — when no user creds are set we send SIGNOZ-API-KEY as before.
   */
  private sessionToken: { token: string; expiresAtMs: number } | null = null;

  private queryAuthConfigured(): boolean {
    const cloudUrl = (process.env.SIGNOZ_CLOUD_URL || "").trim();
    const apiKey = (process.env.SIGNOZ_API_KEY || "").trim();
    return !!cloudUrl && (!!apiKey || this.useSessionAuth());
  }

  private useSessionAuth(): boolean {
    return (
      !!(process.env.SIGNOZ_USER_EMAIL || "").trim() &&
      !!(process.env.SIGNOZ_USER_PASSWORD || "")
    );
  }

  private async signozLogin(): Promise<string> {
    const cloudUrl = (process.env.SIGNOZ_CLOUD_URL || "").trim().replace(/\/+$/, "");
    const response = await fetch(`${cloudUrl}/api/v2/sessions/email_password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: (process.env.SIGNOZ_USER_EMAIL || "").trim(),
        password: process.env.SIGNOZ_USER_PASSWORD,
        orgId: (process.env.SIGNOZ_ORG_ID || "").trim(),
      }),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "unknown");
      throw new Error(`SigNoz session login failed: ${response.status} ${text.slice(0, 200)}`);
    }
    const json = (await response.json()) as { data?: { accessToken?: string } };
    const token = json.data?.accessToken;
    if (!token) throw new Error("SigNoz session login returned no accessToken");

    // Cache until the JWT's own exp (decoding the payload without verifying
    // is fine — we only ever send the token back to its issuer).
    let expiresAtMs = Date.now() + 30 * 60_000; // conservative fallback
    try {
      const payload = JSON.parse(
        Buffer.from(token.split(".")[1] || "", "base64url").toString("utf8"),
      ) as { exp?: number };
      if (typeof payload.exp === "number") expiresAtMs = payload.exp * 1000 - 60_000;
    } catch {
      // keep fallback TTL
    }
    this.sessionToken = { token, expiresAtMs };
    return token;
  }

  private async signozAuthHeaders(
    apiKey: string,
    forceRefresh: boolean,
  ): Promise<Record<string, string>> {
    if (!this.useSessionAuth()) return { "SIGNOZ-API-KEY": apiKey };
    if (
      !forceRefresh &&
      this.sessionToken &&
      this.sessionToken.expiresAtMs > Date.now()
    ) {
      return { Authorization: `Bearer ${this.sessionToken.token}` };
    }
    const token = await this.signozLogin();
    return { Authorization: `Bearer ${token}` };
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
    const doFetch = (headers: Record<string, string>) =>
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

    try {
      let response = await doFetch(await this.signozAuthHeaders(apiKey, false));
      if (response.status === 401 && this.useSessionAuth()) {
        // Token expired or revoked earlier than exp claimed — force one
        // re-login and replay the query.
        response = await doFetch(await this.signozAuthHeaders(apiKey, true));
      }

      if (!response.ok) {
        const text = await response.text().catch(() => "unknown");
        throw new Error(`SigNoz query "${queryName}" failed: ${response.status} ${text}`);
      }

      const raw = (await response.json()) as SigNozQueryResponse;

      const results = Array.isArray(raw.data?.results)
        ? raw.data!.results
        : raw.data?.data?.results;

      if (!Array.isArray(results)) {
        logger.warn(
          `SigNoz query "${queryName}" returned unexpected shape: missing data.results`,
          { queryName, response: JSON.stringify(raw).slice(0, 500) },
        );
        return [];
      }

      const result = results.find((r) => r.queryName === queryName);
      if (!result) {
        logger.warn(
          `SigNoz query "${queryName}" returned results but no matching queryName`,
          { queryName, available: results.map((r) => r.queryName) },
        );
        return [];
      }

      // SigNoz v5 may nest series directly on the result or inside aggregations.
      const allSeries: SigNozSeries[] = [];
      if (Array.isArray(result.series)) {
        allSeries.push(...result.series);
      }
      if (Array.isArray(result.aggregations)) {
        for (const agg of result.aggregations) {
          if (Array.isArray(agg.series)) {
            allSeries.push(...agg.series);
          }
        }
      }
      if (allSeries.length === 0) {
        logger.warn(
          `SigNoz query "${queryName}" returned no series`,
          { queryName, result },
        );
        return [];
      }

      // Flatten all series' points into one sorted array.
      const allPoints = allSeries.flatMap((s) => s.pointValues ?? s.values ?? []);
      if (allPoints.length === 0) {
        logger.warn(
          `SigNoz query "${queryName}" returned series but no pointValues`,
          { queryName, series: allSeries },
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

  private metricFilter(workspaceId?: string): string {
    const escaped = workspaceId?.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    return escaped
      ? `service.name = 'cognivern-backend' AND workspace_id = '${escaped}'`
      : "service.name = 'cognivern-backend'";
  }

  private avg(points: SigNozPoint[]): number {
    if (points.length === 0) return 0;
    return this.sum(points) / points.length;
  }

  private buildEmptyMetrics(range: ObservabilityRange = "24h"): ObservabilityMetrics {
    return {
      timeRange: {
        start: new Date(Date.now() - METRICS_WINDOWS[range]).toISOString(),
        end: new Date().toISOString(),
      },
      range,
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
