# Fhenix Workspace

Confidential policy contracts for Cognivern, deployed on Fhenix-enabled testnets
(Sepolia, Arbitrum Sepolia, Base Sepolia).

See [`docs/FHENIX_INTEGRATION.md`](../../docs/FHENIX_INTEGRATION.md) for the full plan.

## Contracts

- `src/ConfidentialSpendPolicy.sol` — encrypted budgets, encrypted spend counters,
  FHE-evaluated approve/hold/deny decisions. Emits `SpendEvaluated(decisionId, ...)`
  consumed by the X Layer `GovernanceContract`.

## Setup

```bash
pnpm add -D @fhenixprotocol/cofhe-hardhat-plugin
pnpm add @fhenixprotocol/cofhe-contracts
```

Set in `.env`:

```env
FHENIX_PRIVATE_KEY=0x...
FHENIX_SEPOLIA_RPC=https://api.helium.fhenix.zone
ARB_SEPOLIA_RPC=https://sepolia-rollup.arbitrum.io/rpc
BASE_SEPOLIA_RPC=https://sepolia.base.org
```

## Compile / Deploy

```bash
npx hardhat --config contracts/fhenix/hardhat.config.cjs compile
npx hardhat --config contracts/fhenix/hardhat.config.cjs run scripts/deploy.cjs --network fhenixSepolia
```

## Wave Status

| Wave | Status |
|------|--------|
| 1 — scaffold + types + event surface | ✅ this commit |
| 2 — FHE.lte / FHE.gt evaluation + decryption callback | ⏳ |
| 3 — cross-chain attestation to X Layer | ⏳ |
| 4 — Privara payment-rails integration | ⏳ |
| 5 — production demo | ⏳ |
