import {
  type OwsWalletSigningConfig,
  type WalletSigningProviderId,
  DEFAULT_LEDGER_DERIVATION_PATH,
} from '@cognivern/shared';

export { DEFAULT_LEDGER_DERIVATION_PATH };

/**
 * Typed view of the signing-related fields that live on a wallet's free-form
 * `metadata` bag. This is the single place that interprets the raw metadata
 * `Record<string, unknown>` into a typed signing config, so the spend flow and
 * the resume flow agree on provider / derivation-path resolution.
 *
 * Resolution rules (mirrors the original inline logic in handleApprove):
 *  - `signingProvider` wins; if absent, `externalSource` implies `ows_remote`,
 *    otherwise the default is `local`.
 *  - `ledgerDerivationPath` wins for the Ledger provider; absent falls back to
 *    the BIP-44 default `m/44'/60'/0'/0/0`.
 *
 * Ledger is one *option*; wallets without it keep the default `local` provider
 * — signing is never a prerequisite for using Cognivern.
 */
export interface ResolvedSigningConfig {
  signingProvider: WalletSigningProviderId;
  ledgerDerivationPath?: string;
  externalSource?: string;
}

function isWalletSigningProviderId(v: unknown): v is WalletSigningProviderId {
  return (
    typeof v === 'string' &&
    (v === 'local' || v === 'speculos' || v === 'ledger' || v === 'ows_remote')
  );
}

export function resolveWalletSigningConfig(
  metadata: Record<string, unknown> | undefined,
): ResolvedSigningConfig {
  const raw = (metadata ?? {}) as Record<string, unknown>;
  const explicit = raw.signingProvider;
  const signingProvider: WalletSigningProviderId = isWalletSigningProviderId(explicit)
    ? explicit
    : typeof raw.externalSource === 'string' && raw.externalSource
      ? 'ows_remote'
      : 'local';

  const ledgerDerivationPath =
    typeof raw.ledgerDerivationPath === 'string' && raw.ledgerDerivationPath
      ? raw.ledgerDerivationPath
      : signingProvider === 'ledger'
        ? DEFAULT_LEDGER_DERIVATION_PATH
        : undefined;

  const externalSource =
    typeof raw.externalSource === 'string' ? raw.externalSource : undefined;

  return { signingProvider, ledgerDerivationPath, externalSource };
}

/** Re-export the typed metadata view for handlers that read/write the bag. */
export type { OwsWalletSigningConfig };
