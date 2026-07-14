import { BaseStore } from "@backend/shared/storage/BaseStore.js";

// Maps a SIWE-verified wallet address to one of the pre-allocated Canton
// "institution" pool parties (meridian/sterling/atlas/northwind/clearwater-
// cognivern). This is the custodial bridge for production-mode bidding: the
// institution proves control of its wallet via SIWE at the app layer, and the
// cognivern participant acts as the assigned Canton party on its behalf.
//
// The mapping is persisted (JSONL) so a given wallet keeps the same on-ledger
// party across restarts — its identity is stable. Assignment is first-come:
// each new wallet takes the next pool party; once the pool is exhausted the
// assignment cycles (wallets may then share a party — logged; acceptable at
// demo scale, and the pool is sized to the number of institutions we showcase).

interface WalletPartyRecord {
  walletAddress: string; // lowercased
  party: string; // pool party NAME, e.g. "meridian-cognivern"
  assignedAt: string;
}

export class WalletPartyRegistry extends BaseStore<WalletPartyRecord> {
  constructor(
    private readonly pool: string[],
    filePath?: string,
  ) {
    super({
      filePath,
      envVar: "CANTON_WALLET_PARTY_STORE",
      defaultFilename: "canton-wallet-parties.jsonl",
      maxRecords: 100000,
    });
  }

  protected parseLine(
    line: string,
  ): { key: string; record: WalletPartyRecord } | null {
    try {
      const rec = JSON.parse(line) as WalletPartyRecord;
      if (!rec.walletAddress || !rec.party) return null;
      return { key: rec.walletAddress.toLowerCase(), record: rec };
    } catch {
      return null;
    }
  }

  protected serializeRecord(_key: string, record: WalletPartyRecord): string {
    return JSON.stringify(record);
  }

  hasPool(): boolean {
    return this.pool.length > 0;
  }

  // Return the pool party assigned to this wallet, allocating on first use.
  async assign(walletAddress: string): Promise<string> {
    if (this.pool.length === 0)
      throw new Error(
        "No Canton institution parties are configured — set CANTON_POOL_PARTY_NAMES",
      );
    const key = walletAddress.toLowerCase();
    const existing = await this.get(key);
    if (existing) return existing.party;

    await this.ensureLoaded();
    // Assign in pool order; cycle once exhausted.
    const party = this.pool[this.cache.size % this.pool.length];
    await this.set(key, {
      walletAddress: key,
      party,
      assignedAt: new Date().toISOString(),
    });
    return party;
  }
}

// Shared singleton wired from env. Pool parties are the institution parties the
// Canton team allocated and granted our service user CanActAs on.
export const sharedWalletPartyRegistry = new WalletPartyRegistry(
  (process.env.CANTON_POOL_PARTY_NAMES ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);
