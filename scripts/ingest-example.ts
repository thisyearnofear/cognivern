import crypto from "node:crypto";
import { CognivernClient } from "../src/cre/client.js";
import { CreRun } from "../src/cre/types.js";

async function main() {
  const baseUrl = process.env.COGNIVERN_URL || "http://localhost:3000";
  const apiKey = process.env.COGNIVERN_API_KEY || "development-api-key";
  const projectId = process.env.COGNIVERN_PROJECT_ID || "default";
  const ingestKey = process.env.COGNIVERN_INGEST_KEY || "dev-ingest-key";

  // apiKey is still accepted by the client config but ingestion now uses ingestKey only.
  const client = new CognivernClient({ baseUrl, apiKey, projectId, ingestKey });

  const now = new Date().toISOString();
  const run: CreRun = {
    runId: crypto.randomUUID(),
    projectId,
    workflow: "external-agent",
    mode: "local",
    startedAt: now,
    finishedAt: now,
    ok: true,
    steps: [
      {
        kind: "compute",
        name: "do_the_thing",
        startedAt: now,
        finishedAt: now,
        ok: true,
        summary: "Hello from an external agent",
      },
    ],
    artifacts: [
      {
        id: crypto.randomUUID(),
        type: "observation",
        createdAt: now,
        data: { message: "This run was ingested via /ingest/runs" },
      },
    ],
  };

  const result = await client.ingestRun(run);
  console.log("Ingested run:", result.runId);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
