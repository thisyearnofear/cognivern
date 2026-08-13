import crypto from "node:crypto";
import { Indexer, MemData } from "@0gfoundation/0g-storage-ts-sdk";
import { ethers } from "ethers";

const STAGING_CONFIRMATION = "staging";
const TESTNET_INDEXER_RE =
  /^https:\/\/indexer-storage-testnet-(?:turbo|standard)\.0g\.ai\/?$/;
const TESTNET_RPC_RE = /^https:\/\/evmrpc-testnet\.0g\.ai\/?$/;

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function sha256(value: Uint8Array): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function writeOutputIfRequested(
  result: Record<string, unknown>,
): Promise<void> {
  const outputPath = process.env.ZEROG_ROUNDTRIP_OUTPUT_PATH;
  if (!outputPath) return;

  // Importing fs only when explicitly requested keeps the default verification
  // path side-effect free apart from the testnet storage upload itself.
  const { writeFile } = await import("node:fs/promises");
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV !== "staging") {
    throw new Error('Refusing to run unless NODE_ENV="staging"');
  }
  if (process.env.ZEROG_ROUNDTRIP_CONFIRM !== STAGING_CONFIRMATION) {
    throw new Error(
      'Refusing to run without ZEROG_ROUNDTRIP_CONFIRM="staging"',
    );
  }

  const indexerUrl =
    process.env.ZEROG_INDEXER_URL ||
    "https://indexer-storage-testnet-turbo.0g.ai";
  const rpcUrl = process.env.ZEROG_RPC_URL || "https://evmrpc-testnet.0g.ai";
  if (!TESTNET_INDEXER_RE.test(indexerUrl)) {
    throw new Error(`Refusing non-Galileo indexer URL: ${indexerUrl}`);
  }
  if (!TESTNET_RPC_RE.test(rpcUrl)) {
    throw new Error(`Refusing non-Galileo RPC URL: ${rpcUrl}`);
  }

  const privateKey = required("ZEROG_PRIVATE_KEY");
  const chainId = Number(process.env.ZEROG_CHAIN_ID || "16602");
  if (chainId !== 16602) {
    throw new Error(`Refusing unexpected 0G testnet chain ID: ${chainId}`);
  }

  const payload = new TextEncoder().encode(
    JSON.stringify({
      purpose: "cognivern-staging-roundtrip",
      nonce: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    }),
  );
  const expectedHash = sha256(payload);
  const provider = new ethers.JsonRpcProvider(rpcUrl, chainId);
  const signer = new ethers.Wallet(privateKey, provider);
  const indexer = new Indexer(indexerUrl);
  const file = new MemData(payload);

  console.log(
    JSON.stringify(
      {
        stage: "upload",
        network: "0g-galileo-testnet",
        chainId,
        indexerUrl,
        byteLength: payload.byteLength,
        expectedHash,
      },
      null,
      2,
    ),
  );

  const [upload, uploadError] = await indexer.upload(
    file,
    rpcUrl,
    signer as unknown as Parameters<Indexer["upload"]>[2],
    { expectedReplica: 1 },
  );
  if (uploadError) throw uploadError;

  const rootHash = "rootHash" in upload ? upload.rootHash : upload.rootHashes[0];
  const txHash = "txHash" in upload ? upload.txHash : upload.txHashes[0];
  if (!rootHash) throw new Error("0G SDK upload returned no root hash");

  const [downloaded, downloadError] = await indexer.downloadToBlob(rootHash, {
    proof: true,
  });
  if (downloadError) throw downloadError;

  const downloadedBytes = new Uint8Array(await downloaded.arrayBuffer());
  const actualHash = sha256(downloadedBytes);
  const result = {
    verified: actualHash === expectedHash,
    network: "0g-galileo-testnet",
    chainId,
    indexerUrl,
    rootHash,
    txHash,
    byteLength: downloadedBytes.byteLength,
    expectedHash,
    actualHash,
    verifiedAt: new Date().toISOString(),
  };
  await writeOutputIfRequested(result);
  console.log(JSON.stringify(result, null, 2));

  if (!result.verified) {
    throw new Error(
      `0G round-trip hash mismatch: expected ${expectedHash}, got ${actualHash}`,
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
