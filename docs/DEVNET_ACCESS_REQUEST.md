# Canton DevNet Access Request — Draft

Copy and send this to the Encode team / Canton mentors in the `#canton` Discord channel (or the hackathon contact email). Time is short — submission closes Monday 13 July, 12:59 BST.

---

**Subject:** DevNet participant access for HackCanton S2 submission — Cognivern / team thisyearnofear

Hi Encode & Canton mentors,

We are team **thisyearnofear** submitting **Cognivern**, a private sealed-bid / OTC vendor-selection protocol built on Canton Network, for **Track 1 — Private DeFi & Capital Markets**.

Our Daml model is built and compiles clean (`daml/daml/Main.daml`, SDK 2.10.4). We have the backend participant-agnostic code ready and a runbook for the cutover. To satisfy the final submission requirement — **deployed and running on Canton DevNet, not LocalNet/sandbox** — we need to connect to an existing DevNet participant / validator.

We checked the current Canton docs and DevNet status:
- DevNet is live on Splice **0.6.11**, migration ID **1** (public info endpoint: `https://docs.dev.global.canton.network.sync.global/info`).
- The Global Synchronizer Foundation DevNet Super Validator is `https://sv.sv-1.dev.global.canton.network.sync.global`.
- The standard self-hosted validator route requires a **validator request**, **VPN credentials**, and an **egress IP allowlist** (2–7 days), which is too slow for the 13 July deadline.

Could you please help us with one of the following?

1. **Point us to the shared HackCanton S2 DevNet participant** (JSON API URL + ledger/synchronizer ID + auth method + allowed party names) if one is available to finalists, similar to the shared HackCanton S1 DevNet node that Kiryl from NODERS demoed.
2. **If no shared node exists**, introduce us to an SV sponsor or NODERS NaaS contact who can provide managed DevNet participant access for the hackathon.
3. **Confirm the fastest path** for a team that only needs to deploy a DAR and run a few demo transactions, not operate a full validator.

What we can supply immediately:

- Compiled DAR: `daml/.daml/dist/daml-0.0.1.dar` (checked into repo build artifacts or reproducible with `daml build`).
- Required templates: `Main:SealedBidAuction`, `Main:Bid`, `Main:AuctionResult`.
- Backend code: `src/backend/canton/CantonLedgerClient.ts` (Daml JSON API v1 today; can add v2 adapter if needed).
- Live product (currently sandbox-backed): https://cognivern.vercel.app/sealed-bid
- Public repo: https://github.com/thisyearnofear/cognivern

Once we have the participant details we can:

- Upload the DAR.
- Update `CANTON_JSON_API_URL`, `CANTON_LEDGER_ID`, `CANTON_TEMPLATE_*` in production.
- Run `pnpm canton:proof` to generate an on-ledger lifecycle evidence JSON.
- Record the final 3-minute demo video against the DevNet-backed live product.

Please let us know what credentials or forms you need from us.

Thanks,
[thisyearnofear team / your name]

---

## Information to fill once a mentor replies

| Item | Value |
| --- | --- |
| DevNet JSON API base URL | `https://...` (or local `http://json-ledger-api.localhost:8080` if using a self-hosted validator) |
| Ledger ID | `...` |
| Auth method | JWT / API key / OIDC token |
| Participant / validator name | `...` |
| DAR upload endpoint/version | `/v1/packages` or `/v2/packages` |
| Party names we can use | Auctioneer, Alice, Bob, Charlie |
| Synchronizer / domain ID | `devnet` migration ID `1` |
| Splice / Canton version | `0.6.11` |
| VPN / static egress IP required? | yes / no |

After filling the table, hand it to the Devin session so it can finish the cutover and evidence capture.
