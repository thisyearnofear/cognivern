import { describe, it, expect } from 'vitest';
import { isPublicApiPath, PUBLIC_API_PATHS } from '@backend/middleware/publicEndpoints.js';

describe('publicEndpoints — auth bypass list', () => {
  it('does NOT bypass /events/stream', () => {
    // Regression guard: EventsController.streamEvents demands req.workspaceId,
    // which is populated by authMiddleware. Adding /events/stream here makes
    // the middleware skip JWT verification and the controller then 401s every
    // SSE connection. The middleware already handles the ?token= query-param
    // flow specifically for SSE paths.
    expect(isPublicApiPath('/events/stream')).toBe(false);
    expect(PUBLIC_API_PATHS.has('/events/stream')).toBe(false);
  });

  it('does NOT bypass /cre/runs/:runId/approval', () => {
    // Regression guard for commit 02e7e76: held spend approvals broadcast real
    // money; bypassing auth here lets any caller move funds from a scoped
    // wallet. The CreController additionally requires req.userId from the JWT.
    expect(isPublicApiPath('/cre/runs/:runId/approval')).toBe(false);
  });

  it('does NOT bypass credential-backed Cleanverse deposit lookups', () => {
    // Deposit lookup spends server-side Cleanverse quota and must require
    // the normal API/JWT authentication path.
    expect(isPublicApiPath('/cleanverse/deposit-address')).toBe(false);
    expect(PUBLIC_API_PATHS.has('/cleanverse/deposit-address')).toBe(false);
  });

  it('still bypasses the signed news webhook only', () => {
    expect(isPublicApiPath('/webhooks/chain-gpt-news')).toBe(true);
    expect(isPublicApiPath('/webhooks/holds')).toBe(false);
    expect(isPublicApiPath('/webhooks/holds/policy-1/release')).toBe(false);
    expect(isPublicApiPath('/webhooks/anything-else')).toBe(false);
  });

  it('does NOT bypass /intent', () => {
    expect(isPublicApiPath('/intent')).toBe(false);
    expect(isPublicApiPath('/intent/metrics')).toBe(false);
  });

  it('does NOT bypass /spend/scan', () => {
    // ChainGPT auditor credits — must require JWT / workspace API key.
    expect(isPublicApiPath('/spend/scan')).toBe(false);
    expect(PUBLIC_API_PATHS.has('/spend/scan')).toBe(false);
  });

  it('still bypasses /health and /health/slo for monitoring', () => {
    expect(isPublicApiPath('/health')).toBe(true);
    expect(isPublicApiPath('/health/slo')).toBe(true);
  });
});
