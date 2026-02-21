import fs from "node:fs";
import path from "node:path";

export type IngestKeyTelemetry = {
  projectId: string;
  ingestKeyId: string;
  firstSeenAt: string;
  lastSeenAt: string;
  ingestedRuns: number;
};

function nowIso() {
  return new Date().toISOString();
}

export class TokenTelemetryStore {
  private filePath: string;
  private data: Map<string, IngestKeyTelemetry> = new Map();
  private loaded = false;

  constructor(params: { filePath?: string } = {}) {
    this.filePath =
      params.filePath ||
      process.env.COGNIVERN_TOKEN_TELEMETRY_FILE ||
      path.join(process.cwd(), "data", "token-telemetry.json");
  }

  private key(projectId: string, ingestKeyId: string) {
    return `${projectId}:${ingestKeyId}`;
  }

  private async ensureLoaded() {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = await fs.promises.readFile(this.filePath, "utf8");
      const arr = JSON.parse(raw) as IngestKeyTelemetry[];
      for (const t of arr) {
        this.data.set(this.key(t.projectId, t.ingestKeyId), t);
      }
    } catch (e: any) {
      if (e?.code === "ENOENT") return;
      throw e;
    }
  }

  private async persist() {
    await fs.promises.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.promises.writeFile(
      this.filePath,
      JSON.stringify([...this.data.values()], null, 2),
      "utf8"
    );
  }

  async record(projectId: string, ingestKeyId: string) {
    await this.ensureLoaded();
    const k = this.key(projectId, ingestKeyId);
    const existing = this.data.get(k);
    const now = nowIso();

    const next: IngestKeyTelemetry = existing
      ? {
          ...existing,
          lastSeenAt: now,
          ingestedRuns: existing.ingestedRuns + 1,
        }
      : {
          projectId,
          ingestKeyId,
          firstSeenAt: now,
          lastSeenAt: now,
          ingestedRuns: 1,
        };

    this.data.set(k, next);
    await this.persist();
    return next;
  }

  async listByProject(projectId: string): Promise<IngestKeyTelemetry[]> {
    await this.ensureLoaded();
    return [...this.data.values()]
      .filter((t) => t.projectId === projectId)
      .sort((a, b) => (a.lastSeenAt < b.lastSeenAt ? 1 : -1));
  }
}

export const tokenTelemetryStore = new TokenTelemetryStore();
