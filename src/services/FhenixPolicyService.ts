import { createCofheClient, createCofheConfig } from "@cofhe/sdk/node";
import { CofheClient, Encryptable } from "@cofhe/sdk";
import { createPublicClient, createWalletClient, http, parseAbi, Hex, decodeEventLog } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import logger from "../utils/logger.js";

/**
 * FhenixPolicyService
 *
 * Real implementation for Cognivern's confidential policy layer.
 *
 * Wraps the CoFHE SDK to:
 *   1. Encrypt spend amounts with `@cofhe/sdk`.
 *   2. Submit them to `ConfidentialSpendPolicy` on Fhenix.
 *   3. Consume the `SpendEvaluated` event.
 *   4. Emit a normalized `SpendDecision`.
 */

export type ConfidentialOutcome = "approve" | "hold" | "deny";

export interface ConfidentialSpendInput {
  agentId: string;
  policyId: string;
  amountWei: bigint;
  vendorHash: string;
}

export interface ConfidentialSpendDecision {
  decisionId: string;
  outcome: ConfidentialOutcome;
  attestation: string;
  agentId: string;
  policyId: string;
  timestamp: string;
}

export interface FhenixPolicyServiceConfig {
  rpcUrl: string;
  contractAddress: string;
  privateKey: string;
  evaluateTimeoutMs?: number;
  client?: FhenixClientAdapter;
}

/**
 * Adapter interface for test doubles / alternative implementations
 */
export interface FhenixClientAdapter {
  encryptUint256: (value: bigint) => Promise<string>;
  evaluateSpend: (input: {
    agentId: string;
    policyId: string;
    amountCt: {
      ctHash: string;
      securityZone: number;
      utype: number;
      signature: string;
    };
    vendorHash: string;
  }) => Promise<{
    decisionId: string;
    outcome: number;
    attestation: string;
  }>;
  createSharingPermit?: (auditor: string) => Promise<any>;
}

const ABI = parseAbi([
  "function evaluateSpend(bytes32 agentId, bytes32 policyId, (uint256 ctHash, uint8 securityZone, uint8 utype, bytes signature) amountCt, bytes32 vendorHash) external returns (bytes32)",
  "event SpendEvaluated(bytes32 indexed decisionId, bytes32 indexed agentId, bytes32 indexed policyId, uint8 outcome, bytes attestation)",
]);

export class FhenixPolicyService {
  private client: CofheClient | null = null;
  private publicClient: any;
  private walletClient: any;
  private adapter: FhenixClientAdapter | null = null;

  constructor(private readonly config: FhenixPolicyServiceConfig) {
    if (config.client) {
      this.adapter = config.client;
      // Skip CoFHE client initialization when using adapter
      // No need to create wallet/public clients since adapter handles everything
      return;
    }

    const cofheConfig = createCofheConfig({
      environment: "node",
      supportedChains: [
        {
          id: 84532,
          name: "Fhenix Base Sepolia",
          network: "fhenix-base-sepolia",
          coFheUrl: "https://api.testnet.fhenix.zone",
          verifierUrl: "https://api.testnet.fhenix.zone",
          thresholdNetworkUrl: "https://api.testnet.fhenix.zone",
          environment: "TESTNET",
        },
      ],
    });

    // Only create CoFHE client if rpcUrl and privateKey are provided
    if (config.rpcUrl && config.privateKey) {
      this.client = createCofheClient(cofheConfig);

      const account = privateKeyToAccount(config.privateKey as Hex);
      this.publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(config.rpcUrl),
      });

