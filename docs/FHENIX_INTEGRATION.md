# Fhenix Integration — Privacy-by-Design SpendOS

> **Thesis:** Institutions can't deploy autonomous agents on transparent rails. Budgets, counterparties, vendor allowlists, and remaining spend headroom are competitive intelligence. Cognivern's spend control plane should evaluate policy on **encrypted state** so agents can prove compliance without leaking strategy.

This document describes how Cognivern adds **Fhenix (CoFHE)** as a third deployment layer alongside the existing X Layer (execution) and Filecoin (audit) layers — without removing or replacing either.

In product terms, this supports Cognivern's unified operating model:

- **Policy:** every spend/decision route stays governed.
- **Privacy:** sensitive thresholds and inputs remain encrypted.
- **Efficiency:** teams can add model/runtime spend optimization signals without leaking operational strategy.
- **Auditability:** decisions remain provable (`decisionId`, attestation) even when inputs are confidential.

---

## 1. Layered Architecture (Updated)

| Layer                               | Chain                                                  | Role                                                                                                             | Status                    |
| ----------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Execution & Public Policy Anchoring | X Layer Testnet (1952)                                 | `GovernanceContract`, `AIGovernanceStorage` — public agent registry, policy hash anchoring, spend execution logs | **Existing — kept as-is** |
| Live Audit Anchoring                | 0G Newton Testnet                                      | Real-time governance decision anchoring                                                                          | **Existing — kept as-is** |
| Audit Archive                       | Filecoin Calibration                                   | Long-term immutable audit storage                                                                                | **Existing — kept as-is** |
| **Confidential Policy State**       | **Fhenix (Sepolia / Arbitrum Sepolia / Base Sepolia)** | **Encrypted budgets, encrypted spend counters, sealed approval ciphertexts, FHE-evaluated policy checks**        | **LIVE**                  |

**Bridge pattern:** Fhenix computes the encrypted policy decision → **Hyperlane Mailbox** dispatches it to X Layer → X Layer **`GovernanceContract.handle()`** consumes it for execution and public anchoring.

This bridge is powered by the **Hyperlane Messaging Protocol**, selected for its permissionless interoperability which allows us to connect Fhenix (Confidential Layer) to X Layer (Execution Layer) with strict sender/origin verification.

---

## 2. What Becomes Encrypted

| Cognivern Concept            | Today (plaintext)                      | With Fhenix (encrypted)                                     |
| ---------------------------- | -------------------------------------- | ----------------------------------------------------------- |
| Per-agent daily budget       | `uint256 dailyLimit` in policy JSON    | `euint128 dailyLimit` on Fhenix                             |
| Spend counter                | `uint256 spentToday` in service memory | `euint128 spentToday` on Fhenix                             |
| Vendor allowlist             | `string[] allowedVendors`              | `ebool isAllowed = vendorHash ∈ encryptedSet`               |
| Approval threshold           | `uint256 approvalThreshold`            | `euint128 approvalThreshold`                                |
| Spend amount in `/api/spend` | Plaintext in request body              | Client-side encrypted via `@cofhe/sdk` before submission    |
| Approval ciphertext          | N/A                                    | Sealed approval — only signer + auditor permits can decrypt |

The **decision** (approve / hold / deny) is revealed publicly. The **inputs and thresholds** stay encrypted.

---

## 3. New Smart Contract — `ConfidentialSpendPolicy.sol`

Deployed on Fhenix (Arbitrum Sepolia, chain 421614) at **`0xeA88BD6121d181cFD6F60997B4BDd0297CA432fE`**.

Mirrors the rule semantics of `PolicyEnforcementService` but operates on `euint128` / `ebool`.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint128, ebool, InEuint128} from "@fhenixprotocol/cofhe-contracts/FHE.sol";

interface IMailbox {
    function dispatch(uint32 _destinationDomain, bytes32 _recipientAddress, bytes calldata _messageBody) external returns (bytes32);
}

