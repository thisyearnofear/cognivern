import { test, expect } from '@playwright/test';

test.describe('Landing page', () => {
  test('loads and displays core content', async ({ page }) => {
    await page.goto('/');

    // Title should contain Cognivern
    await expect(page).toHaveTitle(/Cognivern/);

    // Brand name visible in the header
    const brand = page.getByText('Cognivern', { exact: false }).first();
    await expect(brand).toBeVisible();

    // Hero headline
    await expect(page.getByText('Keep AI agents').first()).toBeVisible();

    // Primary CTA — the current guided spend demo
    const demoButton = page.getByRole('button', { name: /Try a blocked spend/i });
    await expect(demoButton).toBeVisible();

    // Secondary CTA — private vendor-selection demo
    await expect(page.getByRole('button', { name: /Explore private selection/i })).toBeVisible();
  });
});
