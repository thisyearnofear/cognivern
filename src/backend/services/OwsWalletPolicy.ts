import { Policy, PolicyRule } from "../types/Policy.js";
import type { PolicyService } from "./PolicyService.js";
import type { PolicyEnforcementService } from "./PolicyEnforcementService.js";
import type { FhenixPolicyService } from "./FhenixPolicyService.js";
import type { AgentAction } from "../types/Agent.js";
import type { SpendIntent, SpendExecutionContext, ExecutionResult } from "./OwsWalletService.js";
import { createHash } from "node:crypto";

export class OwsWalletPolicyEvaluator {
  toAgentAction(intent: SpendIntent): AgentAction {
    const amountValue = Number(intent.amount);
    const metadata = {
      ...(intent.metadata || {}),
      agentId: intent.agentId,
      amount: intent.amount,
      amountValue: Number.isFinite(amountValue) ? amountValue : 0,
      amountUsd: this.resolveAmountUsd(intent, amountValue),
      asset: intent.asset,
      recipient: intent.recipient,
    };

    return {
      id: intent.id,
      timestamp: intent.timestamp,
      type: "spend",
      description: intent.reason,
      metadata,
      policyChecks: [],
    };
  }

  resolveAmountUsd(intent: SpendIntent, amountValue: number): number {
    const metadataAmountUsd = Number(intent.metadata?.amountUsd);
    if (Number.isFinite(metadataAmountUsd)) {
      return metadataAmountUsd;
    }

    if (["USD", "USDC", "USDT"].includes(intent.asset.toUpperCase())) {
      return Number.isFinite(amountValue) ? amountValue : 0;
    }

    return Number.isFinite(amountValue) ? amountValue : 0;
  }

  async resolveActiveSpendPolicy(
    policyService: PolicyService,
    explicitPolicyId?: string,
  ): Promise<Policy | null> {
    const requestedPolicyId =
      explicitPolicyId || process.env.ACTIVE_SPEND_POLICY;
    if (requestedPolicyId) {
      const explicitPolicy =
        await policyService.getPolicy(requestedPolicyId);
      if (explicitPolicy?.status === "active") {
        return explicitPolicy;
      }
    }

    const policies = await policyService.listPolicies();
    const activePolicies = policies.filter(
      (policy) =>
        policy.status === "active" &&
        Array.isArray(policy.rules) &&
        policy.rules.length > 0,
    );
    const spendPolicy =
      activePolicies.find(
        (policy) =>
          String(policy.metadata?.category || "").toLowerCase() === "spend",
      ) ||
      activePolicies.find((policy) => policy.id === "spend-governance-policy");

    if (spendPolicy) {
      return spendPolicy;
    }

    return (
      activePolicies.sort(
        (left, right) =>
          new Date(right.updatedAt).getTime() -
          new Date(left.updatedAt).getTime(),
      )[0] || null
    );
  }

  shouldUseConfidentialPolicy(activePolicy: Policy): boolean {
    return activePolicy.metadata?.confidential === true;
  }

  classifyDecision(
    policy: Policy,
    checks: AgentAction["policyChecks"],
  ): { status: ExecutionResult["status"]; reason?: string } {
    const failedChecks = checks.filter((check) => !check.result);
    if (failedChecks.length === 0) {
      return { status: "approved" };
    }

    const failedRules = failedChecks
      .map((check) => ({
        check,
        rule: policy.rules.find((rule) => rule.id === check.policyId),
      }))
      .filter(
        (
          value,
        ): value is {
          check: AgentAction["policyChecks"][number];
          rule: PolicyRule;
        } => Boolean(value.rule),
      );

    const denyRules = failedRules.filter(
      ({ rule }) => String(rule.type).toLowerCase() === "deny",
    );
    if (denyRules.length > 0) {
      return {
        status: "denied",
        reason: denyRules
          .map(
            ({ check, rule }) =>
              check.reason ||
              String(
                rule.action?.parameters?.reason ||
                  `${rule.id} denied the spend`,
              ),
          )
          .join("; "),
      };
    }

    return {
      status: "held",
      reason: failedRules
        .map(
          ({ check, rule }) =>
            check.reason ||
            String(
              rule.action?.parameters?.reason || `${rule.id} requires review`,
            ),
        )
        .join("; "),
    };
  }

  async evaluatePolicyChecks(
    intent: SpendIntent,
    action: AgentAction,
    activePolicy: Policy,
    context: SpendExecutionContext,
    policyEnforcement: PolicyEnforcementService,
    fhenixPolicyService: FhenixPolicyService,
  ): Promise<{
    policyChecks: AgentAction["policyChecks"];
    decision?: { status: ExecutionResult["status"]; reason?: string };
  }> {
    if (!this.shouldUseConfidentialPolicy(activePolicy)) {
      await policyEnforcement.loadPolicy(activePolicy.id);
      const decision = await policyEnforcement.evaluateDecision(action);
      return { policyChecks: decision.policyChecks };
    }

    if (
      typeof context.encryptedAmount !== "string" &&
      typeof intent.metadata?.encryptedAmount !== "string"
    ) {
      return {
        policyChecks: [
          {
            policyId: activePolicy.id,
            result: false,
            reason:
              "Confidential policy requires encrypted amount input. Held for manual review.",
          },
        ],
        decision: {
          status: "held",
          reason:
            "Confidential policy requires encrypted amount input. Held for manual review.",
        },
      };
    }

    const amountWei = BigInt(intent.amount);
    const vendorHash =
      context.vendorHash ||
      (typeof intent.metadata?.vendorHash === "string"
        ? intent.metadata.vendorHash
        : `0x${createHash("sha256").update(intent.recipient).digest("hex")}`);

    const confidentialDecision =
      await fhenixPolicyService.evaluateEncrypted({
        agentId: intent.agentId,
        policyId: activePolicy.id,
        amountWei,
        vendorHash,
      });

    const decisionByOutcome: Record<
      typeof confidentialDecision.outcome,
      { status: ExecutionResult["status"]; reason?: string }
    > = {
      approve: { status: "approved" },
      hold: {
        status: "held",
        reason: "Confidential policy requires manual review.",
      },
      deny: {
        status: "denied",
        reason: "Confidential policy denied this spend.",
      },
    };

    return {
      policyChecks: [
        {
          policyId: activePolicy.id,
          result: confidentialDecision.outcome === "approve",
          reason: `Confidential outcome: ${confidentialDecision.outcome}`,
        },
      ],
      decision: {
        ...decisionByOutcome[confidentialDecision.outcome],
        reason:
          decisionByOutcome[confidentialDecision.outcome].reason ||
          `Confidential decision ${confidentialDecision.decisionId} approved spend`,
      },
    };
  }
}
