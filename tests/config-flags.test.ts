/**
 * Regression test for the env-flag boolean parsing in src/config.ts.
 *
 * Guards against the z.coerce.boolean() footgun: Boolean("false") === true, so an
 * env file shipping HYDRADB_ENABLED=false (or MCP_ENABLED=false,
 * FILECOIN_ENABLED=false, FHE_WATCHER_ENABLED=false) used to silently parse as
 * *enabled*. Only the literal "true" must be truthy.
 *
 * @vitest-environment node
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

const FLAGS = [
  "HYDRADB_ENABLED",
  "MCP_ENABLED",
  "FILECOIN_ENABLED",
  "FHE_WATCHER_ENABLED",
] as const;

// An empty env file. Pointing DOTENV_CONFIG_PATH at it makes src/config.ts load
// *only* that file (skipping the repo's real .env), so every case below is
// hermetic and the "absent" case genuinely exercises the schema defaults.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cognivern-config-"));
const emptyEnvPath = path.join(tmpDir, ".env");
fs.writeFileSync(emptyEnvPath, "");

// Module cache + whatever vars the previous case set.
afterEach(() => {
  vi.resetModules();
  process.env.DOTENV_CONFIG_PATH = emptyEnvPath;
  for (const flag of FLAGS) delete process.env[flag];
  delete process.env.COGNIVERN_API_KEY;
});

function loadConfig() {
  // COGNIVERN_API_KEY is required by the schema regardless of the flags under test.
  process.env.COGNIVERN_API_KEY = "test";
  // Import fresh so the module re-reads the env.
  return import("../src/config.js");
}

describe("src/config.ts strict boolean flags", () => {
  it('treats literal "true" as enabled', async () => {
    process.env.HYDRADB_ENABLED = "true";
    const { config } = await loadConfig();
    expect(config.HYDRADB_ENABLED).toBe(true);
  });

  it('treats "TRUE" case-insensitively as enabled', async () => {
    process.env.HYDRADB_ENABLED = "TRUE";
    const { config } = await loadConfig();
    expect(config.HYDRADB_ENABLED).toBe(true);
  });

  it('treats "false" as DISABLED (the z.coerce.boolean() footgun)', async () => {
    for (const flag of FLAGS) process.env[flag] = "false";
    const { config } = await loadConfig();
    expect(config.HYDRADB_ENABLED).toBe(false);
    expect(config.MCP_ENABLED).toBe(false);
    expect(config.FILECOIN_ENABLED).toBe(false);
    expect(config.FHE_WATCHER_ENABLED).toBe(false);
  });

  it("treats any non-true string as disabled", async () => {
    for (const flag of FLAGS) process.env[flag] = "0";
    const { config } = await loadConfig();
    expect(config.HYDRADB_ENABLED).toBe(false);
    expect(config.MCP_ENABLED).toBe(false);
  });

  it("falls back to configured defaults when the var is absent", async () => {
    // MCP defaults to true; the others default to false.
    const { config } = await loadConfig();
    expect(config.MCP_ENABLED).toBe(true);
    expect(config.HYDRADB_ENABLED).toBe(false);
    expect(config.FILECOIN_ENABLED).toBe(false);
    expect(config.FHE_WATCHER_ENABLED).toBe(false);
  });
});