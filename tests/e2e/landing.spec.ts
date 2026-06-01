import { test, expect } from "@playwright/test";

test.describe("Landing page", () => {
  test("loads and displays core content", async ({ page }) => {
    await page.goto("/");

    // Title should contain Cognivern
    await expect(page).toHaveTitle(/Cognivern/);

    // Brand name visible in the header
    const brand = page.getByText("Cognivern", { exact: false }).first();
    await expect(brand).toBeVisible();

    // Hero headline
    await expect(
      page.getByText("Govern every agent transaction")
    ).toBeVisible();

    // Primary CTA — "Try Demo" button
    const demoButton = page.getByRole("button", { name: /Try Demo/i });
    await expect(demoButton).toBeVisible();

    // Secondary CTA — "Connect Wallet" button
    const connectButton = page.getByRole("button", {
      name: /Connect Wallet/i,
    });
    await expect(connectButton).toBeVisible();
  });
});
