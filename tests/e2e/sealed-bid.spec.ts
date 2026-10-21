import { test, expect } from '@playwright/test';

/**
 * Sealed-bid vendor selection surface. Without a session the rounds hook
 * falls back to the demo round collection, so this spec covers the guest
 * (demo-data) render and interaction only. It deliberately never submits:
 * creating a round posts to the live Canton backend, and ops policy
 * (AGENTS.md) bans probe rounds because they cannot be cancelled. No
 * close/reveal POSTs either — we assert the buttons render and validate,
 * never click them to completion.
 */
test.describe('Sealed-bid vendor selection', () => {
  test('renders the surface with unified status, search and seeded demo rounds', async ({ page }) => {
    await page.goto('/sealed-bid');

    await expect(
      page.getByRole('heading', { name: /Private vendor selection/i, level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByText(/Vendors bid blind/i),
    ).toBeVisible();
    // Single unified workspace status (replaces the old stacked demo banners).
    await expect(page.getByText(/Sample data\./i).first()).toBeVisible();
    // Header hierarchy: primary agent round + quiet manual alternative.
    await expect(page.getByRole('button', { name: /New agent round/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Manual instead/i }).first()).toBeVisible();
    // Search + status filter.
    await expect(page.getByLabel(/Search rounds/i)).toBeVisible();
    await expect(page.getByRole('group', { name: /Filter by status/i })).toBeVisible();
    // Guest fallback shows the seeded demo rounds instead of the empty state.
    await expect(page.getByText(/Q3 security audit RFP/i).first()).toBeVisible();
    await expect(page.getByText('No vendor selections yet')).toHaveCount(0);
  });

  test('search and status filter narrow the round list', async ({ page }) => {
    await page.goto('/sealed-bid');

    // Narrow by text: only the ERC-4626 round should remain.
    await page.getByLabel(/Search rounds/i).fill('ERC-4626');
    await expect(page.getByText(/Smart contract audit/i).first()).toBeVisible();
    await expect(page.getByText(/Q3 security audit RFP/i)).toHaveCount(0);

    // Clear, then filter by status: Decided shows the no-results state
    // (demo seeds only have open + closed rounds).
    await page.getByLabel(/Search rounds/i).fill('');
    await page.getByRole('button', { name: /^Decided$/ }).click();
    await expect(page.getByText(/No rounds match/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Clear filters/i })).toBeVisible();

    // Clearing restores the list.
    await page.getByRole('button', { name: /Clear filters/i }).click();
    await expect(page.getByText(/Q3 security audit RFP/i).first()).toBeVisible();
  });

  test('agent round form opens from the header and cancels cleanly', async ({ page }) => {
    await page.goto('/sealed-bid');

    // The header action is the lowest-friction path into the form.
    await page.getByRole('button', { name: /New agent round/i }).first().click();

    await expect(page.getByText('Agent-initiated round')).toBeVisible();
    await expect(page.getByText(/policy-governed/)).toBeVisible();
    // Sandbox settlement is collapsed to a single no-funds note.
    await expect(page.getByText(/No fund movement\./i)).toBeVisible();

    // Cancel instead of ever submitting — see the describe-block note.
    await page.getByRole('button', { name: /Cancel/i }).first().click();
    await expect(page.getByText('Agent-initiated round')).toHaveCount(0);
  });

  test('round detail shows lifecycle, privacy note and bid validation', async ({ page }) => {
    await page.goto('/sealed-bid');

    // Open the first demo round (client-side detail, no navigation POST).
    await page.getByRole('button', { name: /Q3 security audit RFP/i }).first().click();

    // Lifecycle stepper + humanized status pill.
    await expect(page.getByLabel(/Round progress/i)).toBeVisible();
    await expect(page.getByText(/Open for bids/i).first()).toBeVisible();
    // Privacy is explained in plain language, not implementation jargon.
    await expect(page.getByText(/How privacy works here/i)).toBeVisible();
    // Sandbox auctioneer notice (anyone may act as auctioneer in demo).
    await expect(page.getByText(/anyone can act as auctioneer/i)).toBeVisible();

    // Bid amount validation: clearing to 0 surfaces an inline error and
    // disables submit — without ever POSTing.
    const amount = page.getByLabel(/Amount \(USD\)/i);
    await expect(amount).toBeVisible();
    await amount.fill('0');
    await expect(page.getByRole('alert').filter({ hasText: /at least \$1/i })).toBeVisible();
    const submit = page.getByRole('button', { name: /Submit as /i });
    await expect(submit).toBeDisabled();
  });
});
