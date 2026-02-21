import fs from "node:fs";
import path from "node:path";

export type ProjectUsage = {
  projectId: string;
  windowStart: string; // ISO
  windowSeconds: number;
  ingestedRuns: number;
  lastIngestAt?: string;
};

function nowIso() {
  return new Date().toISOString();
}

function floorToWindowStart(now: Date, windowSeconds: number) {
  const t = Math.floor(now.getTime() / 1000);
  const start = Math.floor(t / windowSeconds) * windowSeconds;
  return new Date(start * 1000).toISOString();
}

/**
 * Minimal usage meter for quotas.
 *
 * - Tracks ingested runs per project per time window
 * - Persists to a local JSON file (so restarts don't reset quotas)
 */
export class UsageMeter {
  private windowSeconds: number;
  private defaultMaxRunsPerWindow: number;
  private perProjectMaxRuns: Map<string, number> = new Map();
  private filePath: string;
  private usage: Map<string, ProjectUsage> = new Map();
  private loaded = false;

  constructor(params: {
    windowSeconds?: number;
    maxRunsPerWindow?: number;
    filePath?: string;
  } = {}) {
    this.windowSeconds = params.windowSeconds ?? Number(process.env.QUOTA_WINDOW_SECONDS || 86400); // default 24h
    this.defaultMaxRunsPerWindow =
      params.maxRunsPerWindow ?? Number(process.env.QUOTA_MAX_RUNS_PER_WINDOW || 1000);

    // Optional per-project overrides:
    //   COGNIVERN_PROJECT_QUOTAS="default=1000,acme=10000"
    const perProject = process.env.COGNIVERN_PROJECT_QUOTAS || "";
    perProject
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((pair) => {
        const [projectId, limit] = pair.split("=");
        const n = Number((limit || "").trim());
        if (projectId?.trim() && Number.isFinite(n) && n > 0) {
          this.perProjectMaxRuns.set(projectId.trim(), n);
        }
      });
    this.filePath =
      params.filePath ||
      process.env.COGNIVERN_USAGE_FILE ||
      path.join(process.cwd(), "data", "usage.json");
  }

  private async ensureLoaded() {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = await fs.promises.readFile(this.filePath, "utf8");
      const arr = JSON.parse(raw) as ProjectUsage[];
      for (const u of arr) this.usage.set(u.projectId, u);
    } catch (e: any) {
      if (e?.code === "ENOENT") return;
      throw e;
    }
  }

  private async persist() {
    await fs.promises.mkdir(path.dirname(this.filePath), { recursive: true });
    const arr = [...this.usage.values()];
    await fs.promises.writeFile(this.filePath, JSON.stringify(arr, null, 2), "utf8");
  }

  getMaxRunsForProject(projectId: string): number {
    return this.perProjectMaxRuns.get(projectId) || this.defaultMaxRunsPerWindow;
  }

  async canIngest(projectId: string): Promise<{ allowed: boolean; reason?: string; usage: ProjectUsage }> {
    await this.ensureLoaded();

    const now = new Date();
    const windowStart = floorToWindowStart(now, this.windowSeconds);

    const current = this.usage.get(projectId);
    const usage: ProjectUsage =
      current && current.windowStart === windowStart
        ? current
        : {
            projectId,
            windowStart,
            windowSeconds: this.windowSeconds,
            ingestedRuns: 0,
          };

    const max = this.getMaxRunsForProject(projectId);
    if (usage.ingestedRuns >= max) {
      return {
        allowed: false,
        reason: `Quota exceeded: ${usage.ingestedRuns}/${max} runs per ${this.windowSeconds}s`,
        usage,
      };
    }

    return { allowed: true, usage };
  }

  async recordIngest(projectId: string): Promise<ProjectUsage> {
    await this.ensureLoaded();

    const now = new Date();
    const windowStart = floorToWindowStart(now, this.windowSeconds);

    const current = this.usage.get(projectId);
    const next: ProjectUsage =
      current && current.windowStart === windowStart
        ? {
            ...current,
            ingestedRuns: current.ingestedRuns + 1,
            lastIngestAt: nowIso(),
          }
        : {
            projectId,
            windowStart,
            windowSeconds: this.windowSeconds,
            ingestedRuns: 1,
            lastIngestAt: nowIso(),
          };

    this.usage.set(projectId, next);
    await this.persist();
    return next;
  }

  async getUsage(projectId: string): Promise<ProjectUsage | null> {
    await this.ensureLoaded();
    return this.usage.get(projectId) || null;
  }
}

export const usageMeter = new UsageMeter();
