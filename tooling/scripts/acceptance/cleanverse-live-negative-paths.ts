#!/usr/bin/env tsx
/**
 * Read-only live acceptance check for the Cleanverse CVI country-rule rail.
 *
 * This script never creates a wallet, round, or transaction. It checks:
 *   1. the public rail status is enabled and configured with the expected rule;
 *   2. a known unregistered sender is denied fail-closed;
 *   3. the two known US-tagged demo A-Passes pass together.
 *
 * This is intentionally a smoke subset, not the full negative-path matrix. Frozen,
 * expired, missing-country, country-deny, and upstream-outage cases are covered by
 * deterministic unit tests. Fixture mismatches fail with a stale-fixture diagnostic.
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
// Defaults are the live demo pair (disposable Monad testnet wallet + Cleanverse
// treasury). The negative fixture is a deliberately unregistered address.
const negativeAddress =
  process.env.CLEANVERSE_NEGATIVE_ADDRESS || '0x3333333333333333333333333333333333333333';
const demoSender =
  process.env.CLEANVERSE_DEMO_SENDER || '0x2FeE0208c0d1598104f52fb55Dcc2811707c8879';
const demoRecipient =
  process.env.CLEANVERSE_DEMO_RECIPIENT || '0x0cBAEF799662f1df638B1ef1Ae74eCb24Fd9bA56';

function assertFixtureAddress(name: string, address: string): void {
  assert(
    /^0x[a-fA-F0-9]{40}$/.test(address),
    `fixture ${name} is a valid EVM address (stale or malformed fixture)`,
  );
}

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

async function screen(sender: string, recipient: string, fixtureName: string): Promise<any> {
  const response = await fetch(`${baseUrl}/api/cleanverse/screen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sender, recipient }),
  });
  const body = await response.json();
  assert(
    response.ok,
    `${fixtureName} screen returned HTTP ${response.status}; fixture may be stale`,
  );
  assert(
    body.success === true,
    `${fixtureName} screen response envelope is successful; fixture may be stale`,
  );
  return body.data;
}

assertFixtureAddress('negative sender', negativeAddress);
assertFixtureAddress('demo sender', demoSender);
assertFixtureAddress('demo recipient', demoRecipient);
assert(
  new Set([negativeAddress.toLowerCase(), demoSender.toLowerCase(), demoRecipient.toLowerCase()])
    .size === 3,
  'acceptance fixtures are distinct; stale fixture configuration detected',
);

const status = await getJson('/api/cleanverse/status');
const config = status.data;
assert(config?.enabled === true, 'Cleanverse rail is enabled');
assert(config?.apiConfigured === true, 'Cleanverse API credentials are configured');
assert(config?.countryRule?.mode === 'allow', 'institutional country rule is an allowlist');
assert(
  Array.isArray(config.countryRule.countries) && config.countryRule.countries.includes('US'),
  'country allowlist includes US',
);

const denied = await screen(negativeAddress, demoRecipient, 'negative sender');
assert(
  denied.ok === false,
  'negative sender is denied fail-closed; a passing result indicates a stale fixture',
);
assert(
  typeof denied.reason === 'string' &&
    /CN_001|not registered|not found|unregistered/i.test(denied.reason),
  'negative sender is specifically unregistered; stale fixture if this fails',
);

const passing = await screen(demoSender, demoRecipient, 'demo pair');
assert(passing.ok === true, 'known demo pair passes CVI screening; stale fixture if this fails');
assert(
  passing.sender?.aPass?.status === 1,
  'demo sender A-Pass is active; stale fixture if this fails',
);
assert(
  passing.recipient?.aPass?.status === 1,
  'demo recipient A-Pass is active; stale fixture if this fails',
);
assert(
  passing.sender?.aPass?.countries?.includes('US') &&
    passing.recipient?.aPass?.countries?.includes('US'),
  'both demo A-Passes carry the allowed US country tag; stale fixture if this fails',
);

console.log('\nCleanverse live negative-path acceptance passed (read-only).');
