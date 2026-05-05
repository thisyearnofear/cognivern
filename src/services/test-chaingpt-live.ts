/**
 * ChainGPT API - Live Test
 * Tests the real ChainGPT API with the provided key
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load .env file from project root
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", "..", ".env");
dotenv.config({ path: envPath });

const API_KEY = process.env.CHAINGPT_API_KEY;
const BASE_URL = "https://api.chaingpt.org";

async function testChainGPTAPI() {
  console.log("🔑 Testing ChainGPT API with live key\n");
  console.log(`API Key: ${API_KEY ? API_KEY.substring(0, 8) + "..." : "NOT SET"}\n`);

  if (!API_KEY) {
    console.error("❌ CHAINGPT_API_KEY not found in .env");
    process.exit(1);
  }

  // Test 1: Smart Contract Auditor API (streaming)
  console.log("Test 1: ChainGPT Smart Contract Auditor API (Streaming)");
  try {
    const response = await fetch(`${BASE_URL}/chat/stream`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "smart_contract_auditor",
        question: `Audit the following contract for vulnerabilities:
pragma solidity ^0.8.0;
contract SimpleVault {
    mapping(address => uint256) public balances;

    function deposit() public payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw(uint256 amount) public {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
        balances[msg.sender] -= amount;
    }
}`,
        chatHistory: "off"
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`  ❌ Failed: ${response.status} - ${errorText}`);
    } else {
      console.log("  ✓ Auditor API responding (streaming)");

      // Read streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let totalChunks = 0;
      let fullResponse = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          fullResponse += chunk;
          totalChunks++;

          // Print first few chunks to show progress
          if (totalChunks <= 3) {
            console.log(`  Chunk ${totalChunks}: ${chunk.substring(0, 100)}...`);
          }
        }

        console.log(`  ✓ Received ${totalChunks} chunks`);
        console.log(`  Response length: ${fullResponse.length} characters`);
        console.log(`  Preview: ${fullResponse.substring(0, 200)}...`);
      }
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`);
  }

  // Test 2: Check credits/balance
  console.log("\nTest 2: Check Account Credits");
  try {
    const response = await fetch(`${BASE_URL}/chat/chatHistory?limit=1`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`  ❌ Failed: ${response.status} - ${errorText}`);
    } else {
      const data = await response.json();
      console.log("  ✓ API key is valid");
      console.log(`  History entries: ${data.data?.rows?.length || 0}`);
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`);
  }

  console.log("\n✅ API key test complete!");
}

testChainGPTAPI().catch(console.error);
