import { Logger } from "../shared/logging/Logger.js";
import { ethers } from "ethers";

const logger = new Logger("HyperlaneRelayer");

export class HyperlaneRelayerService {
  private xLayerProvider: ethers.JsonRpcProvider;
  private xLayerWallet: ethers.Wallet;
  private governanceContractAddress: string;

  constructor(
    xLayerRpcUrl: string,
    privateKey: string,
    governanceContractAddress: string
  ) {
    this.xLayerProvider = new ethers.JsonRpcProvider(xLayerRpcUrl);
    this.xLayerWallet = new ethers.Wallet(privateKey, this.xLayerProvider);
    this.governanceContractAddress = governanceContractAddress;
  }

  /**
   * Simulates the Hyperlane Relayer picking up a message from the Fhenix Mailbox
   * and delivering it to the X Layer GovernanceContract.
   *
   * @param originDomain The Hyperlane domain ID for Fhenix
   * @param senderAddress The address of the ConfidentialSpendPolicy on Fhenix
   * @param payload The encoded decision payload (decisionId, agentId, policyId, outcome)
   */
  async relayMessage(originDomain: number, senderAddress: string, payload: string): Promise<string> {
    logger.info(`Relaying message from domain ${originDomain} to X Layer GovernanceContract`);

    // The ABI for the IMessageRecipient handle method
    const abi = [
      "function handle(uint32 _origin, bytes32 _sender, bytes calldata _message) external payable"
    ];

    const governanceContract = new ethers.Contract(
      this.governanceContractAddress,
      abi,
      this.xLayerWallet
    );

    try {
      // Hyperlane senders are typically represented as bytes32, so we pad the EVM address
      const paddedSender = ethers.zeroPadValue(senderAddress, 32);

      // Call handle() on the X Layer Governance Contract
      const tx = await governanceContract.handle(
        originDomain,
        paddedSender,
        payload
      );

      logger.info(`Relay transaction submitted: ${tx.hash}`);

      const receipt = await tx.wait();
      logger.info(`Relay transaction confirmed in block ${receipt.blockNumber}`);

      return tx.hash;
    } catch (error) {
      logger.error("Failed to relay message to X Layer", error);
      throw error;
    }
  }
}
