import { chromium } from "@playwright/test";
import fs from "node:fs";

const OUT_DIR = "/tmp/wallet-onboard-screenshots";
fs.mkdirSync(OUT_DIR, { recursive: true });

async function screenshot(page, name: string) {
  const path = `${OUT_DIR}/${Date.now()}-${name}.png`;
  await page.screenshot({ path, fullPage: true });
  console.log(`screenshot: ${path}`);
}

async function main() {
  const username = process.env.WALLET_USERNAME ?? "papa";
  const password = process.env.WALLET_PASSWORD ?? "";
  if (!password) {
    console.error("Set WALLET_PASSWORD env var");
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  await page.goto("https://wallet.validator.hackcanton-01.devnet.naas.noders.services/", {
    waitUntil: "networkidle",
  });
  await screenshot(page, "wallet-landing");

  // Look for login button / connect wallet
  const bodyText = await page.locator("body").innerText();
  console.log("=== landing body text ===");
  console.log(bodyText.slice(0, 2000));

  // Click the OAuth2 login button
  const loginButton = page.getByRole("button", { name: /Log In with OAuth2/i });
  if (await loginButton.isVisible().catch(() => false)) {
    console.log("Clicking 'Log In with OAuth2'...");
    await loginButton.click();
  } else {
    // fallback: any button containing the text
    const alt = page.locator("button, a").filter({ hasText: /OAuth2/i }).first();
    await alt.click();
  }

  // Wait for Keycloak or popup
  await page.waitForTimeout(3000);
  await screenshot(page, "post-click");

  // Handle Keycloak login
  if (page.url().includes("keycloak")) {
    console.log("Keycloak login page detected");
    await screenshot(page, "keycloak");
    await page.locator("input#username, input[name='username']").fill(username);
    await page.locator("input#password, input[name='password']").fill(password);
    await screenshot(page, "keycloak-filled");
    await page.locator("input[type='submit'], button[type='submit']").click();
    await page.waitForTimeout(5000);
    await screenshot(page, "after-login");
  }

  // Onboarding flow — capture whatever appears
  for (let i = 0; i < 5; i++) {
    await page.waitForTimeout(2000);
    await screenshot(page, `onboarding-${i}`);
    const text = await page.locator("body").innerText();
    console.log(`=== page ${i}: ${page.url()} ===`);
    console.log(text.slice(0, 1500));
    // Click primary action buttons, waiting for enabled state
    const action = page.getByRole("button").filter({
      hasText: /next|continue|create|onboard|finish|get started|start|agree|accept/i,
    }).first();
    try {
      await action.waitFor({ state: "visible", timeout: 5000 });
      await action.waitFor({ state: "enabled", timeout: 30000 });
      await action.click();
    } catch {
      break;
    }
  }

  await browser.close();
  console.log("Onboarding exploration complete. Check screenshots in", OUT_DIR);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
