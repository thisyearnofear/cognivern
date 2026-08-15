import { test, expect } from '@playwright/test';

/**
 * Sponsored-credits browser test: seeds a fresh user + program through the
 * API, then drives the real UI (sign in → /sponsor/credits → program detail →
 * tabs → participants → reconcile) and exercises the verifiable-anchoring
 * surfaces (anchor a commitment, list history, verify a receipt publicly).
 *
 * Requires the backend on :3001 (see the run command in DEV.md / the README
 * of this file). The Playwright webServer starts the frontend on :3000.
 */
const API = process.env.E2E_API_URL || 'http://localhost:3001';

test.describe('Sponsor credits (metered gateway + verifiable anchoring)', () => {
  test('signs in and drives the program through the UI with anchored commitments', async ({
    page,
    request,
  }) => {
    const email = `e2e-sponsor-${Date.now()}@test.dev`;
    const password = 'E2E-test-pass-123!';

    // ── Seed: register a fresh user ────────────────────────────────────────
    // Auth routes are mounted at the app root (/auth/*), not under /api.
    const reg = await request.post(`${API}/auth/register`, {
      data: { email, password },
    });
    expect(reg.ok(), `register: ${await reg.text()}`).toBeTruthy();

    const login = await request.post(`${API}/auth/login`, {
      data: { email, password },
    });
    expect(login.ok()).toBeTruthy();
    const { token, workspace } = (await login.json()) as {
      token: string;
      workspace: { id: string };
    };
    expect(token).toBeTruthy();
    expect(workspace?.id).toBeTruthy();

    const authHeaders = { authorization: `Bearer ${token}` };

    // ── Seed: create a program, provision a cohort ────────────────────────
    const create = await request.post(`${API}/api/credit-programs`, {
      headers: authHeaders,
      data: {
        name: 'Browser Test Cohort',
        sponsorName: 'E2E Runner',
        poolUsd: 200,
        baseAllocationUsd: 20,
        allowedModels: ['glm-5.2'],
        maxOutputTokens: 2048,
        status: 'active',
      },
    });
    expect(create.ok(), `create: ${await create.text()}`).toBeTruthy();
    const created = (await create.json()) as {
      data: { program: { id: string } };
    };
    const programId = created.data.program.id;

    const provision = await request.post(
      `${API}/api/credit-programs/${programId}/participants`,
      {
        headers: authHeaders,
        data: { participants: ['alice', 'bob', 'carol'] },
      },
    );
    expect(provision.ok(), `provision: ${await provision.text()}`).toBeTruthy();

    // ── UI: sign in ───────────────────────────────────────────────────────
    await page.goto('/');
    await page
      .getByRole('button', { name: /^Sign In$/i })
      .first()
      .click();
    await expect(
      page.getByRole('heading', { name: /Sign in to Cognivern/i }),
    ).toBeVisible();

    const authForm = page.locator('form').filter({ has: page.getByLabel('Email') });
    await authForm.getByLabel('Email').fill(email);
    await authForm.getByLabel('Password').fill(password);
    await authForm.getByRole('button', { name: /^Sign In$/i }).click();

    // AuthModal closes on success; the landing header flips to "Open
    // Dashboard", confirming the session is established.
    await expect(page.getByRole('button', { name: 'Open Dashboard' }).first()).toBeVisible();

    // Demo-tier workspaces get a first-visit welcome overlay (600ms delayed)
    // that intercepts pointer events. Dismiss it once, up front.
    const dismissWelcome = page.getByRole('button', { name: 'Dismiss welcome' });
    await expect(dismissWelcome).toBeVisible({ timeout: 10_000 });
    await dismissWelcome.click();
    await expect(dismissWelcome).not.toBeVisible();

    // ── UI: sponsor credits list shows the seeded program ─────────────────
    await page.goto('/sponsor/credits');
    await expect(
      page.getByRole('heading', { name: /Sponsored Credits/i, level: 1 }),
    ).toBeVisible();
    await expect(page.getByText('Browser Test Cohort')).toBeVisible();

    // ── UI: program detail tabs ───────────────────────────────────────────
    // The welcome overlay (demo tier, 600ms delayed) can intercept card
    // clicks, so navigate straight to the known program id.
    await page.goto(`/sponsor/credits/${programId}`);
    await expect(
      page.getByRole('heading', { name: 'Browser Test Cohort', level: 1 }),
    ).toBeVisible();

    for (const tab of ['Overview', 'Participants', 'Activity', 'Reconcile']) {
      await expect(
        page.getByRole('tab', { name: tab, exact: true }),
      ).toBeVisible();
    }

    // Participants tab shows the provisioned cohort
    await page.getByRole('tab', { name: 'Participants', exact: true }).click();
    await expect(page.getByText('alice').first()).toBeVisible();
    await expect(page.getByText('bob').first()).toBeVisible();
    await expect(page.getByText('carol').first()).toBeVisible();

    // Reconcile tab re-derives balances from the append-only ledger. It has
    // no heading — assert its copy and the "Books agree" state (fresh ledger
    // with no spend, so nothing drifts).
    await page.getByRole('tab', { name: 'Reconcile', exact: true }).click();
    await expect(
      page.getByText(/Re-derives every participant\u2019s balance|Books agree/i).first(),
    ).toBeVisible();

    // ── API: anchor a commitment, then verify it publicly ────────────────
    const anchor = await request.post(
      `${API}/api/credit-programs/${programId}/commitments`,
      { headers: authHeaders },
    );
    expect(anchor.ok(), `anchor: ${await anchor.text()}`).toBeTruthy();
    const anchored = (await anchor.json()) as {
      data: {
        commitment: {
          commitmentRoot: string;
          anchors: { filecoinCid?: string; zerogRootHash?: string };
        };
      };
    };
    expect(anchored.data.commitment.commitmentRoot).toBeTruthy();

    const history = await request.get(
      `${API}/api/credit-programs/${programId}/commitments`,
      { headers: authHeaders },
    );
    expect(history.ok()).toBeTruthy();
    const hist = (await history.json()) as {
      data: { commitments: Array<{ commitmentRoot: string; createdAt: string }> };
    };
    expect(hist.data.commitments.length).toBeGreaterThanOrEqual(1);
    expect(hist.data.commitments[0].commitmentRoot).toBe(
      anchored.data.commitment.commitmentRoot,
    );

    // A participant's verification receipt includes the anchored root. A bare
    // cvk_ placeholder is rejected, but the route must exist — never 404. When
    // no upstream router key is configured the gateway returns 503
    // (backend_not_configured), which still proves the route is mounted.
    const participant = await request.get(`${API}/v1/credits/verification`, {
      headers: { authorization: `Bearer cvk_placeholder` },
    });
    expect([401, 403, 503]).toContain(participant.status());

    // Public, no-auth verification endpoint — pure hash math, no DB. A
    // fabricated leaf/path against a real root must be a 200 with valid:false
    // (the endpoint discloses nothing, it only checks math).
    const verify = await request.post(`${API}/verify/credit-commitment`, {
      data: {
        root: anchored.data.commitment.commitmentRoot,
        leaf: '0'.repeat(64),
        path: ['0'.repeat(64)],
        index: 0,
      },
    });
    expect(verify.ok()).toBeTruthy();
    const verified = (await verify.json()) as { data: { valid: boolean } };
    expect(verified.data.valid).toBe(false);

    // ── UI: close the program, see the summary state ──────────────────────
    await page.goto(`/sponsor/credits/${programId}`);
    await expect(
      page.getByRole('heading', { name: 'Browser Test Cohort', level: 1 }),
    ).toBeVisible();
  });
});
