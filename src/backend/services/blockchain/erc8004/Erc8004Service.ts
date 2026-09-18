/**
 * ERC-8004 (Trustless Agents) identity + reputation rail on Monad.
 *
 * Registers cognivern OWS agents in the on-chain IdentityRegistry (an
 * ERC-721: the agent's vault wallet owns its identity NFT), serves their
 * registration files, and publishes outcomes to the ReputationRegistry so
 * each agent accrues a portable, verifiable track record.
 *
 * Feature-flagged via ERC8004_ENABLED. Registry addresses resolve per-chain
 * from config (mainnet 143 / testnet 10143 defaults baked in). When the flag
 * is off, write paths fail closed and reads still work.
 */

import { ethers } from "ethers";
import { erc8004Config } from "@backend/shared/config/index.js";
import { logger } from "@backend/shared/logging/Logger.js";
import {
  owsLocalVaultService,
  type OwsAgentRecord,
  type OwsLocalVaultService,
} from "../OwsLocalVaultService.js";

const IDENTITY_REGISTRY_ABI = [
  "function register() returns (uint256)",
  "function register(string agentURI) returns (uint256)",
  "function setAgentURI(uint256 agentId, string newURI)",
  "function getAgentWallet(uint256 agentId) view returns (address)",
  "function getMetadata(uint256 agentId, string metadataKey) view returns (bytes)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "event Registered(uint256 indexed agentId, string agentURI, address indexed owner)",
];

const REPUTATION_REGISTRY_ABI = [
  "function giveFeedback(uint256 agentId, int128 value, uint8 valueDecimals, string tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash)",
  "function revokeFeedback(uint256 agentId, uint64 feedbackIndex)",
  "function getSummary(uint256 agentId, address[] clientAddresses, string tag1, string tag2) view returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals)",
  "function getClients(uint256 agentId) view returns (address[])",
  "function getLastIndex(uint256 agentId, address clientAddress) view returns (uint64)",
  "function readFeedback(uint256 agentId, address clientAddress, uint64 feedbackIndex) view returns (int128 value, uint8 valueDecimals, string tag1, string tag2, bool isRevoked)",
  "event NewFeedback(uint256 indexed agentId, address indexed clientAddress, uint64 feedbackIndex, int128 value, uint8 valueDecimals, string indexed indexedTag1, string tag1, string tag2, string endpoint, string feedbackURI, bytes32 feedbackHash)",
];

/** On-chain binding persisted under OwsAgentRecord.metadata.erc8004. */
export interface Erc8004Binding {
  chainId: number;
  agentRegistry: string;
  identityRegistry: string;
  /** Registry-minted uint256 agentId, decimal string. */
  agentId: string;
  owner: string;
  agentURI: string;
  registerTxHash: string;
  setUriTxHash?: string;
  registeredAt: string;
}

export interface Erc8004Identity {
  agentId: string;
  owner: string;
  agentURI: string;
  agentWallet: string;
}

export interface Erc8004FeedbackResult {
  txHash: string;
  clientAddress: string;
  feedbackIndex?: string;
  transactionLink: string;
}

export type Erc8004Error = { error: string };

function provider() {
  return new ethers.JsonRpcProvider(erc8004Config.rpcUrl, erc8004Config.chainId);
}

export class Erc8004Service {
  constructor(
    private readonly vault: OwsLocalVaultService = owsLocalVaultService,
  ) {}

  status() {
    return {
      enabled: erc8004Config.enabled,
      chainId: erc8004Config.chainId,
      rpcUrl: erc8004Config.rpcUrl,
      identityRegistry: erc8004Config.identityRegistry,
      reputationRegistry: erc8004Config.reputationRegistry,
      agentRegistry: erc8004Config.agentRegistryRef,
      publicBaseUrl: erc8004Config.publicBaseUrl || null,
    };
  }

  /** The agent's stored on-chain binding, if it has registered. */
  bindingFor(agent: OwsAgentRecord): Erc8004Binding | undefined {
    const raw = agent.metadata?.erc8004;
    return raw && typeof raw === "object"
      ? (raw as Erc8004Binding)
      : undefined;
  }

