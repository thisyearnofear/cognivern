#!/usr/bin/env tsx
/**
 * Record a 3-minute narrated demo video of the live Cognivern sealed-bid UI.
 *
 * Run:
 *   pnpm tsx scripts/demo/record-demo-video.ts
 *
 * Outputs:
 *   - .artifacts/demo-recording.webm
 *   - .artifacts/demo-narration.aiff
 *   - docs/demo-video.mp4
 */

import { chromium, type BrowserContext, type Page } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const artifactsDir = path.join(repoRoot, ".artifacts");
const videoPath = path.join(artifactsDir, "demo-recording.webm");
const audioPath = path.join(artifactsDir, "demo-narration.aiff");
const outputPath = path.join(repoRoot, "docs", "demo-video.mp4");
const baseUrl =
  process.env.COGNIVERN_DEMO_URL || "https://cognivern.vercel.app/sealed-bid";
const apiBaseUrl =
  process.env.COGNIVERN_API_URL ||
  (baseUrl.includes("vercel")
    ? "https://cognivern.thisyearnofear.com"
    : baseUrl.replace(/\/sealed-bid\/?$/, ""));

const narrationScript = `Cognivern. Private sealed-bid RFPs and OTC selection on Canton Network.

Institutional RFPs leak pricing. Email RFPs let competitors band. Procurement portals centralize unblinding, creating counterparty risk. OTC desks won't quote tight spreads if print levels leak.

Canton fixes this structurally. In our Daml model, each bid is signatory bidder plus observer manager only. CloseAndReveal selects the winner, archives every losing bid in flight, and emits the AuctionResult in one atomic transaction.

Here is the live product on Canton DevNet. We create a private round, submit three bids, and prove competitors cannot read each other's amounts.

Create a Canton-backed round. Alice bids $91,000. Bob bids $74,500. Charlie bids $108,000.

Toggle the party view. Alice sees only Alice. Bob sees only Bob. Charlie sees only Charlie. The auctioneer sees all three. This disclosure happens inside the Canton participant node, not our backend.

The auctioneer closes bidding and reveals the winner atomically. Bob wins at $74,500. Losing amounts are never disclosed.

That is structural privacy, end-to-end tested on Canton DevNet. Try the demo at cognivern dot vercel dot app slash sealed-bid.`;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateNarration() {
  await fs.mkdir(artifactsDir, { recursive: true });
  const scriptFile = path.join(artifactsDir, "demo-narration.txt");
  await fs.writeFile(scriptFile, narrationScript, "utf-8");
  // macOS say to AIFF; ffmpeg will convert to AAC.
  execSync(`say -f ${scriptFile} -o ${audioPath}`, { stdio: "inherit" });
  console.log(`Narration saved to ${audioPath}`);
}

async function createRoundViaApi(marker: string): Promise<string> {
  const apiKey = process.env.COGNIVERN_API_KEY || "";
  const res = await fetch(`${apiBaseUrl}/api/vendor/sealed-bid/rounds`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { "X-API-KEY": apiKey } : {}),
    },
    body: JSON.stringify({
      description: `HackCanton DevNet demo ${marker}`,
      serviceCategory: "private-otc",
      deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      maxBids: 5,
      backend: "canton",
    }),
  });
  const body = (await res.json()) as { success?: boolean; data?: { roundId: string }; error?: string };
  if (!res.ok || !body.success || !body.data?.roundId) {
    throw new Error(`createRound failed: ${res.status} ${JSON.stringify(body)}`);
  }
  return body.data.roundId;
}

