/**
 * Ingest the cognivern CRE run ledger (data/cre-runs.jsonl) into HydraDB.
 *
 * This is the "document ingestion" deliverable for the HydraDB challenge:
 * real cognivern audit/run data mirrored as app-knowledge with stable IDs
 * and entity-bearing tenant_metadata (agent_id, vendor, decision, chain, ts).
 *
 * Run: HYDRADB_ENABLED=true HYDRADB_API_KEY=... pnpm hydradb:ingest-ledger
 *
 * Idempotent: upsert=true, so re-running updates existing records by id.
 */

import fs from "node:fs";
import path from "node:path";
import { hydraDbIngestion } from "@backend/services/hydradb/index.js";
import type { CreRun } from "@backend/cre/types.js";

const LEDGER_PATH = path.resolve(process.cwd(), "data/cre-runs.jsonl");

async function main() {
  if (!fs.existsSync(LEDGER_PATH)) {
    console.error(`Ledger not found: ${LEDGER_PATH}`);
    process.exit(1);
  }

  console.log(`=== Ingesting CRE run ledger → HydraDB ===`);
  console.log(`source: ${LEDGER_PATH}\n`);

  if (!hydraDbIngestion.isEnabled()) {
    console.error("HYDRADB_ENABLED is not true (or HYDRADB_API_KEY missing).");
    process.exit(1);
  }

  // 1. Ensure database is ready.
  console.log("[1/3] ensureDatabase...");
  await hydraDbIngestion.ensureDatabase();

  // 2. Parse + ingest runs in batches of 25 (HydraDB app_knowledge batch size).
  console.log("[2/3] parsing ledger...");
  const raw = fs.readFileSync(LEDGER_PATH, "utf8").trim().split("\n");
  const runs: CreRun[] = [];
  for (const line of raw) {
    if (!line.trim()) continue;
    try {
      runs.push(JSON.parse(line) as CreRun);
    } catch (err) {
      console.warn(`  skipping unparseable line: ${err}`);
    }
  }
  console.log(`  parsed ${runs.length} runs`);

  const BATCH = 25;
  let ingested = 0;
  const ingestIds: string[] = [];
  for (let i = 0; i < runs.length; i += BATCH) {
    const batch = runs.slice(i, i + BATCH);
    const id = await hydraDbIngestion.ingestCreRuns(batch);
    if (id) ingestIds.push(...id);
    ingested += batch.length;
    process.stdout.write(`  ingested ${ingested}/${runs.length}\r`);
  }
  console.log("");

  // 3. Wait for indexing to complete (searchable).
  console.log("[3/3] waitForIndexing...");
  // ingestCreRuns returns one ingest id per batch; poll the first as a proxy.
  if (ingestIds.length > 0) {
    await hydraDbIngestion.waitForIndexing(ingestIds.slice(0, 5), 180_000);
  }

  console.log(`\n=== Done. Ingested ${ingested} runs into HydraDB. ===`);
  console.log(`Database: ${process.env.HYDRADB_DATABASE ?? "cognivern"}`);
  console.log(`\nNext: run a retrieval query, e.g.:`);
  console.log(`  pnpm tsx -e "import {hydraDbRetrieval} from '@backend/services/hydradb/index.js'; hydraDbRetrieval.retrieve({query:'what did http-verify-agent spend on stable-email?', forceMode:'thinking'}).then(r=>console.log(JSON.stringify(r.metrics,null,2),r.chunks[0]?.chunk_content))"`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Ingestion failed:", err);
  process.exit(1);
});