contract ConfidentialSpendPolicy {
    struct EncryptedPolicy {
        euint128 dailyLimit;
        euint128 perTxLimit;
        euint128 approvalThreshold;
        bytes32 vendorSetRoot;
        address operator;
        bool initialized;
    }

    struct EncryptedCounter {
        euint128 spentToday;
        uint256 windowStart;
        bool initialized;
    }

    struct PendingDecision {
        bytes32 agentId;
        bytes32 policyId;
        bytes32 vendorHash;
    }

    enum Outcome { Deny, Hold, Approve, Pending }

    mapping(bytes32 => EncryptedPolicy)  public policies;
    mapping(bytes32 => EncryptedCounter) public counters;
    mapping(bytes32 => Outcome)          public resolvedOutcomes;
    mapping(bytes32 => PendingDecision)  public pendingDecisions;
    mapping(address => bool)             public authorizedEvaluators;

    address public owner;
    address public pendingOwner;
    IMailbox public mailbox;
    uint32  public xLayerDestinationDomain;
    bytes32 public xLayerRecipient;

    modifier onlyAuthorized() {
        require(msg.sender == owner || authorizedEvaluators[msg.sender], "not authorized");
        _;
    }

    constructor() { owner = msg.sender; authorizedEvaluators[msg.sender] = true; }

    // Two-step ownership transfer
    function transferOwnership(address newOwner) external { /* owner only */ }
    function acceptOwnership() external { /* pending owner only */ }

    // Evaluator whitelist
    function authorizeEvaluator(address e) external { /* owner only */ }
    function revokeEvaluator(address e)  external { /* owner only */ }

    // Policy registration (permissionless)
    function registerPolicy(bytes32 policyId, InEuint128 calldata dailyLimitCt,
        InEuint128 calldata perTxLimitCt, InEuint128 calldata approvalThresholdCt,
        bytes32 vendorSetRoot) external { /* ... */ }

    // Encrypted spend evaluation — only authorized callers
    function evaluateSpend(bytes32 agentId, bytes32 policyId,
        InEuint128 calldata amountCt, bytes32 vendorHash)
        external onlyAuthorized returns (bytes32 decisionId)
    {
        euint128 amount = FHE.asEuint128(amountCt);
        euint128 newSpent = FHE.add(c.spentToday, amount);

        ebool underDaily    = FHE.lte(newSpent, p.dailyLimit);
        ebool underPerTx    = FHE.lte(amount, p.perTxLimit);
        ebool needsApproval = FHE.gt(amount, p.approvalThreshold);

        ebool approved = FHE.and(underDaily, FHE.and(underPerTx, FHE.not(needsApproval)));
        ebool held     = FHE.and(underDaily, FHE.and(underPerTx, needsApproval));

        ebool notDenied = FHE.or(approved, held);
        c.spentToday = FHE.select(notDenied, newSpent, c.spentToday);

        decisionId = keccak256(abi.encode(agentId, policyId, vendorHash, block.number, msg.sender));
        pendingDecisions[decisionId] = PendingDecision(agentId, policyId, vendorHash);
        emit SpendEvaluated(decisionId, agentId, policyId, Outcome.Pending, "");
    }

    // Two-phase resolution: owner decrypts off-chain, then commits outcome + dispatches via Hyperlane
    function resolveDecision(bytes32 decisionId, Outcome outcome) external {
        require(msg.sender == owner, "not owner");
        require(outcome != Outcome.Pending, "outcome must be resolved");

        PendingDecision memory pending = pendingDecisions[decisionId];
        resolvedOutcomes[decisionId] = outcome;
        emit DecisionResolved(decisionId, outcome);

        // Cross-chain dispatch: send real outcome to GovernanceContract on X Layer
        if (address(mailbox) != address(0) && xLayerRecipient != bytes32(0)) {
            bytes memory payload = abi.encode(decisionId, pending.agentId, pending.policyId, uint8(outcome));
            mailbox.dispatch(xLayerDestinationDomain, xLayerRecipient, payload);
        }
    }
}
```

Key properties:

- Budgets and amounts never appear in plaintext on-chain.
- **Access control:** Only the contract owner or whitelisted evaluators can submit spend evaluations — prevents unauthorized actors from inflating encrypted counters.
- **Two-step ownership transfer:** `transferOwnership` + `acceptOwnership` protects against accidental transfers and key loss.
- **Two-phase FHE resolution:** `evaluateSpend` emits `Pending` → off-chain threshold decryption → `resolveDecision` commits the real outcome and dispatches it to X Layer via Hyperlane. The GovernanceContract receives the actual FHE-evaluated outcome (Deny/Hold/Approve), not a placeholder.
- Operators decrypt their own policies via CoFHE permits.
- Auditors receive scoped permits — selective disclosure for compliance.

---

## 4. Backend Changes (`src/`)

### 4.1 New service: `FhenixPolicyService.ts`

```ts
// src/services/FhenixPolicyService.ts
import { CofheClient } from "@cofhe/sdk";

