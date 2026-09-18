# GovernanceProof V2 — on-chain proof anchors (0G, X Layer)

> Merged doc: replaces `ZEROG_PROOF_V2.md` and `XLAYER_PROOF_V2.md`.

`GovernanceProofV2` (`contracts/src/GovernanceProofV2.sol`) is Cognivern's
deployed governance anchor: an **append-only commitment stream** — not an
execution contract, custody contract, or policy engine. The same audited
source is deployed on multiple mainnets; each proof ID is domain-separated
by chain ID and contract address, so rails can never collide.

## Deployments

Machine-readable records live in `contracts/deployments/<chainId>.json` (kept
in sync with the tables below; the receipt verifier cross-checks them).

| | 0G Mainnet / Aristotle | X Layer Mainnet |
| --- | --- | --- |
| Chain ID | `16661` | `196` |
| Contract | `0xAAe217e0893934F7434bdDB27ce87C6e3246D960` | `0xCDb7aD5dF5295C35cfd872Ee01eA01D51EC185c1` |
| Deploy tx | `0x93837e5e…f15a4` | `0xd5c452ee…9cfb` |
| Explorer | [ChainScan](https://chainscan.0g.ai/address/0xAAe217e0893934F7434bdDB27ce87C6e3246D960) | [OKLink](https://www.oklink.com/xlayer/address/0xCDb7aD5dF5295C35cfd872Ee01eA01D51EC185c1) |
| Schema | `2` | `2` |
| Admin | `0xEa480C8CD699B84C7775fe1b1878eBc3bCb1cb77` | `0xEa480C8CD699B84C7775fe1b1878eBc3bCb1cb77` |
| Poster | `0xE5D1ef8F7bC8b2B045390406907Afb81dd4b1a43` | `0xd0aeA50F5428b85f60f4F250d0978741af5D1a2a` |

Deployer, admin, and poster are separate addresses. Only the dedicated poster
key is installed in the backend runtime; the admin is an infrequently used
control role for poster rotation and two-step admin transfer. Admin and
poster are rejected if they would become the same address, including through
a pending admin transfer. No private key or seed phrase belongs in this
repository or in public docs.

The original 0G Galileo V1 contract remains separate and unchanged; the
legacy X Layer testnet contracts (chain 1952) remain the testnet demo path
and are intentionally not carried to mainnet.

## Production configuration

Non-secret settings in the live backend's private shared environment (poster
private keys are secret runtime values only):

```env
ZEROG_PROOF_VERSION=v2
ZEROG_MAINNET_RPC_URL=https://evmrpc.0g.ai
ZEROG_MAINNET_CHAIN_ID=16661
ZEROG_MAINNET_PROOF_CONTRACT=0xAAe217e0893934F7434bdDB27ce87C6e3246D960
ZEROG_MAINNET_ADMIN=0xEa480C8CD699B84C7775fe1b1878eBc3bCb1cb77
ZEROG_MAINNET_POSTER=0xE5D1ef8F7bC8b2B045390406907Afb81dd4b1a43

XLAYER_PROOF_VERSION=v2
XLAYER_MAINNET_RPC_URL=https://rpc.xlayer.tech
XLAYER_MAINNET_CHAIN_ID=196
XLAYER_MAINNET_PROOF_CONTRACT=0xCDb7aD5dF5295C35cfd872Ee01eA01D51EC185c1
XLAYER_MAINNET_POSTER=0xd0aeA50F5428b85f60f4F250d0978741af5D1a2a
```

Rails-era `EXECUTION_XLAYER_MAINNET_*` names are accepted aliases for the
X Layer RPC, chain ID, poster key, and contract. Each `*_PROOF_VERSION=v2`
flag opts that rail in independently; V1 remains the default otherwise.

The backend is **fail-open**: audit persistence and policy decisions do not
depend on a successful proof write. Each completed governance audit run
attempts one idempotent commitment transaction per enabled rail, and the
receipt is saved back to run evidence (`evidence.xlayerProofV2`, and the
0G equivalent).

## What the chain proves

A confirmed `GovernanceDecision` event proves the configured Cognivern poster
submitted a commitment for: one run identity, one canonical evidence bundle,
one ordered policy/version set, one typed decision and application timestamp,
and one contract + chain domain.

It provides ordering, duplicate prevention, and receipt-substitution
resistance. It does **not** prove the evidence was truthful, the policy
correct, or the decision economically correct. The poster key is the trust
root for what gets anchored — keep those limits in product and announcement
copy. The event intentionally does not publish amounts, vendors,
descriptions, workspace/agent IDs, FHE values, or the readable audit payload;
those remain in Cognivern's signed/off-chain evidence layer.

