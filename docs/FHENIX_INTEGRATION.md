# Fhenix Integration — Confidential Policy Evaluation

Fhenix (CoFHE) lets Cognivern evaluate policy on **encrypted state** — budgets, spend counters, and vendor allowlists never appear in plaintext. Only the decision (approve/hold/deny) is revealed.

## Layered Architecture

| Layer | Chain | Role |
|-------|-------|------|
| Execution & Public Policy Anchoring | X Layer Testnet (1952) | `GovernanceContract`, `AIGovernanceStorage` |
| Live Audit Anchoring | 0G Newton Testnet | Real-time governance decision anchoring |
| Audit Archive | Filecoin Calibration | Long-term immutable audit storage |
| **Confidential Policy State** | **Fhenix (Arbitrum Sepolia)** | Encrypted budgets, encrypted spend counters, FHE-evaluated policy checks |

**Cross-chain:** Fhenix computes the encrypted decision → Hyperlane Mailbox dispatches to X Layer → `GovernanceContract.handle()` consumes for execution and public anchoring.

## What Gets Encrypted

| Concept | Without Fhenix | With Fhenix |
|---------|---------------|-------------|
| Per-agent daily budget | `uint256` in policy JSON | `euint128` on Fhenix |
| Spend counter | In-memory counter | `euint128` on Fhenix |
| Vendor allowlist | `string[]` | `ebool` via encrypted set |
| Amount in `/api/spend` | Plaintext | Client-side encrypted via `@cofhe/sdk` |

## Configuration

```env
FHENIX_RPC_URL=https://api.testnet.fhenix.zone
FHENIX_POLICY_CONTRACT=0xeA88BD6121d181cFD6F60997B4BDd0297CA432fE
FHENIX_PRIVATE_KEY=             # Falls back to FILECOIN_PRIVATE_KEY
FHENIX_CHAIN_ID=421614          # Arbitrum Sepolia
FHENIX_EVALUATE_TIMEOUT_MS=30000
```

## Key Contracts

| Contract | Address | Network |
|----------|---------|---------|
| `ConfidentialSpendPolicy` | `0x710005F7454B8756F7E1118B26d1361b001fc818` | Arbitrum Sepolia (deployed 2026-06-13) |
| `GovernanceContract` | `0xB5326cEEDBb52C8ec9905929F5f612F7ac9819cE` | Arbitrum Sepolia |
| `GovernedVault` | `0x468F1CfBB5bec9352b279192a952916610f58BB4` | Arbitrum Sepolia |

## Code Layout

- `contracts/fhenix/src/ConfidentialSpendPolicy.sol` — On-chain FHE policy evaluation
- `contracts/fhenix/src/SealedBidVendorSelection.sol` — Sealed-bid vendor selection
- `src/backend/services/FhenixPolicyService.ts` — Backend FHE integration
- `src/backend/cre/workflows/governance.ts` — Async FHE evaluation workflow with SSE progress
- `src/frontend/src/hooks/use-fhe-progress.ts` — React hook for FHE progress UI

## Async FHE Flow

FHE evaluations take 10-30 seconds. The system handles this asynchronously:

1. `POST /api/governance/evaluate` returns `202 Accepted` with `runId` when `policy.metadata.confidential === true`
2. Background workflow runs 4 steps: `load_policy` → `encrypt_params` → `submit_to_fhenix` → `record_audit`
3. Each step streams via SSE at `GET /api/cre/runs/:runId/events/stream`
4. Frontend shows animated 4-step progress panel
5. `GET /api/governance/evaluate/:runId/result` provides a fallback fetch

## Related Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/governance/policies/confidential` | POST | Create encrypted policy on Fhenix |
| `/api/spend/encrypted` | POST | Submit pre-encrypted spend |
| `/api/governance/decisions/:decisionId` | GET | FHE decision + cross-chain anchoring status |
| `/api/audit/permits` | POST | Issue auditor decryption permit |
| `/api/audit/logs/:decisionId/decrypt` | GET | Auditor decrypt with valid permit |
