import logger from "@backend/utils/logger.js";
import { sharedFhenixPolicyService } from "./FhenixPolicyService.js";
import { rebuildSealedBidRoundMapping } from "@backend/cre/workflows/sealedBidGovernance.js";
import type { SealedBidBackend } from "./sealed-bid/SealedBidBackend.js";
import {
  FheSealedBidBackend,
  type EncryptFn,
} from "./sealed-bid/FheSealedBidBackend.js";
import { CantonSealedBidBackend } from "./sealed-bid/CantonSealedBidBackend.js";
import type {
  BackendName,
  BidRecord,
  CreateRoundRequest,
  PartyView,
  RevealRequest,
  SealedBidRound,
  SubmitBidRequest,
} from "./sealed-bid/types.js";
import { makeCantonLedgerClientFromEnv } from "@backend/canton/CantonLedgerClient.js";
import { CantonPartyRegistry } from "@backend/canton/CantonPartyRegistry.js";

// Re-exports so downstream imports of these types from SealedBidService keep
// working. Consolidation over deprecation: no shim files, no aliases, just a
// single canonical location under sealed-bid/ with a stable path here.
export type {
  BackendName,
  BidRecord,
  BidStatus,
  CreateRoundRequest,
  RevealRequest,
  RoundStatus,
  SealedBidRound,
  SubmitBidRequest,
} from "./sealed-bid/types.js";

// Off-ledger governance metadata for a sealed-bid round.
// Stored separately from the backend round so no Daml model change is needed.
interface RoundGovernance {
  createdByAgent: string;
  governanceRunId: string;
}

// Thin async dispatcher over pluggable sealed-bid backends.
// Round IDs are unique across backends; we remember which backend owns each.
export class SealedBidService {
  private backends = new Map<BackendName, SealedBidBackend>();
  private roundToBackend = new Map<string, BackendName>();
  private governanceByRoundId = new Map<string, RoundGovernance>();

  // Keep the historical constructor signature. Passing an encryptFn wires it
  // to the FHE backend as before; leaving it undefined disables FHE bid
  // submission the same way the old code did.
  constructor(encryptFn?: EncryptFn) {
    this.backends.set("fhe", new FheSealedBidBackend(encryptFn ?? null));
  }

  // Add or replace a backend after construction. Used at bootstrap to plug in
  // the Canton backend once env config is available.
  registerBackend(backend: SealedBidBackend): void {
    this.backends.set(backend.name, backend);
    logger.info(`SealedBid: backend registered — ${backend.name}`);
  }

  hasBackend(name: BackendName): boolean {
    return this.backends.has(name);
  }

  async createRound(
    request: CreateRoundRequest,
    manager: string,
  ): Promise<SealedBidRound> {
    const backendName: BackendName = request.backend ?? "fhe";
    const backend = this.backends.get(backendName);
    if (!backend)
      throw new Error(
        `SealedBid: backend "${backendName}" is not configured on this server`,
      );
    const round = await backend.createRound(request, manager);
    this.roundToBackend.set(round.roundId, backendName);
    return this.withGovernance(round);
  }

  async submitBid(
    roundId: string,
    request: SubmitBidRequest,
  ): Promise<{ bid: BidRecord; governanceRunId?: string }> {
    const backend = await this.resolveBackend(roundId);
    const bid = await backend.submitBid(roundId, request);
    const governance = this.getGovernance(roundId);
    return { bid, governanceRunId: governance?.governanceRunId };
  }

  async closeRound(roundId: string, caller: string): Promise<SealedBidRound> {
    const backend = await this.resolveBackend(roundId);
    const round = await backend.closeRound(roundId, caller);
    return this.withGovernance(round);
  }

  async revealWinner(
    roundId: string,
    request: RevealRequest,
  ): Promise<SealedBidRound> {
    const backend = await this.resolveBackend(roundId);
    const round = await backend.revealWinner(roundId, request);
    return this.withGovernance(round);
  }

  async getRound(roundId: string): Promise<SealedBidRound | null> {
    try {
      const backend = await this.resolveBackend(roundId);
      const round = await backend.getRound(roundId);
      return round ? this.withGovernance(round) : null;
    } catch {
      return null;
    }
  }

  // Real per-party ledger view — returns null for backends without on-ledger
  // per-party disclosure (e.g. the in-memory FHE backend).
  async partyView(roundId: string, party: string): Promise<PartyView | null> {
    const backend = await this.resolveBackend(roundId);
    if (!backend.queryBidsAsParty) return null;
    return backend.queryBidsAsParty(roundId, party);
  }

