# Ledger Integration Plan

## Why

Cognivern governs agent wallet activity. The last mile — signing — is currently software-only (encrypted local key or HTTP remote). Adding Ledger as a signing path closes the trust gap: policy says "approved," hardware ensures "only the human with the device can sign." This is the difference between *governance* and *guardianship*.

Speculos fills the other gap: today, sandbox mode returns demo data but doesn't simulate signing. With Speculos, CI and development can run full governance→signing→audit cycles with hardware-accurate signatures but zero asset risk.

## Core Principles Alignment

| Principle | How this plan honors it |
|---|---|
| **ENHANCEMENT FIRST** | Zero new services. The existing `handleApprove()` dispatch (OwsWalletService:272) is enhanced from a binary check to a provider switch. The existing `signWithExternalWallet()` (OwsLocalVaultService:591) handles Speculos via HTTP — no new transport code. |
| **CONSOLIDATION** | The old `externalSource` truthiness check is replaced by a structured `signingProvider` enum. One code path eliminated, one added. |
| **PREVENT BLOAT** | Only one new file (`LedgerSigningProvider.ts`). The Speculos path uses zero new files — it's a config change + Docker Compose entry. |
| **DRY** | The `signingProvider` field on `OwsWalletDescriptor.metadata` becomes the single source of truth for signing strategy. No more scattered `if (metadata.externalSource)` checks. |
| **CLEAN** | Provider dispatch is a single `switch` in `handleApprove()`. Each provider is an independent module with no knowledge of other providers. |
| **MODULAR** | `SigningProvider` interface is a 3-method contract. New providers (e.g., Trezor, AWS KMS) add one file each — zero changes to existing providers. |
| **PERFORMANT** | Ledger provider loads DMK lazily (only when a ledger-type wallet is used). Speculos path is just HTTP — no new dependencies. |
| **ORGANIZED** | Provider files live in `src/backend/signing/` — a new domain directory alongside `services/`, `cre/`, etc. No sprawl. |

## Status

| Phase | Status |
|---|---|
| Phase 1 — Signing Provider Dispatch | ✅ Done |
| Phase 2 — LedgerSigningProvider | ✅ Done |
| Phase 3 — Speculos Sandbox | ✅ Done |
| Phase 4 — Frontend: Hardware Signed Badge | ✅ Done |
| Phase 5 — AGENTS.md | ✅ Done |

## Phases

### Phase 1 — Signing Provider Dispatch ✅

**What changed:** `handleApprove()` dispatch refactored from binary `if (externalSource)` to explicit `switch (signingProvider)`.

**Files touched:**
- `src/backend/services/OwsWalletService.ts` — lines 272-333 now switch on `wallet.metadata.signingProvider`
- `src/backend/signing/SigningProvider.ts` — new interface (created in Phase 1, used in Phase 2)

**Before / After:**

```typescript
// Before: binary externalSource check
if (access.wallet.metadata?.externalSource) { ... }
else { ... }

// After: provider switch
switch (signingProvider) {
  case "ledger":     → LedgerSigningProvider (real DMK, catches errors → hold)
  case "speculos":   → OwsLocalVaultService.signWithExternalWallet()
  case "ows_remote": → OwsLocalVaultService.signWithExternalWallet()
  default:           → OwsLocalVaultService.signMessage()
}
```

**Verification:**
- TypeScript compiles cleanly
- Backend builds cleanly
- `SpendController.integration.test.ts` — 2/2 passed
- Wallet with `signingProvider: "ledger"` returns `held` with DMK error message

---

### Phase 2 — LedgerSigningProvider ✅

**What changed:** Full DMK-based signing provider, loaded lazily with automatic transport fallback.

**New files:**
- `src/backend/signing/SigningProvider.ts` — `SigningProvider` interface (`name`, `sign()`)
- `src/backend/signing/LedgerSigningProvider.ts` — DMK-based implementation

**`LedgerSigningProvider` details:**

| Concern | Implementation |
|---|---|
| **DMK init** | Lazy — built on first `sign()` call via `DeviceManagementKitBuilder` |
| **Transport** | Dynamic import: tries `node-hid` (USB), falls back to `speculos` (emulated), throws if neither available |
| **Device discovery** | `dmk.startDiscovering({})` → `firstValueFrom()` with 15s timeout |
| **Device connection** | `dmk.connect({ device })` → `DeviceSessionId`, cached for reuse |
| **Message signing** | `SignerEthBuilder.build().signMessage(derivationPath, message)` via EIP-191 |
| **Address derivation** | `signer.getAddress(derivationPath)` for the `signer` field in `SigningResult` |
| **Signature format** | Combines `r`, `s` (strip `0x`), `v` (add 27 if < 27) → standard 65-byte hex string |
| **Error handling** | All device action errors → caught by caller → returned as `held` with descriptive message |
| **Observable → Promise** | Custom `awaitDeviceAction()` helper subscribes, waits for `Completed`/`Error`/`Stopped` |

**Dependencies added:**
- `@ledgerhq/device-management-kit@1.6.0`
- `@ledgerhq/device-signer-kit-ethereum@1.16.0`
- `@ledgerhq/device-transport-kit-node-hid@1.0.1`
- `@ledgerhq/device-transport-kit-speculos@1.2.1`
- `rxjs` (for Observable → Promise conversion)

**Verification:**
- TypeScript compiles cleanly
- Backend builds cleanly
- Tests pass
- Provider loading is lazy (node-hid module only imported when a `"ledger"` wallet is used)
- Transport fallback works: node-hid → speculos → descriptive error

---

### Phase 3 — Speculos Sandbox ✅

**What changed:** Docker Compose Speculos service + backward-compatible dispatch inference.

