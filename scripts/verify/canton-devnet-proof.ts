import fs from "node:fs/promises";
import path from "node:path";

type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  error?: unknown;
  timestamp?: string;
};

type SealedBid = {
  bidder: string;
  encryptedAmount: string;
  proposalHash: string;
  status: string;
  submittedAt: string;
  index: number;
};

type SealedBidRound = {
  roundId: string;
  description: string;
  serviceCategory: string;
  manager: string;
  deadline: string;
  maxBids: number;
  status: "open" | "closed" | "revealed";
  bids: SealedBid[];
  winner: string | null;
  winningBid: number | null;
  winningProposalHash: string | null;
  createdAt: string;
  backend?: "fhe" | "canton";
  settledAssetCid?: string | null;
  settlementAmount?: number | null;
  settlementAssetTag?: string | null;
};

type BidResponse = Omit<SealedBid, "encryptedAmount"> & {
  encryptedAmount: string;
  note?: string;
};

type CloseResponse = {
  roundId: string;
  status: string;
  bidCount: number;
  note?: string;
};

type RevealResponse = {
  roundId: string;
  winner: string;
  winningBid: number;
  winningProposalHash: string;
  status: string;
  totalBids: number;
  note?: string;
};

const baseUrl = (process.env.COGNIVERN_URL || "https://cognivern.thisyearnofear.com").replace(
  /\/$/,
  "",
);
const apiKey = process.env.COGNIVERN_API_KEY || "";
const manager = process.env.CANTON_PROOF_MANAGER || "Auctioneer";
const bidderNames = process.env.CANTON_PROOF_BIDDERS
  ? process.env.CANTON_PROOF_BIDDERS.split(",").map((s) => s.trim())
  : ["Alice", "Bob", "Charlie"];
const artifactDir = process.env.CANTON_PROOF_DIR || ".artifacts";

function headers(extra?: Record<string, string>) {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    ...(extra || {}),
  };
  if (apiKey) h["X-API-KEY"] = apiKey;
  return h;
}