export class FhenixPolicyService {
  constructor(
    private cofhe: CofheClient,
    private contractAddr: string,
  ) {}

  /** Encrypts amount client-side, submits to Fhenix, returns decisionId. */
  async evaluateEncrypted(input: {
    agentId: string;
    policyId: string;
    amountWei: bigint;
    vendorHash: string;
  }): Promise<{ decisionId: string; outcome: "approve" | "hold" | "deny" }> {
    const amountCt = await this.cofhe.encrypt_uint128(input.amountWei);
    // call ConfidentialSpendPolicy.evaluateSpend(...)
    // wait for SpendEvaluated event, return decisionId + outcome
  }

  /** Issue an auditor permit for selective disclosure. */
  async issueAuditPermit(auditor: string, policyId: string): Promise<string> {
    /* ... */
  }
}
```

### 4.2 Modified: `PolicyEnforcementService.ts`

Add a `confidential: true` flag on policy definitions. When set, evaluation is delegated to `FhenixPolicyService` instead of the plaintext rule engine. The returned decision is normalized into the existing `SpendDecision` shape so the rest of the system (audit, run ledger, frontend) is unchanged.

### 4.3 Modified: `OwsWalletService.ts` (`/api/spend`)

```
1. Receive spend request (amount may already be ciphertext from frontend useEncrypt)
2. If policy.confidential → FhenixPolicyService.evaluateEncrypted(...)
3. Receive { decisionId, outcome, attestation }
4. If approve: sign + submit on X Layer, include decisionId in calldata
5. Audit log records decisionId + ciphertext handle (not plaintext amount)
```

### 4.4 New endpoints

| Endpoint                                | Method | Description                                           |
| --------------------------------------- | ------ | ----------------------------------------------------- |
| `/api/governance/policies/confidential` | POST   | Create encrypted policy on Fhenix                     |
| `/api/governance/evaluate`              | POST   | Returns **202 Accepted** with `runId` for confidential policies (async FHE eval with SSE progress) |
| `/api/governance/evaluate/:runId/result` | GET   | Retrieve completed FHE evaluation result              |
| `/api/governance/decisions/:decisionId` | GET    | Retrieve FHE decision + cross-chain anchoring status  |
| `/api/spend/encrypted`                  | POST   | Submit pre-encrypted spend (client used `useEncrypt`) |
| `/api/audit/permits`                    | POST   | Issue auditor decryption permit                       |
| `/api/audit/logs/:decisionId/decrypt`   | GET    | Auditor-side decrypt with valid permit                |

### 4.5 Async FHE Evaluation UX

FHE evaluations can take 10-30 seconds (encryption + on-chain confirmation). Rather than making the user stare at a loading spinner, the system now uses an async pattern:

1. **Backend** detects `policy.metadata.confidential === true` in `GovernanceController.evaluateAction()`
2. Returns **202 Accepted** with `{ runId, status: "running", type: "fhe_evaluation" }`
3. A background **governance workflow** (`src/backend/cre/workflows/governance.ts`) runs the evaluation using `CreRunRecorder`, tracking 4 steps:
   - `load_policy` → `encrypt_params` → `submit_to_fhenix` → `record_audit`
4. Each step is persisted to `CreRunStore` as it completes
5. **Frontend** connects to the existing SSE endpoint `GET /api/cre/runs/:runId/events/stream`
6. An animated **4-step progress panel** shows which phase is active with live status icons (pending → spinner → checkmark/error)
7. On `run_finished`, the evaluation result transitions into the decision panel
8. The shared `useFheProgress` React hook (`src/frontend/src/hooks/use-fhe-progress.ts`) encapsulates the SSE connection and step transitions for reuse across components

**Files:** `src/backend/cre/workflows/governance.ts`, `src/frontend/src/hooks/use-fhe-progress.ts`

---

## 5. Frontend Changes (`src/frontend/`)

Adopt the CoFHE React hooks (same patterns as `wagmi`):

```tsx
import { useEncrypt, useWrite, useDecrypt } from "@cofhe/react";

