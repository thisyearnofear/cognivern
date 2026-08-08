import { chromium } from "@playwright/test";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("https://hackathon.appsfactory.cc/season-2#materials", {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(5000);
  const title = await page.title();
  const text = await page.locator("body").innerText();
  console.log("TITLE:", title);
  console.log("TEXT:\n", text.slice(0, 8000));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
