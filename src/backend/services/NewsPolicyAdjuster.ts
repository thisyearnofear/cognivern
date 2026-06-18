import { sharedPolicyService, PolicyService } from "./governance/PolicyService.js";
import { NotificationService } from "./NotificationService.js";
import { Logger } from "../shared/logging/Logger.js";

const logger = new Logger("NewsPolicyAdjuster");

export interface NewsEvent {
  id: string;
  type: "exploit" | "depeg" | "sanction" | "vulnerability" | "regulatory";
  title: string;
  summary: string;
  affectedProtocols: string[];
  affectedTokens: string[];
  severity: "low" | "medium" | "high" | "critical";
  sourceUrl?: string;
  timestamp: string;
}

export interface PolicyHold {
  policyId: string;
  workspaceId: string;
  policyName: string;
  triggeredBy: NewsEvent;
  heldAt: string;
  reason: string;
  releasedAt?: string;
  releasedBy?: string;
}

export class NewsPolicyAdjuster {
  private policyService: PolicyService;
  private activeHolds: Map<string, PolicyHold> = new Map();

  constructor(policyService?: PolicyService) {
    this.policyService = policyService || sharedPolicyService;
  }

  async handleNewsEvent(event: NewsEvent): Promise<PolicyHold[]> {
    logger.info(`Processing news event: ${event.type} — ${event.title}`, {
      eventId: event.id,
      severity: event.severity,
      affectedProtocols: event.affectedProtocols,
    });

    const policies = await this.policyService.listPolicies();
    const triggeredHolds: PolicyHold[] = [];

    for (const policy of policies) {
      if (policy.status !== "active") continue;

      const allowedVendors = policy.metadata?.allowedVendors as string[] | undefined;
      const allowedTokens = policy.metadata?.allowedTokens as string[] | undefined;

      const matchesVendor = allowedVendors?.some((v) =>
        event.affectedProtocols.some((p) =>
          p.toLowerCase().includes(v.toLowerCase()),
        ),
      );

      const matchesToken = allowedTokens?.some((t) =>
        event.affectedTokens.some((tk) =>
          tk.toLowerCase().includes(t.toLowerCase()),
        ),
      );

      if (!matchesVendor && !matchesToken) continue;

      const hold: PolicyHold = {
        policyId: policy.id,
        workspaceId: policy.metadata?.workspaceId || "unknown",
        policyName: policy.name,
        triggeredBy: event,
        heldAt: new Date().toISOString(),
        reason: `Auto-hold: ${event.type} event — ${event.title}. Affected: ${event.affectedProtocols.join(", ")}. ${event.summary}`,
      };

      await this.policyService.updatePolicyStatus(policy.id, "held");
      this.activeHolds.set(policy.id, hold);
      triggeredHolds.push(hold);

      logger.warn(`Policy ${policy.id} (${policy.name}) auto-held due to news event`, {
        eventType: event.type,
        holdReason: hold.reason,
      });

      await NotificationService.fireDecisionNotification({
        event: "policy_hold",
        timestamp: hold.heldAt,
        workspaceId: hold.workspaceId,
        decision: "denied",
        reason: hold.reason,
        action: `Policy "${policy.name}" auto-held due to ${event.type}: ${event.title}`,
      });
    }

    if (triggeredHolds.length === 0) {
      logger.info(`No active policies matched news event ${event.id}`);
    }

    return triggeredHolds;
  }

  async releasePolicyHold(
    policyId: string,
    releasedBy?: string,
  ): Promise<boolean> {
    const hold = this.activeHolds.get(policyId);
    if (!hold) {
      logger.warn(`No active hold found for policy ${policyId}`);
      return false;
    }

    await this.policyService.updatePolicyStatus(policyId, "active");
    hold.releasedAt = new Date().toISOString();
    hold.releasedBy = releasedBy || "operator";
    this.activeHolds.delete(policyId);

    logger.info(`Policy ${policyId} (${hold.policyName}) hold released`, {
      releasedBy: hold.releasedBy,
    });

    await NotificationService.fireDecisionNotification({
      event: "policy_hold_released",
      timestamp: hold.releasedAt,
      workspaceId: hold.workspaceId,
      decision: "approved",
      reason: `Hold released by ${hold.releasedBy}`,
      action: `Policy "${hold.policyName}" hold released`,
    });

    return true;
  }

  getActiveHolds(): PolicyHold[] {
    return Array.from(this.activeHolds.values());
  }

  getHold(policyId: string): PolicyHold | undefined {
    return this.activeHolds.get(policyId);
  }
}

export const sharedNewsPolicyAdjuster = new NewsPolicyAdjuster();
