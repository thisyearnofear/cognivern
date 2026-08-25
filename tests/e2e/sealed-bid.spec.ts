import { test, expect } from '@playwright/test';

/**
 * Sealed-bid vendor selection surface. Without a session the rounds hook
 * falls back to the demo round collection, so this spec covers the guest
 * (demo-data) render and form interaction only. It deliberately never
 * submits: creating a round posts to the live Canton backend, and ops
 * policy (AGENTS.md) bans probe rounds because they cannot be cancelled.
 */
test.describe('Sealed-bid vendor selection', () => {
  test('renders the surface with create actions and seeded demo rounds', async ({ page }) => {
    await page.goto('/sealed-bid');

    await expect(
      page.getByRole('heading', { name: /Sealed-bid vendor selection/i, level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByText(/Bids stay sealed from competitors/i),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /Create agent round/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Create manually/i }).first()).toBeVisible();
    // Guest fallback shows the seeded demo rounds instead of the empty state.
    await expect(page.getByText(/Q3 security audit RFP/i).first()).toBeVisible();
    await expect(page.getByText('No vendor selection rounds')).toHaveCount(0);
  });

  test('agent round form opens from the header and cancels cleanly', async ({ page }) => {
    await page.goto('/sealed-bid');

    // The header action is the lowest-friction path into the form.
    await page.getByRole('button', { name: /Create agent round/i }).first().click();

    await expect(page.getByText('Agent-initiated round')).toBeVisible();
    await expect(page.getByText(/policy-governed/)).toBeVisible();

    // Cancel instead of ever submitting — see the describe-block note.
    await page.getByRole('button', { name: /Cancel/i }).first().click();
    await expect(page.getByText('Agent-initiated round')).toHaveCount(0);
  });
});
