import { readFileSync } from "node:fs";
import { CantonLedgerClient } from "../../src/backend/canton/CantonLedgerClient.js";

const tokenPath = "/tmp/hackcanton-token.txt";
const bearerToken = readFileSync(tokenPath, "utf8").trim();

const client = new CantonLedgerClient({
  jsonApiUrl: "https://ledger-api-json.participant.hackcanton-01.devnet.naas.noders.services:443",
  applicationId: "cognivern",
  ledgerId: "hackcanton-01",
  ledgerUserId: "papa",
  bearerToken,
});

async function main() {
  console.log("--- listParties ---");
  const parties = await client.listParties();
  console.log(parties);

  console.log("--- listPackages (raw /v2/packages) ---");
  // @ts-expect-error accessing private method for diagnostic
  const packages = await client.v2Call("GET", "/v2/packages");
  console.log("package count:", (packages as { packageIds?: string[] }).packageIds?.length ?? 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