async function request<T>(
  method: "GET" | "POST",
  endpoint: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${baseUrl}${endpoint}`, {
    method,
    headers: headers(),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const parsed = text ? (JSON.parse(text) as ApiEnvelope<T>) : {};
  if (!res.ok || parsed.success === false) {
    throw new Error(
      `${method} ${endpoint} failed (${res.status}): ${JSON.stringify(parsed.error ?? parsed)}`,
    );
  }
  if (parsed.data === undefined) {
    throw new Error(`${method} ${endpoint} returned no data: ${text}`);
  }
  return parsed.data;
}

function parseBidCid(bid: BidResponse | SealedBid): string | null {
  try {
    const parsed = JSON.parse(bid.encryptedAmount) as { bidCid?: string };
    return parsed.bidCid ?? null;
  } catch {
    return null;
  }
}

async function main() {
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const deadline = new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString();

  console.log(`Canton proof target: ${baseUrl}`);
  console.log(`Manager party name : ${manager}`);

  const created = await request<SealedBidRound>("POST", "/api/vendor/sealed-bid/rounds", {
    backend: "canton",
    manager,
    description: `HackCanton DevNet proof round ${runId}`,
    serviceCategory: "private-otc-rfp",
    deadline,
    maxBids: 5,
    // Value settlement: escrow a PaymentDeposit that will be atomically
    // transferred to the winner inside CloseAndReveal. This proves the
    // "what settles atomically?" requirement — value moves on-ledger,
    // not just an informational record.
    settlementAmount: 74500,
    settlementAssetTag: "USDC",
  });

  if (created.backend !== "canton") {
    throw new Error(`Expected canton backend, got ${created.backend ?? "<missing>"}`);
  }

  const bids = [] as Array<{
    bidder: string;
    amountUsd: number;
    proposalDetails: string;
    response: BidResponse;
    bidCid: string | null;
  }>;

  for (const bid of bidderNames.map((name) => ({
    bidder: name,
    amountUsd: name === "Bob" || name === "bob-cognivern" ? 74500 : name === "Alice" || name === "alice-cognivern" ? 91000 : 108000,
    proposalDetails: `${name}: DevNet proof bid`,
  }))) {
    const response = await request<BidResponse>(
      "POST",
      `/api/vendor/sealed-bid/rounds/${encodeURIComponent(created.roundId)}/bid`,
      bid,
    );
    bids.push({ ...bid, response, bidCid: parseBidCid(response) });
  }

  const closed = await request<CloseResponse>(
    "POST",
    `/api/vendor/sealed-bid/rounds/${encodeURIComponent(created.roundId)}/close`,
    { manager },
  );

  const revealed = await request<RevealResponse>(
    "POST",
    `/api/vendor/sealed-bid/rounds/${encodeURIComponent(created.roundId)}/reveal`,
    { selectionMethod: "lowest-bid" },
  );

  const finalRound = await request<SealedBidRound>(
    "GET",
    `/api/vendor/sealed-bid/rounds/${encodeURIComponent(created.roundId)}`,
  );

  const artifact = {
    generatedAt: new Date().toISOString(),
    target: {
      baseUrl,
      expectedNetwork: process.env.CANTON_PROOF_NETWORK || "Canton DevNet (confirm via production env)",
      manager,
    },
    caveat:
      "This proves the public Cognivern API exercised its configured canton backend. Final eligibility also requires production CANTON_JSON_API_URL/CANTON_LEDGER_ID to point at Canton DevNet, not sandbox.",
    lifecycle: {
      created: {
        roundId: created.roundId,
        backend: created.backend,
        manager: created.manager,
        deadline: created.deadline,
      },
      bids: bids.map((b) => ({
        bidder: b.bidder,
        amountUsd: b.amountUsd,
        proposalHash: b.response.proposalHash,
        bidCid: b.bidCid,
        note: b.response.note,
      })),
      closed,
      revealed,
      finalRound: {
        roundId: finalRound.roundId,
        backend: finalRound.backend,
        status: finalRound.status,
        winner: finalRound.winner,
        winningBid: finalRound.winningBid,
        winningProposalHash: finalRound.winningProposalHash,
        bidCountVisibleAfterReveal: finalRound.bids.length,
        // Value settlement evidence — the on-ledger contract ID of the
        // PaymentDeposit that was atomically transferred to the winner.
        settledAssetCid: finalRound.settledAssetCid ?? null,
        settlementAmount: finalRound.settlementAmount ?? null,
        settlementAssetTag: finalRound.settlementAssetTag ?? null,
        valueSettledAtomically: !!finalRound.settledAssetCid,
      },
    },
    submissionFieldsToFill: {
      cantonDevnetParticipantOrValidator: process.env.CANTON_DEVNET_PARTICIPANT || "hackcanton-01.devnet.naas.noders.services",
      uploadedDarPackageId: process.env.CANTON_DEVNET_PACKAGE_ID || "d62e13ab174d8da690a44c6dd354a223f8c70e43a0ac7e17b8385bfd8b291fad",
      deployedTemplateIds: {
        auction: process.env.CANTON_TEMPLATE_AUCTION || "#daml:Main:SealedBidAuction",
        bid: process.env.CANTON_TEMPLATE_BID || "#daml:Main:Bid",
        result: process.env.CANTON_TEMPLATE_RESULT || "#daml:Main:AuctionResult",
        deposit: process.env.CANTON_TEMPLATE_DEPOSIT || "#daml:Main:PaymentDeposit",
      },
    },
  };

  await fs.mkdir(artifactDir, { recursive: true });
  const file = path.join(artifactDir, `canton-devnet-proof-${runId}.json`);
  await fs.writeFile(file, JSON.stringify(artifact, null, 2) + "\n");
  await fs.writeFile(
    path.join(artifactDir, "canton-devnet-proof-latest.json"),
    JSON.stringify(artifact, null, 2) + "\n",
  );

  console.log("\nProof flow completed.");
  console.log(`  roundId         : ${created.roundId}`);
  console.log(`  winner          : ${revealed.winner}`);
  console.log(`  amount          : ${revealed.winningBid}`);
  console.log(`  value settled   : ${finalRound.settledAssetCid ? `YES — ${finalRound.settlementAssetTag} ${finalRound.settlementAmount} → ${finalRound.settledAssetCid.slice(0, 16)}…` : "NO"}`);
  console.log(`  artifact        : ${file}`);
}

main().catch((err) => {
  console.error("Canton proof flow failed:", err);
  process.exit(1);
});
