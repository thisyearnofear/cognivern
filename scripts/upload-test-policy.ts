import { RecallClient } from '@recallnet/sdk/client';
import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { testnet } from '@recallnet/chains';
import { RecallService } from '../src/services/RecallService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
config();

async function uploadTestPolicy() {
  try {
    // Initialize wallet client
    const privateKey = `0x${process.env.RECALL_PRIVATE_KEY}` as `0x${string}`;
    const walletClient = createWalletClient({
      account: privateKeyToAccount(privateKey),
      chain: testnet,
      transport: http(),
    });

    // Initialize Recall client
    const recall = new RecallClient({ walletClient });
    const bucketAddress = process.env.RECALL_BUCKET_ADDRESS as `0x${string}`;

    // Create RecallService instance
    const recallService = new RecallService(recall, bucketAddress);

    // Read the test policy file
    const policyPath = path.join(__dirname, '..', 'src', 'policies', 'test-policy.json');
    const policyContent = fs.readFileSync(policyPath, 'utf-8');
    const policy = JSON.parse(policyContent);

    // Upload to Recall bucket
    console.log('Uploading test policy to Recall bucket...');
    await recallService.storeObject('policies', 'test-policy', policy);
    console.log('Test policy uploaded successfully!');

    // Verify the upload
    console.log('Verifying upload...');
    const result = await recallService.getObject('policies', 'test-policy');
    if (result) {
      console.log('Policy verified in bucket:', result);
    }
  } catch (error) {
    console.error('Error uploading test policy:', error);
    process.exit(1);
  }
}

uploadTestPolicy();
