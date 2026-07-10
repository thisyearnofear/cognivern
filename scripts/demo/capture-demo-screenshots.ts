import { chromium } from "@playwright/test";
import { promises as fs } from "fs";
import path from "path";

const baseUrl = "https://cognivern.vercel.app/sealed-bid";
const apiBaseUrl = "https://cognivern.thisyearnofear.com";
const apiKey = process.env.COGNIVERN_API_KEY || "";
const outDir = path.join(process.cwd(), ".artifacts", "demo-shots");

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createRound(marker: string): Promise<string> {
  const res = await fetch(`${apiBaseUrl}/api/vendor/sealed-bid/rounds`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
    },
    body: JSON.stringify({
      description: `HackCanton DevNet demo ${marker}`,
      serviceCategory: "private-otc",
      deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      maxBids: 5,
      backend: "canton",
    }),
  });
  const body = (await res.json()) as any;
  if (!res.ok || !body.success || !body.data?.roundId) {
    throw new Error(`createRound failed: ${res.status} ${JSON.stringify(body)}`);
  }
  return body.data.roundId;
}

async function submitBid(page: any, bidder: string, amount: string, proposal: string) {
  await page.locator('[data-slot="select-trigger"]').first().click();
  await page.getByRole("option", { name: bidder }).click();
  await page.locator('input[type="number"]').fill(amount);
  await page.getByPlaceholder("Short pitch").fill(proposal);
  await page.getByRole("button", { name: new RegExp(`Submit as ${bidder}`) }).click();
  await page.waitForSelector(`text=${bidder}`, { timeout: 15000 });
}

async function toggleParty(page: any, party: string) {
  const partyView = page.locator("text=Party view").first().locator("xpath=../..");
  await partyView.getByRole("button", { name: party }).click();
  await sleep(300);
}

async function capture() {
  await fs.mkdir(outDir, { recursive: true });

  const marker = Date.now().toString(36);
  console.log("Creating round via API...");
  await createRound(marker);

  const context = await chromium.launchPersistentContext(
    path.join(outDir, "pw-user-data"),
    {
      headless: true,
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 2,
    },
  );
  const page = await context.newPage();

  try {
    // 01 landing
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.waitForSelector("text=Sealed-bid vendor selection", { timeout: 15000 });
    await sleep(1000);
    await page.screenshot({ path: path.join(outDir, "01-landing.png"), fullPage: false });
    console.log("captured 01-landing.png");

    // refresh to see new round
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.waitForSelector(`text=${marker}`, { timeout: 30000 });
    await page.getByText(marker).first().click();
    await page.waitForSelector("text=Submit sealed bid", { timeout: 15000 });
    await sleep(500);
    await page.screenshot({ path: path.join(outDir, "02-round-empty.png"), fullPage: false });
    console.log("captured 02-round-empty.png");

    // Alice
    await submitBid(page, "Alice", "91000", "Premium implementation team");
    await sleep(300);
    await page.screenshot({ path: path.join(outDir, "03-bid-alice.png"), fullPage: false });
    console.log("captured 03-bid-alice.png");

    // Bob
    await submitBid(page, "Bob", "74500", "Best-value team");
    await sleep(300);
    await page.screenshot({ path: path.join(outDir, "04-bid-bob.png"), fullPage: false });
    console.log("captured 04-bid-bob.png");

    // Charlie
    await submitBid(page, "Charlie", "108000", "Enterprise support bundle");
    await sleep(300);
    await page.screenshot({ path: path.join(outDir, "05-bid-charlie.png"), fullPage: false });
    console.log("captured 05-bid-charlie.png");

    // Party views
    await toggleParty(page, "Alice");
    await page.screenshot({ path: path.join(outDir, "06-view-alice.png"), fullPage: false });
    console.log("captured 06-view-alice.png");

    await toggleParty(page, "Bob");
    await page.screenshot({ path: path.join(outDir, "07-view-bob.png"), fullPage: false });
    console.log("captured 07-view-bob.png");

    await toggleParty(page, "Auctioneer");
    await page.screenshot({ path: path.join(outDir, "08-view-auctioneer.png"), fullPage: false });
    console.log("captured 08-view-auctioneer.png");

    // Close and reveal
    await page.getByRole("button", { name: /Close bidding/ }).click();
    await page.waitForSelector("text=Reveal winner atomically", { timeout: 15000 });
    await sleep(300);
    await page.screenshot({ path: path.join(outDir, "09-closed.png"), fullPage: false });
    console.log("captured 09-closed.png");

    await page.getByRole("button", { name: "Reveal winner atomically" }).click();
    await page.waitForSelector("text=Winner:", { timeout: 15000 });
    await sleep(500);
    await page.screenshot({ path: path.join(outDir, "10-revealed.png"), fullPage: false });
    console.log("captured 10-revealed.png");
  } catch (err) {
    console.error(err);
    throw err;
  } finally {
    await context.close();
  }

  console.log(`All screenshots saved to ${outDir}`);
}

capture().catch((err) => {
  console.error(err);
  process.exit(1);
});
