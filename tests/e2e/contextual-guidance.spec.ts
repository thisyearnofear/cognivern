import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Contextual-guidance pilot: human worked-example links and the read-only
 * get_mandate_review browser tool. Everything here is local — the frontend
 * is served by the Playwright webServer and every API call is either
 * intercepted with a scoped fixture or never happens (guest surfaces render
 * bundled demo data). No backend, no live ledger, no paid calls.
 */

const SHOTS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.artifacts/screenshots');

function fakeJwt(): string {
  const payload = Buffer.from(
    JSON.stringify({ sub: 'u-e2e', exp: Math.floor(Date.now() / 1000) + 3600 }),
  ).toString('base64url');
  return `e2e.${payload}.sig`;
}

/** Seed the persisted zustand auth store so the app boots connected. */
async function seedAuth(context: BrowserContext) {
  await context.addInitScript((token: string) => {
    window.localStorage.setItem(
      'civern-auth-store',
      JSON.stringify({
        state: {
          isConnected: true,
          walletAddress: '0xe2e',
          authUser: { id: 'u-e2e', walletAddress: '0xe2e' },
          workspace: { id: 'ws-e2e', name: 'E2E Workspace', tier: 'live' },
          token,
          workspaceMode: 'sandbox',
          hasExitedSandbox: true,
        },
        version: 0,
      }),
    );
  }, fakeJwt());
}

/** Capture document.modelContext registrations on window.__mcpTools. */
async function mockModelContext(context: BrowserContext) {
  await context.addInitScript(() => {
    (window as unknown as { __mcpTools: Array<{ tool: { name: string; execute: () => unknown }; signal?: AbortSignal }> }).__mcpTools = [];
    (document as unknown as { modelContext: unknown }).modelContext = {
      registerTool(tool: { name: string; execute: () => unknown }, options?: { signal?: AbortSignal }) {
        (window as unknown as { __mcpTools: Array<{ tool: { name: string; execute: () => unknown }; signal?: AbortSignal }> }).__mcpTools.push({
          tool,
          signal: options?.signal,
        });
      },
    };
  });
}

const ok = (data: unknown) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({ success: true, data }),
});

/**
 * Fail closed on any /api/ call a test did not explicitly mock — this must
 * never fall through to a real backend. Register FIRST at page level:
 * Playwright consults handlers in reverse registration order, so the
 * specific mocks added afterwards still match first and any unmatched
 * /api/ request lands here instead of escaping the sandbox.
 */
async function failClosedApi(page: Page) {
  await page.route('**/api/**', (route) =>
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, error: 'unmocked api request in e2e' }),
    }),
  );
}

const emptyAttribution = {
  generatedAt: '2026-11-25T00:00:00Z',
  totalRecords: 0,
  totalsByAsset: {},
  counts: { allocated: 0, consumed: 0, held: 0, denied: 0, failed: 0, uncertain: 0 },
  records: [],
};

