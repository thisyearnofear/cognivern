import logger from "@backend/utils/logger.js";
import { sharedFhenixPolicyService } from "./FhenixPolicyService.js";
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

// Thin async dispatcher over pluggable sealed-bid backends.
// Round IDs are unique across backends; we remember which backend owns each.
export class SealedBidService {
  private backends = new Map<BackendName, SealedBidBackend>();
  private roundToBackend = new Map<string, BackendName>();

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
    return round;
  }

  async submitBid(
    roundId: string,
    request: SubmitBidRequest,
  ): Promise<BidRecord> {
    return (await this.resolveBackend(roundId)).submitBid(roundId, request);
  }

  async closeRound(roundId: string, caller: string): Promise<SealedBidRound> {
    return (await this.resolveBackend(roundId)).closeRound(roundId, caller);
  }

  async revealWinner(
    roundId: string,
    request: RevealRequest,
  ): Promise<SealedBidRound> {
    return (await this.resolveBackend(roundId)).revealWinner(roundId, request);
  }

  async getRound(roundId: string): Promise<SealedBidRound | null> {
    try {
      return (await this.resolveBackend(roundId)).getRound(roundId);
    } catch {
      return null;
    }
  }

  async listRounds(): Promise<SealedBidRound[]> {
    const all = await Promise.all(
      Array.from(this.backends.values()).map((b) => b.listRounds()),
    );
    return all.flat();
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
