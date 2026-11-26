# Praman reproduction: held evidence bundle

A proposed, offline audit experiment — not a deployed integration, a payment
authorization, a partnership, or a signature from either side.

Praman proposed binding a Cognivern decision digest to its WASM/screening
receipt. The first reproduction boundary is deliberately small: one
publishable, fully synthetic compliant-call evidence bundle that records a
**held** decision — `gate.decision = deny`, `gate.reviewRequired = true`,
`settlement.status = not_attempted`, and **no** `settlementTransfer`.

## Fixture

`held-bundle.json` was produced by the real
`buildTelegraphEvidenceBundle` (`src/backend/services/telegraph/TelegraphEvidence.ts`)
with fake IDs and a frozen timestamp (`2026-11-26T00:00:00.000Z`).

The digest is over the **canonicalized JSON** (key-sorted, normalized),
not the exact file bytes — whitespace and key order do not change it, but
any change to canonicalized data does.

Pinned canonical SHA-256 (the bundle with `evidenceHash` removed):

```
0a532c32a6fb22a0f14c26f182c19085e0cfd24de3bb2414503de8a4b80bc427
```

The pinned digest lives here, separately from the fixture, so a reader
recomputes against this file rather than trusting bytes stored beside the
artifact.

## Verify

```sh
node examples/praman-reproduction/verify.mjs        # from the repo root
# or against a copy you intend to tamper with:
node examples/praman-reproduction/verify.mjs /tmp/mutated-bundle.json
```

`verify.mjs` is a standalone script with no repo imports: it drops
`evidenceHash`, recomputes the canonical SHA-256 of the remaining data,
requires equality with the pinned digest above and the embedded
`evidenceHash`, and additionally requires the held-decision shape (deny +
reviewRequired, no transfer). Any change to canonicalized data — including
flipping the decision — fails with exit 1. To exercise the tamper path,
copy the fixture to a temp path, edit it, and run the verifier against the
copy — do not mutate the checked-in fixture.

## Boundary

- A matched hash authenticates neither the issuer nor the truth of the
  screening conclusion — only that these exact bytes are unaltered.
- Before any real exchange, both sides must agree canonicalization,
  signer/trust root, list source/version, idempotency, retention, and which
  subject/transaction is covered; each team recomputes the other's digest
  locally on pinned commits, and an altered input must fail.
- Any future combined receipt stays separate from the original bundle and
  from settlement authority: a human release never resumes a blocked
  transfer.
- This is Cognivern's synthetic fixture only. No mutual reproduction,
  Praman attestation or deployed integration is claimed.