function SpendForm() {
  const { encrypt } = useEncrypt();
  const { write } = useWrite({ address: SPEND_POLICY_ADDR, abi });

  async function submit(amount: bigint) {
    const ct = await encrypt.uint256(amount);
    await write({
      functionName: "evaluateSpend",
      args: [agentId, policyId, ct, vendorHash],
    });
  }
}
```

New surfaces:

- **Confidential Policy editor** — operator sets encrypted budgets via `useEncrypt`.
- **Auditor view** — paste permit → `useDecrypt` reveals scoped fields.
- **Decision badge** — shows `confidential: true` on audit rows; amount displayed only with permit.

---

## 6. Efficiency Governance Alignment

Confidential policy infrastructure is not only for hiding wallet budgets — it is also a foundation for AI spend efficiency governance.

As Cognivern expands usage ingestion across IDE/CLI/agent workflows, efficiency signals (for example model choice, token/cost envelopes, and task class metadata) can be attached to policy evaluation and audit evidence while sensitive operating details remain protected.

Design constraint: keep a **single enforcement plane** (no parallel decision stack). Efficiency policies should compose with existing policy checks, confidential evaluation, and audit artifacts.

---

## 7. Privara Layer (Application Tooling)

Use `@reineira-os/sdk` for the **payment-rails** half of `/api/spend`:

- Confidential payroll to contractor wallets — agent-initiated, policy-gated, amount-encrypted.
- Programmable transfer envelopes that carry the Fhenix `decisionId` as compliance proof.

This composes cleanly: Cognivern decides → Privara executes the confidential transfer.

---

## 8. Hardhat Setup

````js
// contracts/fhenix/hardhat.config.cjs
require("@fhenixprotocol/cofhe-hardhat-plugin");
require("@fhenixprotocol/hardhat-fhenix");
module.exports = {
  solidity: { version: "0.8.25", settings: { evmVersion: "cancun", viaIR: true } },
  networks: {
    arbitrumSepolia:  {
      url: process.env.ARB_SEPOLIA_RPC || "https://sepolia-rollup.arbitrum.io/rpc",
      accounts: process.env.FHENIX_PRIVATE_KEY ? [process.env.FHENIX_PRIVATE_KEY] : [],
      chainId: 421614,
    },
    baseSepolia:      {
      url: process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org",
      accounts: process.env.FHENIX_PRIVATE_KEY ? [process.env.FHENIX_PRIVATE_KEY] : [],
      chainId: 84532,
    },
  },
};

Deploy:
```bash
pnpm deploy:fhenix
# or directly:
npx hardhat run scripts/deploy-fhenix.ts --config contracts/fhenix/hardhat.config.cjs --network fhenixSepolia
````

```

---

## 9. Cross-Chain Flow

```

Frontend (useEncrypt amount)
│
▼
POST /api/spend/encrypted ───────────────┐
│ │
▼ │
FhenixPolicyService.evaluateEncrypted │
│ │
▼ │
[Fhenix] ConfidentialSpendPolicy │
• FHE.lte / FHE.gt over euint128 │
• emits SpendEvaluated(decisionId,…) │
│ │
▼ │
attestation + decisionId │
│ │
▼ │
[X Layer] GovernanceContract.handle(origin, sender, payload)
│
▼
[0G] live anchoring ──► [Filecoin] long-term archive
│
▼
Audit UI (operator sees outcome; auditor with permit sees amounts)