## Proof lifecycle

**First write wins per run:** a `runIdHash` anchors once; a retry must reuse
the original decision, timestamp, evidence hash, and policy set hash; a later
decision or re-stamped timestamp is rejected. The first proof ID is available
via `runProofId(runIdHash)`. Corrections must be explicit (e.g. a new version
with a `supersedes` relationship) — V2 never silently revises proofs. The
poster is single-key by design and has no fund or execution permissions.

## Canonicalization V1

Changing any rule below requires a new canonicalization version and a new
contract schema version.

**Canonical JSON rules:** UTF-8 JSON; object keys sorted by Unicode
code-point; array order significant and preserved; no insignificant
whitespace; standard JSON escaping; proof-affecting quantities are decimal
strings (`"1500000"`, `"6"`, `"1734000000"`), never floats; standard
`true`/`false`/`null` literals; `undefined`, `NaN`, `Infinity`, duplicate
keys, and implementation-specific date formats are forbidden. The repo
verification utility implements this with no new runtime dependency.

**Evidence bundle** preimage:

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

`action`, `policyChecks`, and `evidence` carry the canonical Cognivern audit
fields; no new top-level fields without bumping `schemaVersion`.

```text
evidenceHash = keccak256(UTF8(canonicalJson(evidenceBundle)))
runIdHash    = keccak256(UTF8(evidenceBundle.runId))
```

`runId` must be a random UUID or equivalent high-entropy identifier —
sequential IDs (`run-42`) are dictionary-attackable as preimages.

**Policy set** preimage — ordered list in the evaluator's actual application
order (the verifier must not re-sort):

```json
{ "schemaVersion": 1, "policies": [ { "id": "policy-id", "version": "3", "contentHash": "0x..." } ] }
```

Each `contentHash` commits to the canonical policy-version content
`{ id, version, name, description, status, rules, metadata }` (empty metadata
object when absent), including the rules actually evaluated.

```text
policySetHash = keccak256(UTF8(canonicalJson(policySet)))
```

**Domain-separated proof ID** — computed by the contract with ABI
length-delimited encoding:

```text
proofId = keccak256(abi.encode(
  uint8(2), uint256(chainId), address(proofContract),
  bytes32(runIdHash), bytes32(evidenceHash), bytes32(policySetHash),
  uint8(decision),        // 1 approved, 2 held, 3 stopped
  uint64(decisionTimestamp)
))
```

This binds each ID to its chain and deployed contract, preventing reuse
across a testnet mirror or another deployment.

## Verification

Read-only; recomputes hashes and proof ID, checks the receipt's chain and
contract domain, then reads `proofBlock(proofId)` and `runProofId(runIdHash)`:

```bash
pnpm zerog:proof:verify   evidence.json policy-set.json receipt.json   # 0G
pnpm xlayer:proof:verify  evidence.json policy-set.json receipt.json   # X Layer
```

A receipt carries at least `{ chainId, contractAddress, proofId, txHash }`.

Verify the public integration endpoint after rollout:

```bash
curl -sS https://api.cognivern.persidian.com/api/governance/proof-info \
  | jq '.data | {enabled, version, chainId, contractAddress},
                .data.xlayerProofV2 | {enabled, version, chainId, contractAddress}'
```

Then run one controlled, non-custodial governance evaluation in the demo
workspace and verify the receipt on the explorer. Do **not** probe with a
contract deployment or a wallet-spend request (a wallet spend on X Layer
moves real OKB).

## New-rail deployment runbook

1. Create the ignored `.env.<rail>-mainnet` (see `.env.example`) with a
   temporary funded deployer key, an admin address, and a dedicated funded
   poster key/address pair. Inject secrets from a secret manager; do not
   replace existing testnet wallet variables.
2. Preflight (validates chain, key/address matches, role separation, funding,
   redeploy guard — sends no transaction):

   ```bash
   <RAIL>_MAINNET_ENV_FILE=.env.<rail>-mainnet pnpm <rail>:proof:preflight
   ```

3. Deploy via `contracts/scripts/deploy-governance-proof-v2.ts` on the
   rail's Hardhat network (refuses wrong chain and redeploy while
   `*_PROOF_CONTRACT` is set).
4. Record contract/deploy-tx/admin/poster in this doc **and**
   `contracts/deployments/<chainId>.json` (`status: active`) — the registry
   is what the receipt verifier cross-checks.
5. Opt the backend in with the `*_PROOF_VERSION=v2` config block above,
   then run the controlled verification.
