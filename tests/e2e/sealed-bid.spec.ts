import { test, expect } from '@playwright/test';

/**
 * Sealed-bid vendor selection surface. Without a session the rounds hook
 * falls back to demo data (empty list), so this spec covers rendering and
 * form interaction only. It deliberately never submits: creating a round
 * posts to the live Canton DevNet participant, and ops policy (AGENTS.md)
 * bans probe rounds because they cannot be cancelled.
 */
test.describe('Sealed-bid vendor selection', () => {
  test('renders the surface with create actions and the empty state', async ({ page }) => {
    await page.goto('/sealed-bid');

    await expect(
      page.getByRole('heading', { name: /Sealed-bid vendor selection/i, level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByText(/Bids stay sealed from competitors/i),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /Create agent round/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Create manually/i }).first()).toBeVisible();
    await expect(page.getByText('No vendor selection rounds')).toBeVisible();
  });

  test('agent round form opens from the empty state and cancels cleanly', async ({ page }) => {
    await page.goto('/sealed-bid');

    // The empty-state action is the lowest-friction path into the form.
    const emptyStateAction = page.getByRole('button', { name: /Create agent round/i }).last();
    await emptyStateAction.click();

    await expect(page.getByText('Agent-initiated round')).toBeVisible();
    await expect(page.getByText(/policy-governed/)).toBeVisible();

    // Cancel instead of ever submitting — see the describe-block note.
    await page.getByRole('button', { name: /Cancel/i }).first().click();
    await expect(page.getByText('Agent-initiated round')).toHaveCount(0);
  });
});
