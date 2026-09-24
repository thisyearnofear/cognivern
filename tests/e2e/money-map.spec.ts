import { test, expect } from '@playwright/test';

/**
 * Money-map probes: a funder can answer what money does, what it costs,
 * whether funds move, and where the receipt lands — without reading docs.
 */
test.describe('Money map', () => {
  test('/spend shows the four fundable actions with settlement + receipt', async ({ page }) => {
    await page.goto('/spend');

    const map = page.getByLabel('What you can fund');
    await expect(map).toBeVisible();

    for (const label of ['Pay or transfer', 'Private selection', 'Verified signals', 'Sponsored inference']) {
      await expect(map.getByText(label, { exact: true })).toBeVisible();
    }

    // Settlement honesty: selection-only vs funds-moving paths are explicit.
    await expect(map.getByText(/Moves funds on approval/)).toBeVisible();
    await expect(map.getByText(/selection only/i)).toBeVisible();
    // Receipt honesty: every action names its receipt (tooltip = progressive disclosure).
    const transfer = map.getByRole('button', { name: /Pay or transfer/ });
    await expect(transfer).toHaveAttribute('title', /Receipt:/);
  });

  test('/sealed-bid states manual rounds do not escrow funds', async ({ page }) => {
    await page.goto('/sealed-bid');

    await expect(page.getByText(/does not escrow funds/i).first()).toBeVisible();
    await expect(page.getByText(/Create manually/i).first()).toBeVisible();
  });

  test('/telegraph states per-call cost and confidence gating', async ({ page }) => {
    await page.goto('/telegraph');

    await expect(page.getByText(/~\$0\.01 in x402 USDC/i)).toBeVisible();
    await expect(page.getByText(/confidence.*approves.*holds/i).first()).toBeVisible();
  });
});
