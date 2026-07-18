import crypto from "node:crypto";
import logger from "@backend/utils/logger.js";
import { CantonLedgerClient } from "@backend/canton/CantonLedgerClient.js";
import { CantonPartyRegistry } from "@backend/canton/CantonPartyRegistry.js";
import type { SealedBidBackend } from "./SealedBidBackend.js";
import type {
  BackendName,
  BidRecord,
  CreateRoundRequest,
  PartyView,
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
  deposit: string;
}

interface AuctionPayload {
  manager: string;
  eligibleBidders: string[];
  roundId: string;
  description: string;
  serviceCategory: string;
  deadline: string;
  maxBids: string;
  settlementAsset: { tag: "None" } | { tag: "Some", value: { contractId: string } } | null;
}

interface PaymentDepositPayload {
  issuer: string;
  owner: string;
  amount: string;
  assetTag: string;
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
  settledAsset: { tag: "None" } | { tag: "Some", value: { contractId: string } } | null;
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
  // Value settlement state — populated when the round was created with a
  // settlementAmount. The depositCid is the escrowed PaymentDeposit contract
  // (owned by the manager). After reveal, settledAssetCid is the new deposit
  // contract owned by the winner.
  depositCid: string | null;
  settledAssetCid: string | null;
  settlementAmount: number | null;
  settlementAssetTag: string | null;
}

// The set of bidders eligible to submit into an auction. In production this
// would be configurable per-round; for Phase 2 we use the demo parties the
// sandbox init-script provisions so the flow is exercisable end-to-end
// without extra config. On shared DevNet nodes parties are often suffixed by
// project name, so allow overriding via env.
const DEFAULT_ELIGIBLE_BIDDER_NAMES = process.env.CANTON_DEMO_BIDDER_NAMES
  ? process.env.CANTON_DEMO_BIDDER_NAMES.split(",").map((s) => s.trim())
  : ["Alice", "Bob", "Charlie"];
const DEFAULT_DEMO_MANAGER = process.env.CANTON_DEMO_MANAGER_NAME ?? "Auctioneer";

export class CantonSealedBidBackend implements SealedBidBackend {
  readonly name: BackendName = "canton";
  private rounds = new Map<string, CantonRoundState>();
  // Populated once at construction from the ledger — lets the backend
  // reflect auctions the Daml init-script pre-seeded on sandbox boot so
  // visitors land on a rich demo state rather than an empty round list.
  // Every public method awaits this before touching `rounds`.
  private ready: Promise<void>;

  constructor(
    private readonly client: CantonLedgerClient,
    private readonly parties: CantonPartyRegistry,
    private readonly templates: CantonTemplateIds,
    private readonly defaultBidderNames: string[] = DEFAULT_ELIGIBLE_BIDDER_NAMES,
    private readonly demoManagerName: string = DEFAULT_DEMO_MANAGER,
  ) {
    this.ready = this.hydrateFromLedger().catch((err) => {
      logger.warn(
        `SealedBid[canton]: hydrate from ledger failed — pre-seeded rounds will not appear until first HTTP request retries: ${err instanceof Error ? err.message : err}`,
      );
    });
  }