**Modified files:**
- `deploy/docker-compose.yml` — `speculos` service with `profiles: ["sandbox"]` (not in default stack)
- `deploy/docker-compose.dev.yml` — development override with Speculos always available
- `src/backend/services/OwsWalletService.ts` — dispatch now falls back `externalSource` → `"ows_remote"` automatically

**Docker Compose (production):** `docker compose --profile sandbox up speculos`
**Docker Compose (dev):** `docker compose -f deploy/docker-compose.dev.yml up speculos`

**Backend dispatch fallback:** The `handleApprove()` provider resolution now infers `"ows_remote"` when `externalSource` is set without `signingProvider`. This means:
- Old wallets with `externalSource` → `"ows_remote"` → `signWithExternalWallet()` (backward compat)
- New wallets with `signingProvider: "speculos"` → `"speculos"` → `signWithExternalWallet()` (explicit)
- New wallets with `signingProvider: "ledger"` → `"ledger"` → `LedgerSigningProvider`

**Alignment with principles:**
- ENHANCEMENT FIRST: Zero new service code. The existing `signWithExternalWallet()` handles Speculos HTTP transport.
- PERFORMANT: Speculos runs only when explicitly started (sandbox profile).

---

### Phase 4 — Frontend: Hardware Signed Badge ✅

**What changed:** Audit entries from Ledger-signed transactions show a blue "Hardware" badge with fingerprint icon.

**Files touched:**
- `packages/shared/src/types/index.ts` — added `signingProvider` and `walletAddress` to shared `AuditLog`
- `src/backend/services/AuditLogService.ts` — added `signingProvider` to backend `AuditLog`; `mapCreRunToAuditLog` extracts it from the `attestation_result` artifact
- `src/backend/services/OwsWalletService.ts` — `handleApprove` now includes `signingProvider` in the artifact data
- `src/frontend/src/components/audit/audit-page.tsx` — added `hasLedgerSigning()` detector + blue "Hardware" badge

**Badge rendering:** Follows the exact same pattern as FHE (amber) and ChainGPT (purple) badges — inline `<span>` with the `Fingerprint` lucide icon. Blue color scheme differentiates it.

**Data flow:** signingProvider is written into the CRE artifact at signing time → extracted by `AuditLogService` → included in API response → detected by `hasLedgerSigning()` in the frontend.

**Alignment with principles:**
- ENHANCEMENT FIRST: No new components. The badge is a conditional render in the existing `AuditLogRow`.
- DRY: The `signingProvider` field on the audit record is the single source of truth.

---

### Phase 5 — AGENTS.md ✅

**What changed:** Agent instructions for the signing provider layer, modeled on Ledger's own `agent-skills` repo.

**New files:**
- `src/backend/signing/AGENTS.md` — documents the `SigningProvider` interface, provider table, how to add new providers, `LedgerSigningProvider` internals, and credo

**This mirrors Ledger's `LedgerHQ/agent-skills` pattern:** markdown files that teach coding agents the conventions, constraints, and API contracts for a specific subsystem. If an agent is asked "add Trezor support", "fix Ledger timeout", or "what signing providers exist", the AGENTS.md provides the answer without needing to infer from code.

## Total Surface Area

| Metric | Value |
|---|---|
| New files | 4 (`SigningProvider.ts`, `LedgerSigningProvider.ts`, `deploy/docker-compose.dev.yml`, `src/backend/signing/AGENTS.md`) |
| Modified files | 7 (`OwsWalletService.ts`, `ARCHITECTURE.md`, `AuditLogService.ts`, `deploy/docker-compose.yml`, `packages/shared/types/index.ts`, `audit-page.tsx`, `docs/LEDGER_INTEGRATION.md`) |
| Deleted files | 0 |
| New dependencies | 5 (`@ledgerhq/device-management-kit`, `@ledgerhq/device-signer-kit-ethereum`, `@ledgerhq/device-transport-kit-node-hid`, `@ledgerhq/device-transport-kit-speculos`, `rxjs`) |
| New Docker services | 1 (Speculos, sandbox profile only) |

## What This Enables That Doesn't Exist Today

| Capability | Before | After |
|---|---|---|
| Hardware-gated signing | No — all signing is software keys | High-value tx require physical device confirmation via DMK |
| CI signing tests | No — sandbox mode returns demo data, no actual signing | Full governance→signing→audit cycles with Speculos (`docker compose --profile sandbox up`) |
| Signing provider abstraction | Binary: local key or HTTP remote | Extensible dispatch via `SigningProvider` interface: local / Ledger DMK / Speculos / OWS Remote |
| Audit differentiation | All signatures look identical | Ledger-signed tx carry blue "Hardware" badge with fingerprint icon |
| Agent capability awareness | AGENTS.md covers only Next.js conventions | `src/backend/signing/AGENTS.md` documents the entire `SigningProvider` contract |

## Non-Goals

- **Clear Signing integration** — Phase 2 uses `signMessage` (EIP-191 personal_sign). Clear Signing (human-readable tx data on device screen via `signTransaction`) is a natural follow-on but requires EIP-712 typed data encoding and is not needed for the initial integration.
- **Stax/Flex touchscreen UX** — The DMK SDK supports all models. Phase 2 works with any Ledger device. Model-specific UX (e.g., EIP-712 on Stax) is future work.
- **Multi-signer orchestration** — No plans to combine multiple Ledger devices (multisig) or route some signatures to Ledger and others to local keys within a single transaction. The provider is per-wallet.
- **Trezor / AWS KMS / other hardware** — The `SigningProvider` interface is designed for these, but the plan intentionally stops at Ledger to avoid scope creep.
