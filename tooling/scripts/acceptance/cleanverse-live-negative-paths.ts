#!/usr/bin/env tsx
/**
 * Read-only live acceptance check for the Cleanverse CVI country-rule rail.
 *
 * This script never creates a wallet, round, or transaction. It checks:
 *   1. the public rail status is enabled and configured with the expected rule;
 *   2. a known unregistered sender is denied fail-closed;
 *   3. the two known US-tagged demo A-Passes pass together.
 *
 * Usage:
 *   pnpm tsx tooling/scripts/acceptance/cleanverse-live-negative-paths.ts
 *
 * Override fixtures when Cleanverse UAT data changes:
 *   CLEANVERSE_ACCEPTANCE_BASE_URL=https://api.cognivern.persidian.com \
 *   CLEANVERSE_NEGATIVE_ADDRESS=0x... \
 *   CLEANVERSE_DEMO_SENDER=0x... \
 *   CLEANVERSE_DEMO_RECIPIENT=0x... \
 *   pnpm tsx tooling/scripts/acceptance/cleanverse-live-negative-paths.ts
 */

const baseUrl = (
  process.env.CLEANVERSE_ACCEPTANCE_BASE_URL || 'https://api.cognivern.persidian.com'
).replace(/\/$/, '');
const negativeAddress =
  process.env.CLEANVERSE_NEGATIVE_ADDRESS || '0x3333333333333333333333333333333333333333';
const demoSender =
  process.env.CLEANVERSE_DEMO_SENDER || '0x1111111111111111111111111111111111111111';
const demoRecipient =
  process.env.CLEANVERSE_DEMO_RECIPIENT || '0x2222222222222222222222222222222222222222';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
  console.log(`ok — ${message}`);
}

async function getJson(path: string): Promise<any> {
  const response = await fetch(`${baseUrl}${path}`);
  const body = await response.json();
  assert(response.ok, `${path} returned HTTP ${response.status}`);
  return body;
}

async function screen(sender: string, recipient: string): Promise<any> {
  const response = await fetch(`${baseUrl}/api/cleanverse/screen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sender, recipient }),
  });
  const body = await response.json();
  assert(response.ok, `screen ${sender} → ${recipient} returned HTTP ${response.status}`);
  assert(body.success === true, 'screen response envelope is successful');
  return body.data;
}

const status = await getJson('/api/cleanverse/status');
const config = status.data;
assert(config?.enabled === true, 'Cleanverse rail is enabled');
assert(config?.apiConfigured === true, 'Cleanverse API credentials are configured');
assert(config?.countryRule?.mode === 'allow', 'institutional country rule is an allowlist');
assert(
  Array.isArray(config.countryRule.countries) && config.countryRule.countries.includes('US'),
  'country allowlist includes US',
);

const denied = await screen(negativeAddress, demoRecipient);
assert(denied.ok === false, 'unregistered sender is denied fail-closed');
assert(
  typeof denied.reason === 'string' && /A-Pass|apass|CVI|CN_001/i.test(denied.reason),
  'unregistered sender denial has an identity-screening reason',
);

const passing = await screen(demoSender, demoRecipient);
assert(passing.ok === true, 'known demo pair passes CVI screening');
assert(passing.sender?.aPass?.status === 1, 'demo sender A-Pass is active');
assert(passing.recipient?.aPass?.status === 1, 'demo recipient A-Pass is active');
assert(
  passing.sender?.aPass?.countries?.includes('US') &&
    passing.recipient?.aPass?.countries?.includes('US'),
  'both demo A-Passes carry the allowed US country tag',
);

console.log('\nCleanverse live negative-path acceptance passed (read-only).');
