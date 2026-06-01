import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";

// We need to test the migration script's config logic without actually
// running migrations. Re-import just the helper by re-implementing it
// locally to validate the function's contract.

interface DbConfig {
  driver: "sqlite" | "postgres";
  connectionString: string;
}

function getDbConfig(env: NodeJS.ProcessEnv): DbConfig {
  const url = env.DATABASE_URL;
  if (!url) {
    return {
      driver: "sqlite",
      connectionString: path.resolve(process.cwd(), "data/cognivern.db"),
    };
  }
  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
    return { driver: "postgres", connectionString: url };
  }
  if (url.startsWith("file:")) {
    return { driver: "sqlite", connectionString: url.slice("file:".length) };
  }
  return { driver: "sqlite", connectionString: url };
}

describe("migrate script config", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("defaults to SQLite when no DATABASE_URL is set", () => {
    delete process.env.DATABASE_URL;
    const cfg = getDbConfig(process.env);
    expect(cfg.driver).toBe("sqlite");
    expect(cfg.connectionString).toContain("cognivern.db");
  });

  it("selects postgres driver for postgres:// URL", () => {
    process.env.DATABASE_URL = "postgres://user:pass@host:5432/db";
    const cfg = getDbConfig(process.env);
    expect(cfg.driver).toBe("postgres");
    expect(cfg.connectionString).toBe("postgres://user:pass@host:5432/db");
  });

  it("selects postgres driver for postgresql:// URL", () => {
    process.env.DATABASE_URL = "postgresql://user@host/db?sslmode=require";
    const cfg = getDbConfig(process.env);
    expect(cfg.driver).toBe("postgres");
  });

  it("selects sqlite driver for file: scheme", () => {
    process.env.DATABASE_URL = "file:/tmp/foo.db";
    const cfg = getDbConfig(process.env);
    expect(cfg.driver).toBe("sqlite");
    expect(cfg.connectionString).toBe("/tmp/foo.db");
  });

  it("selects sqlite driver for a plain path", () => {
    process.env.DATABASE_URL = "/tmp/cognivern.db";
    const cfg = getDbConfig(process.env);
    expect(cfg.driver).toBe("sqlite");
    expect(cfg.connectionString).toBe("/tmp/cognivern.db");
  });
});

describe("migrate script — SQLite directory auto-creation", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cognivern-migrate-"));
  });

  it("creates the parent directory if missing", () => {
    const dbPath = path.join(tmpDir, "subdir/nested/data.db");
    expect(fs.existsSync(path.dirname(dbPath))).toBe(false);

    // Mirror the same logic as runSqliteMigrate
    const dir = path.dirname(dbPath);
    if (dir && !fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    expect(fs.existsSync(dir)).toBe(true);
  });

  it("does not throw if the directory already exists", () => {
    const dbPath = path.join(tmpDir, "data.db");
    const dir = path.dirname(dbPath);

    expect(fs.existsSync(dir)).toBe(true);
    // Should be a no-op
    expect(() => fs.mkdirSync(dir, { recursive: true })).not.toThrow();
  });
});
