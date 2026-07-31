import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { SourceAwareSpendAuthorizationService } from '@backend/services/governance/SourceAwareSpendAuthorization.js';

const honeypotPath = path.resolve(process.cwd(), 'tests/fixtures/prompt-injection-honeypot.html');

const baseSpend = {
  agentId: 'research-agent',
  recipient: 'vendor.example',
  amount: '100',
  asset: 'USDC',
  reason: 'Renew the approved note-taking subscription',
};

const untrustedPage = {
  sources: [
    {
      id: 'web:honeypot',
      kind: 'web' as const,
      locator: 'https://example.test/honeypot',
    },
  ],
  recipientIntroducedByUntrustedSource: true,
};

describe('SourceAwareSpendAuthorizationService', () => {
  it('uses a fixture containing hidden instructions', () => {
    const fixture = fs.readFileSync(honeypotPath, 'utf8');
    expect(fixture).toContain('attacker.example');
  });

  it('holds a direct attacker-controlled spend request without operator authorization', () => {
    const service = new SourceAwareSpendAuthorizationService();
    const result = service.evaluate({
      ...baseSpend,
      recipient: 'attacker.example',
      provenance: untrustedPage,
    });

    expect(result).toMatchObject({ required: true, authorized: false });
    expect(result.reason).toMatch(/authorization is required/i);
  });

  it('accepts only the exact operator-authorized spend and source scope', () => {
    const service = new SourceAwareSpendAuthorizationService();
    const { token } = service.issue(
      {
        ...baseSpend,
        maxAmount: '100',
        allowedSourceKinds: ['user', 'web'],
      },
      'operator-1',
    );

    expect(service.evaluate({ ...baseSpend, provenance: untrustedPage, token })).toMatchObject({
      required: true,
      authorized: true,
    });

    expect(
      service.evaluate({
        ...baseSpend,
        recipient: 'attacker.example',
        provenance: untrustedPage,
        token,
      }),
    ).toMatchObject({ required: true, authorized: false });
  });

  it('rejects provenance from a source type the operator did not authorize', () => {
    const service = new SourceAwareSpendAuthorizationService();
    const { token } = service.issue(
      {
        ...baseSpend,
        maxAmount: '100',
        allowedSourceKinds: ['user'],
      },
      'operator-1',
    );

    const result = service.evaluate({
      ...baseSpend,
      provenance: untrustedPage,
      token,
    });
    expect(result).toMatchObject({ required: true, authorized: false });
    expect(result.reason).toMatch(/source type/i);
  });

  it('permits preview but consumes a valid authorization at execution', () => {
    const service = new SourceAwareSpendAuthorizationService();
    const { token } = service.issue(
      {
        ...baseSpend,
        maxAmount: '100',
        allowedSourceKinds: ['user', 'web'],
      },
      'operator-1',
    );

    expect(service.evaluate({ ...baseSpend, provenance: untrustedPage, token })).toMatchObject({
      authorized: true,
    });
    expect(
      service.evaluate({ ...baseSpend, provenance: untrustedPage, token, consume: true }),
    ).toMatchObject({ authorized: true });
    expect(
      service.evaluate({ ...baseSpend, provenance: untrustedPage, token, consume: true }),
    ).toMatchObject({
      authorized: false,
      reason: 'Source-aware authorization has already been used.',
    });
  });
});
