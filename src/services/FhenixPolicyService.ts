/**
 * FhenixPolicyService
 *
 * Wave 1 scaffold for Cognivern's confidential policy layer.
 *
 * Wraps the CoFHE SDK to:
 *   1. Encrypt spend amounts client-side with `@cofhe/sdk`.
 *   2. Submit them to `ConfidentialSpendPolicy` on Fhenix.
 *   3. Consume the `SpendEvaluated(decisionId, outcome, attestation)` event.
 *   4. Emit a normalized `SpendDecision` for the rest of the control plane.
 *   5. Issue auditor permits for selective disclosure.
 *
 * See docs/FHENIX_INTEGRATION.md for the full design.
 *
 * Wave 2 will wire this into the actual @cofhe/sdk client and contract ABI.
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
  attestation: string; // hex-encoded, consumed by X Layer GovernanceContract
  agentId: string;
  policyId: string;
  timestamp: string;
}

export interface FhenixPolicyServiceConfig {
  rpcUrl: string;
  contractAddress: string;
  client?: FhenixClientAdapter;
  evaluateTimeoutMs?: number;
}

type HexString = `0x${string}`;

export interface FhenixClientAdapter {
  encryptUint256(value: bigint): Promise<string>;
  evaluateSpend(input: {
    contractAddress: string;
    agentId: string;
    policyId: string;
    amountCiphertext: string;
    vendorHash: string;
  }): Promise<{
    decisionId: string;
    outcome: ConfidentialOutcome | number | string;
    attestation?: string;
  }>;
  issueAuditPermit?(input: {
    contractAddress: string;
    auditor: string;
    policyId: string;
  }): Promise<string>;
}

export class FhenixPolicyService {
  constructor(private readonly config: FhenixPolicyServiceConfig) {}

  async evaluateEncrypted(input: ConfidentialSpendInput): Promise<ConfidentialSpendDecision> {
    if (!this.config.client) {
      return {
        decisionId: synthDecisionId(input),
        outcome: "deny",
        attestation: "0x",
        agentId: input.agentId,
        policyId: input.policyId,
        timestamp: new Date().toISOString(),
      };
    }

    const timeoutMs = this.config.evaluateTimeoutMs || 15000;
    const amountCiphertext = await this.withTimeout(
      this.config.client.encryptUint256(input.amountWei),
      timeoutMs,
      "Fhenix encryption timed out",
    );
    const result = await this.withTimeout(
      this.config.client.evaluateSpend({
        contractAddress: this.config.contractAddress,
        agentId: input.agentId,
        policyId: input.policyId,
        amountCiphertext,
        vendorHash: input.vendorHash,
      }),
      timeoutMs,
      "Fhenix policy evaluation timed out",
    );

    return {
      decisionId: normalizeHex(result.decisionId, "decisionId"),
      outcome: this.normalizeOutcome(result.outcome),
      attestation: normalizeHex(result.attestation || "0x", "attestation"),
      agentId: input.agentId,
      policyId: input.policyId,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Issue a CoFHE permit so an auditor can selectively decrypt fields they
   * are authorized to view (e.g. a specific policy's spent counter).
   */
  async issueAuditPermit(auditor: string, policyId: string): Promise<string> {
    if (!this.config.client?.issueAuditPermit) {
      return synthPermit(auditor, policyId);
    }

    const timeoutMs = this.config.evaluateTimeoutMs || 15000;
    const permit = await this.withTimeout(
      this.config.client.issueAuditPermit({
        contractAddress: this.config.contractAddress,
        auditor,
        policyId,
      }),
      timeoutMs,
      "Fhenix audit permit issuance timed out",
    );
    return normalizeHex(permit, "permit");
  }

  private normalizeOutcome(outcome: ConfidentialOutcome | number | string): ConfidentialOutcome {
    if (outcome === "approve" || outcome === 2 || String(outcome) === "2") {
      return "approve";
    }
    if (outcome === "hold" || outcome === 1 || String(outcome) === "1") {
      return "hold";
    }
    if (outcome === "deny" || outcome === 0 || String(outcome) === "0") {
      return "deny";
    }
    throw new Error(`Unsupported confidential outcome: ${String(outcome)}`);
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    timeoutMessage: string,
  ): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
        }),
      ]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }
}

function synthDecisionId(input: ConfidentialSpendInput): string {
  // Deterministic placeholder so audit trails can dedupe during scaffolding.
  const payload = `${input.agentId}:${input.policyId}:${input.vendorHash}:${input.amountWei.toString()}`;
  let hash = 0n;
  for (const ch of payload) hash = (hash * 1315423911n) ^ BigInt(ch.charCodeAt(0));
  return "0x" + hash.toString(16).padStart(64, "0").slice(0, 64);
}

function synthPermit(auditor: string, policyId: string): string {
  const payload = `${auditor}:${policyId}`;
  let hash = 0n;
  for (const ch of payload) hash = (hash * 1099511628211n) ^ BigInt(ch.charCodeAt(0));
  return `0x${hash.toString(16).padStart(64, "0").slice(0, 64)}`;
}

function normalizeHex(value: string, fieldName: string): HexString {
  if (!value || typeof value !== "string" || !value.startsWith("0x")) {
    throw new Error(`Invalid ${fieldName}: expected hex string`);
  }
  return value as HexString;
}
