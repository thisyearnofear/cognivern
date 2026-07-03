import crypto from "node:crypto";
import logger from "@backend/utils/logger.js";

// Minimal Daml JSON Ledger API v1 client.
// Handles JWT synthesis, /v1/query, /v1/create, /v1/exercise, /v1/parties, /v1/user.
// Intentionally small — no schema-aware helpers; callers pass raw template IDs
// and payloads. Sandbox JWTs are HS256-signed with the empty secret and
// carry claims under https://daml.com/ledger-api.

export interface CantonLedgerClientOptions {
  jsonApiUrl: string;
  applicationId: string;
  ledgerId?: string;
  jwtSecret?: string;
}

export interface AllocatePartyResult {
  identifier: string;
  displayName?: string;
  isLocal: boolean;
}

interface JsonApiResult<T> {
  status: number;
  result?: T;
  errors?: string[];
  warnings?: unknown;
}

export class CantonLedgerClient {
  private readonly jsonApiUrl: string;
  private readonly applicationId: string;
  private readonly ledgerId: string;
  private readonly jwtSecret: string;

  constructor(opts: CantonLedgerClientOptions) {
    this.jsonApiUrl = opts.jsonApiUrl.replace(/\/$/, "");
    this.applicationId = opts.applicationId;
    this.ledgerId = opts.ledgerId ?? "sandbox";
    this.jwtSecret = opts.jwtSecret ?? "";
  }

  // Synthesize a JWT carrying the actAs/readAs party claims the JSON API needs.
  // The claim shape matches Daml 2.x's expectation.
  tokenFor(opts: { actAs?: string[]; readAs?: string[]; admin?: boolean }): string {
    const b64 = (o: unknown) =>
      Buffer.from(JSON.stringify(o)).toString("base64url");
    const header = { alg: "HS256", typ: "JWT" };
    const payload = {
      "https://daml.com/ledger-api": {
        ledgerId: this.ledgerId,
        applicationId: this.applicationId,
        actAs: opts.actAs ?? [],
        readAs: opts.readAs ?? [],
        admin: !!opts.admin,
      },
    };
    const h = b64(header);
    const p = b64(payload);
    const sig = crypto
      .createHmac("sha256", this.jwtSecret)
      .update(`${h}.${p}`)
      .digest("base64url");
    return `${h}.${p}.${sig}`;
  }

  private async call<T>(
    method: "GET" | "POST",
    path: string,
    jwt: string,
    body?: unknown,
  ): Promise<T> {
    const res = await fetch(`${this.jsonApiUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const parsed = (await res.json()) as JsonApiResult<T>;
    if (parsed.status !== 200 && parsed.status !== 201) {
      const err = parsed.errors?.join("; ") ?? `HTTP ${res.status}`;
      throw new Error(`Canton JSON API ${method} ${path} failed: ${err}`);
    }
    return parsed.result as T;
  }

  // Party discovery / allocation ────────────────────────────────────────────
  async listParties(): Promise<AllocatePartyResult[]> {
    const admin = this.tokenFor({ admin: true });
    return this.call<AllocatePartyResult[]>("GET", "/v1/parties", admin);
  }

  // JSON API v1's party allocation endpoint. Idempotent by identifierHint —
  // if a party with the same hint already exists it will be returned.
  async allocateParty(
    identifierHint: string,
    displayName?: string,
  ): Promise<AllocatePartyResult> {
    const admin = this.tokenFor({ admin: true });
    return this.call<AllocatePartyResult>("POST", "/v1/parties/allocate", admin, {
      identifierHint,
      displayName: displayName ?? identifierHint,
    });
  }

  // Contract operations ────────────────────────────────────────────────────
  async query<T = unknown>(
    party: string,
    templateIds: string[],
    query?: Record<string, unknown>,
  ): Promise<Array<{ contractId: string; templateId: string; payload: T }>> {
    const jwt = this.tokenFor({ actAs: [party] });
    return this.call("POST", "/v1/query", jwt, { templateIds, query });
  }

  async create<T = unknown>(
    party: string,
    templateId: string,
    payload: unknown,
  ): Promise<{ contractId: string; templateId: string; payload: T }> {
    const jwt = this.tokenFor({ actAs: [party] });
    return this.call("POST", "/v1/create", jwt, { templateId, payload });
  }

  async exercise<T = unknown>(
    party: string,
    templateId: string,
    contractId: string,
    choice: string,
    argument: unknown,
  ): Promise<{
    exerciseResult: T;
    events: Array<{
      created?: { contractId: string; templateId: string; payload: unknown };
      archived?: { contractId: string; templateId: string };
    }>;
  }> {
    const jwt = this.tokenFor({ actAs: [party] });
    return this.call("POST", "/v1/exercise", jwt, {
      templateId,
      contractId,
      choice,
      argument,
    });
  }
}

// Convenience factory that pulls from env at construction time so consumers
// don't have to plumb config through. Returns null when Canton isn't configured.
export function makeCantonLedgerClientFromEnv(): CantonLedgerClient | null {
  const url = process.env.CANTON_JSON_API_URL;
  if (!url) return null;
  const applicationId = process.env.CANTON_APPLICATION_ID ?? "cognivern";
  const ledgerId = process.env.CANTON_LEDGER_ID ?? "sandbox";
  const jwtSecret = process.env.CANTON_JWT_SECRET ?? "";
  logger.info(`Canton: JSON Ledger client bound to ${url} (app=${applicationId})`);
  return new CantonLedgerClient({
    jsonApiUrl: url,
    applicationId,
    ledgerId,
    jwtSecret,
  });
}
