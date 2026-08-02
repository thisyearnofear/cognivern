import { test, expect } from '@playwright/test';

test.describe('Demo flow', () => {
  test('spend flow demo runs and completes', async ({ page }) => {
    await page.goto('/demo/spend');

    // Title
    await expect(page).toHaveTitle(/Cognivern/);

    // "Start Demo" button is visible
    const startButton = page.getByRole('button', { name: /Start Demo/i });
    await expect(startButton).toBeVisible();

    // Click "Start Demo" and wait for completion
    await startButton.click();

    // Wait for the demo to finish — the "Reset" button appears on completion
    const resetButton = page.getByRole('button', { name: /Reset/i });
    await expect(resetButton).toBeVisible({ timeout: 15000 });

    // The summary and branded governance moment should be visible for the
    // default approved scenario.
    await expect(page.getByText('Spend Approved')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('status').getByText('Guardrails held')).toBeVisible();
  });

  test('demo switches to ungoverned steps', async ({ page }) => {
    await page.goto('/demo/spend');

    // Default — "Encrypted" badge visible in governed mode
    await expect(page.getByText('Encrypted').first()).toBeVisible();

    // Find and click the governance toggle button
    // The toggle is inside a flex row with "ShieldOff" icon and "Governed" label
    const toggleContainer = page.locator('div.flex.items-center.justify-center.gap-3');
    const toggleButton = toggleContainer.locator('button');
    await toggleButton.click();

    // Now running in ungoverned mode — the flow explains the missing evidence.
    await expect(page.getByText('No Audit Trail', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Without governance:', { exact: true })).toBeVisible();
  });

  test('landing page loads and has core content', async ({ page }) => {
    await page.goto('/');

    // Core content
    await expect(page).toHaveTitle(/Cognivern/);
    await expect(page.getByText('Keep AI agents').first()).toBeVisible();

    // The guided spend demo CTA is visible
    const demoButton = page.getByRole('button', { name: /Try a blocked spend/i });
    await expect(demoButton).toBeVisible();
  });
});