```

---

## 10. Production Readiness & Scalability

### Cross-Chain Security
In production, the bridge between Fhenix and X Layer is secured by Hyperlane's **Interchain Security Modules (ISMs)**.
- **Origin Verification:** The X Layer contract only accepts messages from the specific Fhenix chain domain.
- **Sender Verification:** The `GovernanceContract` explicitly validates that the sender of the message is the authorized `ConfidentialSpendPolicy` contract.
- **Relayer Flexibility:** Cross-chain dispatch is handled entirely inside the Solidity contracts via `mailbox.dispatch()` in `ConfidentialSpendPolicy.resolveDecision()`. The smart contracts are 100% compliant with the official Hyperlane Rust Relayer. In a production environment, you simply point to the official Hyperlane Mailbox addresses and run a standard Hyperlane validator set.

### Agent UX (Developer Experience)
To support non-TypeScript agents (Python/Go), Cognivern provides a **Trusted Encryption Sidecar** API (`/api/fhenix/encrypt`). This allows agents to benefit from FHE-based policy evaluation without needing to implement the `@cofhe/sdk` primitives locally, which is critical for rapid cross-language adoption.

---

## 11. Buildathon Wave Plan

| Wave | Deliverable |
|------|-------------|
| **Wave 1 (Ideation)** | [x] This integration doc + `ConfidentialSpendPolicy.sol` skeleton + Hardhat scaffold |
| **Wave 2** | [x] `/api/spend/encrypted` live, `FhenixPolicyService` adapter path wired (client-injected, timeout + outcome normalization), policy metadata gate (`policy.metadata.confidential`) enforced in spend path |
| **Wave 3 (Marathon)** | [x] Frontend `useEncrypt` flow; production CoFHE client + contract adapter; auditor permit consumption/decrypt UX; X Layer cross-chain decision anchoring; demo script |
| **Wave 4** | [x] Privara SDK integration for confidential payroll; sealed-bid vendor selection example |
| **Wave 5 (Final)** | [x] Production-grade demo: institutional treasury agent operating with fully encrypted budgets, MEV-protected execution, selective auditor disclosure |
| **Wave 6 (Hardening)** | [x] Shared `FhenixPolicyService` singleton eliminates redundant CoFHE clients; `resolveDecision()` enables proper two-phase FHE outcome resolution; `requestDeFiAction` guarded by resolved outcome; contract tests; centralized config; rate-limited decrypt; typed interfaces; docs updated; access control (`onlyAuthorized`) on evaluateSpend + requestDeFiAction; evaluator whitelist; two-step ownership transfer; Hyperlane dispatch moved from evaluateSpend (dead) to resolveDecision (real outcome) |
| **Wave 7 (Migration)** | [x] Migrated from deprecated Helium testnet to **Arbitrum Sepolia** (chainId 421614); updated all RPC endpoints, chain configs, and hardcoded chain references; `FhenixPolicyService` properly initializes and connects CoFHE client with `ensureConnected`; `evaluateEncrypted` propagates errors for honest fallback messages; `demo:fhenix` script completes all 9 steps end-to-end; added `/governance/decisions/:decisionId` and `/audit/logs/:decisionId/decrypt` routes for demo compatibility |

---

## 12. Why Cognivern Wins This Buildathon

- **Real protocol, not a demo.** Existing OWS wallet layer, policy engine, audit ledger, multi-chain deployment — Fhenix slots into a working system.
- **Direct hit on the institutional gap.** Compliance teams reject autonomous agents because budgets and counterparties are visible. Encrypted policy state removes the blocker.
- **MEV protection by construction.** Sealed approval ciphertexts mean front-runners can't see agent intent until execution.
- **Selective disclosure for audits.** Permits give auditors exactly what they need — nothing more — solving the RWA/compliance pillar.
- **Composable with Privara.** Policy decision (Cognivern) → confidential transfer (Privara) is a clean two-layer story.

## Resources

- Fhenix docs — https://docs.fhenix.io
- CoFHE SDK — `@cofhe/sdk`, `@cofhe/react`
- Privara docs — https://reineira.xyz/docs
- Privara SDK — `@reineira-os/sdk`
- Examples — https://github.com/FhenixProtocol/awesome-fhenix
```
