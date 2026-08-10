# Flare Workspace — Confidential Spend Policy (FCC)

Flare Confidential Compute (FCC) port of Cognivern's confidential spend-policy
paradigm. Target network: **Coston2** (chain id `114`).

See [docs/FLARE_SUMMER_SIGNAL.md](../../docs/FLARE_SUMMER_SIGNAL.md) for the
hackathon plan and [FCC overview](https://dev.flare.network/fcc/overview).

## Architecture (important)

Flare Confidential Compute is **not** FHE and **not** an "Opaque Gateway"
confidential ERC-20. Applications are **Flare Compute Extensions (FCE)**:

1. This Solidity `ConfidentialSpendPolicy` is an **InstructionSender**.
2. It calls `TeeExtensionRegistry.sendInstructions` on the **FlareTeeManager**
   diamond (`0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE` on Coston2).
3. Data providers relay the instruction to your TEE node (via `ext-proxy`).
4. The Go extension evaluates privately and returns a result; Cognivern
   publishes `approve` / `hold` / `deny` on-chain via `publishDecision`.

Budget limits and spend counters live as **TEE-private state**. Only the
decision is public — same product guarantee as Fhenix, different mechanism.

## Contracts

| Path | Role |
| --- | --- |
| `src/ConfidentialSpendPolicy.sol` | InstructionSender + SpendEvaluated surface |
| `src/interfaces/ITee*.sol` | Minimal FCC registry interfaces (from Flare scaffold) |
| `src/mocks/MockTeeRegistries.sol` | Unit-test double for the diamond |
| `config/coston2/deployed-addresses.json` | Coston2 FlareTeeManager + related addresses |

## Commands

```bash
# Compile
npx hardhat --config contracts/flare/hardhat.config.cjs compile

# Unit tests (mock registries — no Docker / Coston2 required)
npx hardhat --config contracts/flare/hardhat.config.cjs test
```

## Env (see root `.env.example`)

```env
FLARE_RPC_URL=https://coston2-api.flare.network/ext/C/rpc
FLARE_CHAIN_ID=114
FLARE_PRIVATE_KEY=          # funded Coston2 key (C2FLR from faucet)
FLARE_POLICY_CONTRACT=      # set after deploy
FLARE_TEE_MANAGER=0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE
FLARE_EXT_PROXY_URL=        # public HTTPS URL of your ext-proxy tunnel
FLARE_EVALUATOR=flare       # feature flag value for backend dispatch
```

Faucet: https://faucet.flare.network/coston2

## TEE extension (Day 1+)

Full Coston2 FCC flow needs the Flare scaffold + Docker:

```bash
git clone https://github.com/flare-foundation/fce-extension-scaffold.git
# Customize OPType/OPCommand to SPEND_POLICY / REGISTER_POLICY / EVALUATE_SPEND
# matching this contract. Guide:
# https://dev.flare.network/fcc/guides/getting-started
```

Requires: Docker Desktop, Go, ngrok/cloudflared, funded Coston2 key.
This machine currently has Go + ngrok; Docker must be available before the
live TEE path can run.

## Relation to Fhenix

| | Fhenix | Flare (this) |
| --- | --- | --- |
| Confidentiality | FHE `euint*` on-chain | TEE-private state via FCE |
| Entry point | `evaluateSpend(InEuint128…)` | `evaluateSpend(…, message)` → `sendInstructions` |
| Decision | CoFHE decrypt + publish | Proxy result + `publishDecision` |
| Event | `SpendEvaluated` | `SpendEvaluated` (same shape) |