  // Discover auctions and results already on the ledger (typically from the
  // Daml init-script's demo seeding) and register them in the off-ledger
  // state so cognivern's dispatcher can route requests against them. Only
  // rounds authored by the demo manager party are picked up — this avoids
  // reflecting rounds from other tenants that might share the participant
  // in a multi-app deployment.
  private async hydrateFromLedger(): Promise<void> {
    const managerParty = await this.parties.resolve(this.demoManagerName);
    const [auctions, results] = await Promise.all([
      this.client.query<AuctionPayload>(managerParty, [this.templates.auction]),
      this.client.query<AuctionResultPayload>(managerParty, [this.templates.result]),
    ]);
    const resultsByRoundId = new Map(
      results.map((r) => [r.payload.roundId, r]),
    );

    let hydratedOpen = 0;
    let hydratedRevealed = 0;

    for (const a of auctions) {
      if (a.payload.manager !== managerParty) continue;
      const roundId = a.payload.roundId;
      if (!roundId || this.rounds.has(roundId)) continue;
      this.rounds.set(roundId, {
        roundId,
        auctionCid: a.contractId,
        resultCid: null,
        manager: this.demoManagerName,
        managerName: this.demoManagerName,
        eligibleBidders: a.payload.eligibleBidders,
        description: a.payload.description,
        serviceCategory: a.payload.serviceCategory,
        deadline: a.payload.deadline,
        maxBids: parseInt(a.payload.maxBids, 10) || 5,
        status: "open",
        createdAt: new Date().toISOString(),
        depositCid: null,
        settledAssetCid: null,
        settlementAmount: null,
        settlementAssetTag: null,
      });
      hydratedOpen++;
    }

    for (const [roundId, r] of resultsByRoundId) {
      if (r.payload.manager !== managerParty) continue;
      // If the same roundId has an existing auction record (edge case where
      // both live simultaneously), upgrade it in-place. Otherwise register
      // a fresh revealed round with no auction contract.
      const existing = this.rounds.get(roundId);
      if (existing) {
        existing.resultCid = r.contractId;
        existing.auctionCid = null;
        existing.status = "revealed";
      } else {
        this.rounds.set(roundId, {
          roundId,
          auctionCid: null,
          resultCid: r.contractId,
          manager: this.demoManagerName,
          managerName: this.demoManagerName,
          eligibleBidders: r.payload.eligibleBidders,
          description: r.payload.description,
          serviceCategory: r.payload.serviceCategory,
          deadline: "",
          maxBids: 0,
          status: "revealed",
          createdAt: r.payload.revealedAt,
          depositCid: null,
          settledAssetCid: r.payload.settledAsset && r.payload.settledAsset.tag === "Some"
            ? r.payload.settledAsset.value.contractId : null,
          settlementAmount: null,
          settlementAssetTag: null,
        });
      }
      hydratedRevealed++;
    }

    if (hydratedOpen || hydratedRevealed) {
      logger.info(
        `SealedBid[canton]: hydrated ${hydratedOpen} open + ${hydratedRevealed} revealed round(s) from ledger`,
      );
    }
  }

  // Public — the dispatcher calls this after registering the backend so it
  // can populate its own roundId → backend index without probing every
  // backend on every request.
  async listHydratedRoundIds(): Promise<string[]> {
    await this.ready;
    return Array.from(this.rounds.keys());
  }

