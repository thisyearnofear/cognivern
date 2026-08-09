# AGENTS.md — cognivern

Guidance for AI agents (and humans) working in this repo. **Read this before making
any claim about deployment or infrastructure state.**

## Canton / Devnet is LIVE — do not re-diagnose it as broken

Cognivern's sealed-bid auctions run on the **HackCanton S2 Canton Devnet** and have
since 2026-07-10. Contracts are on-ledger; the submission's "must be on Devnet"
requirement is already met. Before touching anything Canton-related, READ:

- `docs/CANTON.md` — endpoints, auth, allocated parties, Daml user id, architecture, and cutover config

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

The uploaded package name is `daml` (current package id `d62e13ab…`, upgrading `51789b…`);
templates are referenced as `#daml:Main:SealedBidAuction` / `:Main:Bid` /
`:Main:AuctionResult` / `:Main:PaymentDeposit` (LF 2.x package-name references).
If you rebuild for Devnet, **keep the package name `daml`** or those `#daml:`
references break.

## Process lesson

Verify the running system before claiming it is broken. Read the existing docs first.
A wrong "it's broken" diagnosis wastes far more than the two minutes it takes to check.

## Hackathon state (Aug 9 2026)

- **Cleanverse Build: Trusted Assets** — submission **due today Aug 9 ~23:59 UTC**. Active shipping target now.
- **HackCanton S2** — **concluded**. The **Canton DevNet backend stays live** (see `docs/CANTON.md`), but the next HackCanton round is planned for **September**.
- **Flare Summer Signal** — **now a top priority, additive**. See `docs/FLARE_SUMMER_SIGNAL.md`. Target Bounty 2 (Confidential Compute); must not regress the live Cleanverse rail or the Canton DevNet path.
