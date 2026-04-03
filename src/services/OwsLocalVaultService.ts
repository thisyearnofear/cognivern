import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { ethers } from "ethers";

export interface OwsAccountDescriptor {
  accountId: string;
  address: string;
  derivationPath: string;
  chainId: string;
}

export interface OwsWalletDescriptor {
  id: string;
  name: string;
  createdAt: string;
  chainType: string;
  accounts: OwsAccountDescriptor[];
  metadata: Record<string, unknown>;
}

interface OwsStoredWallet extends OwsWalletDescriptor {
  encryptedPrivateKey: string;
  iv: string;
  authTag: string;
}

export interface OwsApiKeyRecord {
  id: string;
  name: string;
  tokenHash: string;
  createdAt: string;
  walletIds: string[];
  policyIds: string[];
  expiresAt?: string;
  metadata?: Record<string, unknown>;
  permissions?: OwsPermission[];
}

export interface OwsPermission {
  id: string;
  parentCapability: string;
  invoker: string;
  caveats: OwsCaveat[];
}

export interface OwsCaveat {
  type: string;
  value: unknown;
}

interface OwsVaultData {
  version: 1;
  wallets: OwsStoredWallet[];
  apiKeys: OwsApiKeyRecord[];
}

export interface OwsResolvedAccess {
  wallet: OwsWalletDescriptor;
  apiKey?: OwsApiKeyRecord;
}

function nowIso() {
  return new Date().toISOString();
}

export class OwsLocalVaultService {
  private vaultPath: string;
  private encryptionSecret: string;

  constructor() {
    this.vaultPath =
      process.env.OWS_VAULT_PATH ||
      path.join(process.cwd(), ".cognivern", "ows-vault.json");
    this.encryptionSecret =
      process.env.OWS_VAULT_SECRET ||
      process.env.OWS_API_KEY ||
      process.env.API_KEY ||
      "development-ows-vault-secret";
  }

  async getStatus() {
    const vault = this.readVault();
    return {
      provider: "OWS Local Vault",
      vaultPath: this.vaultPath,
      walletCount: vault.wallets.length,
      apiKeyCount: vault.apiKeys.length,
      wallets: vault.wallets.map((wallet) => this.toDescriptor(wallet)),
      bootstrappedFromEnv: vault.wallets.some(
        (wallet) => wallet.metadata?.bootstrapSource === "env",
      ),
    };
  }

  async listWallets(): Promise<OwsWalletDescriptor[]> {
    const vault = this.readVault();
    return vault.wallets.map((wallet) => this.toDescriptor(wallet));
  }

  async listApiKeys(): Promise<Array<Omit<OwsApiKeyRecord, "tokenHash">>> {
    const vault = this.readVault();
    return vault.apiKeys.map(({ tokenHash, ...rest }) => rest);
  }

  async ensureBootstrapWallet(): Promise<OwsWalletDescriptor | null> {
    const vault = this.readVault();
    if (vault.wallets.length > 0) {
      return this.toDescriptor(vault.wallets[0]);
    }

    const bootstrapPrivateKey =
      process.env.OWS_BOOTSTRAP_PRIVATE_KEY || process.env.FILECOIN_PRIVATE_KEY;
    if (!bootstrapPrivateKey) {
      return null;
    }

    return this.importWallet({
      name: "Cognivern Treasury",
      privateKey: bootstrapPrivateKey,
      chainId: "eip155:314159",
      chainType: "evm",
      derivationPath: "m/44'/60'/0'/0/0",
      metadata: {
        bootstrapSource: "env",
      },
    });
  }

