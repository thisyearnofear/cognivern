interface Sample {
  route: string;
  status: number;
  durationMs: number;
  at: number;
}

interface SloTarget {
  p95Ms: number;
  maxErrorRate: number;
}

export interface SloRouteSnapshot {
  count: number;
  errorCount: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  errorRate: number;
  sloMet: boolean;
}

export interface SloSnapshot {
  windowSeconds: number;
  capturedAt: string;
  routes: Record<string, SloRouteSnapshot>;
  overall: {
    requestCount: number;
    errorCount: number;
    errorRate: number;
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
  };
}

const DEFAULT_TARGETS: Record<string, SloTarget> = {
  "/api/governance/evaluate": { p95Ms: 3000, maxErrorRate: 0.01 },
  "/api/audit/logs": { p95Ms: 800, maxErrorRate: 0.005 },
  "/api/audit/insights": { p95Ms: 1200, maxErrorRate: 0.005 },
  "/api/spend": { p95Ms: 3000, maxErrorRate: 0.01 },
  "/api/copilot/runs": { p95Ms: 1500, maxErrorRate: 0.01 },
  "/health": { p95Ms: 200, maxErrorRate: 0.001 },
  "/health/slo": { p95Ms: 200, maxErrorRate: 0.001 },
};

export class SloMetricsService {
  private samples: Sample[] = [];
  private readonly maxSamples: number;
  private readonly windowMs: number;
  private readonly targets: Record<string, SloTarget>;

  constructor(opts?: { maxSamples?: number; windowMs?: number }) {
    this.maxSamples = opts?.maxSamples ?? 5000;
    this.windowMs = opts?.windowMs ?? 15 * 60 * 1000;
    this.targets = this.loadTargets();
  }

  private loadTargets(): Record<string, SloTarget> {
    const out: Record<string, SloTarget> = { ...DEFAULT_TARGETS };
    const envMap: Array<[string, string]> = [
      ["SLO_GOVERNANCE_P95_MS", "/api/governance/evaluate"],
      ["SLO_AUDIT_LOGS_P95_MS", "/api/audit/logs"],
      ["SLO_AUDIT_INSIGHTS_P95_MS", "/api/audit/insights"],
      ["SLO_SPEND_P95_MS", "/api/spend"],
      ["SLO_COPILOT_P95_MS", "/api/copilot/runs"],
      ["SLO_HEALTH_P95_MS", "/health"],
    ];
    for (const [envKey, route] of envMap) {
      const raw = process.env[envKey];
      if (!raw) continue;
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && parsed > 0) {
        out[route] = { ...out[route], p95Ms: parsed };
      }
    }
    return out;
  }

  record(route: string, status: number, durationMs: number): void {
    if (!Number.isFinite(durationMs) || durationMs < 0) return;
    this.samples.push({
      route,
      status,
      durationMs,
      at: Date.now(),
    });
    if (this.samples.length > this.maxSamples) {
      this.samples.splice(0, this.samples.length - this.maxSamples);
    }
  }

  snapshot(): SloSnapshot {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    this.samples = this.samples.filter((s) => s.at >= cutoff);

    const byRoute = new Map<string, Sample[]>();
    for (const s of this.samples) {
      if (!byRoute.has(s.route)) byRoute.set(s.route, []);
      byRoute.get(s.route)!.push(s);
    }

    const routes: Record<string, SloRouteSnapshot> = {};
    for (const [route, samples] of byRoute.entries()) {
      routes[route] = this.summarize(samples, this.targets[route]);
    }

    const all = this.samples;
    const overallErrors = all.filter((s) => s.status >= 500).length;
    return {
      windowSeconds: Math.round(this.windowMs / 1000),
      capturedAt: new Date().toISOString(),
      routes,
      overall: {
        requestCount: all.length,
        errorCount: overallErrors,
        errorRate: all.length ? overallErrors / all.length : 0,
        ...this.percentiles(all.map((s) => s.durationMs)),
      },
    };
  }

  private summarize(
    samples: Sample[],
    target?: SloTarget,
  ): SloRouteSnapshot {
    const count = samples.length;
    const errorCount = samples.filter((s) => s.status >= 500).length;
    const errorRate = count ? errorCount / count : 0;
    const p = this.percentiles(samples.map((s) => s.durationMs));
    const sloMet = target
      ? p.p95Ms <= target.p95Ms && errorRate <= target.maxErrorRate
      : true;
    return { count, errorCount, errorRate, ...p, sloMet };
  }

  private percentiles(values: number[]): {
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
  } {
    if (values.length === 0) {
      return { p50Ms: 0, p95Ms: 0, p99Ms: 0 };
    }
    const sorted = [...values].sort((a, b) => a - b);
    const at = (q: number) => {
      const idx = Math.min(
        sorted.length - 1,
        Math.max(0, Math.ceil(q * sorted.length) - 1),
      );
      return sorted[idx];
    };
    return {
      p50Ms: Math.round(at(0.5)),
      p95Ms: Math.round(at(0.95)),
      p99Ms: Math.round(at(0.99)),
    };
  }
}

export const sharedSloMetrics = new SloMetricsService();
