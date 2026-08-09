/**
 * CVI — Cleanverse Verified Identity (A-Pass) screening for agent spend.
 * Fail-closed: missing, blacklisted, paused, frozen, or expired A-Pass
 * denies the spend.
 *
 * Wire contract (Cleanverse Cooperate API v5.x):
 *   - Every response is `{ code: "0000" (success), message, data }` where
 *     `data` carries the payload. Business codes are strings ("0000" ok,
 *     "0001" param error, "0002" business failure, ...).
 *   - POST /query_apass   body {chain, address}
 *       → data {cvRecordId, subTier, tier, status (1 active | 2 frozen),
 *               expirationTime (unix seconds), subGroup, currentKycHash,
 *               group, countries}
 *   - POST /verify_apass  body {chain, atoken, address}
 *       → data {chain, atoken, address, code (1 no token | 2 no A-Pass |
 *               3 frozen/expired | 4 ok), message, magickLink}
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
  /** 1 = active, 2 = frozen on the live API; string statuses kept for legacy mocks. */
  status: string | number;
  tier?: string;
  expiration?: string;
  group: string;
  subGroup?: string;
  kycHash?: string;
  customerId?: string;
  cvRecordId?: string;
  subTier?: number;
  countries?: string[];
  isRegisted?: boolean;
  isPaused?: boolean;
  isBlacklisted?: boolean;
  createdAt?: string;
}

export interface APassScreenResult {
  address: string;
  ok: boolean;
  reason?: string;
  code?: number | string;
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

/** Documented query_apass data payload (flat fields). */
interface RawQueryApassData {
  cvRecordId?: string;
  customerId?: string;
  chain?: string;
  address?: string;
  subTier?: number | string;
  tier?: string | number;
  status?: number | string;
  expirationTime?: number | string;
  subGroup?: string;
  currentKycHash?: string;
  group?: string;
  countries?: string[];
}

/** Documented verify_apass data payload. */
interface RawVerifyApassData {
  chain?: string;
  atoken?: string;
  address?: string;
  /** 1 no token | 2 no A-Pass | 3 frozen/expired | 4 ok. */
  code?: number | string;
  message?: string;
  magickLink?: string;
  token?: {
    chain?: string;
    address?: string;
    name?: string;
    symbol?: string;
    decimals?: number;
    contractAddress?: string;
  };
}

function mapQueryApass(raw: RawQueryApassData): APassRecord {
  return {
    chain: String(raw.chain ?? ""),
    address: String(raw.address ?? ""),
    status: raw.status ?? "",
    tier: raw.tier !== undefined ? String(raw.tier) : undefined,
    group: raw.group !== undefined ? String(raw.group) : "",
    subGroup: raw.subGroup !== undefined ? String(raw.subGroup) : undefined,
    kycHash:
      raw.currentKycHash !== undefined ? String(raw.currentKycHash) : undefined,
    customerId:
      raw.customerId !== undefined ? String(raw.customerId) : undefined,
    cvRecordId: raw.cvRecordId !== undefined ? String(raw.cvRecordId) : undefined,
    subTier:
      raw.subTier !== undefined
        ? typeof raw.subTier === "number"
          ? raw.subTier
          : Number(raw.subTier)
        : undefined,
    countries: Array.isArray(raw.countries)
      ? (raw.countries as string[])
      : undefined,
    expiration:
      raw.expirationTime !== undefined ? String(raw.expirationTime) : undefined,
  };
}

export class CleanverseIdentityService {
  constructor(private readonly client: CleanverseClient = cleanverseClient) {}

  async queryAPass(
    chain: string,
    address: string,
  ): Promise<{ success: boolean; data?: APassRecord; code?: string | number; error?: string }> {
    const response = await this.client.request<RawQueryApassData | null>({
      endpoint: "/query_apass",
      method: "POST",
      body: { chain, address },
    });

    const data = response.data !== undefined ? response.data : response.result;
    if (String(response.code) === "0000") {
      if (data) {
        return { success: true, data: mapQueryApass(data), code: "0000" };
      }
      // Success envelope with an empty payload means no registered A-Pass.
      return {
        success: false,
        code: "0000",
        error: "No A-Pass found for address",
      };
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
    token?: RawVerifyApassData["token"];
  }> {
    const response = await this.client.request<RawVerifyApassData>({
      endpoint: "/verify_apass",
      method: "POST",
      // Field name per the contract is `atoken`, not `aTokenAddress`.
      body: { chain, atoken: aTokenAddress, address },
    });

    const data = response.data !== undefined ? response.data : response.result;
    const verificationCode = Number(data?.code ?? 0);
    const messages: Record<number, string> = {
      4: "A-Pass verified, can transact",
      3: "A-Pass frozen or expired",
      2: "User has no A-Pass",
      1: "A-Token not found on this chain",
    };

    return {
      // Business envelope success ("0000") AND the verification result
      // (data.code) both indicate the A-Pass is usable for this A-Token.
      success: String(response.code) === "0000" && verificationCode === 4,
      code: verificationCode,
      message:
        (data?.message?.trim() && data.message) ||
        messages[verificationCode] ||
        response.message ||
        `Unexpected code: ${verificationCode}`,
      token: data?.token,
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

    // NOTE: query_apass (v5.2) returns flat fields only — isBlacklisted /
    // isPaused are NOT live API fields; they are tolerated from legacy/mock
    // sources. On the live API, blacklist/freeze surfaces as status = 2.
    if (record.isBlacklisted) {
      return { address, ok: false, reason: "A-Pass is blacklisted", aPass: record };
    }
    if (record.isPaused) {
      return { address, ok: false, reason: "A-Pass is paused", aPass: record };
    }

    // Live API returns status as an integer: 1 = active, 2 = frozen.
    // Fail-closed: anything other than 1 / ACTIVE denies (unknown, missing,
    // or "0" statuses are not trusted).
    const status = String(record.status ?? "").toUpperCase();
    if (status !== "1" && status !== "ACTIVE") {
      return {
        address,
        ok: false,
        reason: `A-Pass status is ${record.status || "unknown"}`,
        aPass: record,
      };
    }

    // expirationTime is unix seconds per the contract; tolerate ms values.
    // Fail-closed: a present-but-malformed expiration denies. Absent
    // expiration is not judged (no data to fabricate).
    if (record.expiration !== undefined && record.expiration !== "") {
      const raw = Number(record.expiration);
      if (!Number.isFinite(raw) || raw <= 0) {
        return {
          address,
          ok: false,
          reason: "A-Pass has an invalid expiration",
          aPass: record,
        };
      }
      const asSeconds = raw > 1e12 ? raw / 1000 : raw;
      if (asSeconds * 1000 < Date.now()) {
        return { address, ok: false, reason: "A-Pass is expired", aPass: record };
      }
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
