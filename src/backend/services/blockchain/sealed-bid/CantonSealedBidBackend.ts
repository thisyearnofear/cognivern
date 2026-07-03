import crypto from "node:crypto";
import logger from "@backend/utils/logger.js";
import { CantonLedgerClient } from "@backend/canton/CantonLedgerClient.js";
import { CantonPartyRegistry } from "@backend/canton/CantonPartyRegistry.js";
import type { SealedBidBackend } from "./SealedBidBackend.js";
import type {
  BackendName,
  BidRecord,
  CreateRoundRequest,
  RevealRequest,
  SealedBidRound,
  SubmitBidRequest,
} from "./types.js";

// Daml template IDs. The main package id is provided via env — it changes
// each time the .dar is rebuilt with model changes.
interface CantonTemplateIds {
  auction: string;
  bid: string;
  result: string;
}

interface AuctionPayload {
  manager: string;
  eligibleBidders: string[];
  roundId: string;
  description: string;
  serviceCategory: string;
  deadline: string;
  maxBids: string;
}

interface BidPayload {
  manager: string;
  bidder: string;
  roundId: string;
  amountUsd: string;
  proposalHash: string;
  submittedAt: string;
}

interface AuctionResultPayload {
  manager: string;
  eligibleBidders: string[];
  roundId: string;
  winner: string;
  winningAmount: string;
  winningProposal: string;
  description: string;
  serviceCategory: string;
  revealedAt: string;
}

// Off-ledger state kept per round: the current auction contract id (rotates
// on close/reveal since the auction is a consuming choice target), the manager
// and bidder party ids, and the roundId assigned at creation. Anything that
// can be recovered by re-querying the ledger is NOT cached here.
interface CantonRoundState {
  roundId: string;
  auctionCid: string | null;
  resultCid: string | null;
  manager: string;
  managerName: string;
  eligibleBidders: string[];
  description: string;
  serviceCategory: string;
  deadline: string;
  maxBids: number;
  status: "open" | "closed" | "revealed";
  createdAt: string;
}

// The set of bidders eligible to submit into an auction. In production this
// would be configurable per-round; for Phase 2 we use the demo parties the
// sandbox init-script provisions so the flow is exercisable end-to-end
// without extra config.
const DEFAULT_ELIGIBLE_BIDDER_NAMES = ["Alice", "Bob", "Charlie"];

export class CantonSealedBidBackend implements SealedBidBackend {
  readonly name: BackendName = "canton";
  private rounds = new Map<string, CantonRoundState>();

  constructor(
    private readonly client: CantonLedgerClient,
    private readonly parties: CantonPartyRegistry,
    private readonly templates: CantonTemplateIds,
    private readonly defaultBidderNames: string[] = DEFAULT_ELIGIBLE_BIDDER_NAMES,
  ) {}

  async createRound(
    request: CreateRoundRequest,
    manager: string,
  ): Promise<SealedBidRound> {
    const managerParty = await this.parties.resolve(manager);
    const eligibleBidders = await Promise.all(
      this.defaultBidderNames.map((n) => this.parties.resolve(n)),
    );

    // Assign the cognivern roundId FIRST so we can persist it on the auction
    // itself. This gives the ledger a per-round key we can filter Bids on.
    const roundId = "0x" + crypto.randomBytes(32).toString("hex");

    const created = await this.client.create<AuctionPayload>(
      managerParty,
      this.templates.auction,
      {
        manager: managerParty,
        eligibleBidders,
        roundId,
        description: request.description,
        serviceCategory: request.serviceCategory,
        deadline: request.deadline,
        maxBids: String(request.maxBids),
      },
    );
    const state: CantonRoundState = {
      roundId,
      auctionCid: created.contractId,
      resultCid: null,
      manager,
      managerName: manager,
      eligibleBidders,
      description: request.description,
      serviceCategory: request.serviceCategory,
      deadline: request.deadline,
      maxBids: request.maxBids,
      status: "open",
      createdAt: new Date().toISOString(),
    };
    this.rounds.set(roundId, state);

    logger.info(
      `SealedBid[canton]: round created ${roundId} — auctionCid=${created.contractId.slice(0, 12)}…`,
    );
    return this.toSealedBidRound(state, []);
  }

