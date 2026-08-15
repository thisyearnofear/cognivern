import { test, expect } from '@playwright/test';

test.describe('Landing page', () => {
  test('loads and displays core content', async ({ page }) => {
    await page.goto('/');

    // Title should contain Cognivern
    await expect(page).toHaveTitle(/Cognivern/);

    // Brand name visible in the header
    const brand = page.getByText('Cognivern', { exact: false }).first();
    await expect(brand).toBeVisible();

    // Hero headline — the product promise stays job-first, not infrastructure-first.
    await expect(page.getByText('Delegate consequential work.').first()).toBeVisible();

    // Primary CTA — the guided governed-request demo.
    const demoButton = page.getByRole('button', { name: /Try a governed request/i });
    await expect(demoButton).toBeVisible();

    // Secondary CTA — the product flow explanation.
    await expect(page.getByRole('button', { name: /See how it works/i })).toBeVisible();
  });
});
