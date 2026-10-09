#!/usr/bin/env tsx
/**
 * Record the HackCanton S3 narrated demo video of the live Cognivern UI.
 *
 * Flow: /sealed-bid list → API-created Canton round WITH escrowed settlement
 * → 3 bids via the real UI (demo personas → DevNet demo parties) → party-view
 * disclosure toggles (live ledger queries) → close → atomic reveal → winner
 * banner incl. settlement reference → /sponsor/sample report+receipt →
 * /verify public verification.
 *
 * NOTE: creates ONE real round on the live DevNet ledger — that is the demo.
 *
 * Run:
 *   pnpm tsx tooling/scripts/demo/record-demo-video-s3.ts
 *
 * Outputs:
 *   - .artifacts/demo-recording-s3.webm
 *   - .artifacts/demo-narration-s3.aiff / .txt
 *   - .artifacts/demo-video-s3.mp4
 */

import { chromium, type Page } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const artifactsDir = path.join(repoRoot, ".artifacts");
const audioPath = path.join(artifactsDir, "demo-narration-s3.aiff");
const outputPath = path.join(artifactsDir, "demo-video-s3.mp4");
const siteUrl = process.env.COGNIVERN_DEMO_URL || "https://cognivern.persidian.com";
const apiBaseUrl =
  process.env.COGNIVERN_API_URL || "https://api.cognivern.persidian.com";

const narrationScript = `Cognivern. Verifiable evidence for agentic spend — with confidential vendor selection on Canton Network.

Hackathon organisers hand out sponsored AI budgets with no third-party-grade record of what the money did — and lose the renewal. Cognivern meters every dollar under a mandate and anchors a receipt anyone can check. This demo shows the other half: when a budget selects a vendor, Canton keeps every bid confidential and settles the winner atomically.

Here is the live product on Canton DevNet. We create a private vendor selection — a priced RFP with an escrowed deposit on ledger.

Three bids arrive: Alice at ninety-one thousand dollars. Bob at seventy-four thousand five hundred. Charlie at a hundred and eight thousand. On Canton each Bid contract is signatory-bidder, observer-auctioneer — no competitor can read another's amount.

Now the party view. This is not a UI filter — every toggle re-queries the participant node acting as that party. Alice sees one bid. Bob sees one. Charlie sees one. The auctioneer sees all three. Canton's disclosure model, live.

The auctioneer closes bidding and reveals atomically. CloseAndReveal selects the winner, archives every losing bid, and transfers the escrowed deposit — one transaction. Bob wins at seventy-four thousand five hundred dollars. The losing amounts were never disclosed to anyone — and value moved in the same transaction that published the result.

And the sponsor side of the story: every funded cohort produces a report — spend by model, task split, and a receipt. Anyone can verify the math publicly — no account, no trust in us required.

Cognivern. Fund the cohort at cost, prove every cent — and let Canton keep the bids sealed. Live at cognivern dot persidian dot com.`;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateNarration() {
  await fs.mkdir(artifactsDir, { recursive: true });
  const scriptFile = path.join(artifactsDir, "demo-narration-s3.txt");
  await fs.writeFile(scriptFile, narrationScript, "utf-8");
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
      description: `HackCanton S3 demo ${marker}`,
      serviceCategory: "private-otc-rfp",
      deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      maxBids: 5,
      backend: "canton",
      manager: "Auctioneer",
      // Escrowed PaymentDeposit — CloseAndReveal transfers it to the winner
      // in the same ledger transaction, and the banner shows the reference.
      settlementAmount: 74500,
      settlementAssetTag: "USDC",
    }),
  });
  const body = (await res.json()) as { success?: boolean; data?: { roundId: string }; error?: string };
  if (!res.ok || !body.success || !body.data?.roundId) {
    throw new Error(`createRound failed: ${res.status} ${JSON.stringify(body)}`);
  }
  return body.data.roundId;
}

async function waitPartyCount(page: Page, count: number) {
  await page.waitForFunction(
    (n) => {
      const el = [...document.querySelectorAll("div")].find((d) =>
        d.textContent?.includes("participant returned"),
      );
      return el?.textContent?.includes(`participant returned ${n}`);
    },
    count,
    { timeout: 20000 },
  );
}