  async importWallet(params: {
    name: string;
    privateKey: string;
    chainId?: string;
    chainType?: string;
    derivationPath?: string;
    metadata?: Record<string, unknown>;
  }): Promise<OwsWalletDescriptor> {
    const vault = this.readVault();

    // Validate private key format before creating wallet
    const hexPrefix = "0x";
    let privateKey = params.privateKey.startsWith(hexPrefix)
      ? params.privateKey
      : hexPrefix + params.privateKey;
    if (privateKey.length !== 66 || !privateKey.startsWith(hexPrefix)) {
      throw new Error(
        "Invalid private key format: must be 32 bytes (66 chars with 0x prefix)",
      );
    }

    const wallet = new ethers.Wallet(privateKey);
    const chainId = params.chainId || "eip155:314159";
    const walletId = crypto.randomUUID();
    const encrypted = this.encryptPrivateKey(privateKey);

    const storedWallet: OwsStoredWallet = {
      id: walletId,
      name: params.name,
      createdAt: nowIso(),
      chainType: params.chainType || "evm",
      accounts: [
        {
          accountId: `${chainId}:${wallet.address}`,
          address: wallet.address,
          derivationPath: params.derivationPath || "m/44'/60'/0'/0/0",
          chainId,
        },
      ],
      metadata: params.metadata || {},
      ...encrypted,
    };

    vault.wallets.push(storedWallet);
    this.writeVault(vault);
    return this.toDescriptor(storedWallet);
  }

  async createApiKey(params: {
    name: string;
    walletIds: string[];
    policyIds: string[];
    expiresAt?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ apiKey: Omit<OwsApiKeyRecord, "tokenHash">; token: string }> {
    const vault = this.readVault();
    const token = `ows_${crypto.randomBytes(24).toString("hex")}`;
    const record: OwsApiKeyRecord = {
      id: crypto.randomUUID(),
      name: params.name,
      tokenHash: this.hashToken(token),
      createdAt: nowIso(),
      walletIds: params.walletIds,
      policyIds: params.policyIds,
      expiresAt: params.expiresAt,
      metadata: params.metadata,
    };

    vault.apiKeys.push(record);
    this.writeVault(vault);

    const { tokenHash, ...apiKey } = record;
    return { apiKey, token };
  }

  async validateApiKey(token?: string | null): Promise<OwsApiKeyRecord | null> {
    if (!token) {
      return null;
    }

    const vault = this.readVault();
    const tokenHash = this.hashToken(token);
    const apiKey =
      vault.apiKeys.find((candidate) => candidate.tokenHash === tokenHash) ||
      null;

    if (!apiKey) {
      return null;
    }

    if (
      apiKey.expiresAt &&
      new Date(apiKey.expiresAt).getTime() <= Date.now()
    ) {
      return null;
    }

    return apiKey;
  }

  async resolveAccess(params: {
    walletId?: string;
    apiKeyToken?: string | null;
  }): Promise<OwsResolvedAccess | null> {
    await this.ensureBootstrapWallet();
    const vault = this.readVault();
    if (vault.wallets.length === 0) {
      return null;
    }

    const apiKey = await this.validateApiKey(params.apiKeyToken);
    let wallet: OwsStoredWallet | undefined;

    if (apiKey) {
      const allowedWalletIds = new Set(apiKey.walletIds);
      wallet = vault.wallets.find((candidate) =>
        params.walletId
          ? candidate.id === params.walletId &&
            allowedWalletIds.has(candidate.id)
          : allowedWalletIds.has(candidate.id),
      );
      if (!wallet) {
        return null;
      }
    } else if (vault.apiKeys.length > 0) {
      return null;
    } else if (params.walletId) {
      wallet = vault.wallets.find(
        (candidate) => candidate.id === params.walletId,
      );
    } else {
      wallet = vault.wallets[0];
    }

    if (!wallet) {
      return null;
    }

    return {
      wallet: this.toDescriptor(wallet),
      apiKey: apiKey || undefined,
    };
  }

  async signMessage(params: {
    walletId: string;
    message: string;
    apiKeyToken?: string | null;
  }): Promise<{ signature: string; signer: string }> {
    const access = await this.resolveAccess({
      walletId: params.walletId,
      apiKeyToken: params.apiKeyToken,
    });
    if (!access) {
      throw new Error("Wallet access not authorized");
    }

    const vault = this.readVault();
    const storedWallet = vault.wallets.find(
      (wallet) => wallet.id === access.wallet.id,
    );
    if (!storedWallet) {
      throw new Error("Wallet not found");
    }

    const wallet = new ethers.Wallet(this.decryptPrivateKey(storedWallet));
    const signature = await wallet.signMessage(params.message);
    return { signature, signer: wallet.address };
  }

  private readVault(): OwsVaultData {
    this.ensureVaultFile();
    const raw = fs.readFileSync(this.vaultPath, "utf8");
    return JSON.parse(raw) as OwsVaultData;
  }

  private writeVault(vault: OwsVaultData) {
    this.ensureVaultFile();
    fs.writeFileSync(this.vaultPath, JSON.stringify(vault, null, 2));
  }

  private ensureVaultFile() {
    const dir = path.dirname(this.vaultPath);
    fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(this.vaultPath)) {
      const emptyVault: OwsVaultData = {
        version: 1,
        wallets: [],
        apiKeys: [],
      };
      fs.writeFileSync(this.vaultPath, JSON.stringify(emptyVault, null, 2));
    }
  }

