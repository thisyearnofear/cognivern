/**
 * FlareConfidentialPolicyService
 *
 * Feature-flagged adapter for Cognivern confidential spend policy on Flare
 * Confidential Compute (FCC / Coston2). Mirrors the FhenixPolicyService
 * decision surface so spend-eval dispatch can switch via FLARE_EVALUATOR=flare.
 *
 * Live path: registerPolicy / evaluateSpend on ConfidentialSpendPolicy
 * InstructionSender → poll EXT_PROXY_URL for TEE result → publishDecision.
 *
 * Until FLARE_POLICY_CONTRACT + FLARE_PRIVATE_KEY are set, evaluateEncrypted
 * returns a fabricated deny (same fail-closed posture as unconfigured Fhenix).
 */

import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  http,
  parseAbi,
  Hex,
  Chain,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import logger from '@backend/utils/logger.js';
import type {
  ConfidentialOutcome,
  ConfidentialSpendDecision,
  ConfidentialSpendInput,
} from './FhenixPolicyService.js';

const COSTON2 = {
  id: 114,
  name: 'Flare Testnet Coston2',
  nativeCurrency: { name: 'C2FLR', symbol: 'C2FLR', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://coston2-api.flare.network/ext/C/rpc'] },
  },
  blockExplorers: {
    default: { name: 'Coston2 Explorer', url: 'https://coston2-explorer.flare.network' },
  },
} as const satisfies Chain;

/** Instruction fee paid to TeeExtensionRegistry.sendInstructions (wei). */
const INSTRUCTION_FEE_WEI = 1_000_000_000n;

/** Demo-scale limits (USD-ish units) matching SpendController demo notes. */
const DEFAULT_POLICY_LIMITS = {
  dailyLimit: '10000',
  perTxLimit: '2000',
  approvalThreshold: '500',
};

const ABI = parseAbi([
  'function registerPolicy(bytes32 policyId, bytes message) external payable',
  'function evaluateSpend(bytes32 agentId, bytes32 policyId, bytes32 vendorHash, bytes message) external payable returns (bytes32)',
  'function publishDecision(bytes32 decisionId, uint8 outcome, bytes attestation) external',
  'function resolvedOutcomes(bytes32 decisionId) external view returns (uint8)',
  'function policyRegistered(bytes32 policyId) external view returns (bool)',
  'function extensionId() external view returns (uint256)',
  'event SpendEvaluated(bytes32 indexed decisionId, bytes32 indexed agentId, bytes32 indexed policyId, uint8 outcome, bytes attestation)',
  'event DecisionResolved(bytes32 indexed decisionId, uint8 outcome)',
  'event PolicyRegistered(bytes32 indexed policyId, address indexed operator)',
]);

const OUTCOME_TO_ENUM: Record<ConfidentialOutcome, number> = {
  deny: 0,
  hold: 1,
  approve: 2,
};

export interface FlareConfidentialPolicyServiceConfig {
  rpcUrl: string;
  chainId: number;
  contractAddress: string;
  privateKey: string;
  extProxyUrl?: string;
  teeManager?: string;
  extensionId?: string;
  evaluator?: string;
  pollTimeoutMs?: number;
}

export function createFlareConfig(): FlareConfidentialPolicyServiceConfig {
  return {
    rpcUrl: process.env.FLARE_RPC_URL || 'https://coston2-api.flare.network/ext/C/rpc',
    chainId: Number(process.env.FLARE_CHAIN_ID || '114'),
    contractAddress: process.env.FLARE_POLICY_CONTRACT || '',
    privateKey: process.env.FLARE_PRIVATE_KEY || '',
    extProxyUrl: process.env.FLARE_EXT_PROXY_URL || '',
    teeManager: process.env.FLARE_TEE_MANAGER || '0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE',
    extensionId: process.env.FLARE_EXTENSION_ID || '',
    evaluator: process.env.FLARE_EVALUATOR || '',
    pollTimeoutMs: Number(process.env.FLARE_POLL_TIMEOUT_MS || '90000'),
  };
}

/** True when spend-eval should use Flare instead of Fhenix. */
export function isFlareEvaluatorEnabled(config = createFlareConfig()): boolean {
  return (config.evaluator || '').trim().toLowerCase() === 'flare';
}

function toBytes32(hexOrId: string): Hex {
  const raw = hexOrId.startsWith('0x') ? hexOrId.slice(2) : hexOrId;
  const padded = raw.padStart(64, '0').slice(0, 64);
  return `0x${padded}` as Hex;
}

function outcomeFromTee(raw: string): ConfidentialOutcome {
  const v = raw.toLowerCase();
  if (v === 'approve' || v === 'hold' || v === 'deny') return v;
  return 'deny';
}

/**
 * Demo SpendController passes amountUsd * 1e18 as amountWei.
 * TEE limits are registered in USD-scale integers — downscale when needed.
 */