async function recordDemo() {
  await fs.mkdir(artifactsDir, { recursive: true });
  // Drop stale persisted workspace mode / auth from earlier runs.
  await fs.rm(path.join(artifactsDir, "pw-user-data-s3"), { recursive: true, force: true });

  const context = await chromium.launchPersistentContext(
    path.join(artifactsDir, "pw-user-data-s3"),
    {
      headless: true,
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 1,
    },
  );

  const page = await context.newPage();

  // Playwright's recordVideo produces blank frames on this stack (headless
  // shell AND headless/headed Chromium), but page.screenshot() renders
  // correctly — so we capture ~5-8fps frames and assemble with ffmpeg.
  const framesDir = path.join(artifactsDir, "frames-s3");
  await fs.rm(framesDir, { recursive: true, force: true });
  await fs.mkdir(framesDir, { recursive: true });
  let frameIdx = 0;
  let capturing = true;
  const recordingStarted = Date.now();
  const captureLoop = (async () => {
    while (capturing) {
      try {
        await page.screenshot({
          path: path.join(framesDir, `f${String(frameIdx).padStart(5, "0")}.png`),
        });
        frameIdx++; // only consume the number on success — no gaps for ffmpeg
      } catch {
        // navigation races — skip the frame
      }
    }
  })();

  // The dashboard serves fixture rounds to anonymous visitors (useApiWithDemo
  // short-circuits on !isConnected) — inject a sandbox-mode session so the
  // page fetches the live Canton list, exactly as a signed-in user sees it.
  // The token only needs to decode client-side (exp checked, signature never
  // verified); every sealed-bid call used here is a public GET or a
  // sandbox-passthrough POST.
  const dummyJwt = [
    Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url"),
    Buffer.from(JSON.stringify({ sub: "hackcanton-demo", exp: 2000000000 })).toString("base64url"),
    "",
  ].join(".");
  await context.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [
      "civern-auth-store",
      JSON.stringify({
        state: {
          isConnected: true,
          walletAddress: null,
          authUser: { id: "hackcanton-demo", email: "demo@cognivern.local" },
          workspace: { id: "ws-demo", name: "Demo", tier: "live" },
          workspaces: [],
          token: dummyJwt,
          workspaceMode: "sandbox",
          hasExitedSandbox: true,
        },
        version: 0,
      }),
    ],
  );

  // The fake session's Authorization header 403s on the public allowlist —
  // strip it so backend calls are anonymous (public GETs + sandbox writes).
  await context.route("**/api/**", (route) => {
    const headers = { ...route.request().headers() };
    delete headers["authorization"];
    return route.continue({ headers });
  });

  // The workspace-mode chrome ("Sandbox — sample data, no real funds")
  // describes wallet context, not the Canton backend — these rounds are
  // real DevNet contracts, so hide the misleading copy for the video.
  // Round-detail navigation is a full document load, so this must be an
  // init script (re-runs per document) rather than a one-shot evaluate.
  // Scoped to the dashboard so the honest SAMPLE DATA badges on
  // /sponsor/sample stay visible.
  await context.addInitScript(`(() => {
    const onDashboard = () =>
      location.pathname.startsWith("/sealed-bid") ||
      location.pathname.startsWith("/dashboard");
    const hide = () => {
      if (!onDashboard()) return;
      if (document.head && !document.getElementById("demo-video-hide")) {
        const style = document.createElement("style");
        style.id = "demo-video-hide";
        style.textContent =
          '[class*="bg-amber"],[class*="border-amber"],[class*="from-amber"]{display:none!important}';
        document.head.appendChild(style);
      }
      for (const el of document.querySelectorAll("p")) {
        if (el.children.length === 0 && el.textContent?.includes("nothing persists")) {
          el.style.display = "none";
        }
      }
    };
    new MutationObserver(hide).observe(document, {
      childList: true,
      subtree: true,
    });
    hide();
  })()`);

  try {
    // ── Landing + problem narration ────────────────────────────────────
    await page.goto(`${siteUrl}/sealed-bid`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=Private vendor selection", { timeout: 20000 });
    await sleep(9000);

    // ── Create the round (API, with settlement escrow) ─────────────────
    const roundMarker = `S3-${Date.now().toString(36)}`;
    const roundId = await createRoundViaApi(roundMarker);
    console.log(`Created round ${roundId}; waiting for UI card`);

    await page.goto(`${siteUrl}/sealed-bid`, { waitUntil: "networkidle" });
    await page.waitForSelector(`text=${roundMarker}`, { timeout: 30000 });
    await sleep(2500);
    await page.getByText(roundMarker).first().click();
    await page.waitForSelector("text=Submit sealed bid", { timeout: 20000 });
    await sleep(2500);

    // ── Three bids through the real UI ─────────────────────────────────
    await submitBid(page, "Alice", "91000", "Premium implementation team");
    await waitPartyCount(page, 1);
    await sleep(2000);
    await submitBid(page, "Bob", "74500", "Best-value team");
    await waitPartyCount(page, 2);
    await sleep(2000);
    await submitBid(page, "Charlie", "108000", "Enterprise support bundle");
    await waitPartyCount(page, 3);
    await sleep(3000);

    // ── Party-view disclosure toggles ──────────────────────────────────
    // PartyView lives inside a collapsed <details> — open it first.
    await page.getByText("Verify who can see each bid").click();
    await page.getByRole("button", { name: "Alice", exact: true }).waitFor({ state: "visible", timeout: 15000 });
    await sleep(1500);
    for (const party of ["Alice", "Bob", "Charlie"] as const) {
      await toggleParty(page, party);
      await waitPartyCount(page, 1);
      await sleep(2200);
    }
    await toggleParty(page, "Auctioneer");
    await waitPartyCount(page, 3);
    await sleep(2500);

    // ── Close + atomic reveal ──────────────────────────────────────────
    await page.getByRole("button", { name: /Close bidding/ }).click();
    await page.waitForSelector("text=Reveal winner atomically", { timeout: 20000 });
    await sleep(3000);
    await page.getByRole("button", { name: "Reveal winner atomically" }).click();
    await page.waitForSelector("text=Winner:", { timeout: 30000 });
    // Hold on the winner banner + settlement reference line.
    await sleep(10000);

    // ── Sponsor receipt segment ────────────────────────────────────────
    await page.goto(`${siteUrl}/sponsor/sample`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=receipt", { timeout: 20000 });
    await sleep(4000);
    await page.mouse.wheel(0, 600);
    await sleep(5000);

    await page.goto(`${siteUrl}/verify`, { waitUntil: "networkidle" });
    await sleep(6000);
  } catch (err) {
    console.error("Recording failed:", err);
    throw err;
  } finally {
    capturing = false;
    await captureLoop.catch(() => {});
    await context.close();
  }

  const seconds = (Date.now() - recordingStarted) / 1000;
  const fps = frameIdx / seconds;
  console.log(`Captured ${frameIdx} frames over ${seconds.toFixed(0)}s (~${fps.toFixed(1)} fps)`);
  if (frameIdx < 30) throw new Error("Too few frames captured");
  return { framesDir, fps };
}

async function submitBid(page: Page, bidder: string, amount: string, proposal: string) {
  await page.locator('[data-slot="select-trigger"]').first().click();
  await page.getByRole("option", { name: bidder }).click();
  await page.locator('input[type="number"]').fill(amount);
  await page.getByPlaceholder("Short pitch").fill(proposal);
  await page.getByRole("button", { name: new RegExp(`Submit as ${bidder}`) }).click();
}

async function toggleParty(page: Page, party: string) {
  // The four party buttons are the only elements with these exact names on
  // the detail page ("Submit as Alice" etc. differ), so no scoping needed.
  await page.getByRole("button", { name: party, exact: true }).click();
}

async function combineAudioVideo(framesDir: string, fps: number) {
  // Narration drives the duration; frame rate is the measured capture rate
  // so playback tracks real time.
  const cmd = `ffmpeg -y -framerate ${fps.toFixed(2)} -i ${framesDir}/f%05d.png -i ${audioPath} -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p -vf "scale=1280:720" -c:a aac -b:a 128k ${outputPath}`;
  console.log(`Running: ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
  const outStat = await fs.stat(outputPath);
  console.log(`Demo video saved to ${outputPath} (${(outStat.size / 1e6).toFixed(1)} MB)`);
}

async function main() {
  await generateNarration();
  const { framesDir, fps } = await recordDemo();
  await combineAudioVideo(framesDir, fps);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
