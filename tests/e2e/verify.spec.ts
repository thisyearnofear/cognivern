import { test, expect } from '@playwright/test';

/**
 * The public verification page — the shareable receipt from the GTM wedge.
 * Backend responses are stubbed at the network boundary so the spec asserts
 * presentation and interaction, not the live API (the API itself is covered
 * by sponsor-credits.spec.ts against a local backend).
 */

const COMMITMENT = {
  id: 'cmt_fixture-0000-0000-0000-000000000001',
  programId: 'cp_fixture',
  status: 'anchored',
  commitmentRoot: '9abc'.repeat(16),
  participantCount: 24,
  highWaterMark: '480000000000',
  highWaterMarkUsd: 480,
  createdAt: '2026-08-18T12:00:00.000Z',
  anchors: {
    zerogRootHash: `0x${'a1'.repeat(32)}`,
    zerogTxHash: `0x${'b2'.repeat(32)}`,
    filecoinCid: 'bafyfixturecid',
    filecoinTxHash: `0x${'c3'.repeat(32)}`,
    filecoinActionId: 'act_fixture',
  },
  program: { name: 'Autumn Agent Hack', sponsorName: 'Wedge Conf', status: 'active' },
};

function stubMetadata(page: import('@playwright/test').Page) {
  return page.route('**/verify/credit-commitment/*', (route) =>
    route.fulfill({ json: { success: true, data: { commitment: COMMITMENT } } }),
  );
}

test.describe('Public commitment verification (/verify)', () => {
  test('renders a shared commitment with anchors, then verifies a receipt', async ({ page }) => {
    await stubMetadata(page);
    await page.route('**/verify/credit-commitment', (route) =>
      route.fulfill({
        json: { success: true, data: { valid: true, root: COMMITMENT.commitmentRoot } },
      }),
    );

    await page.goto(`/verify?id=${COMMITMENT.id}`);

    await expect(
      page.getByRole('heading', { name: /Verify a sponsored-inference commitment/i, level: 1 }),
    ).toBeVisible();
    await expect(page.getByText('Autumn Agent Hack')).toBeVisible();
    await expect(page.getByText('Wedge Conf')).toBeVisible();
    await expect(page.getByText('Anchored', { exact: true })).toBeVisible();
    await expect(page.getByText('24')).toBeVisible();
    await expect(page.getByText('$480')).toBeVisible();
    await expect(page.getByText(/0G Storage/)).toBeVisible();
    await expect(page.getByText(/Filecoin \(Calibration\)/)).toBeVisible();

    // Receipt inclusion check — the POST goes to the same origin and the
    // stub reports a match.
    await page
      .getByPlaceholder(/leaf/i)
      .fill(JSON.stringify({ leaf: 'ab'.repeat(32), index: 0, path: ['cd'.repeat(32)] }));
    await page.getByRole('button', { name: /Verify inclusion/i }).click();
    await expect(page.getByText('Included in this commitment')).toBeVisible();
  });

  test('a receipt that does not reproduce the root is reported as failed', async ({ page }) => {
    await stubMetadata(page);
    await page.route('**/verify/credit-commitment', (route) =>
      route.fulfill({
        json: { success: true, data: { valid: false, root: COMMITMENT.commitmentRoot } },
      }),
    );

    await page.goto(`/verify?id=${COMMITMENT.id}`);
    await page
      .getByPlaceholder(/leaf/i)
      .fill(JSON.stringify({ leaf: 'ff'.repeat(32), index: 1, path: ['ee'.repeat(32)] }));
    await page.getByRole('button', { name: /Verify inclusion/i }).click();
    await expect(page.getByText(/Does NOT reproduce this root/)).toBeVisible();
  });

  test('an unknown commitment id renders an honest not-found', async ({ page }) => {
    await page.route('**/verify/credit-commitment/*', (route) =>
      route.fulfill({ status: 404, json: { success: false, error: 'Commitment not found' } }),
    );

    await page.goto('/verify?id=cmt_missing');
    await expect(page.getByText('No commitment with that id.')).toBeVisible();
  });

  test('the landing page carries the sponsored-cohorts wedge section', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: /Sponsor a cohort at cost/i, level: 2 }),
    ).toBeVisible();
    await expect(page.getByText(/0% fees, pass-through pricing/)).toBeVisible();
    await expect(page.getByRole('link', { name: /Check your credits/i })).toHaveAttribute(
      'href',
      '/credits',
    );
  });
});