  /**
   * ERC-8004 registration file for an agent. `agentId`/`registrations` are
   * only populated once the on-chain binding exists — pre-registration
   * callers get the same shape with an empty registrations list.
   */
  buildRegistrationFile(params: {
    agent: OwsAgentRecord;
    binding?: Erc8004Binding;
    baseUrl?: string;
  }): Record<string, unknown> {
    const { agent, binding } = params;
    const baseUrl = (params.baseUrl ?? erc8004Config.publicBaseUrl).replace(
      /\/+$/,
      "",
    );

    const services: Array<Record<string, unknown>> = [];
    if (baseUrl) {
      services.push({ name: "web", endpoint: `${baseUrl}/` });
      services.push({
        name: "cognivern",
        endpoint: `${baseUrl}/erc8004/agents/${agent.id}/card`,
        version: "v1",
      });
    }
    if (agent.walletId) {
      services.push({ name: "cognivern-wallet", endpoint: agent.walletId });
    }

    return {
      type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
      name: agent.name,
      description:
        agent.description ||
        `Cognivern ${agent.type} agent — governed by mandate and spend policy`,
      services,
      x402Support: false,
      active: agent.status === "active",
      registrations: binding
        ? [
            {
              agentId: Number(binding.agentId),
              agentRegistry: binding.agentRegistry,
            },
          ]
        : [],
      supportedTrust: ["reputation"],
    };
  }

  /** registration-v1 file as a self-contained on-chain data: URI. */
  registrationFileToDataUri(file: Record<string, unknown>): string {
    return `data:application/json;base64,${Buffer.from(
      JSON.stringify(file),
    ).toString("base64")}`;
  }

  /**
   * Register an OWS agent on-chain: mint its identity NFT to the agent's
   * vault wallet, then point the URI at its registration file (public HTTPS
   * card when ERC8004_PUBLIC_BASE_URL is set, else a self-contained data:
   * URI). Two transactions so `registrations` is always fully populated.
   */
  async registerAgent(params: {
    /** OWS agent record id. */
    agentId: string;
    walletId?: string;
    apiKeyToken?: string | null;
    operatorApproved?: boolean;
    agentURI?: string;
  }): Promise<{ binding: Erc8004Binding } | Erc8004Error> {
    if (!erc8004Config.enabled) {
      return { error: "ERC-8004 is not enabled. Set ERC8004_ENABLED=true." };
    }
    if (!erc8004Config.identityRegistry) {
      return {
        error: `No ERC-8004 identity registry for chain ${erc8004Config.chainId}`,
      };
    }

    const agent = await this.vault.getAgent(params.agentId);
    if (!agent) {
      return { error: `Agent ${params.agentId} not found` };
    }
    if (this.bindingFor(agent)) {
      return { error: `Agent ${params.agentId} already has an ERC-8004 identity` };
    }

    const walletId = params.walletId || agent.walletId;
    if (!walletId) {
      return {
        error:
          "Agent has no wallet — pass walletId so the identity NFT has an owner",
      };
    }

    const iface = new ethers.Interface(IDENTITY_REGISTRY_ABI);
    const callParams = {
      walletId,
      apiKeyToken: params.apiKeyToken,
      operatorApproved: params.operatorApproved,
      to: erc8004Config.identityRegistry,
      rpcUrl: erc8004Config.rpcUrl,
      chainId: erc8004Config.chainId,
    };

    const mint = await this.vault.sendContractCall({
      ...callParams,
      data: iface.encodeFunctionData("register()"),
      gasLimit: 500_000,
    });
    if ("error" in mint) {
      return { error: `ERC-8004 register failed: ${mint.error}` };
    }

    let registered: { agentId: string; owner: string };
    try {
      registered = await this.parseRegisteredEvent(mint.txHash);
    } catch (error) {
      return {
        error: `register tx ${mint.txHash} broadcast but event lookup failed: ${
          error instanceof Error ? error.message : "unknown"
        }`,
      };
    }

    const file = this.buildRegistrationFile({
      agent,
      binding: {
        chainId: erc8004Config.chainId,
        agentRegistry: erc8004Config.agentRegistryRef,
        identityRegistry: erc8004Config.identityRegistry,
        agentId: registered.agentId,
        owner: registered.owner,
        agentURI: "",
        registerTxHash: mint.txHash,
        registeredAt: new Date().toISOString(),
      },
    });
    const agentURI =
      params.agentURI ||
      (erc8004Config.publicBaseUrl
        ? `${erc8004Config.publicBaseUrl}/erc8004/agents/${agent.id}/card`
        : this.registrationFileToDataUri(file));

    const setUri = await this.vault.sendContractCall({
      ...callParams,
      data: iface.encodeFunctionData("setAgentURI", [
        registered.agentId,
        agentURI,
      ]),
      gasLimit: 500_000,
    });
    if ("error" in setUri) {
      // Identity exists on-chain; surface the partial state rather than lose it.
      const binding: Erc8004Binding = {
        chainId: erc8004Config.chainId,
        agentRegistry: erc8004Config.agentRegistryRef,
        identityRegistry: erc8004Config.identityRegistry,
        agentId: registered.agentId,
        owner: registered.owner,
        agentURI: "",
        registerTxHash: mint.txHash,
        registeredAt: new Date().toISOString(),
      };
      await this.vault.updateAgentMetadata(agent.id, { erc8004: binding });
      return {
        error: `Registered as agent ${registered.agentId} but setAgentURI failed: ${setUri.error}`,
      };
    }

    const binding: Erc8004Binding = {
      chainId: erc8004Config.chainId,
      agentRegistry: erc8004Config.agentRegistryRef,
      identityRegistry: erc8004Config.identityRegistry,
      agentId: registered.agentId,
      owner: registered.owner,
      agentURI,
      registerTxHash: mint.txHash,
      setUriTxHash: setUri.txHash,
      registeredAt: new Date().toISOString(),
    };
    await this.vault.updateAgentMetadata(agent.id, { erc8004: binding });

    logger.info(
      `ERC-8004 agent registered: owsAgent=${agent.id} agentId=${registered.agentId} tx=${mint.txHash}`,
    );
    return { binding };
  }

