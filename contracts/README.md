# Smart Contracts

This directory contains Cognivern's Solidity projects and Hardhat configuration. Contract changes can affect deployed behavior, ABI compatibility, cross-chain dispatch, and testnet state; keep them separate from ordinary application changes when possible.

## Projects

| Path           | Purpose                                                                    |
| -------------- | -------------------------------------------------------------------------- |
| `src/`         | Core Solidity contracts compiled by the root Hardhat configuration         |
| `fhenix/src/`  | Confidential policy and sealed-bid contracts using the CoFHE/Fhenix plugin |
| `fhenix/test/` | Fhenix contract tests                                                      |
| `scripts/`     | Contract-specific deployment helpers                                       |

The root `contracts/` Hardhat project and `contracts/fhenix/` use different compiler/plugin configurations. Use the matching config explicitly.

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

Deployment commands require the relevant testnet credentials and should not be run casually. Prefer local compilation and contract tests for normal development.

## Related code

- Backend adapters: `src/backend/services/blockchain/`
- Fhenix service integration: `src/backend/services/blockchain/FhenixPolicyService.ts` (from the repository root)
- Canton sealed-bid backend: `src/backend/services/blockchain/sealed-bid/`
- Architecture reference: [Developer Guide](../docs/DEV.md)
