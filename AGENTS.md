# AGENTS.md — cognivern

Guidance for AI agents (and humans) working in this repo. **Read this before making
any claim about deployment or infrastructure state.**

> **This file is committed to the repo. Do not add hostnames, IP addresses, ports,
> SSH targets, private keys, or deployment paths here.** Put private operational
> details in `docs/OPS.md` (already gitignored) or in `~/.config/devin/`.

## Canton / Devnet is LIVE — do not re-diagnose it as broken

Cognivern's sealed-bid auctions run on the **HackCanton S2 Canton Devnet** and have
since 2026-07-10. Contracts are on-ledger; the submission's "must be on Devnet"
requirement is already met. Before touching anything Canton-related, READ:

- `docs/CANTON.md` — endpoints, auth, allocated parties, Daml user id, architecture, and cutover config

Do **not** ask the Canton team (or the user) for the JSON Ledger API URL, OIDC auth,
or the onboarded user id — they are all in those docs.

## Verifying runtime state (don't trust the misleading signals)

- Current hostnames, SSH targets, ports, and deployment paths are in the gitignored
  `docs/OPS.md` (or `~/.config/devin/`). **Do not put them in this public file.**
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

## Process lessons

Verify the running system before claiming it is broken. Read the existing docs first.
A wrong "it's broken" diagnosis wastes far more than the two minutes it takes to check.

**Commit attribution matters beyond GitHub's UI.** The repo-local identity is
`thisyearnofear <74209106+thisyearnofear@users.noreply.github.com>` — note the
numeric ID prefix. The legacy unprefixed form (`user@users.noreply.github.com`)
does NOT link commits to the account: GitHub's `?author=` filter, contribution
graphs, and any scoring/reputation tooling reading the API will see the work as
unattributed (we measured the cost — a talent engine scored 6 months of
shipping at 5 commits until attribution was fixed, see
`P-U-C/talent-engine#3`). Never switch the user.email back to the unprefixed
form, and check `git config user.email` in any fresh clone of this repo.

## Hackathon state (Aug 9 2026)

- **Cleanverse Build: Trusted Assets** — submission **due today Aug 9 ~23:59 UTC**. Active shipping target now.
- **HackCanton S2** — **concluded**. The **Canton DevNet backend stays live** (see `docs/CANTON.md`), but the next HackCanton round is planned for **September**.
- **Flare Summer Signal** — **now a top priority, additive**. See `docs/FLARE_SUMMER_SIGNAL.md`. Target Bounty 2 (Confidential Compute); must not regress the live Cleanverse rail or the Canton DevNet path.

---

## Agent workflow

The following rules are for the agent (human or AI) editing this repo. They are defaults, not hard laws; if a rule fights the task in front of you, say so and get a human sign-off before breaking it.

### Glossary

Use these terms consistently in code, tests, docs, and commit messages.

- **mandate** — a bounded objective, budget, permissions, and evidence requirements under which an agent operates.
- **rail** — an execution or settlement pathway (e.g., x402, Canton, 0G, Fhenix, Cleanverse, xLayer).
- **vendor** — a service or provider an agent may pay or call.
- **action** — one step an agent takes; the unit of attribution.
- **run** — a single agent execution session; contains actions, evidence, and outcomes.
- **evidence** — the artifact produced to justify a spend or outcome.
- **CRE** — the Cognivern Run/Evidence ledger.
- **sealed-bid round** — a Canton/Daml confidential auction for vendor selection.
- **policy** — the rules that determine whether a proposed spend is allowed.
- **workspace** — a tenant/unit of isolation for users, agents, mandates, and runs.

### The three ways to hurt yourself

