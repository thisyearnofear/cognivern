# HackCanton Season 3 — Cognivern Submission (draft)

> **Live draft — submissions close Oct 9 2026 23:59 UTC.** This doc becomes
> the historical submission record after judging; rail truth lives in
> [`../CANTON.md`](../CANTON.md) (sealed-bid rail),
> [`../PRODUCT_STRATEGY.md`](../PRODUCT_STRATEGY.md) (sponsor-side thesis),
> and [`../SPONSORED_CREDITS.md`](../SPONSORED_CREDITS.md) (cohort mechanics).

**Hackathon:** HackCanton Season 3 (AppsFactory, fully online)
**Window:** opened Sep 17 2026 → submissions close **Oct 9 2026 23:59 UTC** → Grand Final Oct 21
**Team:** thisyearnofear
**Repository:** [github.com/thisyearnofear/cognivern](https://github.com/thisyearnofear/cognivern)
**Live product:** [cognivern.persidian.com](https://cognivern.persidian.com) · sponsor console `/sponsor` · API `api.cognivern.persidian.com`
**Tracks (max two):** primary — investment infrastructure (governance/allocation tooling); secondary — open

> **Scope note (Oct 5, mentor feedback):** receipts/debrief lead. Sealed-bid
> is expansion narrative only — a second buyer problem until the receipt is
> proven to travel. Judged on whether organisers share the report, not on
> rail breadth.

---

## TL;DR

**Cognivern is the sponsor-side answer to hackathon DevRel:** organisers hand
out inference budgets at 0% throughput fees and get mandate receipts that hold
up to a third party — then we measure whether the receipt actually travels to
sponsors and judges.

**One line:** *Fund the cohort at cost, prove every cent — and watch whether
the receipt travels.* (Confidential vendor selection on Canton is a later
expansion rail, not the lead wedge; see scope note above.)

---

## What the judges can click today (no signup)

- `/sponsor` — organiser narrative, live proof strip (real rounds or silence, never fixtures)
- `/sponsor#proof` → `/verify` — public Merkle-receipt verification against anchored roots
- `/credits` — exactly what a grantee sees: balance, disclosure tier, receipts
- `/sealed-bid` — create rounds, submit bids, close/reveal, party-view disclosure toggle

Backend: PM2 `cognivern-backend` (port 3087) + `cognivern-canton` sandbox
(JSON API `:7575`, SERVING) on the production host. Live list returns the
three seeded demo rounds with `backend: "canton"`, fresh deadlines.

---

## DevNet cutover (required before submission)

Sandbox-backed runs do **not** satisfy the DevNet deployment requirement. The
S3 shared node (`hackcanton-01`, same host as S2) is reachable again
(`livez` 200), but S2 credentials get `invalid token` on the ledger API —
the node moved to per-team tenant namespaces (see [DevNet quickstart](https://hackmd.io/e3XQxMggRw2m5N7nxzQYZA)).

1. **Owner:** register / confirm S3-season tenant access (Console SSO + wallet onboarding). S2 account alone is not enough.
2. Upload the settlement DAR (`daml-0.0.2`, package `d62e13ab…`) via Console → Collections (or confirm the S2 package still vetted under the tenant namespace).
3. Allocate `auctioner/sponsor`-side parties (or reuse `-cognivern` parties if visible to the tenant) and grant `actAs`.
4. Cut production env to DevNet values (`.env.example`, DevNet section), `pm2 restart cognivern-backend --update-env`.
5. Run `pnpm canton:proof` against the live API; capture round ID, bid contract IDs, `CloseAndReveal` tx, `AuctionResult` contract ID into `.artifacts/`.
6. Dogfood: run one real sponsored-cohort flow against the DevNet-backed API and keep its numbers for the demo.

Full runbook: [`../CANTON.md`](../CANTON.md) (runbooks + DevNet evidence checklist).

## Submission checklist

- [ ] DevNet cutover + `canton:proof` artifact (see above)
- [x] Validation instrumentation (server-recorded share/open/feedback + report `validation` block)
- [ ] Demo video (sealed-bid create → bid privacy view → reveal + sponsor receipt)
- [ ] Materials uploaded (repo, demo, video — full set)
- [ ] **Submitted for judging** (upload ≠ submit)
- [ ] Build diary entries (momentum matters — cf. chain-experts)
