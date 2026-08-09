# Cleanverse Build — Trusted Assets Hackathon — Cognivern Submission

**Hackathon:** Cleanverse Build: Trusted Assets (supported by Monad Foundation)  
**Track:** Track 2 — DeFi (CVI and/or CVA in core flow)  
**Window:** 2026-08-08 00:00 – 2026-08-09 23:59 UTC  
**Team:** thisyearnofear  
**Repository:** [github.com/thisyearnofear/cognivern](https://github.com/thisyearnofear/cognivern)  
**Live product:** [cognivern.persidian.com](https://cognivern.persidian.com) · API `api.cognivern.persidian.com`  
**Product surface:** [/verified-capital](https://cognivern.persidian.com/verified-capital) (Cleanverse CVI/CVA spend rail)

---

## One-page summary

### Problem

Autonomous agents can move on-chain value, but institutional and compliant capital cannot safely fund them without **verified identity** at the decision boundary and **verified assets** at settlement. Static allowlists and after-the-fact monitoring do not interlock identity with money.

### Solution

Cognivern is the economic control plane for agentic work. For this hackathon we make Cleanverse **core** to the governed spend loop:

1. **CVI (A-Pass)** — before policy approval, sender and recipient wallets are screened via `query_apass` (fail-closed on missing / blacklisted / paused / frozen) against the documented v5.x contract (string `"0000"` envelope, payload in `data`, integer status 1/2, numeric tiers).
2. **Country compliance** — an institutional allow/deny rule on A-Pass country tags (v5.5): `CLEANVERSE_ALLOW_COUNTRIES` whitelists both parties (fail-closed when a tag is missing), `CLEANVERSE_BLOCK_COUNTRIES` denies blocked tags. A configured rule is a hard deny gate alongside the tier buckets.
3. **CVA (aUSD-D)** — approved spends with `executionProvider: "cleanverse"` call `verify_apass`, then broadcast an ERC-20 aUSD-D transfer on **Monad testnet (chain 10143)**.
4. Evidence — `cleanverse_apass` CRE artifact + transfer receipt / MonadScan link in the run ledger.

### CVI · CVA integration points

| Stage                  | Primitive                  | Where                                                                            |
| ---------------------- | -------------------------- | -------------------------------------------------------------------------------- |
| Pre-policy gate        | CVI `POST /query_apass`    | `OwsWalletService.executeSpend` → `CleanverseIdentityService.screenAddresses`    |
| Country compliance     | A-Pass country tags (v5.5) | `deriveCleanversePolicySignals` → deny `cleanverse-country-rule`                 |
| Settlement eligibility | CVA `POST /verify_apass`   | `CleanverseExecutionProvider.executeTransfer`                                    |
| Value movement         | aUSD-D ERC-20 `transfer`   | Local vault signer → Monad RPC                                                   |
| Operator UX            | Status + screen API        | `GET /api/cleanverse/status`, `POST /api/cleanverse/screen`, `/verified-capital` |
| Wallet opt-in          | Metadata                   | `executionProvider: "cleanverse"`, `chainId: 10143`                              |

### Deployed chains

- **Monad testnet** — chain ID `10143`, RPC `https://testnet-rpc.monad.xyz`
- Demo A-Token (aUSD-D): `0xbD14cFAf1Fb8b08858E3FfcCeffEfe09cC013892`
- Explorer: https://testnet.monadscan.com

### Live demo URL

- Product: https://cognivern.persidian.com/verified-capital
- API status: `GET https://api.cognivern.persidian.com/api/cleanverse/status`
- Spend status (includes `cleanverse.enabled` + `countryRule`): `GET …/api/spend/status`

**Rail status (Aug 9):** live and armed on Hetzner — `/api/cleanverse/status`
returns `enabled: true`, `apiConfigured: true` (Monad `10143`, aUSD-D
`0xbD14…3892`). The demo A-Pass accounts (cvRecordId 373/374, tier 50, US)
screen as verified against the real UAT API.

---

## Architecture

```
Agent / operator
    │  POST /api/spend  (+ optional mandateId)
    ▼
OwsWalletService.executeSpend
    │  source-auth
    │  mandate settlement (allowedAssets / chain / requireVerifiedSettlement)
    │  CVI screen (A-Pass) ── deny if fail
    │  country allow/deny (A-Pass tags) ── deny if non-compliant
    │  derive tier → amlCapUsd / reviewAboveUsd / travelRule → policy metadata
    │  policy evaluation (Cleanverse AML + tier review rules)
    ▼
finalizeApprovedSpend
    │  executionProvider === "cleanverse"
    ▼
CleanverseExecutionProvider
    │  verify_apass (sender + recipient)
    │  ERC-20 aUSD-D transfer on Monad
    ▼
CRE: cleanverse_apass + capital_attribution.compliance + receipt
Capital statement: cleanverseVerifiedShareOfConsumed → allocation hold if gaps
```

---

## How to run locally

```bash
# .env
CLEANVERSE_API_ID=…
CLEANVERSE_API_KEY=…
CLEANVERSE_API_URL=https://uatapi.cleanverse.com/api/cooperate
# Optional institutional country rule on A-Pass tags (v5.5):
# CLEANVERSE_ALLOW_COUNTRIES=US,SG   # whitelist — both parties must hold a tag
# CLEANVERSE_BLOCK_COUNTRIES=RU,KP   # blacklist — denies blocked tags (wins if both set)
MONAD_RPC_URL=https://testnet-rpc.monad.xyz
MONAD_CHAIN_ID=10143

pnpm install
pnpm dev          # API
pnpm frontend     # UI → /verified-capital

# Smoke (mock Cleanverse HTTP, no credentials required)
pnpm tsx tooling/scripts/demo/test-cleanverse-spend.ts

# Live read-only acceptance smoke subset: status + unregistered denial + demo pass
pnpm tsx tooling/scripts/acceptance/cleanverse-live-negative-paths.ts

# Unit tests
pnpm vitest run tests/unit/CleanverseIdentityService.test.ts tests/unit/CleanversePolicySignals.test.ts tests/unit/OwsWalletCleanverse.test.ts tests/unit/FundedMandateService.test.ts tests/unit/AllocationRecommendationService.test.ts
```

Configure the disposable demo wallet in **Settings → Wallets** with execution provider
`Cleanverse (Monad aUSD-D)` and chain `10143`:

```text
0x2FeE0208c0d1598104f52fb55Dcc2811707c8879
```

This is a public testnet address only; never commit or share its private key.
The shared deployer/treasury address is not the demo funding wallet. The wallet
has been funded with MON for gas; it still requires aUSD-D before a CVA transfer
can run. Both sender and recipient need active A-Passes.

---

## Demo video script (outline)

1. Open `/verified-capital` — show rail status (API connected, Monad 10143, aUSD-D).
2. **Screen identities** — fail a wallet without A-Pass; pass a verified pair (show tier).
3. **Preview policy** — amount in aUSD-D; show approve/hold driven by A-Pass tier caps.
4. **Execute CVA spend** with OWS scoped key — CRE run + MonadScan tx.
5. Capital → statement shows Cleanverse-verified share; allocation holds if settlement gaps.

_(The rail, country rule, and disposable MON-funded demo wallet are configured.
Record the final CVA beat after aUSD-D is supplied; no CVA transaction has been
run yet.)_

---

## Files added / touched

| Path                                                          | Role                          |
| ------------------------------------------------------------- | ----------------------------- |
| `src/backend/services/blockchain/cleanverse/*`                | Client, CVI, CVA, crypto      |
| `src/backend/services/blockchain/OwsWalletService.ts`         | CVI gate + CVA branch         |
| `src/backend/services/blockchain/OwsLocalVaultService.ts`     | `sendErc20Transfer`           |
| `src/backend/modules/api/controllers/CleanverseController.ts` | Status + screen               |
| `src/frontend/.../verified-capital`                           | Operator UI for the live rail |
| `docs/HACKATHON_SUBMISSION_CLEANVERSE.md`                     | This document                 |

---

## Submission checklist

- [x] Public GitHub commits during Aug 8–9 UTC
- [ ] Demo video recorded
- [ ] This one-pager attached / linked
- [x] Live demo URL reachable (rail live + armed; `/api/cleanverse/status` → `enabled: true`)
- [x] Read-only negative-path acceptance smoke run (unregistered denial + US-tagged demo pass; deterministic frozen/expired/country/outage cases remain in unit coverage)
- [x] Disposable Monad demo wallet created and MON-funded
- [ ] aUSD-D supplied and CVA transaction recorded
- [ ] Email to isaac@cleanverse.com by Aug 9 23:59 UTC
