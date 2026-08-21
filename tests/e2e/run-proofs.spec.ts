import { test, expect } from '@playwright/test';

/**
 * Unauthenticated visitors explore with demo data (useApiWithDemo falls back
 * when no session exists). run-001 carries the real dual-chain mainnet probe
 * proofs (docs/XLAYER_PROOF_V2.md), so this spec exercises the actual proof
 * surface without any backend dependency.
 */
test.describe('Run detail — governance proof anchors', () => {
  test('surfaces 0G and X Layer proof receipts with explorer links', async ({ page }) => {
    await page.goto('/runs/run-001');

    await expect(
      page.getByRole('heading', { name: /Alpha Trader — Market Scan \+ Execute/i, level: 1 }),
    ).toBeVisible();

    // The proof card renders with one row per anchored rail.
    await expect(page.getByText('On-chain governance proofs')).toBeVisible();
    await expect(page.getByText('Chain 196')).toBeVisible();
    await expect(page.getByText('Chain 16661')).toBeVisible();
    await expect(page.getByText('Block 68566290')).toBeVisible();
    await expect(page.getByText('Block 42262905')).toBeVisible();

    const proofButtons = page.getByRole('button', { name: /View proof/i });
    await expect(proofButtons).toHaveCount(2);

    // The decision receipt lists the anchors as evidence.
    await expect(page.getByText('On-chain proof anchors')).toBeVisible();
  });

  test('run detail for a run without anchors does not show the proof card', async ({ page }) => {
    await page.goto('/runs/run-002');

    await expect(
      page.getByRole('heading', { name: /Beta Rebalancer — Portfolio Rebalance/i, level: 1 }),
    ).toBeVisible();
    await expect(page.getByText('On-chain governance proofs')).toHaveCount(0);
  });
});