  async submitBid(
    roundId: string,
    request: SubmitBidRequest,
  ): Promise<BidRecord> {
    const state = this.rounds.get(roundId);
    if (!state) throw new Error(`Round ${roundId} not found`);
    if (state.status !== "open") throw new Error("Round is not open for bids");
    if (!state.auctionCid) throw new Error("Round has no active auction contract");
    if (new Date(state.deadline) < new Date())
      throw new Error("Past round deadline");

    const bidderParty = await this.parties.resolve(request.bidder);
    if (!state.eligibleBidders.includes(bidderParty))
      throw new Error(
        `Bidder ${request.bidder} is not on the eligible list for this round`,
      );

    const proposalHash = request.proposalDetails
      ? "0x" +
        crypto
          .createHash("sha256")
          .update(request.proposalDetails)
          .digest("hex")
      : "0x" + crypto.randomBytes(32).toString("hex");

    const exResult = await this.client.exercise<string>(
      bidderParty,
      this.templates.auction,
      state.auctionCid,
      "SubmitBid",
      {
        bidder: bidderParty,
        amountUsd: request.amountUsd.toFixed(2),
        proposalHash,
      },
    );

    // Count bids belonging to THIS round to compute the index — matches the
    // FHE backend's contract that BidRecord.index reflects submission order.
    const bidsForRound = await this.queryBidsAsManager(state);
    const index = Math.max(0, bidsForRound.length - 1);
    const created = exResult.events.find(
      (e) => e.created && e.created.templateId.endsWith(":Main:Bid"),
    )?.created;

    const bid: BidRecord = {
      bidder: request.bidder,
      encryptedAmount: JSON.stringify({
        canton: true,
        bidCid: created?.contractId,
        note: "Amount is visible only to the auctioneer via Canton disclosure model",
      }),
      proposalHash,
      status: "pending",
      submittedAt: new Date().toISOString(),
      index,
    };
    logger.info(
      `SealedBid[canton]: bid submitted for round ${roundId} by ${request.bidder} (bidCid=${created?.contractId.slice(0, 12)}…)`,
    );
    return bid;
  }

  async closeRound(roundId: string, caller: string): Promise<SealedBidRound> {
    const state = this.rounds.get(roundId);
    if (!state) throw new Error(`Round ${roundId} not found`);
    if (state.manager !== caller)
      throw new Error("Only the round manager can close the round");
    if (state.status !== "open") throw new Error("Round is already closed");
    // Canton auction close is not a separate ledger step; it happens
    // atomically inside CloseAndReveal. We just mark the off-ledger state
    // so no further bids are accepted through this backend.
    state.status = "closed";
    const bids = await this.queryBidsAsManager(state);
    logger.info(
      `SealedBid[canton]: round ${roundId} closed with ${bids.length} bids on-ledger`,
    );
    return this.toSealedBidRound(state, bids);
  }

  async revealWinner(
    roundId: string,
    request: RevealRequest,
  ): Promise<SealedBidRound> {
    const state = this.rounds.get(roundId);
    if (!state) throw new Error(`Round ${roundId} not found`);
    if (state.status !== "closed")
      throw new Error("Round must be closed before revealing winner");
    if (!state.auctionCid) throw new Error("Round has no active auction contract");

    const managerParty = await this.parties.resolve(state.managerName);
    const bidsOnLedger = await this.queryBidsAsManager(state);
    if (bidsOnLedger.length === 0)
      throw new Error("No bids submitted in this round");

    const selectionMethod = (() => {
      switch (request.selectionMethod) {
        case "lowest-bid":
          return { tag: "LowestBid", value: {} };
        case "highest-bid":
          return { tag: "HighestBid", value: {} };
        case "specific": {
          if (!request.specificBidder)
            throw new Error(
              "selectionMethod=specific requires specificBidder",
            );
          return {
            tag: "SpecificBidder",
            value: { bidder: request.specificBidder },
          };
        }
      }
    })();

    // Atomic reveal: archive all bids + emit AuctionResult in one transaction.
    // Losing bid amounts are never disclosed to non-observers.
    const exResult = await this.client.exercise<string>(
      managerParty,
      this.templates.auction,
      state.auctionCid,
      "CloseAndReveal",
      {
        bidCids: bidsOnLedger.map((b) => b.contractId),
        selectionMethod,
      },
    );

    const resultCreated = exResult.events.find(
      (e) => e.created && e.created.templateId.endsWith(":Main:AuctionResult"),
    )?.created;
    if (!resultCreated)
      throw new Error("CloseAndReveal did not emit an AuctionResult event");

    state.resultCid = resultCreated.contractId;
    state.auctionCid = null; // auction was consumed by the choice
    state.status = "revealed";

    const result = resultCreated.payload as AuctionResultPayload;
    return this.toSealedBidRoundRevealed(state, result, bidsOnLedger);
  }