  async listRounds(): Promise<SealedBidRound[]> {
    const all = await Promise.all(
      Array.from(this.backends.values()).map((b) => b.listRounds()),
    );
    return all.flat().map((r) => this.withGovernance(r));
  }

  /**
   * Attach off-ledger agent governance metadata to a round, if any exists.
   * This keeps the Daml model unchanged while still surfacing agent ownership
   * and the CRE run id in API responses.
   */
  withGovernance(round: SealedBidRound): SealedBidRound {
    const governance = this.governanceByRoundId.get(round.roundId);
    if (!governance) return round;
    return {
      ...round,
      createdByAgent: governance.createdByAgent,
      governanceRunId: governance.governanceRunId,
    };
  }

  /**
   * Register agent governance metadata for a round. Called by the controller
   * after it creates a governance run for an agent-initiated round.
   */
  setGovernance(
    roundId: string,
    governance: RoundGovernance,
  ): void {
    this.governanceByRoundId.set(roundId, governance);
  }

  /**
   * Rebuild the in-memory round→governance mapping from persisted CRE runs.
   * Call this after a process restart so that agent-governed rounds created
   * before the restart can still record bid/reveal events.
   */
  async bootstrapGovernance(): Promise<void> {
    const mapping = await rebuildSealedBidRoundMapping();
    for (const [roundId, governance] of mapping.entries()) {
      this.governanceByRoundId.set(roundId, governance);
    }
  }

  /**
   * Retrieve the governance metadata for a round, if any.
   */
  getGovernance(roundId: string): RoundGovernance | undefined {
    return this.governanceByRoundId.get(roundId);
  }

  // Async resolve — falls back to probing every backend on cache miss so
  // rounds that were seeded on-ledger before this process started (e.g. via
  // the Daml init-script) become addressable without a manual re-index.
  // Once a probe succeeds the mapping is memoized so subsequent calls are
  // O(1) again.
  private async resolveBackend(roundId: string): Promise<SealedBidBackend> {
    const cached = this.roundToBackend.get(roundId);
    if (cached) {
      const backend = this.backends.get(cached);
      if (!backend)
        throw new Error(
          `Round ${roundId} references backend "${cached}" which is no longer configured`,
        );
      return backend;
    }
    for (const backend of this.backends.values()) {
      const found = await backend.getRound(roundId);
      if (found) {
        this.roundToBackend.set(roundId, backend.name);
        return backend;
      }
    }
    throw new Error(`Round ${roundId} not found`);
  }
}

// Shared singleton. FHE backend is always wired; Canton is registered lazily
// on first use if the env is configured — this avoids blocking startup when
// the sandbox / DevNet node isn't up.
export const sharedSealedBidService = new SealedBidService(
  async (value: bigint) => {
    const ct = await sharedFhenixPolicyService.encryptValue(value);
    return { ctHash: ct.ctHash.toString(), utype: ct.utype };
  },
);

const cantonClient = makeCantonLedgerClientFromEnv();
if (cantonClient) {
  const templates = {
    auction: process.env.CANTON_TEMPLATE_AUCTION ?? "",
    bid: process.env.CANTON_TEMPLATE_BID ?? "",
    result: process.env.CANTON_TEMPLATE_RESULT ?? "",
    deposit: process.env.CANTON_TEMPLATE_DEPOSIT ?? "#daml:Main:PaymentDeposit",
  };
  if (!templates.auction || !templates.bid || !templates.result) {
    logger.warn(
      "SealedBid: CANTON_JSON_API_URL is set but CANTON_TEMPLATE_{AUCTION,BID,RESULT} are missing — canton backend disabled",
    );
  } else {
    const staticParties = parseStaticPartyMap(
      process.env.CANTON_DEMO_PARTY_IDS ?? "",
    );
    const parties = new CantonPartyRegistry(cantonClient, staticParties);
    sharedSealedBidService.registerBackend(
      new CantonSealedBidBackend(cantonClient, parties, templates),
    );
  }
}

function parseStaticPartyMap(raw: string): Record<string, string> | undefined {
  if (!raw.trim()) return undefined;
  const map: Record<string, string> = {};
  for (const entry of raw.split(",")) {
    const [name, ...idParts] = entry.trim().split("=");
    const id = idParts.join("=");
    if (name && id) map[name.trim()] = id.trim();
  }
  return Object.keys(map).length > 0 ? map : undefined;
}
