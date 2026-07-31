import { URL } from "node:url";

export type EgressConnector = "webhook" | "slack" | "mcp";

export interface EgressDecision {
  allowed: boolean;
  reason?: string;
  destinationHost?: string;
}

export interface EgressRequest {
  connector: EgressConnector;
  destination: string;
  payload: unknown;
  sourceProvenance?: {
    sources?: Array<{ kind?: string }>;
  };
}

const MAX_PAYLOAD_BYTES = 64 * 1024;

function configuredHosts(): string[] {
  return (process.env.COGNIVERN_EGRESS_ALLOWLIST || "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

function isHostAllowed(host: string, allowlist: string[]): boolean {
  return allowlist.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`),
  );
}

export class EgressPolicyService {
  evaluate(request: EgressRequest): EgressDecision {
    let parsed: URL;
    try {
      parsed = new URL(request.destination);
    } catch {
      return { allowed: false, reason: "Egress destination is not a valid URL." };
    }

    if (
      parsed.protocol !== "https:" &&
      !(process.env.NODE_ENV !== "production" && parsed.protocol === "http:")
    ) {
      return {
        allowed: false,
        reason: "Egress destinations must use HTTPS in production.",
        destinationHost: parsed.hostname,
      };
    }

    const serialized = JSON.stringify(request.payload) ?? "null";
    if (Buffer.byteLength(serialized, "utf8") > MAX_PAYLOAD_BYTES) {
      return {
        allowed: false,
        reason: `Egress payload exceeds ${MAX_PAYLOAD_BYTES} byte limit.`,
        destinationHost: parsed.hostname,
      };
    }

    const enforcementEnabled = process.env.EGRESS_POLICY_ENFORCEMENT === "true";
    const allowlist = configuredHosts();
    if (enforcementEnabled && !isHostAllowed(parsed.hostname.toLowerCase(), allowlist)) {
      return {
        allowed: false,
        reason: "Egress destination is not in the configured allowlist.",
        destinationHost: parsed.hostname,
      };
    }

    return { allowed: true, destinationHost: parsed.hostname };
  }
}

export const egressPolicyService = new EgressPolicyService();
