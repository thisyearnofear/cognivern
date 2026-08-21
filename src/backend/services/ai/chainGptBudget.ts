/**
 * Shared ChainGPT daily call budget — process-local with optional file
 * persistence so PM2 restarts do not reset the counter mid-day.
 */

import fs from "node:fs";
import path from "node:path";
import logger from "@backend/utils/logger.js";

type BudgetSnapshot = {
  day: string;
  count: number;
};

function utcDayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function defaultBudgetPath(): string | null {
  const base =
    process.env.RATE_LIMIT_STORE_FILE ||
    process.env.DB_PATH ||
    path.join(process.cwd(), "data", "cognivern.db");
  try {
    const dir = path.dirname(base);
    fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, "chaingpt-daily-budget.json");
  } catch {
    return null;
  }
}

export class ChainGptDailyBudget {
  private readonly limit: number;
  private readonly storePath: string | null;
  private dayKey: string;
  private count: number;

  constructor(opts?: { limit?: number; storePath?: string | null }) {
    this.limit = Math.max(
      0,
      opts?.limit ?? Number(process.env.CHAINGPT_DAILY_CALL_BUDGET || 100),
    );
    this.storePath =
      opts?.storePath === null
        ? null
        : opts?.storePath ||
          process.env.CHAINGPT_BUDGET_FILE ||
          defaultBudgetPath();
    this.dayKey = utcDayKey();
    this.count = 0;
    this.load();
  }

  get remaining(): number {
    this.rolloverIfNeeded();
    if (this.limit <= 0) return Number.POSITIVE_INFINITY;
    return Math.max(0, this.limit - this.count);
  }

  get used(): number {
    this.rolloverIfNeeded();
    return this.count;
  }

  get dailyLimit(): number {
    return this.limit;
  }

  /** Returns false when the daily budget is exhausted. */
  tryConsume(n = 1): boolean {
    this.rolloverIfNeeded();
    if (this.limit <= 0) return true; // 0 = unlimited
    if (this.count + n > this.limit) {
      logger.warn("ChainGPT daily call budget exhausted", {
        used: this.count,
        limit: this.limit,
      });
      return false;
    }
    this.count += n;
    this.persist();
    return true;
  }

  private rolloverIfNeeded(): void {
    const today = utcDayKey();
    if (today !== this.dayKey) {
      this.dayKey = today;
      this.count = 0;
      this.persist();
    }
  }

  private load(): void {
    if (!this.storePath) return;
    try {
      if (!fs.existsSync(this.storePath)) return;
      const raw = JSON.parse(
        fs.readFileSync(this.storePath, "utf8"),
      ) as BudgetSnapshot;
      if (raw.day === utcDayKey() && typeof raw.count === "number") {
        this.dayKey = raw.day;
        this.count = Math.max(0, Math.floor(raw.count));
      }
    } catch (err) {
      logger.warn("Failed to load ChainGPT budget file", err);
    }
  }

  private persist(): void {
    if (!this.storePath) return;
    try {
      fs.mkdirSync(path.dirname(this.storePath), { recursive: true });
      const snapshot: BudgetSnapshot = {
        day: this.dayKey,
        count: this.count,
      };
      fs.writeFileSync(this.storePath, JSON.stringify(snapshot));
    } catch (err) {
      logger.warn("Failed to persist ChainGPT budget file", err);
    }
  }
}

let sharedBudget: ChainGptDailyBudget | null = null;

export function getSharedChainGptBudget(): ChainGptDailyBudget {
  if (!sharedBudget) sharedBudget = new ChainGptDailyBudget();
  return sharedBudget;
}

/** Test helper — reset the singleton. */
export function resetSharedChainGptBudgetForTests(): void {
  sharedBudget = null;
}
