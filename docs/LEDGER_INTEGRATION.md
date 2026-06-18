# Ledger Integration — Hardware Signing

Cognivern supports hardware-gated signing via Ledger DMK (production) and Speculos (sandbox/CI).

## Signing Provider Architecture

The `SigningProvider` interface in `src/backend/signing/SigningProvider.ts` defines a 3-method contract. Dispatch happens in `OwsWalletService.handleApprove()` based on `wallet.metadata.signingProvider`:

| Provider | Value | Backend | Use Case |
|----------|-------|---------|----------|
| **Local** | `"local"` (default) | `OwsLocalVaultService.signMessage()` | Development, low-value |
| **OWS Remote** | `"ows_remote"` | `OwsLocalVaultService.signWithExternalWallet()` | Multi-instance |
| **Ledger DMK** | `"ledger"` | `LedgerSigningProvider` (`@ledgerhq/device-management-kit`) | Production high-value, hardware-gated |
| **Speculos** | `"speculos"` | `OwsLocalVaultService.signWithExternalWallet()` via HTTP | Sandbox/CI |

## Configuration

```typescript
// Local wallet (default)
{ metadata: {} }

// Ledger hardware wallet
{ metadata: { signingProvider: "ledger" } }

// Speculos emulated wallet (sandbox)
{ metadata: { signingProvider: "speculos", externalSource: "http://speculos:5000" } }
```

## Code Layout

- `src/backend/signing/SigningProvider.ts` — Interface (`name`, `sign()`)
- `src/backend/signing/LedgerSigningProvider.ts` — DMK-based implementation with USB/Speculos transport fallback
- `src/backend/services/OwsWalletService.ts` — Provider dispatch in `handleApprove()`
- `deploy/docker-compose.yml` — Speculos service (`profiles: ["sandbox"]`)
- `src/frontend/src/components/audit/audit-page.tsx` — "Hardware" badge in audit trail

## Running Speculos

```bash
# Production stack (sandbox profile)
docker compose --profile sandbox up speculos

# Development
docker compose -f deploy/docker-compose.dev.yml up speculos
```

## Dependencies

- `@ledgerhq/device-management-kit`
- `@ledgerhq/device-signer-kit-ethereum`
- `@ledgerhq/device-transport-kit-node-hid`
- `@ledgerhq/device-transport-kit-speculos`
- `rxjs`
