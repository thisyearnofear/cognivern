# HackCanton Season 3 — Cognivern Submission (concluded)

> **Concluded Oct 21 2026 — not shortlisted for judging.** Historical record
> only; rail truth lives in [`../CANTON.md`](../CANTON.md) (sealed-bid rail),
> [`../PRODUCT_STRATEGY.md`](../PRODUCT_STRATEGY.md) (sponsor-side thesis),
> and [`../SPONSORED_CREDITS.md`](../SPONSORED_CREDITS.md) (cohort mechanics).
> Judge feedback and lessons: [Retrospective](#retrospective).

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

## Validation protocol (mentor-agreed, pre-registered before Mara)

Working statement: organisers lose repeat sponsorship when they can't
present sponsor-accepted evidence that cohort activity produced outcomes
tied to the sponsor's goals. Capture and packaging are tested separately.

Interview questions (verbatim, same five for comparability):

1. How do you currently explain sponsor spend after a cohort?
2. What's the hardest or most annoying part of that debrief?
3. What would make a receipt/report trustworthy enough to send to a sponsor?
4. Would you actually share a link like this after the cohort? Why or why not?
5. What would make this a habit next time?

Falsifiers (asked explicitly, not inferred):

- What did you renew last time despite weak attribution?
- When credits were consumed but outcomes were weak, did the sponsor renew anyway?
- Counterfactual closer: would you renew differently if this evidence did not exist?

Synthesis: one row per interview — sponsor segment (credits/brand/mixed),
stated renewal criteria, justification-without-proof example, minimum
evidence package — each row carrying an explicit call plus confidence:

- Decision product, if evidence changes the renewal decision
- Reporting product, if evidence is needed after the decision for accountability
- Nicer deck, if presentation polish with no decision impact

Pass bar: 2 of 3 cohorts show external share + sponsor open + material
debrief help, with unprompted sharing as the strong signal. If the metric
fails, the same rails pivot to enterprise budget owners — framed as a
finding, not a failure.

## Submission checklist

- [x] DevNet cutover + `canton:proof` artifact (S3 tenant `hackcanton-devnet-3`,
  package `d62e13ab…` REGISTERED; proof round `0x1cb3282e…`, winner
  `e6c5f9fc-alice`, value settled atomically — `.artifacts/canton-devnet-proof-2026-10-06T15-48-38-758Z.json`)
- [x] Validation instrumentation (server-recorded share/open/feedback + report `validation` block)
- [x] Demo video (sealed-bid create → bid privacy view → reveal + sponsor
  receipt) — `.artifacts/demo-video-s3.mp4` (1:40, 720p, narrated). Recorded
  live against production via `tooling/scripts/demo/record-demo-video-s3.ts`;
  on-screen round `0xeb3d8ac6…` verified `revealed` on Canton DevNet,
  `e6c5f9fc-bob` @ $74,500, `settledAssetCid` present.
  Public URL: https://youtu.be/taG9NPRzAmE
- [x] Materials uploaded (repo, demo, video — full set)
- [x] **Submitted for judging** (upload ≠ submit)
- [ ] Build diary entries (momentum matters — cf. chain-experts)

## Retrospective

**Outcome (Oct 21 2026):** cognivern did not make the top-25 shortlist that
went to the judges — the submission was not scored. The organizers' stated
bar: a judge can verify a real build (a working demo or video, and public
Daml code), Canton is at the core, and the documents contain real answers.

The three reasons given, verbatim-ish:

1. **Submission hygiene.** The Metrics field shipped with an assistant
   instruction left in ("Recover from memory if possible; do not invent a
   separate interview…"). Form fields are paste targets — repo greps never
   saw them.
2. **Two products in one submission.** The pitch led with sealed-bid
   auctions for AI agents while the Value section led with credit receipts
   for hackathon organizers — the Oct 5 mentor-driven scope pivot — leaving
   Canton reading as an "expansion story" on a product whose wedge was
   elsewhere.
3. **Canton wasn't load-bearing, technically.** No `daml/` model change
   during the season (last real change `4857b8cd`, Jul 19 — pre-season;
   the only in-season touch was file reorganization), and sign-in is
   EVM-wallet SIWE mapping to custodial pool parties, not a Canton wallet.

Lessons for the next Canton submission:

- **One product, one story — and the venue's tech must be the wedge.**
  The credits pivot was a defensible product call but structurally wrong
  for a Canton-judged venue. Submit the rail where the venue tech is
  load-bearing, or skip the venue. Future submissions follow
  [`../SUBMISSION_CHECKLIST.md`](../SUBMISSION_CHECKLIST.md).
- **Do visible model work in-season.** The next Daml changes are scoped in
  `../CANTON.md` → "Next model work (post-S3)": a `Cancel`/`AuctionCancelled`
  path (zero-bid rounds are unarchivable today), an on-ledger close-deadline
  option, and a real CIP-0056 settlement asset.
- **Canton-native identity, not EVM custody.** External-party signing
  (Canton 3.x interactive submission) makes the bidder's wallet a real
  Canton party; the SIWE → pool-party bridge stays the sandbox/demo path.
  Design is in the same CANTON.md section.
