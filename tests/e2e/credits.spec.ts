import { test, expect } from '@playwright/test';

/**
 * Participant self-service (/credits) — the no-login surface where a tester
 * pastes the cvk_ key their organiser handed out. Gateway responses are
 * stubbed at the network boundary; auth failure handling is covered with a
 * 401 stub. The live gateway contract itself is covered by
 * sponsor-credits.spec.ts.
 */

const KEY = 'cvk_test_fixture_key';

const CREDITS = {
  participant: { handle: 'gina', projectTag: 'wedge', disclosureTier: 'private', status: 'active' },
  program: {
    id: 'cp_fixture',
    name: 'Autumn Agent Hack',
    sponsor: 'Wedge Conf',
    status: 'active',
    startsAt: null,
    endsAt: '2026-08-25T00:00:00.000Z',
    allowedModels: ['openai/gpt-oss-120b'],
    backend: '0g-router',
  },
  balance: { allocatedUsd: 5, consumedUsd: 1.25, reservedUsd: 0.5, availableUsd: 3.25, requestCount: 41 },
  disclosureOptions: [
    { tier: 'private', multiplier: 0.85, allocationUsd: 4.25, current: true },
    { tier: 'standard', multiplier: 1, allocationUsd: 5, current: false },
    { tier: 'detailed', multiplier: 1.1, allocationUsd: 5.5, current: false },
    { tier: 'open', multiplier: 1.25, allocationUsd: 6.25, current: false },
  ],
};

const ACTIVITY = {
  participant: 'gina',
  disclosureTier: 'private',
  summary: { requests: 2, costUsd: 0.014 },
  withheldFromSponsor: 2,
  calls: [
    {
      youSee: {
        id: 'call_1',
        createdAt: '2026-08-18T10:00:00.000Z',
        model: 'openai/gpt-oss-120b',
        costUsd: 0.01,
      },
      sponsorSees: null,
    },
    {
      youSee: {
        id: 'call_2',
        createdAt: '2026-08-18T11:00:00.000Z',
        model: 'openai/gpt-oss-20b',
        costUsd: 0.004,
      },
      sponsorSees: null,
    },
  ],
  explanation: { storage: 's', redaction: 'r', digests: 'd' },
};

const RECEIPT = {
  participant: { handle: 'gina', programId: 'cp_fixture' },
  commitment: {
    id: 'cmt_fixture-0000-0000-0000-000000000001',
    status: 'anchored',
    commitmentRoot: '9abc'.repeat(16),
    createdAt: '2026-08-18T12:00:00.000Z',
  },
  state: {},
  proof: { leaf: 'ff'.repeat(32), index: 3, path: ['ab'.repeat(32)] },
};

test.describe('Participant self-service (/credits)', () => {
  test('a paste of the organiser key shows balance, sponsor visibility, and the receipt', async ({
    page,
  }) => {
    await page.route('**/v1/credits/verification', (route) =>
      route.fulfill({ json: RECEIPT }),
    );
    await page.route('**/v1/credits/activity*', (route) =>
      route.fulfill({ json: ACTIVITY }),
    );
    await page.route('**/v1/credits', (route) => {
      // The key must arrive as the Bearer credential.
      expect(route.request().headers()['authorization']).toBe(`Bearer ${KEY}`);
      return route.fulfill({ json: CREDITS });
    });

    await page.goto('/credits');
    await page.getByPlaceholder(/cvk_/i).fill(KEY);
    await page.getByRole('button', { name: /Check balance/i }).click();

    // Balance card.
    await expect(page.getByText('Autumn Agent Hack')).toBeVisible();
    await expect(page.getByText('$3.25')).toBeVisible();
    await expect(page.getByText('$1.25')).toBeVisible();
    await expect(page.getByText('41 call(s) so far')).toBeVisible();
    await expect(page.getByText('private tier')).toBeVisible();

    // Authorisation header assertion is inside the /v1/credits route handler.

    // What the sponsor sees — private tier withholds rows entirely.
    await expect(page.getByText('What your sponsor sees')).toBeVisible();
    await expect(page.getByText(/2 of your last 2 call\(s\) withheld/)).toBeVisible();
    await expect(page.getByText('withheld').first()).toBeVisible();

    // Verifiable receipt with the jump into the public commitment page.
    const verifyLink = page.getByRole('link', { name: /Open public verification/i });
    await expect(verifyLink).toBeVisible();
    await expect(verifyLink).toHaveAttribute('href', `/verify?id=${RECEIPT.commitment.id}`);
  });

  test('an invalid key surfaces the gateway error without a crash', async ({ page }) => {
    await page.route('**/v1/credits', (route) =>
      route.fulfill({
        status: 401,
        json: {
          error: { message: 'Invalid, revoked, or missing gateway key.', type: 'invalid_request_error' },
        },
      }),
    );

    await page.goto('/credits');
    await page.getByPlaceholder(/cvk_/i).fill('cvk_wrong');
    await page.getByRole('button', { name: /Check balance/i }).click();
    await expect(page.getByText('Invalid, revoked, or missing gateway key.')).toBeVisible();
    await expect(page.getByText('Autumn Agent Hack')).toHaveCount(0);
  });
});
