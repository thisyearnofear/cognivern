export const HELP_TEXT: Record<string, { title: string; body: string }> = {
  "policy:budget": {
    title: "Budget Policy",
    body: "Sets spending limits per transaction or per time period. Agents exceeding the limit are denied.",
  },
  "policy:allowlist": {
    title: "Allowlist Policy",
    body: "Restricts agent spending to pre-approved protocols, vendors, or contract addresses.",
  },
  "policy:chain": {
    title: "Chain Restriction",
    body: "Limits which blockchain networks an agent can operate on.",
  },
  "policy:approval": {
    title: "Human Approval",
    body: "Flags transactions above a threshold for manual review before execution.",
  },
  "policy:encrypt": {
    title: "Encrypted Policy (FHE)",
    body: "Budget limits are encrypted on-chain via Fhenix FHE. The agent cannot see its spending caps — only whether a spend passes or fails.",
  },
  "governance:nl-input": {
    title: "Natural Language Input",
    body: "Describe the spend action in plain English. Cognivern parses the action type, amount, and protocol automatically.",
  },
  "governance:quick-check": {
    title: "Quick Check",
    body: "Instantly test a spend action against your active policies. Use this to calibrate limits before deploying agents.",
  },
  "security:auth": {
    title: "Authentication",
    body: "SIWE (Sign-In With Ethereum) with nonce replay protection. JWT tokens verified server-side and revocable.",
  },
  "security:apikeys": {
    title: "API Key Security",
    body: "Keys are hashed with scrypt before storage. Only the cvn_ prefix is visible after creation. Scoped permissions per key.",
  },
  "security:ratelimit": {
    title: "Rate Limiting",
    body: "3 layers: global IP limit, per-workspace (100/min), per-API-key (50/min). Persistent across server restarts.",
  },
  "security:idempotency": {
    title: "Idempotency",
    body: "Send an Idempotency-Key header with spend requests to prevent duplicate execution. Keys valid for 24 hours.",
  },
};
