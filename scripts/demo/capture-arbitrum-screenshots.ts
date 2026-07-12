import { chromium } from "@playwright/test";
import { promises as fs } from "fs";
import path from "path";

const baseUrl = "https://cognivern.vercel.app";
const outDir = path.join(process.cwd(), ".artifacts", "arbitrum-shots");

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function shot(page: any, name: string) {
  const p = path.join(outDir, name);
  await page.screenshot({ path: p, fullPage: false });
  console.log(`captured ${name}`);
}

async function capture() {
  await fs.mkdir(outDir, { recursive: true });

  const context = await chromium.launchPersistentContext(
    path.join(outDir, "pw-user-data"),
    {
      headless: true,
      viewport: { width: 1440, height: 810 },
      deviceScaleFactor: 2,
    },
  );
  const page = await context.newPage();

  try {
    // 01 — Landing / home
    await page.goto(`${baseUrl}`, { waitUntil: "networkidle" });
    await sleep(2500);
    await shot(page, "01-home.png");

    // 02 — Spend flow demo (governed, approved scenario — start it to show mid-flow)
    await page.goto(`${baseUrl}/demo/spend`, { waitUntil: "networkidle" });
    await sleep(2000);
    await shot(page, "02-spend-idle.png");
    // Start the demo and capture mid-flow
    await page.getByRole("button", { name: /Start Demo/ }).click();
    await sleep(2500);
    await shot(page, "03-spend-running.png");
    // Wait for completion
    await sleep(5000);
    await shot(page, "04-spend-approved.png");

    // 05 — Governance OFF (ungoverned) to show the problem
    await page.goto(`${baseUrl}/demo/spend`, { waitUntil: "networkidle" });
    await sleep(1500);
    // toggle governance off
    const govToggle = page.locator("button.relative.w-12.h-6.rounded-full");
    await govToggle.click();
    await sleep(500);
    await shot(page, "05-spend-ungoverned.png");
    await page.getByRole("button", { name: /Start Demo/ }).click();
    await sleep(4000);
    await shot(page, "06-spend-ungoverned-result.png");

    // 07 — Copilot (agent runtime)
    await page.goto(`${baseUrl}/copilot`, { waitUntil: "networkidle" });
    await sleep(2500);
    await shot(page, "07-copilot.png");

    // 08 — Policies
    await page.goto(`${baseUrl}/policies`, { waitUntil: "networkidle" });
    await sleep(2000);
    await shot(page, "08-policies.png");

    // 09 — Audit
    await page.goto(`${baseUrl}/audit`, { waitUntil: "networkidle" });
    await sleep(2000);
    await shot(page, "09-audit.png");

    // 10 — Agents
    await page.goto(`${baseUrl}/agents`, { waitUntil: "networkidle" });
    await sleep(2000);
    await shot(page, "10-agents.png");

    // 11 — Governance check
    await page.goto(`${baseUrl}/governance/check`, { waitUntil: "networkidle" });
    await sleep(2000);
    await shot(page, "11-governance-check.png");

    // 12 — Dashboard
    await page.goto(`${baseUrl}/dashboard`, { waitUntil: "networkidle" });
    await sleep(2000);
    await shot(page, "12-dashboard.png");
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