async function recordDemo() {
  await fs.mkdir(artifactsDir, { recursive: true });

  const context = await chromium.launchPersistentContext(
    path.join(artifactsDir, "pw-user-data"),
    {
      headless: true,
      viewport: { width: 1280, height: 720 },
      recordVideo: { dir: artifactsDir, size: { width: 1280, height: 720 } },
      deviceScaleFactor: 1,
    },
  );

  const page = await context.newPage();

  try {
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.waitForSelector("text=Sealed-bid vendor selection", {
      timeout: 15000,
    });

    // Intro + problem context pause while landing page is visible
    await sleep(5000);

    // Create a fresh Canton-backed round via the API so the manager is set
    // correctly on the DevNet backend.
    const roundMarker = Date.now().toString(36);
    const roundId = await createRoundViaApi(roundMarker);
    console.log(`Created round ${roundId}; waiting for UI card`);

    // Refresh the list so the newly created round appears.
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.waitForSelector("text=Sealed-bid vendor selection", {
      timeout: 15000,
    });

    // Wait for the new round card to appear in the list and open it.
    await page.waitForSelector(`text=${roundMarker}`, { timeout: 30000 });
    await page.getByText(roundMarker).first().click();

    // Wait for round detail to load
    await page.waitForSelector("text=Submit sealed bid", { timeout: 15000 });
    await sleep(2000);

    // Submit Alice
    await submitBid(page, "Alice", "91000", "Premium implementation team");
    await sleep(2000);

    // Submit Bob
    await submitBid(page, "Bob", "74500", "Best-value team");
    await sleep(2000);

    // Submit Charlie
    await submitBid(page, "Charlie", "108000", "Enterprise support bundle");
    await sleep(2000);

    // Party view toggles
    await toggleParty(page, "Auctioneer");
    await sleep(1500);
    await toggleParty(page, "Alice");
    await sleep(1500);
    await toggleParty(page, "Bob");
    await sleep(1500);
    await toggleParty(page, "Charlie");
    await sleep(1500);
    await toggleParty(page, "Auctioneer");
    await sleep(1500);

    // Close bidding (requires Auctioneer party view to be selected)
    await page.getByRole("button", { name: /Close bidding/ }).click();
    await page.waitForSelector("text=Reveal winner atomically", {
      timeout: 15000,
    });
    await sleep(2000);

    // Reveal
    await page.getByRole("button", { name: "Reveal winner atomically" }).click();
    await page.waitForSelector("text=Winner:", { timeout: 15000 });
    await sleep(5000);
  } catch (err) {
    console.error("Recording failed:", err);
    throw err;
  } finally {
    await context.close();
  }

  // Playwright saves video on context close; find the newest webm in artifactsDir.
  const files = await fs.readdir(artifactsDir);
  const webm = files
    .filter((f) => f.endsWith(".webm"))
    .map((f) => ({ name: f, stat: fs.stat(path.join(artifactsDir, f)) }))
    .sort((a, b) => -1 /* newest first via promise? */);
  // stat returns promise; handle below
  const entries = await Promise.all(
    files
      .filter((f) => f.endsWith(".webm"))
      .map(async (f) => ({
        name: f,
        mtime: (await fs.stat(path.join(artifactsDir, f))).mtime.getTime(),
      })),
  );
  entries.sort((a, b) => b.mtime - a.mtime);
  const newest = entries[0]?.name;
  if (!newest) {
    throw new Error("No webm video file found after recording");
  }
  const source = path.join(artifactsDir, newest);
  await fs.copyFile(source, videoPath);
  console.log(`Screen recording saved to ${videoPath}`);
}

async function submitBid(
  page: Page,
  bidder: string,
  amount: string,
  proposal: string,
) {
  await page.locator('[data-slot="select-trigger"]').first().click();
  await page.getByRole("option", { name: bidder }).click();
  await page.locator('input[type="number"]').fill(amount);
  await page.getByPlaceholder("Short pitch").fill(proposal);

  await page.getByRole("button", { name: new RegExp(`Submit as ${bidder}`) }).click();
  // Wait for the bid to appear in the party view list.
  await page.waitForSelector(`text=${bidder}`, { timeout: 15000 });
}

async function toggleParty(page: Page, party: string) {
  // Click within the Party view card to disambiguate from other buttons.
  const partyView = page.locator("text=Party view").first().locator("xpath=../..");
  await partyView.getByRole("button", { name: party }).click();
}

async function combineAudioVideo() {
  // Convert AIFF to AAC and mux with video.
  // We intentionally do NOT use -shortest so the audio (narration) drives the
  // output duration; the final video frame is held for any remaining audio.
  const cmd = `ffmpeg -y -i ${videoPath} -i ${audioPath} -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p -c:a aac -b:a 128k ${outputPath}`;
  console.log(`Running: ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
  const outStat = await fs.stat(outputPath);
  console.log(`Demo video saved to ${outputPath} (${(outStat.size / 1e6).toFixed(1)} MB)`);
}

async function main() {
  await generateNarration();
  await recordDemo();
  await combineAudioVideo();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