  /** Public on-chain reads for a registered agent identity. */
  async getOnChainIdentity(agentId: string): Promise<Erc8004Identity> {
    const registry = new ethers.Contract(
      erc8004Config.identityRegistry,
      IDENTITY_REGISTRY_ABI,
      provider(),
    );
    const [owner, agentURI, agentWallet] = await Promise.all([
      registry.ownerOf(agentId),
      registry.tokenURI(agentId),
      registry.getAgentWallet(agentId).catch(() => ethers.ZeroAddress),
    ]);
    return {
      agentId,
      owner: String(owner),
      agentURI: String(agentURI),
      agentWallet: String(agentWallet),
    };
  }

  /**
   * Publish feedback to the ReputationRegistry. `clientAddress` is the
   * signing wallet — the caller's wallet or the agent's own for
   * operator-attested outcomes.
   */
  async giveFeedback(params: {
    /** On-chain (registry) agentId. */
    agentId: string;
    walletId: string;
    apiKeyToken?: string | null;
    operatorApproved?: boolean;
    value: bigint | number | string;
    valueDecimals?: number;
    tag1?: string;
    tag2?: string;
    endpoint?: string;
    feedbackURI?: string;
    feedbackHash?: string;
  }): Promise<Erc8004FeedbackResult | Erc8004Error> {
    if (!erc8004Config.enabled) {
      return { error: "ERC-8004 is not enabled. Set ERC8004_ENABLED=true." };
    }
    if (!erc8004Config.reputationRegistry) {
      return {
        error: `No ERC-8004 reputation registry for chain ${erc8004Config.chainId}`,
      };
    }

    const iface = new ethers.Interface(REPUTATION_REGISTRY_ABI);
    const data = iface.encodeFunctionData("giveFeedback", [
      params.agentId,
      params.value,
      params.valueDecimals ?? 0,
      params.tag1 ?? "",
      params.tag2 ?? "",
      params.endpoint ?? "",
      params.feedbackURI ?? "",
      params.feedbackHash ?? ethers.ZeroHash,
    ]);

    const broadcast = await this.vault.sendContractCall({
      walletId: params.walletId,
      apiKeyToken: params.apiKeyToken,
      operatorApproved: params.operatorApproved,
      to: erc8004Config.reputationRegistry,
      data,
      rpcUrl: erc8004Config.rpcUrl,
      chainId: erc8004Config.chainId,
      gasLimit: 400_000,
    });
    if ("error" in broadcast) {
      return { error: `giveFeedback failed: ${broadcast.error}` };
    }

    let feedbackIndex: string | undefined;
    try {
      const receipt = await provider().waitForTransaction(
        broadcast.txHash,
        1,
        60_000,
      );
      if (receipt) {
        for (const log of receipt.logs) {
          if (
            log.address.toLowerCase() !==
            erc8004Config.reputationRegistry.toLowerCase()
          ) {
            continue;
          }
          const parsed = iface.parseLog({
            topics: log.topics as string[],
            data: log.data,
          });
          if (parsed?.name === "NewFeedback") {
            feedbackIndex = parsed.args.feedbackIndex.toString();
            break;
          }
        }
      }
    } catch {
      // feedbackIndex is best-effort; the txHash is the durable evidence
    }

    logger.info(
      `ERC-8004 feedback: agent=${params.agentId} client=${broadcast.from} tx=${broadcast.txHash}`,
    );
    return {
      txHash: broadcast.txHash,
      clientAddress: broadcast.from,
      feedbackIndex,
      transactionLink: erc8004Config.explorerTxUrl(broadcast.txHash),
    };
  }

