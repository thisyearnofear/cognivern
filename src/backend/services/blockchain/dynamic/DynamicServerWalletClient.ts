/**
 * Dynamic server-wallet client — the only Cognivern boundary that touches
 * `@dynamic-labs-wallet/node-evm`.
 *
 * Pattern: backend-owned MPC server wallets (API token auth). Cognivern keeps
 * policy / CRE; Dynamic holds key shares (backUpToDynamic).
 *
 * @see https://www.dynamic.xyz/docs/overview/agents/overview
 * @see https://www.dynamic.xyz/docs/node/wallets/server-wallets/overview
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import type { Account, Chain, Transport, WalletClient } from "viem";
import { defineChain } from "viem";
import { executionRails } from "@backend/shared/config/index.js";
import { executionRailIdForChainId } from "@cognivern/shared";

export type DynamicWalletMetadata = Record<string, unknown> & {
  accountAddress?: string;
};

export interface DynamicProvisionResult {
  accountAddress: string;
  walletMetadata: DynamicWalletMetadata;
  metadataPath?: string;
}

type DynamicEvmClient = {
  authenticateApiToken: (token: string) => Promise<void>;
  createWalletAccount: (args: {
    thresholdSignatureScheme: string;
    password?: string;
    backUpToDynamic?: boolean;
    onError?: (error: Error) => void;
  }) => Promise<{
    walletMetadata: DynamicWalletMetadata;
    externalServerKeyShares: unknown[];
  }>;
  getWalletClient: (args: {
    walletMetadata: DynamicWalletMetadata;
    password?: string;
    chain?: Chain;
    chainId?: number;
    rpcUrl?: string;
  }) => Promise<WalletClient<Transport, Chain, Account>>;
  signMessage: (args: {
    message: string;
    walletMetadata: DynamicWalletMetadata;
    password?: string;
  }) => Promise<`0x${string}`>;
};

let cachedClient: DynamicEvmClient | null = null;
let authenticated = false;

function envFlag(value: string | undefined): boolean {
  return (value || "").toLowerCase() === "true";
}

export function isDynamicConfigured(): boolean {
  return (
    envFlag(process.env.DYNAMIC_ENABLED) &&
    Boolean(process.env.DYNAMIC_ENVIRONMENT_ID?.trim()) &&
    Boolean(process.env.DYNAMIC_API_TOKEN?.trim())
  );
}

export function defaultDynamicAccountAddress(): string | undefined {
  const fromEnv = process.env.DYNAMIC_SERVER_WALLET_ADDRESS?.trim();
  return fromEnv || undefined;
}

export function defaultDynamicWalletPassword(): string | undefined {
  const password = process.env.DYNAMIC_WALLET_PASSWORD?.trim();
  return password || undefined;
}

function defaultMetadataPath(): string {
  return (
    process.env.DYNAMIC_WALLET_METADATA_PATH?.trim() ||
    path.resolve(process.cwd(), ".cognivern/dynamic-server-wallet.json")
  );
}

export async function loadDynamicWalletMetadata(
  explicit?: DynamicWalletMetadata | null,
): Promise<DynamicWalletMetadata | null> {
  if (explicit && typeof explicit === "object") {
    return explicit;
  }

  const inline = process.env.DYNAMIC_WALLET_METADATA_JSON?.trim();
  if (inline) {
    try {
      return JSON.parse(inline) as DynamicWalletMetadata;
    } catch {
      throw new Error(
        "DYNAMIC_WALLET_METADATA_JSON is set but is not valid JSON",
      );
    }
  }

  const metadataPath = defaultMetadataPath();
  try {
    const raw = await fs.readFile(metadataPath, "utf8");
    return JSON.parse(raw) as DynamicWalletMetadata;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function persistDynamicWalletMetadata(
  walletMetadata: DynamicWalletMetadata,
  metadataPath = defaultMetadataPath(),
): Promise<string> {
  await fs.mkdir(path.dirname(metadataPath), { recursive: true });
  await fs.writeFile(
    metadataPath,
    `${JSON.stringify(walletMetadata, null, 2)}\n`,
    "utf8",
  );
  return metadataPath;
}

async function loadSdk(): Promise<{
  DynamicEvmWalletClient: new (args: {
    environmentId: string;
  }) => DynamicEvmClient;
  ThresholdSignatureScheme: { TWO_OF_TWO: string };
}> {
  // Dynamic's package typings don't surface named exports under NodeNext
  // `import` resolution; runtime ESM exports are correct.
  const [evmMod, nodeMod] = await Promise.all([
    import("@dynamic-labs-wallet/node-evm") as Promise<
      Record<string, unknown>
    >,
    import("@dynamic-labs-wallet/node") as Promise<Record<string, unknown>>,
  ]);
  const DynamicEvmWalletClient = evmMod.DynamicEvmWalletClient;
  const ThresholdSignatureScheme = nodeMod.ThresholdSignatureScheme;
  if (typeof DynamicEvmWalletClient !== "function") {
    throw new Error(
      "@dynamic-labs-wallet/node-evm did not export DynamicEvmWalletClient",
    );
  }
  if (
    !ThresholdSignatureScheme ||
    typeof ThresholdSignatureScheme !== "object"
  ) {
    throw new Error(
      "@dynamic-labs-wallet/node did not export ThresholdSignatureScheme",
    );
  }
  return {
    DynamicEvmWalletClient: DynamicEvmWalletClient as new (args: {
      environmentId: string;
    }) => DynamicEvmClient,
    ThresholdSignatureScheme: ThresholdSignatureScheme as {
      TWO_OF_TWO: string;
    },
  };
}

export async function getAuthenticatedDynamicClient(): Promise<DynamicEvmClient> {
  if (!isDynamicConfigured()) {
    throw new Error(
      "Dynamic is not configured. Set DYNAMIC_ENABLED=true, DYNAMIC_ENVIRONMENT_ID, and DYNAMIC_API_TOKEN.",
    );
  }

  if (cachedClient && authenticated) {
    return cachedClient;
  }

  const { DynamicEvmWalletClient } = await loadSdk();
  const client = new DynamicEvmWalletClient({
    environmentId: process.env.DYNAMIC_ENVIRONMENT_ID!.trim(),
  });
  await client.authenticateApiToken(process.env.DYNAMIC_API_TOKEN!.trim());
  cachedClient = client;
  authenticated = true;
  return client;
}

/** Test hook — clear memoized client between unit tests. */
export function resetDynamicClientCache(): void {
  cachedClient = null;
  authenticated = false;
}

