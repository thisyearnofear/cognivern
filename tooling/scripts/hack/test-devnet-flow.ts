import { readFileSync } from "node:fs";
import crypto from "node:crypto";
import { CantonLedgerClient } from "../../src/backend/canton/CantonLedgerClient.js";

const token = readFileSync("/tmp/hackcanton-token.txt", "utf8").trim();
const pkgName = "daml";

const client = new CantonLedgerClient({
  jsonApiUrl: "https://ledger-api-json.participant.hackcanton-01.devnet.naas.noders.services:443",
  applicationId: "cognivern",
  ledgerId: "hackcanton-01",
  ledgerUserId: "e6c5f9fc-98ed-491f-b228-00cf931a05cc",
  bearerToken: token,
});

const templates = {
  auction: `#${pkgName}:Main:SealedBidAuction`,
  bid: `#${pkgName}:Main:Bid`,
  result: `#${pkgName}:Main:AuctionResult`,
};

const manager = "auctioner-cognivern::122003aa7c491e00a453145c4d2cd3dbf5db8908b4e663c9944baed57fd66effa668";
const alice = "alice-cognivern::122003aa7c491e00a453145c4d2cd3dbf5db8908b4e663c9944baed57fd66effa668";
const bob = "bob-cognivern::122003aa7c491e00a453145c4d2cd3dbf5db8908b4e663c9944baed57fd66effa668";
const charlie = "charlie-cognivern::122003aa7c491e00a453145c4d2cd3dbf5db8908b4e663c9944baed57fd66effa668";

async function main() {
  console.log("--- querying existing rounds ---");
  const rounds = await client.query(manager, [templates.auction]);
  console.log("existing auction contracts:", rounds.length);

  console.log("--- create round ---");
  const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const created = await client.create(manager, templates.auction, {
    manager,
    eligibleBidders: [alice, bob, charlie],
    roundId: "devnet-smoke-" + crypto.randomBytes(4).toString("hex"),
    description: "DevNet smoke test",
    serviceCategory: "test",
    deadline,
    maxBids: "5",
  });
  console.log("auctionCid:", created.contractId);

  console.log("--- submit bid 1 ---");
  const bid1 = await client.exercise(alice, templates.auction, created.contractId, "SubmitBid", {
    bidder: alice,
    amountUsd: "120.00",
    proposalHash: "0x1a",
  });
  console.log("bid1 created:", bid1.events.find((e) => e.created?.templateId.endsWith(":Main:Bid"))?.created?.contractId);

  console.log("--- query bids ---");
  const bids = await client.query(manager, [templates.bid]);
  console.log("bids visible to manager:", bids.length);

  console.log("SUCCESS: ledger flow works");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