  private encryptPrivateKey(privateKey: string) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", this.deriveKey(), iv);
    const encrypted = Buffer.concat([
      cipher.update(privateKey, "utf8"),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return {
      encryptedPrivateKey: encrypted.toString("base64"),
      iv: iv.toString("base64"),
      authTag: authTag.toString("base64"),
    };
  }

  private decryptPrivateKey(wallet: OwsStoredWallet) {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      this.deriveKey(),
      Buffer.from(wallet.iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(wallet.authTag, "base64"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(wallet.encryptedPrivateKey, "base64")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  }

  private deriveKey() {
    return crypto.scryptSync(this.encryptionSecret, "cognivern-ows-v1", 32);
  }

  private hashToken(token: string) {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  private toDescriptor(wallet: OwsStoredWallet): OwsWalletDescriptor {
    return {
      id: wallet.id,
      name: wallet.name,
      createdAt: wallet.createdAt,
      chainType: wallet.chainType,
      accounts: wallet.accounts,
      metadata: wallet.metadata,
    };
  }

  async requestPermissions(params: {
    walletId: string;
    invoker: string;
    permissions: Array<{
      type: string;
      value?: unknown;
    }>;
  }): Promise<OwsPermission[]> {
    const vault = this.readVault();
    const wallet = vault.wallets.find((w) => w.id === params.walletId);
    if (!wallet) {
      throw new Error("Wallet not found");
    }

    const permissions: OwsPermission[] = params.permissions.map((perm) => ({
      id: crypto.randomUUID(),
      parentCapability: perm.type,
      invoker: params.invoker,
      caveats: perm.value ? [{ type: perm.type, value: perm.value }] : [],
    }));

    const existingKey = vault.apiKeys.find(
      (k) =>
        k.metadata?.invoker === params.invoker &&
        k.walletIds.includes(params.walletId),
    );
    if (existingKey) {
      existingKey.permissions = permissions;
      existingKey.metadata = {
        ...existingKey.metadata,
        lastPermissionRequest: nowIso(),
      };
    } else {
      const token = `ows_${crypto.randomBytes(24).toString("hex")}`;
      vault.apiKeys.push({
        id: crypto.randomUUID(),
        name: `Permission-based key for ${params.invoker}`,
        tokenHash: this.hashToken(token),
        createdAt: nowIso(),
        walletIds: [params.walletId],
        policyIds: [],
        metadata: {
          invoker: params.invoker,
          permissions,
        },
        permissions,
      });
    }

    this.writeVault(vault);
    return permissions;
  }

  async getPermissions(walletId: string): Promise<OwsPermission[]> {
    const vault = this.readVault();
    const apiKeys = vault.apiKeys.filter((k) => k.walletIds.includes(walletId));
    const allPermissions: OwsPermission[] = [];
    for (const key of apiKeys) {
      if (key.permissions) {
        allPermissions.push(...key.permissions);
      }
    }
    return allPermissions;
  }
}

export const owsLocalVaultService = new OwsLocalVaultService();