  async createRound(
    request: CreateRoundRequest,
    manager: string,
  ): Promise<SealedBidRound> {
    await this.ready;
    const managerParty = await this.parties.resolve(manager);
    const eligibleBidders = await Promise.all(
      this.defaultBidderNames.map((n) => this.parties.resolve(n)),
    );

    // Assign the cognivern roundId FIRST so we can persist it on the auction
    // itself. This gives the ledger a per-round key we can filter Bids on.
    const roundId = "0x" + crypto.randomBytes(32).toString("hex");

    // Value settlement: if settlementAmount is provided, escrow a
    // PaymentDeposit on-ledger BEFORE creating the auction. The deposit's
    // contract ID is passed to the SealedBidAuction so CloseAndReveal can
    // atomically transfer it to the winner.
    let depositCid: string | null = null;
    let settlementAmount: number | null = null;
    let settlementAssetTag: string | null = null;
    if (request.settlementAmount && request.settlementAmount > 0) {
      settlementAmount = request.settlementAmount;
      settlementAssetTag = request.settlementAssetTag ?? "USDC";
      const deposit = await this.client.create<PaymentDepositPayload>(
        managerParty,
        this.templates.deposit,
        {
          issuer: managerParty,
          owner: managerParty,
          amount: settlementAmount.toFixed(2),
          assetTag: settlementAssetTag,
        },
      );
      depositCid = deposit.contractId;
      logger.info(
        `SealedBid[canton]: escrowed PaymentDeposit ${depositCid.slice(0, 12)}… (${settlementAssetTag} ${settlementAmount}) for round ${roundId}`,
      );
    }

    // Build the settlementAsset field for the auction create. Daml JSON API
    // encodes Optional as { tag: "Some", value: { contractId: "..." } } or
    // { tag: "None" }.
    const settlementAssetField = depositCid
      ? { tag: "Some", value: { contractId: depositCid } }
      : { tag: "None" };

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
        settlementAsset: settlementAssetField,
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
      depositCid,
      settledAssetCid: null,
      settlementAmount,
      settlementAssetTag,
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
    await this.ready;
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

    // Honour an explicit proposalHash from the caller (used by integration
    // tests to pin a known literal so the post-reveal ledger assertion can
    // lock the CloseAndReveal winner→winningProposal mapping). Production
    // flows leave request.proposalHash unset and we fall back to a SHA-256
    // of `proposalDetails` (or random bytes if no details were supplied).
    const proposalHash =
      request.proposalHash ??
      (request.proposalDetails
        ? "0x" +
          crypto
            .createHash("sha256")
            .update(request.proposalDetails)
            .digest("hex")
        : "0x" + crypto.randomBytes(32).toString("hex"));

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
    await this.ready;
    const state = this.rounds.get(roundId);
    if (!state) throw new Error(`Round ${roundId} not found`);
    const callerParty = await this.parties.resolve(caller);
    const managerParty = await this.parties.resolve(state.managerName);
    if (callerParty !== managerParty)
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
    await this.ready;
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

    // Capture the settled asset CID from the AuctionResult — this is the
    // on-ledger proof that value was transferred to the winner atomically.
    if (result.settledAsset && result.settledAsset.tag === "Some") {
      state.settledAssetCid = result.settledAsset.value.contractId;
      logger.info(
        `SealedBid[canton]: value settled — PaymentDeposit ${state.settledAssetCid.slice(0, 12)}… transferred to winner in atomic reveal`,
      );
    }

    return this.toSealedBidRoundRevealed(state, result, bidsOnLedger);
  }

  async getRound(roundId: string): Promise<SealedBidRound | null> {
    await this.ready;
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
    await this.ready;
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

  // Query the ledger ACTING AS `party` and return exactly the Bid contracts
  // that party can read on-ledger for this round. This is real per-party
  // disclosure: when `party` is a bidder, Canton returns only that bidder's own
  // Bid (they are its signatory); when `party` is the manager, Canton returns
  // every bid (the manager is observer on all). A competitor's bid is never in
  // the result set — there is nothing filtered client-side. The amount is
  // present because the returning party is authorized to read it.
  async queryBidsAsParty(roundId: string, party: string): Promise<PartyView> {
    await this.ready;
    const state = this.rounds.get(roundId);
    if (!state) throw new Error(`Round ${roundId} not found`);
    const partyId = await this.parties.resolve(party);
    const all = await this.client.query<BidPayload>(partyId, [
      this.templates.bid,
    ]);
    const visibleBids = all
      .filter((b) => b.payload.roundId === state.roundId)
      .map((b, i) => ({
        bidder: b.payload.bidder,
        amountUsd: parseFloat(b.payload.amountUsd),
        proposalHash: b.payload.proposalHash,
        index: i,
      }));
    return { party, partyId, visibleBids };
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
      settledAssetCid: state.settledAssetCid,
      settlementAmount: state.settlementAmount,
      settlementAssetTag: state.settlementAssetTag,
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
      settledAssetCid: state.settledAssetCid,
      settlementAmount: state.settlementAmount,
      settlementAssetTag: state.settlementAssetTag,
    };
  }
}