test.describe('Telegraph worked example', () => {
  test('shows the Northwind aside and free-inspection link in reading order', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/telegraph', { waitUntil: 'domcontentloaded' });

    const aside = page.getByRole('complementary', { name: 'Worked example' });
    await expect(aside).toBeVisible();
    await expect(aside.getByRole('heading', { name: 'Why was this supplier held for review?' })).toBeVisible();
    await expect(aside.getByText(/fictional supplier/i)).toBeVisible();
    await expect(aside.getByText(/Low-confidence evidence sent the request to review/i)).toBeVisible();
    await expect(aside.getByText(/Recorded testnet example · No new charge/i)).toBeVisible();
    const link = aside.getByRole('link', { name: 'Inspect the decision' });
    await expect(link).toHaveAttribute('href', '/verify?report=supplier-diligence&case=2&model=groq&view=governed');
    // Paid-call pricing stays visible alongside, not inside, the example.
    await expect(page.getByText(/Miner calls pay ~\$0\.01 x402 USDC/i)).toBeVisible();

    await page.screenshot({ path: `${SHOTS}/telegraph-worked-example-wide.png`, fullPage: false });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(aside).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/telegraph-worked-example-small.png`, fullPage: false });
  });

  test('deep link opens the governed view of case 2 for groq', async ({ page }) => {
    await page.goto('/verify?report=supplier-diligence&case=2&model=groq&view=governed', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/Northwind Meridian Components/i).first()).toBeVisible();
    // Governed arm: the recorded outcome is a hold decided by the review gate
    // on low-confidence purchased evidence.
    await expect(page.getByText(/human-review hold/i).first()).toBeVisible();
    await expect(page.getByText(/Purchased evidence was low-confidence/i).first()).toBeVisible();
  });
});

test.describe('Sealed-bid empty state', () => {
  test('offers the recorded sandbox replay next to first-round actions', async ({ page, context }) => {
    await seedAuth(context);
    await failClosedApi(page);
    await page.route('**/api/vendor/sealed-bid/rounds', (route) =>
      route.request().method() === 'GET' ? route.fulfill(ok([])) : route.fallback(),
    );
    await page.route('**/api/vendor/sealed-bid/canton-identity', (route) => route.fulfill(ok(null)));
    await page.route('**/api/vendor/sealed-bid/capabilities', (route) => route.fulfill(ok({})));

    await page.goto('/sealed-bid', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('No vendor selections yet')).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole('button', { name: 'New agent round' }).last()).toBeVisible();
    const replay = page.getByRole('link', { name: 'See a completed round' });
    await expect(replay).toBeVisible();
    await expect(replay).toHaveAttribute('href', '/verify?round=sandbox-replay');
    await expect(page.getByText(/Recorded sandbox replay/i)).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/sealed-bid-empty-replay.png`, fullPage: false });
  });

  test('filtered no-results state does not show the replay link', async ({ page }) => {
    // Guest visit: bundled demo rounds, zero API calls. SSR renders the
    // input before hydration, and a pre-hydration fill never reaches React
    // state — wait for React's fiber props on the node first.
    await page.goto('/sealed-bid', { waitUntil: 'domcontentloaded' });
    const search = page.getByLabel(/Search rounds/i);
    await expect(async () => {
      const hydrated = await search.evaluate(
        (el) => Object.keys(el).some((k) => k.startsWith('__reactProps$')),
      );
      expect(hydrated).toBe(true);
    }).toPass({ timeout: 20000 });
    await search.fill('zzz-no-such-round');
    await expect(page.getByText(/No rounds match/i)).toBeVisible();
    await expect(page.getByRole('link', { name: 'See a completed round' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Clear filters/i })).toBeVisible();
  });
});

test.describe('Governance examples', () => {
  test('example buttons are labelled as evaluations with demo-policy caveats', async ({ page, context }) => {
    await failClosedApi(page);
    let evalCalls = 0;
    await page.route('**/api/governance/evaluate', (route) => {
      evalCalls += 1;
      return route.fulfill(ok({ decision: 'approved', decidedBy: 'policy', reasons: [] }));
    });

    // waitUntil: 'domcontentloaded' — a long-lived dev-server subresource
    // (HMR/refresh channel) can keep 'load' pending under route mocking.
    // The button is SSR-visible before hydration attaches onClick, so
    // retry the click until the handler is live and the call is made once.
    await page.goto('/governance/check', { waitUntil: 'domcontentloaded' });
    const example = page.getByRole('button', { name: /Evaluate example: Approved spend/i });
    await expect(example).toBeVisible();
    await expect(page.getByText(/demo policies; your policy may differ/i)).toBeVisible();
    await expect
      .poll(async () => {
        await example.click();
        return evalCalls;
      }, { timeout: 20000 })
      .toBe(1);
    await page.screenshot({ path: `${SHOTS}/governance-check-examples.png`, fullPage: false });
  });
});