1. **Killing by pattern.** Never `pkill -f`, `pgrep | kill`, or `kill` a PID you found by matching a name, path, or port. The live backend, pm2, and local dev servers are shared with other work. Kill only a PID you captured at spawn, or the owner of a port after confirming `/proc/<pid>/cwd` or `pm2 list`.
2. **Writing to the live install.** The active env is `/opt/cognivern/app/.env` → `/opt/cognivern/shared/.env`. Do not edit, restart, or migrate against live Hetzner or live Canton DevNet unless the user explicitly asked. Copy data/DB snapshots into a local or worktree sandbox; never symlink back.
3. **Baking in origins.** Never set `VITE_API_URL`, `VITE_WS_URL`, or similar public origins into the frontend build for dev. Dev is single-origin and the Vite/Next dev server proxies. Baking origins into the bundle breaks remote/testing environments.

### Hit every rail

The most common defect in this repo is a change that works on one path and is missing across the others. Before calling a feature done, say which rails it touched.

- **API contract.** Did the request/response shape in `packages/shared` and `src/backend/modules/api` change? Did `keyScopes.ts` need a new scope?
- **Frontend.** Does the Next.js UI (or a Playwright test) reflect the new state and error paths?
- **Agents / workers.** Does the copilot example, Cloudflare agent, or any `src/backend/modules/agents` code use the new payload?
- **On-chain / Daml.** Did the Fhenix, 0G, xLayer, or Canton flows change? Are package refs (`#daml:Main:...`) and template IDs still valid?
- **Reverse states.** If you added a way in, add the way out and the way to see it. Approve needs reject. Create needs archive/cancel where the model allows it. A one-way door is a bug.
- **Observability / CRE.** Does the new flow emit the right run/evidence events for the audit ledger? Does it add an OpenTelemetry span or metric?
- **Docs.** User-facing behavior goes in `docs/user/` or the relevant integration doc; architecture and constraint changes go in `docs/internals/`.

### Dev and test discipline

- Local dev: `pnpm dev` (backend) and `pnpm frontend` (Next.js) in separate terminals. Do not run the live Hetzner deployment for local testing.
- For DB testing, use a known seed or a safe `VACUUM INTO` copy of a local SQLite file; do not copy live Mongo/Postgres files while a server holds them.
- For Canton, use the sandbox or local Daml scripts. Do **not** create probe rounds on the live Devnet; they persist.
- Use `cp .env.example .env` and keep secrets out of the repo.

### Verifying

- Smallest proof that works. Run tests, lint, or typecheck scoped to the files you touched.
- For backend behavior changes, add or run a focused Vitest or Playwright test. For prompt-injection or security changes, run `pnpm test:prompt-injection`.
- For UI changes, run the relevant Playwright spec.
- Do not run repo-wide `pnpm test` or full `tsc` unless the user explicitly asks. CI owns the full suite.
- For async flows (Canton, Fhenix, x402, Telegraph), wait on typed receipts or terminal events, not `setTimeout` or polling.

### Taste

- Complexity belongs at the adapter boundary. Orchestration stays pure; UI stays dumb.
- Inferred types over annotations. `any` is the enemy. Prefer `unknown` + narrowing or Zod.
- Comments describe how a thing is used, not what it does. Use them for functions and cross-rail invariants, not for every line.
- No continuously repainting animations or unthrottled WebSocket/SSE traffic. Users notice a dropped frame, a lying spinner, and a stale label.
- If a rule here conflicts with the task in front of you, say so loudly and get a human sign-off before breaking it.

### Plans and work artifacts

- Do not commit implementation plans, research notes, or agent scratch files. Keep temporary material outside the worktree or in a clearly gitignored path.
- A merged PR is the implementation record. Track active work in the GitHub issue/project that owns it.
- Durable architecture decisions go in `docs/internals/`; update them when the product changes.

### Pull requests

- Conventional commit titles, plain language: `fix(backend): reject spend when policy counter is exhausted`.
- One concern per PR. If the description says "also", split it.
- UI changes need before/after screenshots or a short video; backend behavior changes need a test or a Playwright trace.
- Include the rails you hit in the PR body.
