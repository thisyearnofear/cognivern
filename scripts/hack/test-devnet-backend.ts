import { readFileSync } from "node:fs";
import { CantonLedgerClient } from "../../src/backend/canton/CantonLedgerClient.js";
import { CantonSealedBidBackend } from "../../src/backend/services/blockchain/sealed-bid/CantonSealedBidBackend.js";

const token = readFileSync("/tmp/hackcanton-token.txt", "utf8").trim();

const suffix = "::122003aa7c491e00a453145c4d2cd3dbf5db8908b4e663c9944baed57fd66effa668";
const partyByName: Record<string, string> = {
  "auctioner-cognivern": `auctioner-cognivern${suffix}`,
  "alice-cognivern": `alice-cognivern${suffix}`,
  "bob-cognivern": `bob-cognivern${suffix}`,
  "charlie-cognivern": `charlie-cognivern${suffix}`,
};

const client = new CantonLedgerClient({
  jsonApiUrl: "https://ledger-api-json.participant.hackcanton-01.devnet.naas.noders.services:443",
  applicationId: "cognivern",
  ledgerId: "hackcanton-01",
  ledgerUserId: "e6c5f9fc-98ed-491f-b228-00cf931a05cc",
  bearerToken: token,
});

const templates = {
  auction: "#daml:Main:SealedBidAuction",
  bid: "#daml:Main:Bid",
  result: "#daml:Main:AuctionResult",
};

const bidderNames = ["alice-cognivern", "bob-cognivern", "charlie-cognivern"];
const managerName = "auctioner-cognivern";

// Minimal party resolver: on DevNet the admin pre-allocated parties, so we
// bypass the auto-allocation registry that would otherwise hit /v2/parties.
const staticParties = {
  resolve: async (name: string) => {
    const id = partyByName[name];
    if (!id) throw new Error(`Unknown demo party name: ${name}`);
    return id;
  },
  // satisfy private typing only used via resolve
  listParties: async () => Object.values(partyByName).map((p) => ({ identifier: p, isLocal: true })),
} as unknown as import("../../src/backend/canton/CantonPartyRegistry.js").CantonPartyRegistry;

async function main() {
  const backend = new CantonSealedBidBackend(
    client,
    staticParties,
    templates,
    bidderNames,
    managerName,
  );

  console.log("--- create round ---");
  const round = await backend.createRound(
    {
      description: "Backend DevNet smoke test",
      serviceCategory: "test",
      deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      maxBids: 5,
    },
    managerName,
  );
  console.log("roundId:", round.roundId, "status:", round.status);

  console.log("--- submit bids ---");
  await backend.submitBid(round.roundId, {
    bidder: "alice-cognivern",
    amountUsd: 32000,
    proposalDetails: "alice proposal",
  });
  await backend.submitBid(round.roundId, {
    bidder: "bob-cognivern",
    amountUsd: 24500,
    proposalDetails: "bob proposal",
    proposalHash: "0x2b",
  });
  await backend.submitBid(round.roundId, {
    bidder: "charlie-cognivern",
    amountUsd: 41000,
    proposalDetails: "charlie proposal",
  });

  const withBids = await backend.getRound(round.roundId);
  console.log("bids:", withBids?.bids.length);

  console.log("--- close & reveal ---");
  await backend.closeRound(round.roundId, managerName);
  const revealed = await backend.revealWinner(round.roundId, {
    selectionMethod: "lowest-bid",
  });
  console.log("revealed:", revealed.status, "winner:", revealed.winner, "amount:", revealed.winningBid);

  if (revealed.winner?.includes("bob-cognivern") && revealed.winningBid === 24500) {
    console.log("SUCCESS: backend full flow works on DevNet");
  } else {
    throw new Error("Unexpected reveal result");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
