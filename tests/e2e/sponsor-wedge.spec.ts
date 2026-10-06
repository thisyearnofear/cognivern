import { test, expect } from '@playwright/test';

/**
 * Sponsor landing answers offer / pain / try-it above the fold, and the
 * sample report is clearly labeled — never mistaken for live data.
 */
test.describe('Sponsor wedge', () => {
  test('/sponsor leads with organiser pain and a no-signup sample', async ({ page }) => {
    await page.goto('/sponsor');

    await expect(page.getByText(/debrief shouldn’t be guesswork|debrief shouldn't be guesswork/i).first()).toBeVisible();
    await expect(page.getByText(/metered key/i).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /see a sample report/i })).toBeVisible();
    // Sealed-bid belongs to a different buyer story — not on this page.
    await expect(page.getByText(/private selection/i)).toHaveCount(0);
  });

  test('/sponsor/sample is badged sample data with no auth', async ({ page }) => {
    await page.goto('/sponsor/sample');

    await expect(page.getByText('Sample data').first()).toBeVisible();
    await expect(page.getByLabel('Sample spend by model')).toBeVisible();
    await expect(page.getByLabel('Sample spend by task class')).toBeVisible();
    await expect(page.getByLabel('Sample verifiable receipt')).toBeVisible();
    // Receipt card points at the real verifier rather than faking a proof.
    await expect(page.getByRole('link', { name: /live verifier/i })).toBeVisible();
  });

  test('/sponsor/sample links back into the funnel', async ({ page }) => {
    await page.goto('/sponsor/sample');

    await page.getByRole('link', { name: /run this on my cohort/i }).click();
    // Generous timeout: dev-server compiles /sponsor on first visit.
    await expect(page).toHaveURL(/\/sponsor\/?$/, { timeout: 30000 });
  });
});
