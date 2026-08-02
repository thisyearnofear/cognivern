import { test, expect } from '@playwright/test';

const testEmail = process.env.E2E_TEST_EMAIL;
const testPassword = process.env.E2E_TEST_PASSWORD;

/**
 * This suite is deliberately opt-in. It uses an existing disposable account,
 * never creates an account, and only navigates/read-checks core surfaces.
 *
 * Run with:
 * E2E_TEST_EMAIL=... E2E_TEST_PASSWORD=... pnpm exec playwright test tests/e2e/authenticated-smoke.spec.ts
 */
test.describe('Authenticated user-testing smoke', () => {
  test.skip(
    !testEmail || !testPassword,
    'Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD for a disposable test account',
  );

  test('signs in and reaches the core operational surfaces', async ({ page }) => {
    await page.goto('/');

    await page
      .getByRole('button', { name: /^Sign In$/i })
      .first()
      .click();
    await expect(page.getByRole('heading', { name: /Sign in to Cognivern/i })).toBeVisible();

    const authForm = page.locator('form').filter({ has: page.getByLabel('Email') });
    await authForm.getByLabel('Email').fill(testEmail!);
    await authForm.getByLabel('Password').fill(testPassword!);
    await authForm.getByRole('button', { name: /^Sign In$/i }).click();

    await expect(page).toHaveURL(/\/dashboard(?:\?.*)?$/);
    await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();

    await page.goto('/governance/check');
    await expect(page.getByRole('heading', { name: /Governance Check/i, level: 1 })).toBeVisible();

    await page.goto('/audit');
    await expect(page.getByRole('heading', { name: /Audit/i, level: 1 })).toBeVisible();

    await page.goto('/runs');
    await expect(page.getByRole('heading', { name: 'Runs', level: 1 })).toBeVisible();

    await page.goto('/agents');
    await expect(page.getByRole('heading', { name: /API Identities/i, level: 1 })).toBeVisible();
  });
});
