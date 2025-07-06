import { RecallClient } from "@recallnet/sdk/client";
import { config } from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { testnet } from "@recallnet/chains";
import { RecallService } from "../src/services/RecallService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
config();

async function uploadTestPolicy() {
  try {
    // Initialize wallet client
    const privateKeyRaw = process.env.RECALL_PRIVATE_KEY;
    if (!privateKeyRaw) {
      throw new Error("RECALL_PRIVATE_KEY not found in environment variables");
    }

    // Remove 0x prefix for viem (it expects raw hex)
    const privateKey = privateKeyRaw.startsWith("0x")
      ? privateKeyRaw.slice(2)
      : privateKeyRaw;

    const walletClient = createWalletClient({
      account: privateKeyToAccount(`0x${privateKey}` as `0x${string}`),
      chain: testnet,
      transport: http(),
    });

    // Initialize Recall client
    const recall = new RecallClient({ walletClient });
    const bucketAddress = process.env.RECALL_BUCKET_ADDRESS as `0x${string}`;

    // Create RecallService instance
    const recallService = new RecallService(recall, bucketAddress);

    // Read the test policy file
    const testPolicyPath = path.join(
      __dirname,
      "..",
      "src",
      "policies",
      "test-policy.json"
    );
    const testPolicyContent = fs.readFileSync(testPolicyPath, "utf-8");
    const testPolicy = JSON.parse(testPolicyContent);

    // Read the trading competition policy file
    const tradingPolicyPath = path.join(
      __dirname,
      "..",
      "src",
      "policies",
      "trading-competition-policy.json"
    );
    const tradingPolicyContent = fs.readFileSync(tradingPolicyPath, "utf-8");
    const tradingPolicy = JSON.parse(tradingPolicyContent);

    // Upload test policy to Recall bucket
    console.log("Uploading test policy to Recall bucket...");
    await recallService.storeObject("policies", "test-policy", testPolicy);
    console.log("Test policy uploaded successfully!");

    // Upload trading competition policy to Recall bucket
    console.log("Uploading trading competition policy to Recall bucket...");
    await recallService.storeObject(
      "policies",
      "trading-competition-policy",
      tradingPolicy
    );
    console.log("Trading competition policy uploaded successfully!");

    // Verify the uploads
    console.log("Verifying uploads...");
    const testResult = await recallService.getObject("policies", "test-policy");
    const tradingResult = await recallService.getObject(
      "policies",
      "trading-competition-policy"
    );
    if (testResult) {
      console.log("Test policy verified in bucket");
    }
    if (tradingResult) {
      console.log("Trading competition policy verified in bucket");
    }
  } catch (error) {
    console.error("Error uploading test policy:", error);
    process.exit(1);
  }
}

uploadTestPolicy();
