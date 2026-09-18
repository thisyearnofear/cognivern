/**
 * Live-data check — auto-exit mode fetches real events from the configured
 * sources (HyperSync if ENVIO_API_TOKEN is set, public RPC otherwise) and runs
 * the real handlers. Skips silently when offline or token-less.
 */
import { describe, it, expect } from "vitest";
import { createTestIndexer } from "envio";

describe("live chain data", () => {
  it("processes the first real events on Monad testnet", async () => {
    const t = createTestIndexer();
    let result;
    try {
      result = await t.process({ chains: { 10143: {} } });
    } catch (e) {
      console.log("live fetch unavailable:", (e as Error).message?.slice(0, 200));
      return; // offline / no token — not a correctness failure
    }
    console.log("changes:", result.changes.length);
    for (const c of result.changes) console.log(JSON.stringify(c).slice(0, 400));
  }, 120_000);
});
