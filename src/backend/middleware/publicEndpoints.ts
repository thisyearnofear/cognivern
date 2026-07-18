/**
 * Single source of truth for HTTP endpoints that bypass workspace-level auth.
 *
 * Why this exists:
 *   Two middlewares sit in front of the /api router:
 *     - `apiKeyMiddleware` (in ApiModule) — validates x-api-key (legacy or cvn_)
 *     - `authMiddleware` (this folder)   — validates JWT Bearer
 *
 *   Each previously kept its own list of "public" paths. They drifted:
 *   `apiKeyMiddleware` declared ~30 paths public (skipping the x-api-key check),
 *   but `authMiddleware` then demanded a JWT for the same paths, so requests
 *   with only an x-api-key (or no auth at all on per-resource paths like
 *   /api/spend) were rejected.
 *
 *   Endpoints in this list are the per-resource kind: the controller (or a
 *   service it calls) is responsible for the actual auth. For /api/spend that
 *   is the OWS scoped key in `x-ows-scoped-access`. For /api/audit/logs and
 *   /api/agents etc. the data is intentionally public (landing pages).
 *
 *   Anything NOT in this list still requires either:
 *     - a valid `x-api-key` (validated by apiKeyMiddleware) which sets
 *       `req.workspaceId`, or
 *     - a valid JWT Bearer (validated by authMiddleware).
 *
 *   When adding a new path here, confirm the route's controller enforces its
 *   own per-resource auth. Public in this module does NOT mean unauthenticated;
 *   it means workspace-tier auth is delegated.
 */
export const PUBLIC_API_PATHS: ReadonlySet<string> = new Set([
  "/health",
  "/dashboard/bundle",
  "/agents",
  "/agents/unified",
  "/agents/connections",
  "/agents/governance/status",
  "/agents/governance/decisions",
  "/agents/portfolio/status",
  "/agents/portfolio/decisions",
  "/agents/sapience/status",
  "/agents/sapience/decisions",
  "/audit/logs",
  "/audit/insights",
  "/governance/policies",
  "/spendos/status",
  "/spendos/decisions",
  "/metrics/ux-summary",
  "/metrics/ux-events",
  "/cre/runs",
  "/cre/projects",
  "/cre/forecast",
  "/cre/runs/:runId/retry",
  // NOTE: /cre/runs/:runId/approval is NOT in this list. Held spend runs are
  // resumed through this endpoint and broadcast real money; an unauthenticated
  // approval would let any caller move funds from a scoped wallet. The
  // controller additionally requires req.userId (operator JWT) for the spend
  // branch — see CreController.submitApproval. This mirrors the /api/spend
  // hardening from commit 432e10c.
  "/spend",
  "/spend/status",
  "/spend/scan",
  "/projects",
  "/projects/:projectId/usage",
  "/projects/:projectId/tokens",
  "/fhenix/status",
  "/fhenix/encrypt",
  "/fhenix/decrypt",
  "/intent",
  "/intent/metrics",
  // Auth endpoints must be public — you can't require auth to create an account.
  "/auth/nonce",
  "/auth/verify",
  "/auth/register",
  "/auth/login",
  "/auth/verify-email",
  "/auth/forgot-password",
  "/auth/reset-password",
  // MCP tool manifest and governance check are public for agent discovery.
  "/mcp/governance-check",
  // OpenAPI spec is public so external agents can self-discover the API.
  "/docs/openapi.json",
  // Sealed-bid vendor selection — vendors submit bids without workspace auth.
  // The controller manages round state and bid encryption internally.
  "/vendor/sealed-bid/rounds",
  "/vendor/sealed-bid/rounds/:roundId",
  "/vendor/sealed-bid/rounds/:roundId/party-view",
  "/vendor/sealed-bid/rounds/:roundId/bid",
  "/vendor/sealed-bid/rounds/:roundId/close",
  "/vendor/sealed-bid/rounds/:roundId/reveal",
  // Speech transcription is used by the frontend without workspace auth.
  "/speech/transcribe",
  "/webhooks/chain-gpt-news",
  "/webhooks/holds",
  // NOTE: /events/stream is NOT in this list. EventsController demands
  // req.workspaceId, which is populated by authMiddleware from the JWT
  // payload. Bypassing the middleware here would skip that population and
  // every SSE connection would 401. The middleware already supports the
  // ?token=<jwt> query-param flow specifically for SSE (EventSource can't
  // set Authorization headers) — see authMiddleware.ts queryToken logic.
]);

/**
 * Default workspace identifier for legacy global x-api-key holders.
 *
 * The legacy COGNIVERN_API_KEY is a single global key without a workspace
 * binding. We map it to a synthetic "default" workspaceId so downstream
 * controllers that read `req.workspaceId` (governance, apikeys, audit) work
 * without changes. Data persisted under this id is intentionally shared
 * across all legacy-key callers.
 */
export const LEGACY_DEFAULT_WORKSPACE_ID = "default";

/**
 * Returns true if the given request path is in the public list, or is under
 * a public prefix (e.g. /api/webhooks/*), or matches a parameterized public
 * path pattern (e.g. /vendor/sealed-bid/rounds/:roundId/bid).
 */
export function isPublicApiPath(path: string): boolean {
  if (PUBLIC_API_PATHS.has(path)) return true;
  if (path.startsWith("/webhooks/")) return true;
  // Check parameterized patterns — replace :param segments with wildcards
  for (const pattern of PUBLIC_API_PATHS) {
    if (pattern.includes(":")) {
      const regex = new RegExp(
        "^" + pattern.replace(/:[^/]+/g, "[^/]+") + "$",
      );
      if (regex.test(path)) return true;
    }
  }
  return false;
}
