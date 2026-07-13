# AGENTS.md — cognivern

Guidance for AI agents (and humans) working in this repo. **Read this before making
any claim about deployment or infrastructure state.**

## Canton / Devnet is LIVE — do not re-diagnose it as broken

Cognivern's sealed-bid auctions run on the **HackCanton S2 Canton Devnet** and have
since 2026-07-10. Contracts are on-ledger; the submission's "must be on Devnet"
requirement is already met. Before touching anything Canton-related, READ:

- `docs/HACKCANTON_DEVNET_MATERIALS.md` — endpoints, auth, allocated parties, Daml user id
- `docs/FINAL_SUBMISSION_RUNBOOK.md` — the cutover/config that is **already done**
- `docs/CANTON.md` — architecture

Do **not** ask the Canton team (or the user) for the JSON Ledger API URL, OIDC auth,
or the onboarded user id — they are all in those docs.

## Verifying runtime state (don't trust the misleading signals)

- The live backend is on the Hetzner box (`ssh snel-bot`), pm2 process
  `cognivern-backend`, port **3087**.
- The ACTIVE env file is `/opt/cognivern/app/.env` → symlink →
  `/opt/cognivern/shared/.env`. **The file at `/opt/cognivern/.env` is a stale
  decoy** — do not judge config from it.
- `/proc/<pid>/environ` does **not** show dotenv-loaded vars (loaded at runtime), so
  CANTON_* looks absent even when it's fully present. Do not rely on it.
- To check whether Canton is live, hit the API:
  `curl -s http://localhost:3087/api/vendor/sealed-bid/rounds` — rounds return with
  `"backend":"canton"` when connected to Devnet.
- **Do not create probe/test rounds against the live Devnet participant** — the Daml
  model has no cancel / archive-without-bids choice, so they persist in the demo list.

## The Daml package on Devnet

The uploaded package name is `daml` (package id `51789b…`); templates are referenced
as `#daml:Main:SealedBidAuction` / `:Main:Bid` / `:Main:AuctionResult` (LF 2.x
package-name references). If you rebuild for Devnet, **keep the package name `daml`**
or those `#daml:` references break.

## Process lesson

Verify the running system before claiming it is broken. Read the existing docs first.
A wrong "it's broken" diagnosis wastes far more than the two minutes it takes to check.
