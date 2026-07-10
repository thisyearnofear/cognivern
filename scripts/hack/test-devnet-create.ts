import { readFileSync } from "node:fs";
import crypto from "node:crypto";
import { CantonLedgerClient } from "../../src/backend/canton/CantonLedgerClient.js";

const token = readFileSync("/tmp/hackcanton-token.txt", "utf8").trim();

const client = new CantonLedgerClient({
  jsonApiUrl: "https://ledger-api-json.participant.hackcanton-01.devnet.naas.noders.services:443",
  applicationId: "cognivern",
  ledgerId: "hackcanton-01",
  ledgerUserId: "e6c5f9fc-98ed-491f-b228-00cf931a05cc",
  bearerToken: token,
});

const manager = "auctioner-cognivern::122003aa7c491e00a453145c4d2cd3dbf5db8908b4e663c9944baed57fd66effa668";
const alice = "alice-cognivern::122003aa7c491e00a453145c4d2cd3dbf5db8908b4e663c9944baed57fd66effa668";
const bob = "bob-cognivern::122003aa7c491e00a453145c4d2cd3dbf5db8908b4e663c9944baed57fd66effa668";
const charlie = "charlie-cognivern::122003aa7c491e00a453145c4d2cd3dbf5db8908b4e663c9944baed57fd66effa668";

async function main() {
  const templateId = "#daml:Main:SealedBidAuction";
  const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  // Access private submitTransaction via any
  const res = await (client as any).submitTransaction(manager, [
    {
      CreateCommand: {
        templateId,
        createArguments: {
          manager,
          eligibleBidders: [alice, bob, charlie],
          roundId: "devnet-smoke-" + crypto.randomBytes(4).toString("hex"),
          description: "DevNet smoke test",
          serviceCategory: "test",
          deadline,
          maxBids: "5",
        },
      },
    },
  ]);
  console.log(JSON.stringify(res, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
