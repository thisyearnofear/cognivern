import { describe, it, expect } from "vitest";
import {
  isPublicApiPath,
  PUBLIC_API_PATHS,
} from "@backend/middleware/publicEndpoints.js";

describe("publicEndpoints — auth bypass list", () => {
  it("does NOT bypass /events/stream", () => {
    // Regression guard: EventsController.streamEvents demands req.workspaceId,
    // which is populated by authMiddleware. Adding /events/stream here makes
    // the middleware skip JWT verification and the controller then 401s every
    // SSE connection. The middleware already handles the ?token= query-param
    // flow specifically for SSE paths.
    expect(isPublicApiPath("/events/stream")).toBe(false);
    expect(PUBLIC_API_PATHS.has("/events/stream")).toBe(false);
  });

  it("does NOT bypass /cre/runs/:runId/approval", () => {
    // Regression guard for commit 02e7e76: held spend approvals broadcast real
    // money; bypassing auth here lets any caller move funds from a scoped
    // wallet. The CreController additionally requires req.userId from the JWT.
    expect(isPublicApiPath("/cre/runs/:runId/approval")).toBe(false);
  });

  it("still bypasses webhooks (prefix match)", () => {
    expect(isPublicApiPath("/webhooks/chain-gpt-news")).toBe(true);
    expect(isPublicApiPath("/webhooks/anything-else")).toBe(true);
  });

  it("still bypasses /health", () => {
    expect(isPublicApiPath("/health")).toBe(true);
  });
});
