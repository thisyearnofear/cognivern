# Dynamic server wallets

Supplementary MPC custody for Cognivern agent spends. Cognivern keeps the
control plane (mandate → policy → CRE); Dynamic holds server-wallet key shares.

## Pattern

**Server wallets** (API token, backend-owned). Not agent-as-Dynamic-user, not
delegated end-user wallets.

Docs:

- [Agents overview](https://www.dynamic.xyz/docs/overview/agents/overview)
- [Server wallets setup](https://www.dynamic.xyz/docs/node/wallets/server-wallets/overview)
- [Viem wallet client](https://www.dynamic.xyz/docs/node/wallets/server-wallets/viem-wallet-client)

## Product surface (custody-first)

Operators choose **custody by need**, not by vendor:

| Need | Custody mode | Adapters underneath |
| --- | --- | --- |
| Default demos / low stakes | Cognivern vault | `local` |
| No raw keys on this box | Managed MPC | `dynamic` |
| Gas sponsorship / ops broadcast | Hosted execution | `keeperhub` |
| Identity-gated capital | Verified settlement | `cleanverse` |

Settings → **Wallet custody** is the primary control. Advanced still allows
splitting signing vs broadcast. Run detail shows a **Spend path** strip:
Policy → Custody → Settlement → Evidence.

## Env

```bash
DYNAMIC_ENABLED=true
DYNAMIC_ENVIRONMENT_ID=...
DYNAMIC_API_TOKEN=...
DYNAMIC_WALLET_PASSWORD=...          # required for backUpToDynamic
DYNAMIC_SERVER_WALLET_ADDRESS=0x...  # optional default
DYNAMIC_WALLET_METADATA_PATH=.cognivern/dynamic-server-wallet.json
```

Requires Node 18+ (Linux x64/arm64 or macOS arm64). The SDK uses native MPC
addons — not Bun / edge runtimes.

## Provision

```bash
pnpm dynamic:provision
```

Writes non-secret `walletMetadata` to `DYNAMIC_WALLET_METADATA_PATH`. Key shares
stay with Dynamic (`backUpToDynamic: true`).

## Configure a Cognivern wallet

PATCH `/api/ows/wallets/:id` (or Settings → wallet):

```json
{
  "executionProvider": "dynamic",
  "signingProvider": "dynamic",
  "dynamicAccountAddress": "0x…",
  "dynamicWalletMetadata": { "...from provision file..." },
  "chainId": 1952
}
```

Fund the Dynamic address on that chain before spending.

## Demo

```bash
pnpm demo:dynamic
# optional live spend:
DYNAMIC_DEMO_WALLET_ID=... DYNAMIC_DEMO_API_KEY=... DYNAMIC_DEMO_WORKSPACE_ID=... pnpm demo:dynamic
```

## Code map

| Piece | Path |
| --- | --- |
| SDK boundary | `src/backend/services/blockchain/dynamic/DynamicServerWalletClient.ts` |
| Execution | `src/backend/services/blockchain/execution/DynamicExecutionBackend.ts` |
| Signing | `src/backend/signing/DynamicSigningProvider.ts` |

Switch back to `local` / KeeperHub / Cleanverse anytime via the same PATCH.

## Follow-ups (not in v1)

- Telegraph x402 payer using a Dynamic `WalletClient` / EIP-3009 shim
- Fireblocks Flow / MPP / Solana
- React embedded-wallet login / delegated access
