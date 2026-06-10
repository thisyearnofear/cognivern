<!-- BEGIN:signing-provider-rules -->

# Signing Provider Abstraction

The signing layer is swappable via `SigningProvider` interface. Dispatch happens in `OwsWalletService.handleApprove()` based on `wallet.metadata.signingProvider`.

## Interface

```typescript
interface SigningProvider {
  name: string;
  sign(params: { walletId: string; message: string; derivationPath?: string }): Promise<{ signature: string; signer: string }>;
}
```

## Providers

| signingProvider | Implementation | Use Case |
|---|---|---|
| `"local"` (default) | `OwsLocalVaultService.signMessage()` — decrypted local key | Dev, low-value |
| `"ledger"` | `LedgerSigningProvider` — DMK via USB | Production high-value, hardware-gated |
| `"speculos"` | `OwsLocalVaultService.signWithExternalWallet()` → HTTP | Sandbox/CI, no hardware |
| `"ows_remote"` | `OwsLocalVaultService.signWithExternalWallet()` → HTTP | Multi-instance, remote signing |

## Adding a New Provider

1. Create a file in `src/backend/signing/` that implements `SigningProvider`
2. Add a `case` to the `switch` in `OwsWalletService.handleApprove()`
3. Update the `signingProvider` union type in the backend's `AuditLog` interface
4. Add an entry to the provider table in `docs/ARCHITECTURE.md#5-signing-provider-abstraction`

## LedgerSigningProvider Internals

- DMK is built lazily on first `sign()` call — no cost until a Ledger wallet is used
- Transport is loaded via dynamic `import()` — tries `node-hid` (USB), falls back to `speculos` (emulated)
- Device discovery has a 15-second timeout
- Device session is cached after `connect()` for reuse
- Message signing uses EIP-191 (personal_sign) via `SignerEth`
- Signature `{ r, s, v }` is combined into standard 65-byte hex string

## Credo

- If you need to adjust the timeout, change `DISCOVERY_TIMEOUT_MS` in `LedgerSigningProvider.ts`
- If adding a new chain signer (e.g. Solana, Bitcoin), add the corresponding `@ledgerhq/device-signer-kit-*` package
- The signing provider is per-wallet — different wallets can use different providers
- Do NOT import node-hid statically — it requires native USB libraries and breaks in serverless

<!-- END:signing-provider-rules -->
