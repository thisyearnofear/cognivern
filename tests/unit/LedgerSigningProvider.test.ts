import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Ledger signing path via the speculos transport.
 *
 * No physical device is available in CI, so the Device Management Kit and the
 * Ethereum signer are mocked at the import boundary. A fake (speculos-style)
 * transport factory is injected via the constructor — the same seam production
 * code uses for the emulated transport. The DMK/signer observables are faked
 * with plain subscribe-able objects (no rxjs import needed inside the hoisted
 * mock factory) that immediately emit a `completed` state with the output.
 */

const captured = vi.hoisted(() => ({
  signPath: undefined as string | undefined,
  addressPath: undefined as string | undefined,
}));

// A minimal subscribe-able that emits one `next` on a microtask (after the
// caller's `const sub = obs.subscribe(...)` assignment completes), then
// resolves — matching what awaitDeviceAction resolves on (status 'completed').
// Deferring avoids the TDZ on the caller's `sub.unsubscribe()` reference.
function fakeObservable(output: unknown) {
  return {
    subscribe(handlers: { next?: (v: unknown) => void; error?: (e: unknown) => void }) {
      const sub = { unsubscribed: false, unsubscribe() { this.unsubscribed = true; } };
      queueMicrotask(() => {
        if (!sub.unsubscribed) handlers.next?.({ status: 'completed', output });
      });
      return sub;
    },
  };
}

vi.mock('@ledgerhq/device-management-kit', () => ({
  DeviceManagementKitBuilder: vi.fn().mockImplementation(function () {
    return {
      addTransport: vi.fn().mockReturnThis(),
      build: vi.fn().mockReturnValue({
        startDiscovering: () => fakeObservable({ id: 'speculos-1', name: 'Speculos' }),
        connect: vi.fn().mockResolvedValue('session-1'),
      }),
    };
  }),
}));

vi.mock('@ledgerhq/device-signer-kit-ethereum', () => ({
  SignerEthBuilder: vi.fn().mockImplementation(function () {
    return {
      build: () => ({
        signMessage: (derivationPath: string, _message: string) => {
          captured.signPath = derivationPath;
          return { observable: fakeObservable({ r: 'a'.repeat(64), s: 'b'.repeat(64), v: 0 }) };
        },
        getAddress: (derivationPath: string) => {
          captured.addressPath = derivationPath;
          return { observable: fakeObservable({ address: '0xSignerAddress' }) };
        },
      }),
    };
  }),
}));

const fakeSpeculosTransport = { type: 'speculos' } as unknown;

describe('LedgerSigningProvider (speculos transport)', () => {
  beforeEach(() => {
    captured.signPath = undefined;
    captured.addressPath = undefined;
    vi.clearAllMocks();
  });

  it('returns a 65-byte serialized signature and the device signer address', async () => {
    const { LedgerSigningProvider } = await import(
      '../../src/backend/signing/LedgerSigningProvider.js'
    );
    const provider = new LedgerSigningProvider(
      fakeSpeculosTransport as never,
    );

    const result = await provider.sign({
      walletId: 'w1',
      message: 'sign this spend',
      derivationPath: "m/44'/60'/0'/0/0",
    });

    // r (32) + s (32) + v (1) = 65 bytes => 0x + 130 hex chars.
    expect(result.signature).toMatch(/^0x[0-9a-f]{130}$/);
    expect(result.signer).toBe('0xSignerAddress');
  });

  it('forwards the configured derivation path to the device signer', async () => {
    const { LedgerSigningProvider } = await import(
      '../../src/backend/signing/LedgerSigningProvider.js'
    );
    const provider = new LedgerSigningProvider(
      fakeSpeculosTransport as never,
    );

    await provider.sign({
      walletId: 'w1',
      message: 'msg',
      derivationPath: "m/44'/60'/1'/0/0",
    });

    expect(captured.signPath).toBe("m/44'/60'/1'/0/0");
    expect(captured.addressPath).toBe("m/44'/60'/1'/0/0");
  });

  it('falls back to the default BIP-44 path when none is supplied', async () => {
    const { LedgerSigningProvider } = await import(
      '../../src/backend/signing/LedgerSigningProvider.js'
    );
    const provider = new LedgerSigningProvider(
      fakeSpeculosTransport as never,
    );

    await provider.sign({ walletId: 'w1', message: 'msg' });

    expect(captured.signPath).toBe("m/44'/60'/0'/0/0");
    expect(captured.addressPath).toBe("m/44'/60'/0'/0/0");
  });
});
