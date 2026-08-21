# 0G GovernanceProof V2

`GovernanceProofV2` is Cognivern's deployed 0G Mainnet proof anchor. It is an
append-only commitment stream, not an execution contract, custody contract, or
policy engine.

## Deployment status

Machine-readable record for this deployment: `contracts/deployments/16661.json`
(kept in sync with the table below; the receipt verifier cross-checks it).

The V2 contract is live on **0G Mainnet / Aristotle (chain ID `16661`)**:

| Item | Verified value |
| --- | --- |
| Contract | `0xAAe217e0893934F7434bdDB27ce87C6e3246D960` |
| Deployment transaction | `0x93837e5e7c599093065300b50823d80f95b6522ecbd16f03deeb9da1f74f15a4` |
| Explorer | [ChainScan](https://chainscan.0g.ai/address/0xAAe217e0893934F7434bdDB27ce87C6e3246D960) |
| Schema | `2` |
| Admin | `0xEa480C8CD699B84C7775fe1b1878eBc3bCb1cb77` |
| Dedicated poster | `0xE5D1ef8F7bC8b2B045390406907Afb81dd4b1a43` |

The deployer, admin, and poster are separate addresses. Only the dedicated
poster key is installed in the backend runtime; the admin is an infrequently
used control role for poster rotation and two-step admin transfer. No private
key or seed phrase belongs in this repository or in public documentation.
The backend rollout enables V2 only after the artifact deployment and a
read-only runtime check confirm the configured chain, contract, and poster.

The original Galileo V1 contract remains separate and unchanged.

## Production configuration

The live backend uses the following non-secret V2 settings in its private
shared environment. The poster private key is stored only as a secret runtime
value:

```env
ZEROG_PROOF_VERSION=v2
ZEROG_MAINNET_RPC_URL=https://evmrpc.0g.ai
ZEROG_MAINNET_CHAIN_ID=16661
ZEROG_MAINNET_PROOF_CONTRACT=0xAAe217e0893934F7434bdDB27ce87C6e3246D960
ZEROG_MAINNET_ADMIN=0xEa480C8CD699B84C7775fe1b1878eBc3bCb1cb77
ZEROG_MAINNET_POSTER=0xE5D1ef8F7bC8b2B045390406907Afb81dd4b1a43
```

The backend remains fail-open for governance if 0G is unavailable: audit
persistence and policy decisions do not depend on a successful proof write.
Once enabled, each completed governance audit run attempts one idempotent
commitment transaction, and the receipt is saved back to the run evidence.

### Controlled production verification

After rollout, verify the public integration info endpoint:

```bash
curl -sS https://api.cognivern.persidian.com/api/governance/proof-info \
  | jq '.data | {enabled, version, chainId, network, contractAddress, explorerUrl}'
```

Then run one controlled, non-custodial governance evaluation in the demo
workspace and verify the resulting V2 receipt and transaction on ChainScan.
Do not use a contract deployment or a wallet-spend request as the probe.

A controlled default-policy MCP verification was completed after the production
rollout. The zero-amount request returned `success: true` and `allowed: true`,
and the resulting proof was verified directly against the contract:

- Proof ID: `0x0c4c0cfb4f193e676754c067f029829ca6428c47450e3389b1364b3a552fd4c8`
- Transaction: `0x4e3dd1440b227bef60941995e1ac018c41d490c3f4e28db55201c127bb8431b9`
- Block: `42107566`
- Contract `proofCount`: `2` after verification

## What the chain proves

A confirmed `GovernanceDecision` event proves that the configured Cognivern
poster submitted a commitment for:

- one Cognivern run identity;
- one canonical evidence bundle;
- one ordered policy/version set;
- one typed decision and application timestamp;
- one 0G Mainnet contract and chain domain.

It provides ordering, duplicate prevention, and receipt-substitution resistance.
It does **not** prove that the evidence was truthful, that the policy was
correct, or that the decision was economically or operationally correct. The
poster key is the trust root for what gets anchored. Those limits must remain
clear in product and announcement copy.

The event intentionally does not publish amounts, vendors, descriptions,
workspace IDs, agent IDs, FHE values, or the readable audit payload. Those remain
in Cognivern's signed/off-chain evidence layer.

## Proof lifecycle

V2 enforces **first write wins per run**:

- `runIdHash` can be anchored once;
- a retry must reuse the original decision, timestamp, evidence hash, and policy
  set hash;
- a later decision or re-stamped timestamp for the same run is rejected;
- the first proof ID is available through `runProofId(runIdHash)`;
- a future correction flow must be explicit, for example a new version with a
  `supersedes` relationship. V2 does not silently revise proofs.

The poster is intentionally single-key for the first deployment. It has no fund
or execution permissions. The separate admin can rotate it, and admin rotation
is two-step. Admin and poster are rejected if they would become the same address,
including through a pending admin transfer.

## Canonicalization V1

The backend adapter and verification utility must use the following format.
Changing any rule requires a new canonicalization version and a new contract
schema version.

### Canonical JSON rules

1. Encode as UTF-8 JSON.
2. Object keys are sorted by their Unicode code-point order.
3. Array order is significant and preserved exactly.
4. No insignificant whitespace is emitted.
5. Strings use standard JSON escaping.
6. Quantities that affect a proof are decimal strings, not floating-point JSON
   numbers. Examples: `"1500000"`, `"6"`, and `"1734000000"`.
7. Booleans and `null` use standard JSON literals.
8. `undefined`, `NaN`, `Infinity`, duplicate object keys, and implementation-
   specific date formatting are forbidden.

The repository verification utility implements these rules without introducing
a new runtime dependency.

### Evidence bundle

The evidence preimage is an object with this shape:

```json
{
  "schemaVersion": 1,
  "runId": "random-uuid",
  "decision": "approved",
  "decisionTimestamp": "1734000000",
  "action": {},
  "policyChecks": [],
  "evidence": {}
}
```

The adapter may populate `action`, `policyChecks`, and `evidence` with the
canonical Cognivern fields needed for audit, but must not add top-level fields
without bumping `schemaVersion`.

```text
evidenceHash = keccak256(UTF8(canonicalJson(evidenceBundle)))
runIdHash    = keccak256(UTF8(evidenceBundle.runId))
```

`runId` must be a random UUID or equivalent high-entropy identifier. Sequential
IDs such as `run-42` must not be used as the preimage because their hashes are
easy to dictionary-attack and correlate.

### Policy set

The policy commitment preimage is an ordered list in the evaluator's actual
application order:

```json
{
  "schemaVersion": 1,
  "policies": [
    {
      "id": "policy-id",
      "version": "3",
      "contentHash": "0x..."
    }
  ]
}
```

Each `contentHash` commits to the canonical policy-version content, using the
shared shape `{ id, version, name, description, status, rules, metadata }` (with
an empty metadata object when absent), including the rules that were actually
evaluated. The array order must not be sorted by the verifier; it must match the
evaluator's recorded order.

```text
policySetHash = keccak256(UTF8(canonicalJson(policySet)))
```

### Domain-separated proof ID

The contract computes the proof ID with ABI length-delimited encoding:

```text
proofId = keccak256(abi.encode(
  uint8(2),              // GovernanceProofV2 schema version
  uint256(chainId),
  address(proofContract),
  bytes32(runIdHash),
  bytes32(evidenceHash),
  bytes32(policySetHash),
  uint8(decision),        // 1 approved, 2 held, 3 stopped
  uint64(decisionTimestamp)
))
```

This binds an ID to its specific 0G chain and deployed contract, preventing the
same proof ID from being reused across a testnet mirror or another deployment.

## Verification

Once the backend adapter emits a receipt, verify the three preimages and the
on-chain mapping locally:

```bash
pnpm zerog:proof:verify evidence.json policy-set.json receipt.json
```

The command is read-only. It recomputes the hashes and proof ID, checks the
receipt's chain and contract domain, then reads `proofBlock(proofId)` and
`runProofId(runIdHash)` from the configured contract.

The receipt should contain at least:

```json
{
  "chainId": 16661,
  "contractAddress": "0x...",
  "proofId": "0x...",
  "txHash": "0x..."
}
```

The backend adapter is wired behind the explicit `ZEROG_PROOF_VERSION=v2`
feature flag and uses the separate `ZEROG_MAINNET_*` credentials. V1 remains the
default for environments that do not opt in. Keep deployment secrets in the
ignored `.env.0g-mainnet` file or inject them from a secret manager; do not
replace existing testnet wallet variables.

For a new deployment, run the preflight command before sending a transaction:

```bash
ZEROG_MAINNET_ENV_FILE=.env.0g-mainnet pnpm zerog:proof:preflight
```

The deployed instance above has already passed role and chain preflight. After a
backend rollout, run one controlled proof and verify the resulting receipt with
the utility above.
