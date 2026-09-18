# Cleanverse — verified agent capital rail (CVI / CVA)

Optional rail that interlocks **verified identity** (CVI, A-Pass) with
**verified settlement** (CVA, Access USDC on Monad). Built for the Cleanverse
Build: Trusted Assets hackathon (Aug 2026) — submission record:
[`history/HACKATHON_SUBMISSION_CLEANVERSE.md`](./history/HACKATHON_SUBMISSION_CLEANVERSE.md).
The rail is **live and armed in production** — do not regress it.

## How it fits the spend path

```text
POST /api/spend
  → OwsWalletService.executeSpend
    → CVI screen (A-Pass, fail-closed on missing/blacklisted/paused/frozen)
    → country allow/deny rule on A-Pass tags (hard deny: cleanverse-country-rule)
    → tier → amlCapUsd / reviewAboveUsd → policy evaluation
  → finalizeApprovedSpend (executionProvider === "cleanverse")
    → CleanverseExecutionProvider: verify_apass → ERC-20 Access USDC transfer
  → CRE: cleanverse_apass artifact + tx receipt (MonadScan link)
```

## Chains & contracts

- **Monad testnet** — chain ID `10143`, RPC `https://testnet-rpc.monad.xyz`,
  explorer `testnet.monadscan.com`
- Access USDC/aUSDC: `0xaC0893567D43C3E7e6e35a72803df05416C1f20D` (6 decimals;
  minimal-proxy `transfer` needs ~300k gas — providers use `gasLimit: 400_000`)
- Cleanverse API (UAT): `https://uatapi.cleanverse.com/api/cooperate` —
  `query_apass` (pre-policy) and `verify_apass` (pre-settlement), v5.x envelope:
  string `"0000"` code, payload in `data`, integer status, numeric tiers

## Environment

```env
CLEANVERSE_API_ID=…
CLEANVERSE_API_KEY=…
CLEANVERSE_API_URL=https://uatapi.cleanverse.com/api/cooperate
MONAD_RPC_URL=https://testnet-rpc.monad.xyz
MONAD_CHAIN_ID=10143
# Optional institutional country rule on A-Pass country tags (v5.5):
# CLEANVERSE_ALLOW_COUNTRIES=US,SG   # whitelist, fail-closed on missing tag
# CLEANVERSE_BLOCK_COUNTRIES=RU,KP   # blacklist; wins if both set
```

## API & UI

- `GET /api/cleanverse/status` — config + Monad / Access USDC status
- `POST /api/cleanverse/screen` — screen sender + recipient A-Pass
- `GET /api/cleanverse/deposit-address?address=0x…&chain=monad` — where to fund
  Access USDC (fund the deposit address, **not** the A-Pass wallet)
- `GET /api/spend/status` — includes `cleanverse.enabled` + `countryRule`
- UI: `/verified-capital`

## Wallet opt-in

Set wallet metadata `executionProvider: "cleanverse"`, `chainId: 10143`
(Settings → Wallets). Demo wallet `0x2FeE0208c0d1598104f52fb55Dcc2811707c8879`
is a disposable public testnet address — never commit its key. Both sender and
recipient need active A-Passes; the wallet needs MON for gas and Access USDC
for the transfer.

## Tests & acceptance

- Hermetic smoke: `pnpm tsx tooling/scripts/demo/test-cleanverse-spend.ts`
- Live read-only negative-paths subset:
  `pnpm tsx tooling/scripts/acceptance/cleanverse-live-negative-paths.ts`
- Unit: `CleanverseIdentityService`, `CleanversePolicySignals`,
  `OwsWalletCleanverse` vitest files

## Files

`src/backend/services/blockchain/cleanverse/*` (client, CVI, CVA, crypto) ·
`OwsWalletService.ts` (CVI gate + CVA branch) · `OwsLocalVaultService.ts`
(`sendErc20Transfer`) · `CleanverseController.ts` · frontend `/verified-capital`.
