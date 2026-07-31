import crypto from 'node:crypto';

export const SOURCE_KINDS = [
  'user',
  'web',
  'email',
  'repository',
  'document',
  'tool_output',
] as const;

export type SourceKind = (typeof SOURCE_KINDS)[number];

export interface SpendSourceProvenance {
  sources: Array<{
    id: string;
    kind: SourceKind;
    locator?: string;
    contentHash?: string;
  }>;
  recipientIntroducedByUntrustedSource?: boolean;
}

export interface SourceAuthorizationRequest {
  agentId: string;
  recipient: string;
  asset: string;
  maxAmount: string;
  reason: string;
  allowedSourceKinds: SourceKind[];
  expiresInSeconds?: number;
}

interface SourceAuthorizationClaims extends SourceAuthorizationRequest {
  version: 1;
  issuedAt: string;
  expiresAt: string;
  operatorId: string;
  nonce: string;
}

export interface SourceAuthorizationResult {
  required: boolean;
  authorized: boolean;
  reason?: string;
  authorization?: {
    expiresAt: string;
    operatorId: string;
    allowedSourceKinds: SourceKind[];
    provenanceSourceIds: string[];
  };
}

const MAX_TTL_SECONDS = 60 * 60;
const DEFAULT_TTL_SECONDS = 15 * 60;
const secret = process.env.SPEND_AUTHORIZATION_SECRET || crypto.randomBytes(32).toString('hex');

function sign(encodedClaims: string): string {
  return crypto.createHmac('sha256', secret).update(encodedClaims).digest('base64url');
}

function isSourceKind(value: unknown): value is SourceKind {
  return typeof value === 'string' && (SOURCE_KINDS as readonly string[]).includes(value);
}

function parseAmount(value: string): bigint | null {
  try {
    const amount = BigInt(value);
    return amount >= 0n ? amount : null;
  } catch {
    return null;
  }
}

export class SourceAwareSpendAuthorizationService {
  private usedNonces = new Set<string>();

  issue(
    request: SourceAuthorizationRequest,
    operatorId: string,
  ): { token: string; expiresAt: string } {
    if (
      !request.agentId ||
      !request.recipient ||
      !request.asset ||
      !request.reason ||
      parseAmount(request.maxAmount) === null ||
      request.allowedSourceKinds.length === 0 ||
      !request.allowedSourceKinds.every(isSourceKind)
    ) {
      throw new Error('Invalid source-aware spend authorization request');
    }

    const ttlSeconds = Math.min(
      Math.max(request.expiresInSeconds ?? DEFAULT_TTL_SECONDS, 1),
      MAX_TTL_SECONDS,
    );
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();
    const claims: SourceAuthorizationClaims = {
      version: 1,
      agentId: request.agentId,
      recipient: request.recipient,
      asset: request.asset,
      maxAmount: request.maxAmount,
      reason: request.reason,
      allowedSourceKinds: request.allowedSourceKinds,
      issuedAt: now.toISOString(),
      expiresAt,
      operatorId,
      nonce: crypto.randomUUID(),
    };
    const encodedClaims = Buffer.from(JSON.stringify(claims)).toString('base64url');
    return { token: `${encodedClaims}.${sign(encodedClaims)}`, expiresAt };
  }

  evaluate(params: {
    agentId: string;
    recipient: string;
    amount: string;
    asset: string;
    reason: string;
    provenance?: SpendSourceProvenance;
    token?: string;
    consume?: boolean;
  }): SourceAuthorizationResult {
    const provenance = params.provenance;
    const hasUntrustedSource = Boolean(
      provenance?.recipientIntroducedByUntrustedSource ||
        provenance?.sources.some((source) => source.kind !== 'user'),
    );
    const required = process.env.SOURCE_AWARE_SPEND_ENFORCEMENT === 'true' || hasUntrustedSource;
    if (!required) return { required: false, authorized: true };

    if (!params.token) {
      return {
        required: true,
        authorized: false,
        reason:
          'Source-aware authorization is required before this spend can be previewed or executed.',
      };
    }

    const claims = this.verifyToken(params.token);
    if (!claims) {
      return {
        required: true,
        authorized: false,
        reason: 'Source-aware authorization is invalid or has expired.',
      };
    }

    const requestedAmount = parseAmount(params.amount);
    const authorizedAmount = parseAmount(claims.maxAmount);
    if (
      requestedAmount === null ||
      authorizedAmount === null ||
      claims.agentId !== params.agentId ||
      claims.recipient !== params.recipient ||
      claims.asset !== params.asset ||
      claims.reason !== params.reason ||
      requestedAmount > authorizedAmount
    ) {
      return {
        required: true,
        authorized: false,
        reason: 'Spend does not match the operator-issued source-aware authorization.',
      };
    }

    const sources = provenance?.sources || [];
    if (!sources.every((source) => claims.allowedSourceKinds.includes(source.kind))) {
      return {
        required: true,
        authorized: false,
        reason: 'Spend uses a source type outside the operator-authorized scope.',
      };
    }

    if (params.consume) {
      if (this.usedNonces.has(claims.nonce)) {
        return {
          required: true,
          authorized: false,
          reason: 'Source-aware authorization has already been used.',
        };
      }
      this.usedNonces.add(claims.nonce);
    }

    return {
      required: true,
      authorized: true,
      authorization: {
        expiresAt: claims.expiresAt,
        operatorId: claims.operatorId,
        allowedSourceKinds: claims.allowedSourceKinds,
        provenanceSourceIds: sources.map((source) => source.id),
      },
    };
  }

  private verifyToken(token: string): SourceAuthorizationClaims | null {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [encodedClaims, signature] = parts;
    if (!encodedClaims || !signature) return null;
    const expected = sign(encodedClaims);
    const actualBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (
      actualBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(actualBuffer, expectedBuffer)
    ) {
      return null;
    }

    try {
      const claims = JSON.parse(
        Buffer.from(encodedClaims, 'base64url').toString('utf8'),
      ) as SourceAuthorizationClaims;
      if (
        claims.version !== 1 ||
        !claims.agentId ||
        !claims.recipient ||
        !claims.asset ||
        !claims.reason ||
        !claims.operatorId ||
        !claims.nonce ||
        Number.isNaN(Date.parse(claims.issuedAt)) ||
        !Array.isArray(claims.allowedSourceKinds) ||
        !claims.allowedSourceKinds.every(isSourceKind) ||
        parseAmount(claims.maxAmount) === null ||
        Number.isNaN(Date.parse(claims.expiresAt)) ||
        Date.parse(claims.expiresAt) <= Date.now()
      ) {
        return null;
      }
      return claims;
    } catch {
      return null;
    }
  }
}

export const sourceAwareSpendAuthorizationService = new SourceAwareSpendAuthorizationService();
