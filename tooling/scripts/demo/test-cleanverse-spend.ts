#!/usr/bin/env tsx
/**
 * Local smoke test for the Cleanverse CVI/CVA wiring.
 *
 * 1. Spins a mock Cleanverse HTTP server (query_apass / verify_apass)
 * 2. Exercises CleanverseIdentityService.screenAddresses against it
 * 3. Confirms encodePayload round-trip for encrypted endpoints
 *
 * Run: pnpm tsx tooling/scripts/demo/test-cleanverse-spend.ts
 */

import http from 'node:http';

const MOCK_PORT = 9996;
const MOCK_URL = `http://127.0.0.1:${MOCK_PORT}/api/cooperate`;

process.env.CLEANVERSE_API_ID = 'test-api-id';
process.env.CLEANVERSE_API_KEY = Buffer.alloc(16, 9).toString('base64');
process.env.CLEANVERSE_API_URL = MOCK_URL;
process.env.CLEANVERSE_CHAIN = 'monad';

const PASSING = {
  chain: 'monad',
  address: '0x1111111111111111111111111111111111111111',
  status: 'ACTIVE',
  tier: 'TIER_1',
  group: 'CLEANVERSE_USER',
  isPaused: false,
  isBlacklisted: false,
  isRegisted: true,
};

function assert(cond: unknown, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`ok — ${msg}`);
}

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
  });
  req.on('end', () => {
    const apiId = req.headers['api-id'];
    if (apiId !== 'test-api-id') {
      res.writeHead(401);
      res.end(JSON.stringify({ code: 0, message: 'missing api-id' }));
      return;
    }
    const parsed = body ? JSON.parse(body) : {};
    if (req.url?.endsWith('/query_apass')) {
      const address = String(parsed.address || '').toLowerCase();
      if (address === PASSING.address.toLowerCase()) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ code: 4, result: { ...PASSING, address: parsed.address } }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: 2, message: 'no A-Pass' }));
      return;
    }
    if (req.url?.endsWith('/verify_apass')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          code: 4,
          result: {
            token: {
              chain: 'monad',
              symbol: 'aUSD-D',
              decimals: 6,
              contractAddress: '0xbD14cFAf1Fb8b08858E3FfcCeffEfe09cC013892',
            },
          },
        }),
      );
      return;
    }
    res.writeHead(404);
    res.end('not found');
  });
});

await new Promise<void>((resolve) => server.listen(MOCK_PORT, resolve));

try {
  // Dynamic import AFTER env is set so cleanverseConfig picks it up.
  const { cleanverseIdentityService } = await import(
    '@backend/services/blockchain/cleanverse/CleanverseIdentityService.js'
  );
  const { encodePayload, decodePayload } = await import(
    '@backend/services/blockchain/cleanverse/crypto.js'
  );

  const pass = await cleanverseIdentityService.screenAddresses(
    PASSING.address,
    PASSING.address,
  );
  assert(pass.ok, 'identical verified pair screens clean');

  const fail = await cleanverseIdentityService.screenAddresses(
    PASSING.address,
    '0x2222222222222222222222222222222222222222',
  );
  assert(!fail.ok, 'unverified recipient is denied');
  assert(fail.recipient.ok === false, 'recipient screen result is fail');

  const verify = await cleanverseIdentityService.verifyAPass(
    'monad',
    PASSING.address,
    '0xbD14cFAf1Fb8b08858E3FfcCeffEfe09cC013892',
  );
  assert(verify.success && verify.code === 4, 'verify_apass succeeds for A-Pass holder');

  const key = process.env.CLEANVERSE_API_KEY!;
  const encoded = encodePayload({ hello: 'cleanverse' }, key);
  const decoded = decodePayload<{ hello: string }>(encoded, key);
  assert(decoded.hello === 'cleanverse', 'AES payload round-trips');

  console.log('\nCleanverse smoke test passed.');
} finally {
  server.close();
}
