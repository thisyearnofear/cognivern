import { Logger } from "../shared/logging/Logger.js";
import { ethers } from "ethers";

const logger = new Logger("HyperlaneRelayer");

export interface RelayDestination {
  rpcUrl: string;
  privateKey: string;
  contractAddress: string;
  name: string;
}

export class HyperlaneRelayerService {
  private destinations: Map<
    string,
    { wallet: ethers.Wallet; contractAddress: string; name: string }
  > = new Map();

  constructor(destinations: Record<string, RelayDestination>) {
    for (const [key, dest] of Object.entries(destinations)) {
      const provider = new ethers.JsonRpcProvider(dest.rpcUrl);
      const wallet = new ethers.Wallet(dest.privateKey, provider);
      this.destinations.set(key, {
        wallet,
        contractAddress: dest.contractAddress,
        name: dest.name,
      });
    }
  }

  /**
   * Relay a Hyperlane message from Fhenix to a destination chain.
   *
   * @param destination Key identifying the target chain ("xlayer" | "mantle")
   * @param originDomain The Hyperlane domain ID for Fhenix
   * @param senderAddress The address of the ConfidentialSpendPolicy on Fhenix
   * @param payload The encoded decision payload
   */
  async relayMessage(
    destination: string,
    originDomain: number,
    senderAddress: string,
    payload: string,
  ): Promise<string> {
    const dest = this.destinations.get(destination);
    if (!dest) {
      throw new Error(`Unknown relay destination: ${destination}`);
    }

    logger.info(`Relaying message from domain ${originDomain} to ${dest.name}`);

    const abi = [
      "function handle(uint32 _origin, bytes32 _sender, bytes calldata _message) external payable",
    ];

    const contract = new ethers.Contract(
      dest.contractAddress,
      abi,
      dest.wallet,
    );

    try {
      const paddedSender = ethers.zeroPadValue(senderAddress, 32);

      const tx = await contract.handle(originDomain, paddedSender, payload);
      logger.info(`Relay tx submitted to ${dest.name}: ${tx.hash}`);

      const receipt = await tx.wait();
      logger.info(
        `Relay tx confirmed on ${dest.name} in block ${receipt.blockNumber}`,
      );

      return tx.hash;
    } catch (error) {
      logger.error(`Failed to relay message to ${dest.name}`, error);
      throw error;
    }
  }

  /**
   * Legacy single-destination relay (backwards-compatible).
   */
  async relayToXLayer(
    originDomain: number,
    senderAddress: string,
    payload: string,
  ): Promise<string> {
    return this.relayMessage("xlayer", originDomain, senderAddress, payload);
  }

  async relayToMantle(
    originDomain: number,
    senderAddress: string,
    payload: string,
  ): Promise<string> {
    return this.relayMessage("mantle", originDomain, senderAddress, payload);
  }
}
