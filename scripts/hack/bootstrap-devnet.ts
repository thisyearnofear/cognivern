import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CantonLedgerClient } from "../../src/backend/canton/CantonLedgerClient.js";

const JSON_API_URL =
  process.env.CANTON_JSON_API_URL ??
  "https://ledger-api-json.participant.hackcanton-01.devnet.naas.noders.services:443";
const DAR_PATH =
  process.env.CANTON_DAR_PATH ??
  path.resolve(import.meta.dirname, "../../daml/.daml/dist/daml-0.0.1.dar");

const DEMO_PARTIES = ["Auctioneer", "Alice", "Bob", "Charlie"];

async function main() {
  const client = new CantonLedgerClient({
    jsonApiUrl: JSON_API_URL,
    applicationId: process.env.CANTON_APPLICATION_ID ?? "cognivern",
    ledgerId: process.env.CANTON_LEDGER_ID ?? "hackcanton-01",
    ledgerUserId: process.env.CANTON_LEDGER_USER_ID,
    bearerToken: process.env.CANTON_BEARER_TOKEN,
    oidc:
      process.env.CANTON_OIDC_TOKEN_URL && process.env.CANTON_OIDC_CLIENT_ID
        ? {
            tokenUrl: process.env.CANTON_OIDC_TOKEN_URL,
            clientId: process.env.CANTON_OIDC_CLIENT_ID,
            clientSecret: process.env.CANTON_OIDC_CLIENT_SECRET,
            username: process.env.CANTON_OIDC_USERNAME,
            password: process.env.CANTON_OIDC_PASSWORD,
            audience: process.env.CANTON_OIDC_AUDIENCE,
            scope: process.env.CANTON_OIDC_SCOPE,
          }
        : undefined,
  });

  // Snapshot package IDs before upload so we can identify the newly uploaded one.
  console.log("Fetching packages before upload...");
  const before = await client.listPackageIds();
  console.log(`  existing packages: ${before.length}`);

  console.log(`Uploading DAR ${DAR_PATH}...`);
  const dar = readFileSync(DAR_PATH);
  await client.uploadDar(dar);
  console.log("  DAR upload accepted");

  console.log("Fetching packages after upload...");
  const after = await client.listPackageIds();
  console.log(`  total packages: ${after.length}`);
  const newPackageIds = after.filter((id) => !before.includes(id));
  console.log(`  new package IDs: ${newPackageIds.join(", ") || "none"}`);
  if (newPackageIds.length === 0) {
    throw new Error("DAR upload succeeded but no new package IDs appeared");
  }

  // Assume the DAR contains a single main package. Multi-package DARs would need
  // template ID discovery per package.
  const mainPackageId = newPackageIds[0];
  // Canton v2 commands/queries accept package-name references; full package IDs
  // are returned in events and resolved by the client.
  const packageName = "daml";
  const templates = {
    auction: `#${packageName}:Main:SealedBidAuction`,
    bid: `#${packageName}:Main:Bid`,
    result: `#${packageName}:Main:AuctionResult`,
  };

  console.log("Allocating demo parties...");
  const parties: Record<string, string> = {};
  for (const name of DEMO_PARTIES) {
    const result = await client.allocateParty(name, name);
    parties[name] = result.identifier;
    console.log(`  ${name} -> ${result.identifier}`);
  }

  const bootstrap = {
    jsonApiUrl: JSON_API_URL,
    ledgerId: process.env.CANTON_LEDGER_ID ?? "hackcanton-01",
    mainPackageId,
    templates,
    parties,
    darPath: DAR_PATH,
    timestamp: new Date().toISOString(),
  };

  const outPath = path.resolve(
    import.meta.dirname,
    "../../.artifacts/devnet-bootstrap.json",
);
  writeFileSync(outPath, JSON.stringify(bootstrap, null, 2));
  console.log(`Saved bootstrap result to ${outPath}`);
  console.log(JSON.stringify(bootstrap, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
