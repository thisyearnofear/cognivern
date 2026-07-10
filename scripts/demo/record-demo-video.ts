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

const narrationScript = `Hi, this is team thisyearnofear, and this is Cognivern — a private sealed-bid RFP and OTC vendor-selection protocol built on Canton Network, submitted to Track 1, Private DeFi and Capital Markets.

When institutions run an RFP — for legal counsel, a security audit, or a cloud procurement — every bidder needs to see the auction, but no bidder should see competitor pricing. Email RFPs leak. Procurement portals unblind through a single SaaS provider, creating a new counterparty risk inside an already outsourced workflow. OTC desks face the same problem: market makers won't quote tight spreads if their print levels leak.

Canton Network solves this structurally. Our Daml model gives each Bid contract a bidder signatory and the auctioneer as the sole observer. At reveal, the CloseAndReveal consuming choice selects the winner, archives every losing Bid in flight, and creates the AuctionResult — all in one atomic ledger transaction. No threshold decryption. No leaking losers.

Here is the live product at cognivern dot vercel dot app slash sealed-bid. We will create a Canton-backed private RFP, submit three bids, and prove that competitors cannot read each other's amounts.

We create a new Canton-backed round. The backend writes a SealedBidAuction contract to the DevNet ledger and it appears in the live UI.

Alice submits a sealed bid of $91,000. On Canton, this amount is visible only to the auctioneer.

Bob bids $74,500.

Charlie bids $108,000. Each bid becomes its own sub-transaction-private contract.

Now we toggle the Party view. As Alice, only Alice's bid is readable. As Bob, only Bob's. As Charlie, only Charlie's. Switch to the auctioneer, and all three bids are visible. This filtering happens inside the Canton participant node, not in our application code.

The auctioneer closes bidding, then reveals the winner atomically. One transaction consumes every losing Bid and emits the AuctionResult.

Bob wins at $74,500. The losing amounts are archived and never disclosed. That is structural privacy.

Behind the scenes, every lifecycle step is anchored in a hash-signed audit ledger. We ship 31 passing Vitest tests, 24 TestSprite CLI tests against the live API, and the Canton privacy invariants are asserted by querying the Daml JSON Ledger API directly as each party — not by trusting our backend cache. The Daml model is just 79 lines, and the backend is participant-agnostic, so the same code already runs against the HackCanton S2 DevNet — no code change required.

Cognivern brings institutional sealed-bid workflows to Canton Network — provably private, end-to-end tested, and live today. Try the demo at cognivern dot vercel dot app slash sealed-bid and read the code at github dot com slash thisyearnofear slash cognivern.`;

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

  // Prepend 17 seconds of silence so the live product UI is visible before the
  // narrator starts, pushing the total runtime closer to the requested 3 minutes.
  const silenceFile = path.join(artifactsDir, "demo-silence.aiff");
  const listFile = path.join(artifactsDir, "demo-audio-list.txt");
  const extendedAudioPath = path.join(artifactsDir, "demo-narration-extended.aiff");
  execSync(
    `ffmpeg -y -f lavfi -i anullsrc=r=22050:cl=mono -t 17 -acodec pcm_s16be ${silenceFile}`,
    { stdio: "pipe" },
  );
  await fs.writeFile(
    listFile,
    `file '${silenceFile}'\nfile '${audioPath}'\n`,
    "utf-8",
  );
  execSync(
    `ffmpeg -y -f concat -safe 0 -i ${listFile} -c copy ${extendedAudioPath}`,
    { stdio: "pipe" },
  );
  await fs.copyFile(extendedAudioPath, audioPath);
  console.log("Prepended 17s silence to narration");
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
    await sleep(35000);

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
    await sleep(5000);

    // Submit Alice
    await submitBid(page, "Alice", "91000", "Premium implementation team");
    await sleep(6000);

    // Submit Bob
    await submitBid(page, "Bob", "74500", "Best-value team");
    await sleep(5000);

    // Submit Charlie
    await submitBid(page, "Charlie", "108000", "Enterprise support bundle");
    await sleep(5000);

    // Party view toggles
    await toggleParty(page, "Auctioneer");
    await sleep(5000);
    await toggleParty(page, "Alice");
    await sleep(5000);
    await toggleParty(page, "Bob");
    await sleep(5000);
    await toggleParty(page, "Charlie");
    await sleep(5000);
    await toggleParty(page, "Auctioneer");
    await sleep(5000);

    // Close bidding (requires Auctioneer party view to be selected)
    await page.getByRole("button", { name: /Close bidding/ }).click();
    await page.waitForSelector("text=Reveal winner atomically", {
      timeout: 15000,
    });
    await sleep(5000);

    // Reveal
    await page.getByRole("button", { name: "Reveal winner atomically" }).click();
    await page.waitForSelector("text=Winner:", { timeout: 15000 });
    await sleep(60000);
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
