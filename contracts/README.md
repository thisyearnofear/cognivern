# Smart Contracts

This directory contains Cognivern's Solidity projects and Hardhat configuration. Contract changes can affect deployed behavior, ABI compatibility, cross-chain dispatch, and testnet state; keep them separate from ordinary application changes when possible.

## Projects

| Path           | Purpose                                                                    |
| -------------- | -------------------------------------------------------------------------- |
| `src/`         | Core Solidity contracts compiled by the root Hardhat configuration         |
| `src/GovernanceProofV2.sol` | Commitment-only 0G Mainnet proof anchor for policy/evidence receipts |
| `fhenix/src/`  | Confidential policy and sealed-bid contracts using the CoFHE/Fhenix plugin |
| `fhenix/test/` | Fhenix contract tests                                                      |
| `flare/src/`   | Flare Confidential Compute InstructionSender (CSP-Flare, Coston2)          |
| `flare/test/`  | Flare contract unit tests (mock Tee registries)                            |
| `scripts/`     | Contract-specific deployment helpers                                       |

The root `contracts/`, `contracts/fhenix/`, and `contracts/flare/` Hardhat projects use different compiler/plugin configurations. Use the matching config explicitly.

## Contract test suites — current state (2026-08-24 triage)

The `fhenix/` and `flare/` suites are **dormant**: no CI workflow runs them
(CI covers backend + frontend only), and they have not executed since the
August submissions. Triage found two breakages, both fixed:

1. `chai` was never a root dependency, and with pnpm's isolated linker the
   test files' bare `import { expect } from "chai"` could not resolve it.
   Pinned `chai@^4` + `@types/chai@^4` as root devDependencies (matching
   `hardhat-chai-matchers`' peer range).
2. `@nomicfoundation/hardhat-toolbox@6` dropped the
   `hardhat-toolbox/network-helpers` subpath; tests now import
   `@nomicfoundation/hardhat-network-helpers` directly (added as a root
   devDependency).

**Remaining known gap:** `hardhat-network-helpers` performs a legacy
`hardhat/plugins` directory import that Node rejects because the repo root is
`"type": "module"`. Suites therefore still fail at module load. To revive
them: run the tests in CJS mode (e.g. a contracts-scoped `tsconfig` with
`module: commonjs` and `.cts`/`.cjs` test files, mirroring the flare suite's
`.cjs` shape) or pin the hardhat+toolbox pair to the last-known-good set from
the August submissions. Not prioritized — CI never gated on these suites.

## Validate changes

Core contracts:

```bash
npx hardhat --config contracts/hardhat.config.cjs compile
```

Fhenix contracts:

```bash
npx hardhat --config contracts/fhenix/hardhat.config.cjs compile
npx hardhat --config contracts/fhenix/hardhat.config.cjs test
```

Flare (FCC / Coston2) contracts:

```bash
npx hardhat --config contracts/flare/hardhat.config.cjs compile
npx hardhat --config contracts/flare/hardhat.config.cjs test
```

Deployment commands require the relevant credentials and should not be run casually. Prefer local compilation and contract tests for normal development.

## GovernanceProof V2

`GovernanceProofV2` is the proposed 0G Mainnet proof anchor. It is intentionally
separate from the existing Galileo V1 contract and does not change the live V1
path. V2 records only typed decisions plus `evidenceHash` and `policySetHash`
commitments; audit payloads, amounts, vendors, and stable workspace/agent
identifiers remain off-chain by default.

The contract has no upgrade or execution path. A dedicated poster address writes
proofs, while a separate admin can rotate the poster and uses two-step admin
rotation. Each `runIdHash` is recorded once, making backend retries idempotency-safe.

The poster key is the trust root for what gets anchored: the contract proves
ordering, first-write uniqueness, and commitment integrity, but cannot prove
that the off-chain evidence or policy set was truthful or correctly evaluated.
The canonical preimages and read-only verification workflow are documented in
[`docs/ZEROG_PROOF_V2.md`](../docs/ZEROG_PROOF_V2.md).

Compile and run the focused test suite locally:

```bash
npx hardhat --config contracts/hardhat.config.cjs compile
npx hardhat --config contracts/hardhat.config.cjs test test/GovernanceProofV2.test.ts
```

The mainnet-only deployment helper requires explicit `ZEROG_MAINNET_*` values and
refuses any chain other than 0G Mainnet chain ID `16661`. It verifies the
configured deployer and poster keys against their public addresses, requires
three distinct deployer/admin/poster addresses, refuses a second deployment by
default, and can run in preflight-only mode:

```bash
ZEROG_MAINNET_ENV_FILE=.env.0g-mainnet pnpm zerog:proof:preflight
```

The deployment-only file is gitignored. Prefer injecting it from a secret
manager, and never copy the current testnet wallet values into the V2 variables.
The helper does not update the backend environment or deploy Storage/Compute
integrations. The V2 adapter is not enabled by the existing Galileo V1 service.

## Related code

- Backend adapters: `src/backend/services/blockchain/`
- Fhenix service integration: `src/backend/services/blockchain/FhenixPolicyService.ts` (from the repository root)
- Canton sealed-bid backend: `src/backend/services/blockchain/sealed-bid/`
- Architecture reference: [Developer Guide](../docs/DEV.md)
- Flare Summer Signal: [docs/FLARE_SUMMER_SIGNAL.md](../docs/FLARE_SUMMER_SIGNAL.md)
