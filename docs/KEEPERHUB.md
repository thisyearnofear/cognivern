# KeeperHub — managed execution provider

Routes approved wallet spends through the KeeperHub Direct Execution API
(managed broadcast, gas sponsorship, MEV protection) instead of the local
vault signer. Built for the KeeperHub Agents Onchain hackathon (Aug 2026) —
submission record:
[`history/HACKATHON_SUBMISSION_KEEPERHUB.md`](./history/HACKATHON_SUBMISSION_KEEPERHUB.md).

## How it fits the spend path

`OwsWalletService.finalizeApprovedSpend` dispatches on
`wallet.metadata.executionProvider`: `local` → `OwsLocalVaultService`
(local RPC), `keeperhub` → `KeeperHubExecutionProvider.executeTransfer`.
The provider runs the fail-closed sequence:

1. `POST /api/execute/transfer` with `simulate: true`; continue only on
   `success: true` + `wouldRevert: false`.
2. `POST` the identical body with a stable `Idempotency-Key`.
3. Poll `/api/execute/{id}/status` honoring `X-Poll-Interval-Hint`.
4. Persist `transactionHash`, `transactionLink`, `executionId`, `sponsored`,
   authoritative `receipts` — verified independently via chain RPC when the
   execution is not sponsored.

## Organization scoping (read this before touching keys)

KeeperHub `kh_` API keys and execution wallets are **organization-scoped**;
projects are folders, not security boundaries. The Cognivern execution account
lives in a dedicated `cognivern` organization — never reuse a key from another
org (e.g. `weft`). The provider sends only `{chain, recipient, amount}` so the
org's wallet is selected server-side, and performs a read-only
`GET /api/user/wallet` binding check before simulation — it fails closed when
the returned wallet differs from the configured Cognivern execution wallet.

Current execution EOA (dedicated Turnkey wallet in the `cognivern` org):
`0x12bF701781cbA77daDa2Ccf6DA07e7D357AFE141`.

## Environment & wallet opt-in

```env
KEEPERHUB_API_KEY=kh_...                    # created while `cognivern` org is active
KEEPERHUB_BASE_URL=https://app.keeperhub.com # default
```

Wallet metadata (Settings → Wallets, or `PATCH /api/ows/wallets/:id`):

```json
{
  "executionProvider": "keeperhub",
  "chainId": 421614,
  "keeperHubWalletAddress": "0xYourKeeperHubAddress"
}
```

`keeperHubWalletAddress` is local configuration/provenance only — KeeperHub
selects the actual sender from the API key's organization.

## Surfaces & observability

- Settings → Wallets: "N on KeeperHub" badge, bootstrap empty state, and a
  `KeeperHubConsequences` panel (managed execution, gas sponsorship, MEV,
  audit trail, cost) when the provider is selected.
- Observability: find a KeeperHub spend via the `wallet_sign_and_broadcast`
  span → `keeperhub.execution_id` attribute → nested `audit.log_action`.
- Editor agents: repo `.mcp.json` declares `https://app.keeperhub.com/mcp` —
  same execution surface from MCP-compatible editors.
- Runtime gate: `keeperHubConfig.enabled` in `/api/observability/status`.

## Files & tests

`KeeperHubExecutionProvider.ts` (provider) ·
`SapienceTradingAgent.runKeeperHubRebalanceCycle` (canonical agent path, span
`agent.sapience.keeperhub_rebalance`) ·
`tooling/scripts/demo/run-keeperhub-rebalance.ts` (one-shot loop) ·
`mock-keeperhub-server.mjs` + `test-keeperhub-rebalance.ts` (3-check local
round-trip: provider round-trip, approved shape, held path fabricates no
txHash). Reference execution on Arbitrum Sepolia:
tx `0xc0edc09d1d3f8f7c0b8abf29f10af8003e2955693ace42f7124c66a9d38c967f`.
