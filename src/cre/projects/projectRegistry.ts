import crypto from "node:crypto";

export type Project = {
  projectId: string;
  name: string;
  // Note: ingest keys are NOT exposed via control-plane endpoints.
  // This field remains for internal bootstrapping only.
  ingestKey: string;
};

export type IngestKeyMatch = {
  projectId: string;
  ingestKeyId: string; // stable identifier for telemetry (sha256 of key)
};

/**
 * Minimal multi-project support.
 *
 * Env format:
 *   COGNIVERN_PROJECTS="default:Default Project,acme:Acme Inc"
 *   COGNIVERN_INGEST_KEYS="default=dev-ingest-key|dev-ingest-key-next,acme=acme-secret"
 *
 * Key rotation: separate multiple valid keys per project with '|'.
 */
export class ProjectRegistry {
  private projects: Map<string, Project> = new Map();
  private ingestKeys: Map<string, string[]> = new Map();

  constructor() {
    const projectsSpec = process.env.COGNIVERN_PROJECTS || "default:Default Project";
    const ingestSpec = process.env.COGNIVERN_INGEST_KEYS || "default=dev-ingest-key";

    ingestSpec
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((pair) => {
        const [projectId, keys] = pair.split("=");
        if (!projectId || !keys) return;
        const list = keys
          .split("|")
          .map((k) => k.trim())
          .filter(Boolean);
        if (list.length) this.ingestKeys.set(projectId.trim(), list);
      });

    projectsSpec
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((p) => {
        const [projectId, name] = p.split(":");
        const id = (projectId || "").trim();
        if (!id) return;
        const ingestKey =
          this.ingestKeys.get(id)?.[0] || crypto.randomBytes(24).toString("hex");
        this.projects.set(id, {
          projectId: id,
          name: (name || id).trim(),
          ingestKey,
        });
      });

    // Ensure default exists
    if (!this.projects.has("default")) {
      this.projects.set("default", {
        projectId: "default",
        name: "Default Project",
        ingestKey: this.ingestKeys.get("default")?.[0] || "dev-ingest-key",
      });
    }
  }

  list(): Project[] {
    return [...this.projects.values()];
  }

  get(projectId: string): Project | undefined {
    return this.projects.get(projectId);
  }

  private keyId(key: string) {
    // stable id for analytics/telemetry without storing secrets
    return crypto.createHash("sha256").update(key).digest("hex").slice(0, 16);
  }

  matchIngestKey(projectId: string, ingestKey: string): IngestKeyMatch | null {
    const p = this.projects.get(projectId);
    if (!p) return null;
    const keys = this.ingestKeys.get(projectId) || [p.ingestKey];
    const ok = keys.includes(ingestKey);
    if (!ok) return null;
    return { projectId, ingestKeyId: this.keyId(ingestKey) };
  }
}

export const projectRegistry = new ProjectRegistry();
