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

export interface ObservabilityStatus {
  enabled: boolean;
  reachable: boolean | null;
  endpoint: string | null;
  serviceName: string;
  ingestionKeyConfigured: boolean;
  signozCloudUrl: string | null;
  dashboards: Array<{ title: string; description: string; status: "live" | "upcoming" }>;
  instrumentedSpans: Array<{ name: string; source: string; status: "live" | "upcoming" }>;
  instrumentedMetrics: Array<{ name: string; source: string; status: "live" | "upcoming" }>;
}

const OTEL_ENABLED = !!(process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "").trim();

// Cache the SigNoz reachability probe for 30s so we don't hammer it on
// every page load.
let reachabilityCache: { at: number; reachable: boolean } | null = null;
const REACHABILITY_TTL_MS = 30_000;

export class ObservabilityController {
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
