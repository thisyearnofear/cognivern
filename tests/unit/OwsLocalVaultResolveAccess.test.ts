import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Regression coverage for the /api/spend auth-bypass fix.
 *
 * resolveAccess() must be fail-closed: a wallet is only resolved when a valid
 * scoped OWS API key authorizes it. Previously the method fell open when the
 * vault held zero API keys (signing with the bootstrap/treasury wallet for any
 * unauthenticated caller) or when a bare walletId was supplied. Those branches
 * were removed. This test exercises the real (unmocked) vault end-to-end.
 */

// A deterministic throwaway key — never used outside this isolated vault.
const TEST_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

let tmpDir: string;
let vaultPath: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ows-vault-test-"));
  vaultPath = path.join(tmpDir, "ows-vault.json");
  process.env.OWS_VAULT_PATH = vaultPath;
  process.env.OWS_VAULT_SECRET = "test-vault-secret-resolve-access";
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.OWS_VAULT_PATH;
  delete process.env.OWS_VAULT_SECRET;
});

async function freshVault() {
  // Constructor reads OWS_VAULT_PATH at instantiation, so import then build.
  const { OwsLocalVaultService } = await import(
    "../../src/backend/services/OwsLocalVaultService.js"
  );
  // Start each case from an empty vault file.
  fs.writeFileSync(
    vaultPath,
    JSON.stringify({ version: 1, wallets: [], apiKeys: [], agents: [] }),
  );
  return new OwsLocalVaultService();
}

describe("OwsLocalVaultService.resolveAccess — fail-closed", () => {
  it("returns null when the vault has zero wallets", async () => {
    const vault = await freshVault();
    const access = await vault.resolveAccess({});
    expect(access).toBeNull();
  });

  it("returns null with a wallet present but no token and zero API keys", async () => {
    const vault = await freshVault();
    await vault.importWallet({
      name: "Treasury",
      privateKey: TEST_PRIVATE_KEY,
    });

    // The previously-vulnerable case (a): unauthenticated caller, empty key set.
    const access = await vault.resolveAccess({});
    expect(access).toBeNull();
  });

  it("returns null when a walletId is supplied but no valid token", async () => {
    const vault = await freshVault();
    const wallet = await vault.importWallet({
      name: "Treasury",
      privateKey: TEST_PRIVATE_KEY,
    });

    // The previously-vulnerable case (b): bare walletId, no key.
    const access = await vault.resolveAccess({ walletId: wallet.id });
    expect(access).toBeNull();
  });

  it("returns null for an unknown/bogus token", async () => {
    const vault = await freshVault();
    await vault.importWallet({
      name: "Treasury",
      privateKey: TEST_PRIVATE_KEY,
    });

    const access = await vault.resolveAccess({
      apiKeyToken: "ows_not_a_real_token",
    });
    expect(access).toBeNull();
  });

  it("resolves access for a valid token scoped to the wallet", async () => {
    const vault = await freshVault();
    const wallet = await vault.importWallet({
      name: "Treasury",
      privateKey: TEST_PRIVATE_KEY,
    });
    const { token } = await vault.createApiKey({
      name: "scoped-key",
      walletIds: [wallet.id],
      policyIds: [],
    });

    const access = await vault.resolveAccess({ apiKeyToken: token });
    expect(access).not.toBeNull();
    expect(access?.wallet.id).toBe(wallet.id);
    expect(access?.apiKey).toBeDefined();
  });

  it("returns null when a valid key is scoped to a different wallet", async () => {
    const vault = await freshVault();
    const walletA = await vault.importWallet({
      name: "Treasury A",
      privateKey: TEST_PRIVATE_KEY,
    });
    const walletB = await vault.importWallet({
      name: "Treasury B",
      privateKey:
        "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
    });
    // Key authorizes only wallet B.
    const { token } = await vault.createApiKey({
      name: "scoped-to-b",
      walletIds: [walletB.id],
      policyIds: [],
    });

    // Requesting wallet A with B's key must not resolve.
    const access = await vault.resolveAccess({
      walletId: walletA.id,
      apiKeyToken: token,
    });
    expect(access).toBeNull();
  });
});
