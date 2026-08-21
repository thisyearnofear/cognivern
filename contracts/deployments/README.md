# Contract deployments registry

Machine-readable record of Cognivern's on-chain deployments, one file per
EVM chain (`<chainId>.json`). This registry is the single source of truth for
**what is deployed where**; human docs (`docs/ZEROG_PROOF_V2.md`,
`docs/XLAYER_PROOF_V2.md`, …) narrate each deployment but must mirror the
verified values recorded here.

## File shape

```json
{
  "chainId": 16661,
  "railId": "zerog-mainnet",
  "displayName": "0G Mainnet (Aristotle)",
  "explorerAddressBase": "https://chainscan.0g.ai",
  "explorerTxBase": "https://chainscan.0g.ai",
  "contracts": [
    {
      "name": "GovernanceProofV2",
      "purpose": "governance_proof",
      "address": "0x…",
      "deployTx": "0x…",
      "schemaVersion": 2,
      "status": "active",
      "roles": { "admin": "0x…", "poster": "0x…" },
      "notes": "…"
    }
  ]
}
```

- `railId` matches the rail registry in `packages/shared/src/rails.ts`.
- `status` is one of:
  - `planned` — deployment scoped and scripted, not yet on-chain (address/`deployTx` are `null`).
  - `active` — live and referenced by the product.
  - `deprecated` — live but not carried forward; retained for historical verification.
  - `superseded` — replaced by a newer deployment; set `supersededBy` to the
    replacement's `chainId:address`.
- `address` and `deployTx` are immutable once recorded: a wrong value means a
  corrected new commit, not an in-place edit with a changed history of truth.
- Role fields (`admin`, `poster`, `authority`, …) carry addresses only —
  never keys.

## Rules

1. New contract schema = new source file + new deployment entry; never mutate
   a live contract's meaning or an existing entry's address.
2. When a deployment is replaced, mark it `superseded` and link the successor
   with `supersededBy`; do not delete the entry.
3. Docs tables and backend defaults are populated from these values, and the
   receipt verifier (`tooling/scripts/verify/governance-proof-v2.ts`)
   cross-checks against them.
