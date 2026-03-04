import fs from "node:fs";
import path from "node:path";

export interface UxEventRecord {
  id: string;
  eventType: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

export class UxEventStore {
  private filePath: string;
  private loaded = false;
  private events: UxEventRecord[] = [];
  private readonly limit: number;

  constructor(params: { filePath?: string; limit?: number } = {}) {
    this.filePath =
      params.filePath ||
      process.env.UX_EVENTS_FILE ||
      path.join(process.cwd(), "data", "ux-events.jsonl");
    this.limit = params.limit ?? 5000;
  }

  private async ensureLoaded() {
    if (this.loaded) return;
    try {
      const raw = await fs.promises.readFile(this.filePath, "utf8");
      this.events = raw
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => JSON.parse(line) as UxEventRecord)
        .slice(-this.limit);
    } catch (err: any) {
      if (err?.code !== "ENOENT") {
        throw err;
      }
    }
    this.loaded = true;
  }

  async add(event: UxEventRecord): Promise<void> {
    await this.ensureLoaded();
    this.events.push(event);
    if (this.events.length > this.limit) {
      this.events = this.events.slice(this.events.length - this.limit);
      await this.rewrite();
      return;
    }
    await fs.promises.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.promises.appendFile(this.filePath, `${JSON.stringify(event)}\n`, "utf8");
  }

  async list(): Promise<UxEventRecord[]> {
    await this.ensureLoaded();
    return [...this.events];
  }

  async clear(): Promise<void> {
    await this.ensureLoaded();
    this.events = [];
    await this.rewrite();
  }

  private async rewrite() {
    await fs.promises.mkdir(path.dirname(this.filePath), { recursive: true });
    const content = this.events.map((event) => JSON.stringify(event)).join("\n");
    await fs.promises.writeFile(
      this.filePath,
      content ? `${content}\n` : "",
      "utf8"
    );
  }
}

export const uxEventStore = new UxEventStore();