test.describe('Spend attribution pilot', () => {
  async function mockSpendApi(page: Page, mandates: unknown[]) {
    await page.route('**/api/mandates', (route) => {
      if (route.request().method() === 'GET') return route.fulfill(ok(mandates));
      return route.fallback();
    });
    await page.route('**/api/mandates/context/sync-health', (route) => route.fulfill(ok(null)));
    await page.route('**/api/capital/attribution**', (route) => route.fulfill(ok(emptyAttribution)));
    await page.route('**/api/mandates/*/outcomes', (route) => route.fulfill(ok([])));
    await page.route('**/api/mandates/*/statements', (route) => route.fulfill(ok([])));
    await page.route('**/api/cre/runs**', (route) => route.fulfill(ok([])));
  }

  test('example objective fills only an empty draft and never posts', async ({ page, context }) => {
    await seedAuth(context);
    await failClosedApi(page);
    const mandateRequests: string[] = [];
    await page.route('**/api/mandates', (route) => {
      mandateRequests.push(route.request().method());
      return route.fulfill(ok([]));
    });
    await page.route('**/api/mandates/context/sync-health', (route) => route.fulfill(ok(null)));
    await page.route('**/api/capital/attribution**', (route) => route.fulfill(ok(emptyAttribution)));

    await page.goto('/spend', { waitUntil: 'domcontentloaded' });
    const fill = page.getByRole('button', { name: 'Use an example objective' });
    const objective = page.getByLabel('Objective');
    await expect(fill).toBeVisible({ timeout: 30000 });
    await expect(fill).toBeEnabled();

    // SSR renders the button before hydration attaches onClick — retry the
    // click until the draft is actually filled.
    await expect
      .poll(async () => {
        await fill.click();
        return objective.inputValue().catch(() => '');
      }, { timeout: 20000 })
      .toMatch(/Screen prospective suppliers/);
    await expect(fill).toBeDisabled();

    // A non-empty draft is never overwritten: clear, retype, confirm disabled.
    await objective.fill('My own objective');
    await expect(fill).toBeDisabled();
    await expect(objective).toHaveValue('My own objective');

    // The create action is retained and nothing was submitted.
    await expect(page.getByRole('button', { name: 'Create mandate' })).toBeVisible();
    expect(mandateRequests).not.toContain('POST');
    await page.screenshot({ path: `${SHOTS}/spend-first-mandate-example-objective.png`, fullPage: false });
  });

  test('get_mandate_review registers, returns scoped state, writes nothing, cleans up', async ({ page, context }) => {
    await seedAuth(context);
    await failClosedApi(page);
    await mockModelContext(context);
    await mockSpendApi(page, [
      {
        id: 'm-e2e',
        workspaceId: 'ws-e2e',
        name: 'Supplier screening',
        objective: 'Screen prospective suppliers.',
        agentIds: [],
        status: 'active',
        budget: { byAsset: {} },
        policyIds: [],
        successMetrics: [],
        createdAt: '2026-11-01T00:00:00Z',
        updatedAt: '2026-11-01T00:00:00Z',
      },
    ]);

    const apiRequests: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/')) apiRequests.push(`${req.method()} ${req.url()}`);
    });

    await page.goto('/spend', { waitUntil: 'domcontentloaded' });
    // Single mandate auto-selects; review section visible.
    await expect(page.getByText('Review status')).toBeVisible({ timeout: 30000 });

    // React StrictMode mounts effects twice in dev, so a superseded
    // registration may sit in the list — the live one is the last entry.
    await expect
      .poll(async () =>
        page.evaluate(
          () =>
            (window as unknown as { __mcpTools: Array<{ tool: { name: string } }> }).__mcpTools
              .length,
        ),
      )
      .toBeGreaterThanOrEqual(1);

    const baseline = apiRequests.length;
    const result = await page.evaluate(() => {
      const tools = (window as unknown as { __mcpTools: Array<{ tool: { execute: () => unknown } }> }).__mcpTools;
      return JSON.parse(tools[tools.length - 1].tool.execute() as string) as {
        status: string;
        mandate?: { id: string };
      };
    });
    expect(result.status).toBe('ok');
    expect(result.mandate?.id).toBe('m-e2e');
    // Executing the tool is a pure read of loaded state — zero network, and
    // every API call the page made was a GET (no writes, ever).
    expect(apiRequests.length).toBe(baseline);
    expect(apiRequests.every((r) => r.startsWith('GET '))).toBe(true);

    // Leaving the attribution tab revokes every registration. SSR renders
    // the tab before hydration, so retry click+check together until the
    // view switches and aborts fire.
    await expect(async () => {
      await page.getByRole('tab', { name: 'Runs' }).click();
      const allAborted = await page.evaluate(
        () =>
          (window as unknown as { __mcpTools: Array<{ signal?: AbortSignal }> }).__mcpTools.every(
            (entry) => entry.signal?.aborted,
          ),
      );
      expect(allAborted).toBe(true);
    }).toPass({ timeout: 15000 });
    const after = await page.evaluate(() => {
      const tools = (window as unknown as { __mcpTools: Array<{ tool: { execute: () => unknown } }> }).__mcpTools;
      return JSON.parse(tools[tools.length - 1].tool.execute() as string);
    });
    expect(after.status).toBe('unavailable');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('tab', { name: 'Attribution' }).click();
    await expect(page.getByText('Review status')).toBeVisible({ timeout: 30000 });
    await page.screenshot({ path: `${SHOTS}/spend-attribution-small.png`, fullPage: false });
  });
});
