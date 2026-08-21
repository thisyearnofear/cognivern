# X Layer GovernanceProof V2

`GovernanceProofV2` on X Layer Mainnet is Cognivern's public governance-anchor
rail for X Layer: an append-only commitment stream, not an execution contract,
custody contract, or policy engine. It deploys the **same audited contract
source** as the 0G Mainnet anchor (`contracts/src/GovernanceProofV2.sol`) — the
proof ID is domain-separated by chain ID and contract address, so the two
rails can never collide.

## Deployment status

Machine-readable record: `contracts/deployments/196.json` (kept in sync with
the table below; the receipt verifier cross-checks it).

The V2 contract is live on **X Layer Mainnet (chain ID `196`)**, deployed
2026-08-21:

| Item | Verified value |
| --- | --- |
| Contract | `0xCDb7aD5dF5295C35cfd872Ee01eA01D51EC185c1` |
| Deployment transaction | `0xd5c452ee8342532d0dee490d08cdc7637b61d621205fa4bdc9976f27d9e39cfb` |
| Explorer | [OKLink](https://www.oklink.com/xlayer/address/0xCDb7aD5dF5295C35cfd872Ee01eA01D51EC185c1) |
| Schema | `2` |
| Admin | `0xEa480C8CD699B84C7775fe1b1878eBc3bCb1cb77` |
| Dedicated poster | `0xd0aeA50F5428b85f60f4F250d0978741af5D1a2a` |

The deployer, admin, and poster must be separate addresses. Only the dedicated
poster key is installed in the backend runtime; the admin is an infrequently
used control role for poster rotation and two-step admin transfer. No private
key or seed phrase belongs in this repository or in public documentation.

The legacy X Layer testnet contracts (`GovernanceContract` 0x7556…2DD6 and
`AIGovernanceStorage` 0x1E03…2B2D on chain 1952) remain the testnet demo path
and are intentionally **not** carried to mainnet.

## Deployment runbook

1. Create the ignored `.env.xlayer-mainnet` file (see `.env.example` for the
   full variable list) with a temporary funded deployer key, an admin address,
   and a dedicated funded poster key/address pair.
2. Preflight — validates chain, key/address matches, role separation, funding,
   and the redeploy guard without sending a transaction:

   ```bash
   XLAYER_MAINNET_ENV_FILE=.env.xlayer-mainnet pnpm xlayer:proof:preflight
   ```

3. Deploy:

   ```bash
   XLAYER_MAINNET_ENV_FILE=.env.xlayer-mainnet \
   pnpm exec hardhat --config contracts/hardhat.config.cjs \
     run contracts/scripts/deploy-governance-proof-v2.ts \
     --network xlayerMainnet
   ```

   The script refuses any chain other than X Layer Mainnet (196) and refuses
   to redeploy while `XLAYER_MAINNET_PROOF_CONTRACT` is already set.
4. Record the contract address, deploy transaction, admin, and poster in the
   table above **and** in `contracts/deployments/196.json` (flip `status`
   from `planned` to `active`) — the registry is the machine-readable record
   the receipt verifier cross-checks.

## Production configuration

Once deployed, the live backend opts in with the following non-secret settings
in its private shared environment. The poster private key is stored only as a
secret runtime value:

```env
XLAYER_PROOF_VERSION=v2
XLAYER_MAINNET_RPC_URL=https://rpc.xlayer.tech
XLAYER_MAINNET_CHAIN_ID=196
XLAYER_MAINNET_PROOF_CONTRACT=<deployed-v2-address>
XLAYER_MAINNET_POSTER=<dedicated-proof-poster-address>
```

The rails-era `EXECUTION_XLAYER_MAINNET_*` names are accepted as aliases for
the RPC, chain ID, poster key, and contract values.

The backend remains fail-open for governance if X Layer is unavailable: audit
persistence and policy decisions do not depend on a successful proof write.
Once enabled, each completed governance audit run attempts one idempotent
commitment transaction per enabled proof rail (0G and X Layer are independent),
and the X Layer receipt is saved back to the run evidence as
`evidence.xlayerProofV2`.

### Controlled production verification

After rollout, verify the public integration info endpoint:

```bash
curl -sS https://api.cognivern.persidian.com/api/governance/proof-info \
  | jq '.data.xlayerProofV2 | {enabled, version, chainId, network, contractAddress, explorerUrl}'
```

Then run one controlled, non-custodial governance evaluation in the demo
workspace and verify the resulting V2 receipt and transaction on OKLink. Do
not use a contract deployment or a wallet-spend request as the probe — a
wallet spend on X Layer Mainnet moves real OKB.

A controlled default-policy MCP verification was completed after the
production rollout (2026-08-21). The zero-amount request returned
`success: true` and `allowed: true`, and the resulting proof was verified
directly against the contract:

- Run: `bcebcdef-43f5-44f9-b03c-ff1a635f7f2c`
- Proof ID: `0x6c6240c20ccb8b86ddba4d3f18dbaebad849f043301cb1c561387b18e75f5c6f`
- Transaction: `0x32c740619c97bcc68d92deb371026f4c1170958f2e13a6ae11d594ffc47b1a13`
- Block: `68566290` (`proofBlock` == `runBlock` == tx block; `runProofId` matches)
- Contract `proofCount`: `1` after verification

The same run anchored on 0G Mainnet in the same minute (proof
`0x5ce9f1b3530832ecc689a76cfb2c0364960ace856f43e62dbd06fdf1a77bbe14`, tx
`0x98510a60f3d8a1efdf30bb482f4b66b0eeb7a253ceec2d19047f18aede2e4ae9`, block
`42262905`) — the two proof IDs differ by design, since each is
domain-separated by chain ID and contract address.

## What the chain proves

A confirmed `GovernanceDecision` event proves that the configured Cognivern
poster submitted a commitment for one run identity, one canonical evidence
bundle, one ordered policy/version set, one typed decision and application
timestamp, and one X Layer Mainnet contract and chain domain.

It provides ordering, duplicate prevention, and receipt-substitution
resistance. It does **not** prove that the evidence was truthful, that the
policy was correct, or that the decision was economically or operationally
correct. The poster key is the trust root for what gets anchored. Those limits
must remain clear in product and announcement copy.

## Canonicalization, lifecycle, and verification

The canonical JSON rules, evidence bundle shape, policy-set commitment,
first-write-wins lifecycle, and domain-separated proof ID are identical to the
0G deployment — see `docs/ZEROG_PROOF_V2.md` for the full specification. The
only differences here are the chain domain (`chainId` 196) and the deployed
contract address.

Verify a receipt read-only with:

```bash
pnpm xlayer:proof:verify evidence.json policy-set.json receipt.json
```

The command recomputes the hashes and proof ID, checks the receipt's chain and
contract domain against X Layer Mainnet, then reads `proofBlock(proofId)` and
`runProofId(runIdHash)` from the configured contract.
