import { CreRun } from "./types.js";

export type CognivernClientConfig = {
  baseUrl: string; // e.g. http://localhost:3000
  apiKey: string;
  projectId?: string;
  ingestKey?: string;
};

export class CognivernClient {
  private baseUrl: string;
  private apiKey: string;
  private projectId: string;
  private ingestKey: string;

  constructor(config: CognivernClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.apiKey = config.apiKey;
    this.projectId = config.projectId || "default";
    this.ingestKey = config.ingestKey || process.env.COGNIVERN_INGEST_KEY || "";
  }

  async ingestRun(run: CreRun): Promise<{ runId: string; projectId: string }> {
    const payload = { ...run, projectId: (run as any).projectId || this.projectId };

    const res = await fetch(`${this.baseUrl}/ingest/runs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.ingestKey}`,
        "X-PROJECT-ID": this.projectId,
      },
      body: JSON.stringify(payload),
    });

    const json = (await res.json()) as any;
    if (!res.ok) {
      throw new Error(json?.error || `Ingest failed: ${res.status}`);
    }

    return { runId: json.runId, projectId: json.projectId };
  }
}