  async getRound(roundId: string): Promise<SealedBidRound | null> {
    const state = this.rounds.get(roundId);
    if (!state) return null;
    const bids = await this.queryBidsAsManager(state);
    if (state.status === "revealed" && state.resultCid) {
      const results = await this.client.query<AuctionResultPayload>(
        await this.parties.resolve(state.managerName),
        [this.templates.result],
      );
      const found = results.find(
        (r) => r.contractId === state.resultCid && r.payload.roundId === state.roundId,
      );
      return found
        ? this.toSealedBidRoundRevealed(state, found.payload, bids)
        : this.toSealedBidRound(state, bids);
    }
    return this.toSealedBidRound(state, bids);
  }

  async listRounds(): Promise<SealedBidRound[]> {
    return Promise.all(
      Array.from(this.rounds.values()).map(async (state) => {
        const bids = await this.queryBidsAsManager(state);
        if (state.status === "revealed" && state.resultCid) {
          const results = await this.client.query<AuctionResultPayload>(
            await this.parties.resolve(state.managerName),
            [this.templates.result],
          );
          const found = results.find(
            (r) => r.contractId === state.resultCid && r.payload.roundId === state.roundId,
          );
          if (found)
            return this.toSealedBidRoundRevealed(state, found.payload, bids);
        }
        return this.toSealedBidRound(state, bids);
      }),
    );
  }

  // ── helpers ─────────────────────────────────────────────────────────────

  private async queryBidsAsManager(
    state: CantonRoundState,
  ): Promise<Array<{ contractId: string; payload: BidPayload }>> {
    const managerParty = await this.parties.resolve(state.managerName);
    const all = await this.client.query<BidPayload>(managerParty, [
      this.templates.bid,
    ]);
    // Filter to bids for THIS round. Since Daml 2.10 requires a top-level
    // manager observer for us to see the contract at all, the query already
    // scoped to bids we're allowed to see; the roundId narrows further to
    // bids from this specific auction. Anything else (init-script bids,
    // other rounds this manager runs) is excluded.
    return all.filter(
      (b) =>
        b.payload.manager === managerParty && b.payload.roundId === state.roundId,
    );
  }

  private toSealedBidRound(
    state: CantonRoundState,
    bidsOnLedger: Array<{ contractId: string; payload: BidPayload }>,
  ): SealedBidRound {
    const bids: BidRecord[] = bidsOnLedger.map((b, i) => ({
      bidder: b.payload.bidder,
      encryptedAmount: JSON.stringify({
        canton: true,
        bidCid: b.contractId,
        amountVisibleToManagerOnly: b.payload.amountUsd,
      }),
      proposalHash: b.payload.proposalHash,
      status: "pending",
      submittedAt: b.payload.submittedAt,
      index: i,
    }));
    return {
      roundId: state.roundId,
      description: state.description,
      serviceCategory: state.serviceCategory,
      manager: state.manager,
      deadline: state.deadline,
      maxBids: state.maxBids,
      status: state.status === "revealed" ? "revealed" : state.status,
      bids,
      winner: null,
      winningBid: null,
      winningProposalHash: null,
      createdAt: state.createdAt,
      backend: this.name,
    };
  }

  private toSealedBidRoundRevealed(
    state: CantonRoundState,
    result: AuctionResultPayload,
    bidsOnLedger: Array<{ contractId: string; payload: BidPayload }>,
  ): SealedBidRound {
    // Post-reveal, all bid contracts are archived on-chain. The bids array
    // reflects historical off-ledger state — we still show the bidders that
    // participated but their amounts are gone.
    const bids: BidRecord[] = bidsOnLedger.map((b, i) => ({
      bidder: b.payload.bidder,
      encryptedAmount: JSON.stringify({
        canton: true,
        archived: true,
        amountRevealedInResultOnlyIfWinner: b.payload.bidder === result.winner,
      }),
      proposalHash: b.payload.proposalHash,
      status: b.payload.bidder === result.winner ? "selected" : "rejected",
      submittedAt: b.payload.submittedAt,
      index: i,
    }));
    return {
      roundId: state.roundId,
      description: state.description,
      serviceCategory: state.serviceCategory,
      manager: state.manager,
      deadline: state.deadline,
      maxBids: state.maxBids,
      status: "revealed",
      bids,
      winner: result.winner,
      winningBid: parseFloat(result.winningAmount),
      winningProposalHash: result.winningProposal,
      createdAt: state.createdAt,
      backend: this.name,
    };
  }
}
