/**
 * CVI — Cleanverse Verified Identity (A-Pass) screening for agent spend.
 * Fail-closed: missing, blacklisted, paused, or frozen A-Pass denies the spend.
 */

import { cleanverseConfig } from "@backend/shared/config/index.js";
import { logger } from "@backend/shared/logging/Logger.js";
import {
  cleanverseClient,
  type CleanverseClient,
} from "./CleanverseClient.js";

export interface APassRecord {
  chain: string;
  address: string;
  status: string;
  tier: string;
  expiration?: string;
  group: string;
  subGroup?: string;
  kycHash?: string;
  customerId?: string;
  isRegisted?: boolean;
  isPaused: boolean;
  isBlacklisted: boolean;
  createdAt?: string;
}

export interface APassScreenResult {
  address: string;
  ok: boolean;
  reason?: string;
  code?: number;
  aPass?: APassRecord;
}

export interface CleanverseIdentityScreening {
  required: boolean;
  chain: string;
  sender: APassScreenResult;
  recipient: APassScreenResult;
  ok: boolean;
  reason?: string;
}

export class CleanverseIdentityService {
  constructor(private readonly client: CleanverseClient = cleanverseClient) {}

  async queryAPass(
    chain: string,
    address: string,
  ): Promise<{ success: boolean; data?: APassRecord; code?: number; error?: string }> {
    const response = await this.client.request<APassRecord>({
      endpoint: "/query_apass",
      method: "POST",
      body: { chain, address },
    });

    if (response.code === 4 && response.result) {
      return { success: true, data: response.result, code: 4 };
    }

    return {
      success: false,
      code: response.code,
      error:
        response.message || `A-Pass query failed with code ${response.code}`,
    };
  }

  async verifyAPass(
    chain: string,
    address: string,
    aTokenAddress: string,
  ): Promise<{
    success: boolean;
    code: number;
    message: string;
    token?: {
      chain: string;
      address: string;
      name: string;
      symbol: string;
      decimals: number;
      contractAddress: string;
    };
  }> {
    const response = await this.client.request<{
      token?: {
        chain: string;
        address: string;
        name: string;
        symbol: string;
        decimals: number;
        contractAddress: string;
      };
    }>({
      endpoint: "/verify_apass",
      method: "POST",
      body: { chain, address, aTokenAddress },
    });

    const code = response.code ?? 0;
    const messages: Record<number, string> = {
      4: "A-Pass verified, can transact",
      3: "A-Pass frozen or expired",
      2: "User has no A-Pass",
      1: "A-Token not found on this chain",
    };

    return {
      success: code === 4,
      code,
      message: messages[code] || response.message || `Unexpected code: ${code}`,
      token: response.result?.token,
    };
  }

  evaluateAPass(address: string, record?: APassRecord, queryError?: string): APassScreenResult {
    if (!record) {
      return {
        address,
        ok: false,
        reason: queryError || "No A-Pass found for address",
      };
    }

    if (record.isBlacklisted) {
      return { address, ok: false, reason: "A-Pass is blacklisted", aPass: record };
    }
    if (record.isPaused) {
      return { address, ok: false, reason: "A-Pass is paused", aPass: record };
    }
    const status = (record.status || "").toUpperCase();
    if (status === "FROZEN" || status === "DELETED") {
      return {
        address,
        ok: false,
        reason: `A-Pass status is ${status}`,
        aPass: record,
      };
    }

    return { address, ok: true, aPass: record };
  }

  async screenAddresses(
    sender: string,
    recipient: string,
    chain: string = cleanverseConfig.chain,
  ): Promise<CleanverseIdentityScreening> {
    const screenOne = async (address: string): Promise<APassScreenResult> => {
      try {
        const result = await this.queryAPass(chain, address);
        return this.evaluateAPass(address, result.data, result.error);
      } catch (error) {
        const message = error instanceof Error ? error.message : "A-Pass query failed";
        logger.warn(`Cleanverse A-Pass query failed for ${address}: ${message}`);
        return { address, ok: false, reason: message };
      }
    };

    const [senderResult, recipientResult] = await Promise.all([
      screenOne(sender),
      screenOne(recipient),
    ]);

    const ok = senderResult.ok && recipientResult.ok;
    let reason: string | undefined;
    if (!senderResult.ok) {
      reason = `Sender failed CVI screening: ${senderResult.reason}`;
    } else if (!recipientResult.ok) {
      reason = `Recipient failed CVI screening: ${recipientResult.reason}`;
    }

    return {
      required: true,
      chain,
      sender: senderResult,
      recipient: recipientResult,
      ok,
      reason,
    };
  }
}

export const cleanverseIdentityService = new CleanverseIdentityService();