function amountForTee(amountWei: bigint): string {
  if (amountWei >= 10n ** 15n) {
    return (amountWei / 10n ** 18n).toString();
  }
  return amountWei.toString();
}

function utf8ToHex(s: string): Hex {
  return `0x${Buffer.from(s, 'utf8').toString('hex')}` as Hex;
}

function decodeProxyData(data: unknown): Record<string, unknown> {
  if (data == null) return {};
  if (typeof data === 'object' && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  let raw = String(data);
  if (raw.startsWith('0x') || raw.startsWith('0X')) {
    raw = Buffer.from(raw.slice(2), 'hex').toString('utf8');
  }
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export class FlareConfidentialPolicyService {
  private publicClient: ReturnType<typeof createPublicClient> | null = null;
  private walletClient: ReturnType<typeof createWalletClient> | null = null;
  private registeredPolicies = new Set<string>();

  constructor(private readonly config: FlareConfidentialPolicyServiceConfig) {
    if (config.rpcUrl && config.privateKey && config.contractAddress) {
      const account = privateKeyToAccount(
        (config.privateKey.startsWith('0x')
          ? config.privateKey
          : `0x${config.privateKey}`) as Hex,
      );
      this.publicClient = createPublicClient({
        chain: COSTON2,
        transport: http(config.rpcUrl),
      });
      this.walletClient = createWalletClient({
        account,
        chain: COSTON2,
        transport: http(config.rpcUrl),
      });
    }
  }

  status() {
    return {
      evaluator: 'flare',
      enabled: isFlareEvaluatorEnabled(this.config),
      configured: Boolean(this.config.contractAddress && this.config.privateKey),
      chainId: this.config.chainId,
      contractAddress: this.config.contractAddress || null,
      teeManager: this.config.teeManager || null,
      extensionId: this.config.extensionId || null,
      extProxyUrl: this.config.extProxyUrl || null,
      rpcUrl: this.config.rpcUrl,
    };
  }

  /**
   * Evaluate a spend via FCC InstructionSender → TEE proxy → publishDecision.
   */
  async evaluateEncrypted(input: ConfidentialSpendInput): Promise<ConfidentialSpendDecision> {
    logger.info(
      `Evaluating confidential spend on Flare: agent=${input.agentId}, policy=${input.policyId}`,
    );

    if (!this.walletClient || !this.publicClient || !this.config.contractAddress) {
      logger.warn('Flare CSP not configured — fabricated deny');
      return {
        decisionId: `0x${crypto.randomUUID().replace(/-/g, '')}`,
        outcome: 'deny',
        attestation: '0x',
        agentId: input.agentId,
        policyId: input.policyId,
        timestamp: new Date().toISOString(),
        fabricated: true,
      };
    }

    if (!this.config.extProxyUrl) {
      logger.warn('FLARE_EXT_PROXY_URL unset — fabricated deny');
      return {
        decisionId: `0x${crypto.randomUUID().replace(/-/g, '')}`,
        outcome: 'deny',
        attestation: '0x',
        agentId: input.agentId,
        policyId: input.policyId,
        timestamp: new Date().toISOString(),
        fabricated: true,
      };
    }

    const policyId = toBytes32(input.policyId);
    const agentId = toBytes32(input.agentId);
    const vendorHash = toBytes32(input.vendorHash);
    const amount = amountForTee(input.amountWei);

    await this.ensurePolicyRegistered(policyId, input.policyId, false);

    const evalPayload = utf8ToHex(
      JSON.stringify({
        agentId: input.agentId.startsWith('0x') ? input.agentId : `0x${input.agentId}`,
        policyId: input.policyId.startsWith('0x') ? input.policyId : `0x${input.policyId}`,
        amount,
        vendorHash: input.vendorHash.startsWith('0x')
          ? input.vendorHash
          : `0x${input.vendorHash}`,
      }),
    );

    let evaluated: { decisionId: Hex; attestation: Hex } | null = null;
    let tee: Record<string, unknown> = {};

    for (let attempt = 0; attempt < 2; attempt++) {
      const txHash = await this.walletClient.writeContract({
        address: this.config.contractAddress as Hex,
        abi: ABI,
        functionName: 'evaluateSpend',
        args: [agentId, policyId, vendorHash, evalPayload],
        value: INSTRUCTION_FEE_WEI,
        chain: COSTON2,
        account: this.walletClient.account!,
      });

      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash: txHash,
        timeout: 120_000,
      });

      evaluated = this.parseSpendEvaluated(receipt.logs);
      if (!evaluated) {
        throw new Error(`SpendEvaluated not found in tx ${txHash}`);
      }

      const instructionId = this.instructionIdFromAttestation(evaluated.attestation);
      try {
        tee = await this.pollActionResult(instructionId);
        break;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (attempt === 0 && /policy missing/i.test(msg)) {
          logger.warn('TEE policy missing — re-registering and retrying evaluate');
          await this.ensurePolicyRegistered(policyId, input.policyId, true);
          continue;
        }
        throw err;
      }
    }

    if (!evaluated) {
      throw new Error('evaluateSpend produced no SpendEvaluated event');
    }

    const outcome = outcomeFromTee(String(tee.outcome || 'deny'));
    const attestation = utf8ToHex(JSON.stringify(tee));
    await this.walletClient.writeContract({
      address: this.config.contractAddress as Hex,
      abi: ABI,
      functionName: 'publishDecision',
      args: [evaluated.decisionId, OUTCOME_TO_ENUM[outcome], attestation],
      chain: COSTON2,
      account: this.walletClient.account!,
    });

    return {
      decisionId: evaluated.decisionId,
      outcome,
      attestation,
      agentId: input.agentId,
      policyId: input.policyId,
      timestamp: new Date().toISOString(),
    };
  }

  private async ensurePolicyRegistered(
    policyId: Hex,
    policyIdRaw: string,
    force: boolean,
  ): Promise<void> {
    if (!this.walletClient || !this.publicClient || !this.config.contractAddress) return;

    const key = policyId.toLowerCase();
    if (!force && this.registeredPolicies.has(key)) return;

    const onChain = await this.publicClient.readContract({
      address: this.config.contractAddress as Hex,
      abi: ABI,
      functionName: 'policyRegistered',
      args: [policyId],
    });

    // Seed TEE-private limits. Re-register when forced (TEE restart) or first use.
    if (!force && onChain && this.registeredPolicies.has(key)) return;

    const payload = utf8ToHex(
      JSON.stringify({
        policyId: policyIdRaw.startsWith('0x') ? policyIdRaw : `0x${policyIdRaw}`,
        ...DEFAULT_POLICY_LIMITS,
      }),
    );

    const hash = await this.walletClient.writeContract({
      address: this.config.contractAddress as Hex,
      abi: ABI,
      functionName: 'registerPolicy',
      args: [policyId, payload],
      value: INSTRUCTION_FEE_WEI,
      chain: COSTON2,
      account: this.walletClient.account!,
    });

    await this.publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 });
    await this.sleep(4_000);
    this.registeredPolicies.add(key);
    logger.info(
      `Flare policy registered policyId=${policyId} onChainWas=${Boolean(onChain)} force=${force} tx=${hash}`,
    );
  }

  private parseSpendEvaluated(logs: readonly { data: Hex; topics: readonly Hex[] }[]): {
    decisionId: Hex;
    attestation: Hex;
  } | null {
    for (const log of logs) {
      try {
        const decoded = decodeEventLog({
          abi: ABI,
          data: log.data,
          topics: log.topics as [Hex, ...Hex[]],
        });
        if (decoded.eventName !== 'SpendEvaluated') continue;
        const args = decoded.args as {
          decisionId: Hex;
          attestation: Hex;
        };
        return { decisionId: args.decisionId, attestation: args.attestation };
      } catch {
        // not our event
      }
    }
    return null;
  }

  private instructionIdFromAttestation(attestation: Hex): Hex {
    // Contract encodes abi.encodePacked(instructionId) → 32 raw bytes.
    const hex = attestation.startsWith('0x') ? attestation.slice(2) : attestation;
    if (hex.length >= 64) {
      return `0x${hex.slice(0, 64)}` as Hex;
    }
    return toBytes32(attestation);
  }

  private async pollActionResult(instructionId: Hex): Promise<Record<string, unknown>> {
    const base = (this.config.extProxyUrl || '').replace(/\/$/, '');
    const url = `${base}/action/result/${instructionId}`;
    const deadline = Date.now() + (this.config.pollTimeoutMs || 90_000);
    let lastErr: unknown;

    while (Date.now() < deadline) {
      try {
        const res = await fetch(url);
        if (!res.ok) {
          lastErr = new Error(`proxy HTTP ${res.status}`);
          await this.sleep(3_000);
          continue;
        }
        const body = (await res.json()) as {
          result?: { status?: number; log?: string; data?: unknown };
        };
        const status = body.result?.status;
        if (status === 0) {
          throw new Error(`TEE failed: ${body.result?.log || 'unknown'}`);
        }
        if (status === 1) {
          return decodeProxyData(body.result?.data);
        }
      } catch (err) {
        lastErr = err;
        if (err instanceof Error && err.message.startsWith('TEE failed')) throw err;
      }
      await this.sleep(3_000);
    }

    throw new Error(
      `Timeout polling TEE result for ${instructionId}: ${
        lastErr instanceof Error ? lastErr.message : String(lastErr)
      }`,
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const sharedFlareConfidentialPolicyService = new FlareConfidentialPolicyService(
  createFlareConfig(),
);
