import { describe, it, expect } from 'vitest';
import { resolveWalletSigningConfig } from '@backend/services/blockchain/walletSigningConfig.js';
import { DEFAULT_LEDGER_DERIVATION_PATH } from '@cognivern/shared';

/**
 * The signing-config resolver is the typed boundary over the free-form wallet
 * metadata bag. It must default to "local" (Ledger is an option, never a
 * requirement), forward a Ledger derivation path, and treat an externalSource
 * as the "ows_remote" provider.
 */
describe('resolveWalletSigningConfig', () => {
  it('defaults to the local provider when nothing is configured', () => {
    const cfg = resolveWalletSigningConfig(undefined);
    expect(cfg.signingProvider).toBe('local');
    expect(cfg.ledgerDerivationPath).toBeUndefined();
    expect(cfg.externalSource).toBeUndefined();
  });

  it('defaults to local for an empty metadata bag', () => {
    expect(resolveWalletSigningConfig({}).signingProvider).toBe('local');
  });

  it('uses an explicit signingProvider', () => {
    expect(resolveWalletSigningConfig({ signingProvider: 'ledger' }).signingProvider).toBe('ledger');
    expect(resolveWalletSigningConfig({ signingProvider: 'speculos' }).signingProvider).toBe('speculos');
    expect(resolveWalletSigningConfig({ signingProvider: 'ows_remote' }).signingProvider).toBe('ows_remote');
  });

  it('ignores an unknown signingProvider and falls back to local', () => {
    expect(resolveWalletSigningConfig({ signingProvider: 'trezor' }).signingProvider).toBe('local');
  });

  it('implies ows_remote from an externalSource when no explicit provider', () => {
    const cfg = resolveWalletSigningConfig({ externalSource: 'http://speculos:5000' });
    expect(cfg.signingProvider).toBe('ows_remote');
    expect(cfg.externalSource).toBe('http://speculos:5000');
  });

  it('uses an explicit signingProvider over the externalSource implication', () => {
    const cfg = resolveWalletSigningConfig({
      signingProvider: 'ledger',
      externalSource: 'http://speculos:5000',
    });
    expect(cfg.signingProvider).toBe('ledger');
  });

  it('falls back to the default BIP-44 path for the Ledger provider', () => {
    const cfg = resolveWalletSigningConfig({ signingProvider: 'ledger' });
    expect(cfg.ledgerDerivationPath).toBe(DEFAULT_LEDGER_DERIVATION_PATH);
    expect(cfg.ledgerDerivationPath).toBe("m/44'/60'/0'/0/0");
  });

  it('uses a configured ledgerDerivationPath override', () => {
    const cfg = resolveWalletSigningConfig({
      signingProvider: 'ledger',
      ledgerDerivationPath: "m/44'/60'/1'/0/0",
    });
    expect(cfg.ledgerDerivationPath).toBe("m/44'/60'/1'/0/0");
  });

  it('does not attach a derivation path for non-ledger providers', () => {
    expect(resolveWalletSigningConfig({ signingProvider: 'local' }).ledgerDerivationPath).toBeUndefined();
    expect(resolveWalletSigningConfig({ signingProvider: 'speculos' }).ledgerDerivationPath).toBeUndefined();
  });
});
