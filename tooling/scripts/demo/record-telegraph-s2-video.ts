#!/usr/bin/env tsx
/**
 * Record a narrated demo video for Telegraph Hackathon Season II:
 * the governed intelligence ledger (Mission 02) and verified-answer
 * economics (Mission 10).
 *
 * Run:
 *   pnpm tsx tooling/scripts/demo/record-telegraph-s2-video.ts
 *
 * The pages render demo-mode data when unauthenticated (DemoBanner labels
 * it), so no login is required. Outputs:
 *   - .artifacts/telegraph-s2-recording.webm
 *   - .artifacts/telegraph-s2-narration.aiff
 *   - docs/telegraph-s2-demo.mp4
 */

import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const artifactsDir = path.join(repoRoot, ".artifacts");
const videoPath = path.join(artifactsDir, "telegraph-s2-recording.webm");
const audioPath = path.join(artifactsDir, "telegraph-s2-narration.aiff");
const outputPath = path.join(repoRoot, "docs", "telegraph-s2-demo.mp4");
const baseUrl =
  process.env.COGNIVERN_DEMO_URL || "https://cognivern.vercel.app";

const narrationScript = `Cognivern. The economic control plane for agentic work.

Agents don't just call models — they pay for intelligence. Every Telegraph purchase runs through a mandate: policy decides approved, held, or blocked, and every call lands on an auditable ledger.

This is the intelligence ledger. Six settlements, six cents of real x402 spend on Base Sepolia. Each row is a governed miner call with its miner, intent, cost, and disposition.

Compliance attached to the payment. Before the gas-price call settled, a sanctions screening miner checked the counterparty — verdict clear, its own paid run, linked to the parent settlement. A hit or an inconclusive screen blocks the purchase entirely, and the blocked attempt is itself recorded.

Low-confidence signals don't disappear — they pause for operator approval in the inbox. Approve releases the signal; reject quarantines it. Every state is visible.

And verification has a price. Mission ten samples inference records and pays an evaluator miner to judge correctness — verdicts persist per record, and the leaderboard reports cost per verified correct answer. Not self-reported accuracy. Paid judgement, linked to receipts.

Governance, attribution, and proof — not token throughput. Cognivern.`;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateNarration() {
  await fs.mkdir(artifactsDir, { recursive: true });
  const scriptFile = path.join(artifactsDir, "telegraph-s2-narration.txt");
  await fs.writeFile(scriptFile, narrationScript, "utf-8");
  execSync(`say -f ${scriptFile} -o ${audioPath}`, { stdio: "inherit" });
  console.log(`Narration saved to ${audioPath}`);
}

async function recordDemo() {
  await fs.mkdir(artifactsDir, { recursive: true });

  const context = await chromium.launchPersistentContext(
    path.join(artifactsDir, "pw-telegraph-s2-data"),
    {
      headless: true,
      viewport: { width: 1280, height: 720 },
      recordVideo: { dir: artifactsDir, size: { width: 1280, height: 720 } },
      deviceScaleFactor: 1,
    },
  );

  const page = await context.newPage();

  try {
    // Scene 1: telegraph dashboard — stats + categories.
    await page.goto(`${baseUrl}/telegraph`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=Intelligence", { timeout: 20000 });
    await sleep(6000);

    // Scene 2: scroll to the ledger section and hold on the headline cards.
    const ledger = page.locator("text=Intelligence ledger").first();
    await ledger.scrollIntoViewIfNeeded();
    await sleep(5000);

    // Scene 3: recent settlements list — dispositions and compliance badges.
    await page.mouse.wheel(0, 500);
    await sleep(6000);

    // Scene 4: inbox — held signals awaiting operator approval.
    await page.goto(`${baseUrl}/inbox`, { waitUntil: "networkidle" });
    await sleep(7000);
  } catch (err) {
    console.error("Recording failed:", err);
    throw err;
  } finally {
    await context.close();
  }

  const files = await fs.readdir(artifactsDir);
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
  if (!newest) throw new Error("No webm video file found after recording");
  await fs.copyFile(path.join(artifactsDir, newest), videoPath);
  console.log(`Screen recording saved to ${videoPath}`);
}

async function combineAudioVideo() {
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