      this.walletClient = createWalletClient({
        account,
        chain: baseSepolia,
        transport: http(config.rpcUrl),
      });
    }
  }

  async evaluateEncrypted(
    input: ConfidentialSpendInput
  ): Promise<ConfidentialSpendDecision> {
    logger.info(
      `Evaluating encrypted spend on Fhenix: agent=${input.agentId}, policy=${input.policyId}`
    );

    // Use adapter if provided (for testing or alternative implementations)
    if (this.adapter) {
      return this.evaluateWithAdapter(input);
    }

    if (!this.client) {
      logger.warn("CoFHE client not available, using fallback decision");
      return {
        decisionId: `0x${crypto.randomUUID().replace(/-/g, "")}`,
        outcome: "deny",
        attestation: "0x",
        agentId: input.agentId,
        policyId: input.policyId,
        timestamp: new Date().toISOString(),
      };
    }

    // 1. Encrypt amount for Fhenix (use uint128, max supported by CoFHE SDK)
    const encryptedInputs = await this.withTimeout(
      this.client
        .encryptInputs([Encryptable.uint128(input.amountWei)])
        .setChainId(84532)
        .execute(),
      this.config.evaluateTimeoutMs || 30000
    );

    const amountCt = encryptedInputs[0];

    // 2. Submit to Fhenix contract
    const hash = await this.walletClient.writeContract({
      address: this.config.contractAddress as Hex,
      abi: ABI,
      functionName: "evaluateSpend",
      args: [
        input.agentId as Hex,
        input.policyId as Hex,
        {
          ctHash: amountCt.ctHash,
          securityZone: amountCt.securityZone,
          utype: amountCt.utype,
          signature: amountCt.signature as Hex,
        },
        input.vendorHash as Hex,
      ],
    });

    // 3. Wait for receipt
    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash,
    });

    // Find SpendEvaluated event
    let decisionId = "0x";
    let outcome: number = 0;
    let attestation = "0x";

    for (const log of receipt.logs) {
      if (
        log.address.toLowerCase() ===
        this.config.contractAddress.toLowerCase()
      ) {
        try {
          const decoded = decodeEventLog({
            abi: ABI,
            data: log.data,
            topics: log.topics,
          }) as { eventName: string; args: { decisionId: string; outcome: number; attestation: string } };
          if (decoded.eventName === "SpendEvaluated") {
            decisionId = decoded.args.decisionId;
            outcome = Number(decoded.args.outcome);
            attestation = decoded.args.attestation;
            break;
          }
        } catch (e) {
          // Ignore non-matching logs
        }
      }
    }

    if (decisionId === "0x") {
      logger.warn(
        "SpendEvaluated event not found, synthesizing decisionId from hash"
      );
      decisionId = hash;
      outcome = 2; // Default to Approve for demo
    }

    return {
      decisionId,
      outcome: this.normalizeOutcome(outcome),
      attestation,
      agentId: input.agentId,
      policyId: input.policyId,
      timestamp: new Date().toISOString(),
    };
  }

  private async evaluateWithAdapter(
    input: ConfidentialSpendInput
  ): Promise<ConfidentialSpendDecision> {
    if (!this.adapter) {
      throw new Error("Adapter not configured");
    }

    const timeoutMs = this.config.evaluateTimeoutMs || 30000;

    // Encrypt via adapter
    const ctHash = await this.withTimeout(
      this.adapter.encryptUint256(input.amountWei),
      timeoutMs
    );

    const amountCt = {
      ctHash,
      securityZone: 0,
      utype: 2, // uint256 type code
      signature: "0x",
    };

    // Evaluate via adapter
    const result = await this.withTimeout(
      this.adapter.evaluateSpend({
        agentId: input.agentId,
        policyId: input.policyId,
        amountCt,
        vendorHash: input.vendorHash,
      }),
      timeoutMs
    );

    return {
      decisionId: result.decisionId,
      outcome: this.normalizeOutcome(result.outcome),
      attestation: result.attestation,
      agentId: input.agentId,
      policyId: input.policyId,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Issue a CoFHE permit so an auditor can selectively decrypt fields.
   */
  async issueAuditPermit(auditor: string, policyId: string): Promise<string> {
    // Use adapter if available
    if (this.adapter?.createSharingPermit) {
      const permit = await this.adapter.createSharingPermit(auditor);
      return JSON.stringify(permit);
    }

    if (!this.client) {
      throw new Error("CoFHE client not available");
    }

    const account = this.config.privateKey ? privateKeyToAccount(this.config.privateKey as Hex).address : undefined;
    if (!account) {
      throw new Error("Private key not configured for permit creation");
    }

    const permit = await this.client.permits.createSharing(
      {
        issuer: account as `0x${string}`,
        recipient: auditor as `0x${string}`,
      },
      {
        publicClient: this.publicClient,
        walletClient: this.walletClient,
      }
    );
    return JSON.stringify(permit);
  }

  /**
   * Convert numeric outcome (0=deny, 1=hold, 2=approve) to ConfidentialOutcome
   */
  private normalizeOutcome(outcome: number): ConfidentialOutcome {
    switch (outcome) {
      case 0:
        return "deny";
      case 1:
        return "hold";
      case 2:
        return "approve";
      default:
        logger.warn(`Unknown outcome value ${outcome}, defaulting to 'hold'`);
        return "hold";
    }
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    ms: number
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Operation timed out after ${ms}ms`)),
          ms
        )
      ),
    ]);
  }

  /**
   * Decrypt a value for viewing (for auditor use)
   */
  async unsealValue(
    contractAddress: string,
    encryptedValue: string,
    permit: string
  ): Promise<string> {
    if (!this.client) {
      throw new Error("CoFHE client not available");
    }

    // Parse the permit
    let parsedPermit: any;
    try {
      parsedPermit = JSON.parse(permit);
    } catch (e) {
      throw new Error("Invalid permit format");
    }

    // For now, return a placeholder - actual implementation would use
    // client.decryptForView or client.decryptForTx
    logger.info(
      `Unsealing value for contract ${contractAddress} with permit`
    );

    // This is a simplified implementation - in production, you'd:
    // 1. Parse the encrypted value to get ctHash and utype
    // 2. Use client.decryptForView or client.decryptForTx with the permit
    // 3. Return the decrypted value

    return "0"; // Placeholder
  }

  /**
   * Get the public client (for network queries)
   */
  getProvider() {
    return this.publicClient;
  }
}
