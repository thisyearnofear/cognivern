# Flare Confidential Compute (FCC) — TEE spend policy

> **Status (2026-09-24): STANDBY — FCE stack stopped.** `fce-extension-tee`,
> `fce-ext-proxy`, and `fce-redis` on the FCC host (`nuncio-vultr`,
> `/opt/cognivern-flare/fce`) were stopped and removed; compose project files
> remain for revival. On-chain artifacts below persist on Coston2, but live
> evaluation is down: the backend falls back to the Fhenix/plaintext path
> unless `FLARE_EVALUATOR=flare`, and fails closed (fabricated deny) when the
> proxy is unreachable. Revival = `docker compose up -d` in
> `/opt/cognivern-flare/fce` **plus** re-`REGISTER_POLICY` for every key
> mandate (TEE/Redis-held budgets and counters do not survive the stop).

Confidential spend-policy evaluation inside a Flare Compute Extension (FCE):
budget and per-agent spend counters live **inside the TEE**, not in public
contract storage; only the decision is published on-chain. Built for Flare
Summer Signal Bounty 2 (Aug 2026) — working doc / submission record:
[`history/FLARE_SUMMER_SIGNAL.md`](./history/FLARE_SUMMER_SIGNAL.md).

## Model (FCC, not "Opaque Gateway")

- Apps are **Flare Compute Extensions** — Go HTTP handlers in a confidential
  VM, reached via on-chain `InstructionSender` →
  `TeeExtensionRegistry.sendInstructions` → data-provider relay → `ext-proxy`
  → TEE.
- On Coston2, `ITeeExtensionRegistry` / `ITeeMachineRegistry` are both the
  **FlareTeeManager** diamond: `0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE`.
- Mechanism change vs Fhenix: FHE `euint*` → secure-enclave state. Same
  product guarantee (private budget + counter + approve/hold/deny).

## Deployed artifacts (Coston2, chain 114)

| Item | Value |
| --- | --- |
| InstructionSender (`ConfidentialSpendPolicy.sol`) | `0x9280232ac471237C3065591c9e7774f175AA1A94` |
| Extension id | `0x10238` |
| Extension host | `flare-tee.persidian.com` → Traefik → FCC host `:7667` (**down** since 2026-09-24 — route 502s until revival) |
| FCE OPTypes | `SPEND_POLICY`, `REGISTER_POLICY`, `EVALUATE_SPEND` |

## Backend wiring

- `FlareConfidentialPolicyService.ts` + dispatch branch gated by
  `FLARE_EVALUATOR=flare` (see `flareEvaluator` helper).
- Decisions emit the existing `SpendEvaluated` surface and a
  `flare.confidential` CRE artifact.
- `GET /api/flare/status` (+ Flare block on `/api/fhenix/status`).
- Judge/demo surface: `/governance/check?confidential=1` ("Try confidential spend").
- **Key = sealed mandate**: API-key scopes enforced; optional per-key budget
  registered into the TEE via `REGISTER_POLICY` (key-derived policyId).

## Environment

`FLARE_*` vars in `.env.example` — RPC/chain, InstructionSender address,
extension id, evaluator flag, funded Coston2 key (lives on the FCC host, not
the backend box).

## Files

`contracts/flare/` (Hardhat project, `src/ConfidentialSpendPolicy.sol`,
`config/coston2/deployed-addresses.json`, unit tests) · FCE Go handlers on the
extension host (scaffold-derived) ·
`src/backend/services/blockchain/FlareConfidentialPolicyService.ts`.