  /**
   * Aggregated reputation for an agent. The registry's getSummary requires a
   * non-empty client list, so an omitted filter resolves all known clients
   * first; an agent with no feedback reports a zeroed summary.
   */
  async getReputation(
    agentId: string,
    params: { tag1?: string; tag2?: string; clientAddresses?: string[] } = {},
  ): Promise<{
    agentId: string;
    count: number;
    summaryValue: string;
    summaryValueDecimals: number;
    clients: string[];
  }> {
    const registry = new ethers.Contract(
      erc8004Config.reputationRegistry,
      REPUTATION_REGISTRY_ABI,
      provider(),
    );
    const clients: string[] = (
      params.clientAddresses ?? (await registry.getClients(agentId))
    ).map((c: string) => String(c));
    if (clients.length === 0) {
      return {
        agentId,
        count: 0,
        summaryValue: "0",
        summaryValueDecimals: 0,
        clients: [],
      };
    }
    const summary = await registry.getSummary(
      agentId,
      clients,
      params.tag1 ?? "",
      params.tag2 ?? "",
    );
    return {
      agentId,
      count: Number(summary.count),
      summaryValue: summary.summaryValue.toString(),
      summaryValueDecimals: Number(summary.summaryValueDecimals),
      clients,
    };
  }

  private async parseRegisteredEvent(
    txHash: string,
  ): Promise<{ agentId: string; owner: string }> {
    const receipt = await provider().waitForTransaction(txHash, 1, 60_000);
    if (!receipt) {
      throw new Error("transaction not confirmed within 60s");
    }
    if (receipt.status !== 1) {
      throw new Error("transaction reverted");
    }

    const iface = new ethers.Interface(IDENTITY_REGISTRY_ABI);
    for (const log of receipt.logs) {
      if (
        log.address.toLowerCase() !==
        erc8004Config.identityRegistry.toLowerCase()
      ) {
        continue;
      }
      const parsed = iface.parseLog({
        topics: log.topics as string[],
        data: log.data,
      });
      if (parsed?.name === "Registered") {
        return {
          agentId: parsed.args.agentId.toString(),
          owner: String(parsed.args.owner),
        };
      }
    }
    throw new Error("no Registered event in transaction logs");
  }
}

export const erc8004Service = new Erc8004Service();
