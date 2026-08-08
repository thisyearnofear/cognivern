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

1. **CVI (A-Pass)** — before policy approval, sender and recipient wallets are screened via `query_apass` (fail-closed on missing / blacklisted / paused / frozen).
2. **CVA (aUSD-D)** — approved spends with `executionProvider: "cleanverse"` call `verify_apass`, then broadcast an ERC-20 aUSD-D transfer on **Monad testnet (chain 10143)**.
3. Evidence — `cleanverse_apass` CRE artifact + transfer receipt / MonadScan link in the run ledger.

### CVI · CVA integration points

| Stage | Primitive | Where |
| --- | --- | --- |
| Pre-policy gate | CVI `POST /query_apass` | `OwsWalletService.executeSpend` → `CleanverseIdentityService.screenAddresses` |
| Settlement eligibility | CVA `POST /verify_apass` | `CleanverseExecutionProvider.executeTransfer` |
| Value movement | aUSD-D ERC-20 `transfer` | Local vault signer → Monad RPC |
| Operator UX | Status + screen API | `GET /api/cleanverse/status`, `POST /api/cleanverse/screen`, `/verified-capital` |
| Wallet opt-in | Metadata | `executionProvider: "cleanverse"`, `chainId: 10143` |

### Deployed chains

- **Monad testnet** — chain ID `10143`, RPC `https://testnet-rpc.monad.xyz`
- Demo A-Token (aUSD-D): `0xbD14cFAf1Fb8b08858E3FfcCeffEfe09cC013892`
- Explorer: https://testnet.monadscan.com

### Live demo URL

- Product: https://cognivern.persidian.com/verified-capital  
- API status: `GET https://api.cognivern.persidian.com/api/cleanverse/status`  
- Spend status (includes `cleanverse.enabled`): `GET …/api/spend/status`

---

## Architecture

```
Agent / operator
    │  POST /api/spend
    ▼
OwsWalletService.executeSpend
    │  source-auth
    │  CVI screen (A-Pass) ── deny if fail
    │  policy evaluation
    ▼
finalizeApprovedSpend
    │  executionProvider === "cleanverse"
    ▼
CleanverseExecutionProvider
    │  verify_apass (sender + recipient)
    │  ERC-20 aUSD-D transfer on Monad
    ▼
CRE artifacts: cleanverse_apass + attestation_result + receipt_verification
```

---

## How to run locally

```bash
# .env
CLEANVERSE_API_ID=…
CLEANVERSE_API_KEY=…
CLEANVERSE_API_URL=https://uatapi.cleanverse.com/api/cooperate
MONAD_RPC_URL=https://testnet-rpc.monad.xyz
MONAD_CHAIN_ID=10143

pnpm install
pnpm dev          # API
pnpm frontend     # UI → /verified-capital

# Smoke (mock Cleanverse HTTP, no credentials required)
pnpm tsx tooling/scripts/demo/test-cleanverse-spend.ts

# Unit tests
pnpm vitest run tests/unit/CleanverseIdentityService.test.ts tests/unit/OwsWalletCleanverse.test.ts
```

Configure a wallet in **Settings → Wallets**: execution provider `Cleanverse (Monad aUSD-D)`, chain `10143`. Fund it with MON (gas) and aUSD-D; both parties need active A-Passes.

---

## Demo video script (outline)

1. Open `/verified-capital` — show rail status (API connected, Monad 10143, aUSD-D).
2. **Screen identities** — fail a wallet without A-Pass; pass a verified pair.
3. Settings → set wallet to Cleanverse rail (chain 10143).
4. Trigger a real governed spend — deny on bad identity, then approve + MonadScan tx.
5. Runs / Observability — `cleanverse_apass` artifact + transfer hash.

*(Record after live credentials + funded Monad wallet are in place.)*

---

## Files added / touched

| Path | Role |
| --- | --- |
| `src/backend/services/blockchain/cleanverse/*` | Client, CVI, CVA, crypto |
| `src/backend/services/blockchain/OwsWalletService.ts` | CVI gate + CVA branch |
| `src/backend/services/blockchain/OwsLocalVaultService.ts` | `sendErc20Transfer` |
| `src/backend/modules/api/controllers/CleanverseController.ts` | Status + screen |
| `src/frontend/.../verified-capital` | Operator UI for the live rail |
| `docs/HACKATHON_SUBMISSION_CLEANVERSE.md` | This document |

---

## Submission checklist

- [ ] Public GitHub commits during Aug 8–9 UTC
- [ ] Demo video recorded
- [ ] This one-pager attached / linked
- [ ] Live demo URL reachable
- [ ] Email to isaac@cleanverse.com by Aug 9 23:59 UTC
