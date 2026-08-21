import { test, expect } from '@playwright/test';

/**
 * Settings rails coverage. The "Supported Chains" card renders statically
 * from the shared rails registry (packages/shared/src/rails.ts) without any
 * API call, so it is fully exercisable without a session. The workspace
 * rail-preferences card itself requires an authenticated workspace and is
 * covered by the opt-in authenticated suite instead.
 */
test.describe('Settings — supported rails', () => {
  test('renders the rail registry with live evidence and execution rails', async ({ page }) => {
    await page.goto('/settings');

    await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
    await expect(page.getByText('Supported Chains')).toBeVisible();

    // Registry-driven rows: display names come from packages/shared rails.
    await expect(page.getByText('X Layer Testnet')).toBeVisible();
    await expect(page.getByText('X Layer', { exact: true })).toBeVisible();
    await expect(page.getByText('0G Chain')).toBeVisible();
    await expect(page.getByText('Canton DevNet')).toBeVisible();
    await expect(page.getByText('Mantle Sepolia')).toBeVisible();
  });
});
