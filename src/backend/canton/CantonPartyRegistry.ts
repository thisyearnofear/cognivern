import type { CantonLedgerClient } from "./CantonLedgerClient.js";

// Maps cognivern-side identifiers (API keys, wallet addresses, agent IDs)
// onto Daml party identifiers. The mapping is populated lazily — the first
// request for a given cognivern name allocates a party on the ledger.
// Existing parties (from `daml start` init-script — Auctioneer, Alice, Bob,
// Charlie) are picked up at startup so demo/test flows can address them by
// name without re-allocating.
export class CantonPartyRegistry {
  private cache = new Map<string, string>();
  private ready: Promise<void>;

  constructor(
    private readonly client: CantonLedgerClient,
    private readonly staticParties?: Record<string, string>,
  ) {
    this.ready = this.hydrate();
  }

  private async hydrate() {
    // DevNet/shared nodes often pre-allocate parties via an admin and the
    // authenticated user lacks rights to list or allocate. A static map takes
    // precedence and skips network calls entirely.
    if (this.staticParties) {
      for (const [name, id] of Object.entries(this.staticParties)) {
        this.cache.set(name, id);
        const hint = id.split("::")[0];
        if (hint && hint !== name) this.cache.set(hint, id);
      }
      return;
    }

    try {
      const parties = await this.client.listParties();
      for (const p of parties) {
        const hint = p.identifier.split("::")[0];
        this.cache.set(hint, p.identifier);
        if (p.displayName && p.displayName !== hint) {
          this.cache.set(p.displayName, p.identifier);
        }
      }
    } catch {
      // Non-fatal: listing may fail if sandbox isn't up yet. resolve() will
      // trigger allocation on the next request.
    }
  }

  // Return the Daml party identifier for the cognivern-side name, allocating
  // on the ledger if we've never seen this name before. When a static party
  // map is configured, allocation is skipped and unknown names throw.
  async resolve(name: string): Promise<string> {
    await this.ready;
    const cached = this.cache.get(name);
    if (cached) return cached;
    if (this.staticParties) {
      throw new Error(
        `Canton party "${name}" is not in CANTON_DEMO_PARTY_IDS static mapping`,
      );
    }
    // Daml party identifier hints must be [A-Za-z0-9_-] up to a limit.
    const hint = name.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 63) || "party";
    const allocated = await this.client.allocateParty(hint, name);
    this.cache.set(name, allocated.identifier);
    this.cache.set(hint, allocated.identifier);
    return allocated.identifier;
  }
}