export async function provisionDynamicServerWallet(opts?: {
  password?: string;
  metadataPath?: string;
}): Promise<DynamicProvisionResult> {
  const { ThresholdSignatureScheme } = await loadSdk();
  const client = await getAuthenticatedDynamicClient();
  const password = opts?.password ?? defaultDynamicWalletPassword();
  if (!password) {
    throw new Error(
      "DYNAMIC_WALLET_PASSWORD is required when provisioning with backUpToDynamic.",
    );
  }

  const created = await client.createWalletAccount({
    thresholdSignatureScheme: ThresholdSignatureScheme.TWO_OF_TWO,
    password,
    backUpToDynamic: true,
    onError: (error) => {
      console.error("[dynamic] createWalletAccount error", error);
    },
  });

  const accountAddress =
    typeof created.walletMetadata.accountAddress === "string"
      ? created.walletMetadata.accountAddress
      : "";
  if (!accountAddress) {
    throw new Error("Dynamic createWalletAccount did not return accountAddress");
  }

  const metadataPath = await persistDynamicWalletMetadata(
    created.walletMetadata,
    opts?.metadataPath,
  );

  return {
    accountAddress,
    walletMetadata: created.walletMetadata,
    metadataPath,
  };
}

function resolveChainConfig(chainId: number): { chainId: number; rpcUrl: string; railId: string } {
  const rail = executionRails.resolve(chainId);
  return {
    chainId: rail.chainId || chainId,
    rpcUrl: rail.rpcUrl,
    railId: rail.railId || executionRailIdForChainId(chainId),
  };
}

function buildViemChain(chainId: number, rpcUrl: string): Chain {
  return defineChain({
    id: chainId,
    name: `cognivern-${chainId}`,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: {
      default: { http: [rpcUrl] },
    },
  });
}

export async function getDynamicWalletClient(opts: {
  walletMetadata?: DynamicWalletMetadata | null;
  accountAddress?: string;
  chainId: number;
  password?: string;
}): Promise<{
  walletClient: WalletClient<Transport, Chain, Account>;
  accountAddress: string;
  railId: string;
  chainId: number;
  rpcUrl: string;
}> {
  const client = await getAuthenticatedDynamicClient();
  const walletMetadata = await loadDynamicWalletMetadata(opts.walletMetadata);
  if (!walletMetadata) {
    throw new Error(
      "No Dynamic walletMetadata found. Run the provision script or set DYNAMIC_WALLET_METADATA_PATH / wallet metadata.dynamicWalletMetadata.",
    );
  }

  const accountAddress =
    opts.accountAddress ||
    (typeof walletMetadata.accountAddress === "string"
      ? walletMetadata.accountAddress
      : "") ||
    defaultDynamicAccountAddress() ||
    "";
  if (!accountAddress) {
    throw new Error("Dynamic account address is missing from wallet metadata");
  }

  const { chainId, rpcUrl, railId } = resolveChainConfig(opts.chainId);
  const password = opts.password ?? defaultDynamicWalletPassword();
  const chain = buildViemChain(chainId, rpcUrl);

  const walletClient = await client.getWalletClient({
    walletMetadata,
    password,
    chain,
    chainId,
    rpcUrl,
  });

  return { walletClient, accountAddress, railId, chainId, rpcUrl };
}

export async function signDynamicMessage(opts: {
  message: string;
  walletMetadata?: DynamicWalletMetadata | null;
  password?: string;
}): Promise<{ signature: string; signer: string }> {
  const client = await getAuthenticatedDynamicClient();
  const walletMetadata = await loadDynamicWalletMetadata(opts.walletMetadata);
  if (!walletMetadata) {
    throw new Error(
      "No Dynamic walletMetadata found for signing. Provision a server wallet first.",
    );
  }
  const signer =
    (typeof walletMetadata.accountAddress === "string"
      ? walletMetadata.accountAddress
      : "") ||
    defaultDynamicAccountAddress() ||
    "";
  if (!signer) {
    throw new Error("Dynamic account address missing for signMessage");
  }

  const signature = await client.signMessage({
    message: opts.message,
    walletMetadata,
    password: opts.password ?? defaultDynamicWalletPassword(),
  });

  return { signature, signer };
}
