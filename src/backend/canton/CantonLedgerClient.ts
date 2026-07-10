import crypto from "node:crypto";
import logger from "@backend/utils/logger.js";

// Daml JSON Ledger API client that supports both the legacy v1 sandbox HTTP
// server and the Canton 3.x integrated JSON Ledger API v2. The v2 path is used
// when a Bearer token or OIDC config is supplied; otherwise it falls back to
// the v1 HS256-signed JWT behaviour.

export interface CantonLedgerClientOptions {
  jsonApiUrl: string;
  applicationId: string;
  ledgerId?: string;
  ledgerUserId?: string;
  // v1 sandbox
  jwtSecret?: string;
  // v2 Canton DevNet
  bearerToken?: string;
  oidc?: {
    tokenUrl: string;
    clientId: string;
    clientSecret?: string;
    username?: string;
    password?: string;
    audience?: string;
    scope?: string;
  };
}

export interface AllocatePartyResult {
  identifier: string;
  displayName?: string;
  isLocal: boolean;
}

interface V1JsonApiResult<T> {
  status: number;
  result?: T;
  errors?: string[];
  warnings?: unknown;
}

interface V2PartyDetails {
  party: string;
  isLocal?: boolean;
  localMetadata?: { annotations?: Record<string, string> };
}

interface V2CreatedEvent {
  contractId: string;
  templateId: string;
  createArgument: unknown;
}

interface V2ArchivedEvent {
  contractId: string;
  templateId: string;
}

interface V2Event {
  CreatedEvent?: V2CreatedEvent;
  ArchivedEvent?: V2ArchivedEvent;
  ExercisedEvent?: {
    contractId: string;
    templateId: string;
    choice: string;
    exerciseResult?: unknown;
  };
}

interface V2Transaction {
  updateId: string;
  offset: number | string;
  events: V2Event[];
}

interface V2TransactionResponse {
  transaction: V2Transaction;
}

export class CantonLedgerClient {
  private readonly jsonApiUrl: string;
  private readonly applicationId: string;
  private readonly ledgerId: string;
  private readonly ledgerUserId?: string;
  private readonly jwtSecret: string;
  private readonly isV2: boolean;
  private readonly bearerToken?: string;
  private readonly oidc?: CantonLedgerClientOptions["oidc"];

  private cachedToken?: string;
  private tokenExpiryMs?: number;
  private inferredUserId?: string;

  constructor(opts: CantonLedgerClientOptions) {
    this.jsonApiUrl = opts.jsonApiUrl.replace(/\/$/, "");
    this.applicationId = opts.applicationId;
    this.ledgerId = opts.ledgerId ?? "sandbox";
    this.ledgerUserId = opts.ledgerUserId;
    this.jwtSecret = opts.jwtSecret ?? "";
    this.bearerToken = opts.bearerToken;
    this.oidc = opts.oidc;
    this.isV2 = !!(this.bearerToken || this.oidc);

    if (this.bearerToken) {
      this.cachedToken = this.bearerToken;
      this.inferredUserId = this.extractUserIdFromJwt(this.bearerToken);
    } else if (this.oidc) {
      logger.info(
        `Canton: JSON Ledger client bound to ${this.jsonApiUrl} (v2, OIDC ${this.oidc.clientId})`,
      );
    } else {
      logger.info(
        `Canton: JSON Ledger client bound to ${this.jsonApiUrl} (v1, ledger=${this.ledgerId})`,
      );
    }
  }

  // ── token handling ────────────────────────────────────────────────────────

  private b64url(o: unknown): string {
    return Buffer.from(JSON.stringify(o)).toString("base64url");
  }

  private synthesizeV1Token(opts: {
    actAs?: string[];
    readAs?: string[];
    admin?: boolean;
  }): string {
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
    const h = this.b64url(header);
    const p = this.b64url(payload);
    const sig = crypto
      .createHmac("sha256", this.jwtSecret)
      .update(`${h}.${p}`)
      .digest("base64url");
    return `${h}.${p}.${sig}`;
  }

  private decodeJwtPayload(token: string): Record<string, unknown> | undefined {
    try {
      const payload = token.split(".")[1];
      if (!payload) return undefined;
      return JSON.parse(
        Buffer.from(payload, "base64url").toString("utf8"),
      ) as Record<string, unknown>;
    } catch {
      return undefined;
    }
  }

  private extractUserIdFromJwt(token: string): string | undefined {
    const claims = this.decodeJwtPayload(token);
    if (!claims) return undefined;
    return (
      (claims.preferred_username as string) ??
      (claims.sub as string) ??
      undefined
    );
  }

  private async fetchOidcToken(): Promise<string> {
    if (!this.oidc) throw new Error("OIDC not configured");
    const params = new URLSearchParams();
    if (this.oidc.clientSecret) {
      params.set("grant_type", "client_credentials");
      params.set("client_secret", this.oidc.clientSecret);
    } else {
      params.set("grant_type", "password");
      if (this.oidc.username) params.set("username", this.oidc.username);
      if (this.oidc.password) params.set("password", this.oidc.password);
    }
    params.set("client_id", this.oidc.clientId);
    if (this.oidc.audience) params.set("audience", this.oidc.audience);
    params.set("scope", this.oidc.scope ?? "openid daml_ledger_api");

    const res = await fetch(this.oidc.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const data = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };
    if (!res.ok || !data.access_token) {
      throw new Error(
        `OIDC token fetch failed: ${data.error_description ?? data.error ?? res.statusText}`,
      );
    }
    this.inferredUserId = this.extractUserIdFromJwt(data.access_token);
    this.tokenExpiryMs =
      Date.now() + (data.expires_in ? data.expires_in * 1000 : 3_600_000);
    return data.access_token;
  }

  private async getToken(): Promise<string> {
    if (!this.isV2) {
      return this.synthesizeV1Token({ admin: true });
    }
    if (this.bearerToken) return this.bearerToken;
    if (this.cachedToken && this.tokenExpiryMs && Date.now() < this.tokenExpiryMs - 60_000) {
      return this.cachedToken;
    }
    this.cachedToken = await this.fetchOidcToken();
    return this.cachedToken;
  }

  private effectiveUserId(): string | undefined {
    return this.ledgerUserId ?? this.inferredUserId;
  }

  private commandId(): string {
    return `${this.applicationId}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  }

  // Canton v2 returns full package IDs in event templateIds even when commands
  // use package-name references (e.g. #daml:Main:SealedBidAuction). Match by the
  // stable module:entity suffix so both forms resolve.
  private templateRefEqual(a: string, b: string): boolean {
    if (a === b) return true;
    const suffixA = a.split(":").slice(-2).join(":");
    const suffixB = b.split(":").slice(-2).join(":");
    return suffixA === suffixB;
  }

  // ── v1 transport ─────────────────────────────────────────────────────────

  private async v1Call<T>(
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
    const parsed = (await res.json()) as V1JsonApiResult<T>;
    if (parsed.status !== 200 && parsed.status !== 201) {
      const err = parsed.errors?.join("; ") ?? `HTTP ${res.status}`;
      throw new Error(`Canton JSON API ${method} ${path} failed: ${err}`);
    }
    return parsed.result as T;
  }

  // ── v2 transport ─────────────────────────────────────────────────────────

  private async v2Call<T>(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
    contentType = "application/json",
  ): Promise<T> {
    const token = await this.getToken();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    const init: RequestInit = { method, headers };
    if (body) {
      if (contentType === "application/octet-stream" && body instanceof Uint8Array) {
        init.body = body;
      } else {
        headers["Content-Type"] = contentType;
        init.body = JSON.stringify(body);
      }
    }
    const res = await fetch(`${this.jsonApiUrl}${path}`, init);
    const parsed = (await res.json()) as
      | T
      | { code?: string; cause?: string; message?: string };
    const isError =
      !res.ok ||
      (parsed &&
        typeof parsed === "object" &&
        !(parsed instanceof Array) &&
        ("code" in parsed || "cause" in parsed));
    if (isError) {
      const err =
        (parsed as { cause?: string }).cause ??
        (parsed as { message?: string }).message ??
        `HTTP ${res.status}`;
      throw new Error(`Canton JSON API v2 ${method} ${path} failed: ${err}`);
    }
    return parsed as T;
  }

  // ── party management ───────────────────────────────────────────────────────

  async listParties(): Promise<AllocatePartyResult[]> {
    if (!this.isV2) {
      const admin = this.synthesizeV1Token({ admin: true });
      const result = await this.v1Call<
        { identifier: string; displayName?: string; isLocal: boolean }[]
      >("GET", "/v1/parties", admin);
      return result;
    }
    const res = await this.v2Call<{ partyDetails: V2PartyDetails[] }>(
      "GET",
      "/v2/parties",
    );
    return (res.partyDetails ?? []).map((p) => ({
      identifier: p.party,
      isLocal: p.isLocal ?? true,
      displayName: p.localMetadata?.annotations?.displayName,
    }));
  }

  async allocateParty(
    identifierHint: string,
    displayName?: string,
  ): Promise<AllocatePartyResult> {
    if (!this.isV2) {
      const admin = this.synthesizeV1Token({ admin: true });
      const result = await this.v1Call<
        { identifier: string; displayName?: string; isLocal: boolean }
      >("POST", "/v1/parties/allocate", admin, {
        identifierHint,
        displayName: displayName ?? identifierHint,
      });
      return result;
    }
    const body: Record<string, unknown> = { partyIdHint: identifierHint };
    const userId = this.effectiveUserId();
    if (userId) body.userId = userId;
    const res = await this.v2Call<{ partyDetails: V2PartyDetails }>(
      "POST",
      "/v2/parties",
      body,
    );
    return {
      identifier: res.partyDetails.party,
      isLocal: res.partyDetails.isLocal ?? true,
      displayName,
    };
  }

  // ── contract operations ──────────────────────────────────────────────────

  async query<T = unknown>(
    party: string,
    templateIds: string[],
    query?: Record<string, unknown>,
  ): Promise<Array<{ contractId: string; templateId: string; payload: T }>> {
    if (!this.isV2) {
      const jwt = this.synthesizeV1Token({ actAs: [party] });
      return this.v1Call("POST", "/v1/query", jwt, { templateIds, query });
    }

    const end = await this.v2Call<{ offset?: number | string }>(
      "GET",
      "/v2/state/ledger-end",
    );
    const activeAtOffset = end.offset ?? 0;

    const eventFormat = {
      filtersByParty: {
        [party]: {
          cumulative: templateIds.map((id) => ({
            identifierFilter: {
              TemplateFilter: {
                value: {
                  templateId: id,
                  includeCreatedEventBlob: false,
                },
              },
            },
          })),
        },
      },
      verbose: false,
    };

    const res = await this.v2Call<
      Array<{ contractEntry?: { JsActiveContract?: { createdEvent?: V2CreatedEvent } } }>
    >("POST", "/v2/state/active-contracts", {
      activeAtOffset,
      eventFormat,
      verbose: false,
    });

    const contracts = res
      .flatMap((item) => {
        const ev = item.contractEntry?.JsActiveContract?.createdEvent;
        if (!ev) return [];
        return [
          {
            contractId: ev.contractId,
            templateId: ev.templateId,
            payload: ev.createArgument as T,
          },
        ];
      });

    if (!query) return contracts;
    return contracts.filter((c) =>
      Object.entries(query).every(
        ([k, v]) =>
          (c.payload as Record<string, unknown> | undefined)?.[k] === v,
      ),
    );
  }

  async create<T = unknown>(
    party: string,
    templateId: string,
    payload: unknown,
  ): Promise<{ contractId: string; templateId: string; payload: T }> {
    if (!this.isV2) {
      const jwt = this.synthesizeV1Token({ actAs: [party] });
      return this.v1Call("POST", "/v1/create", jwt, { templateId, payload });
    }
    const res = await this.submitTransaction(party, [
      { CreateCommand: { templateId, createArguments: payload } },
    ]);
    const created = res.transaction.events.find(
      (e) => e.CreatedEvent && this.templateRefEqual(e.CreatedEvent.templateId, templateId),
    )?.CreatedEvent;
    if (!created) {
      throw new Error(
        `Canton v2 create did not emit expected created event for ${templateId}`,
      );
    }
    return {
      contractId: created.contractId,
      templateId: created.templateId,
      payload: created.createArgument as T,
    };
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
    if (!this.isV2) {
      const jwt = this.synthesizeV1Token({ actAs: [party] });
      return this.v1Call("POST", "/v1/exercise", jwt, {
        templateId,
        contractId,
        choice,
        argument,
      });
    }
    const res = await this.submitTransaction(party, [
      {
        ExerciseCommand: {
          templateId,
          contractId,
          choice,
          choiceArgument: argument,
        },
      },
    ]);
    const events = res.transaction.events
      .map((e) => {
        if (e.CreatedEvent) {
          return {
            created: {
              contractId: e.CreatedEvent.contractId,
              templateId: e.CreatedEvent.templateId,
              payload: e.CreatedEvent.createArgument,
            },
          };
        }
        if (e.ArchivedEvent) {
          return {
            archived: {
              contractId: e.ArchivedEvent.contractId,
              templateId: e.ArchivedEvent.templateId,
            },
          };
        }
        if (e.ExercisedEvent) {
          return {
            exercised: {
              contractId: e.ExercisedEvent.contractId,
              templateId: e.ExercisedEvent.templateId,
              choice: e.ExercisedEvent.choice,
              result: e.ExercisedEvent.exerciseResult,
            },
          };
        }
        return undefined;
      })
      .filter((x): x is NonNullable<typeof x> => !!x);
    return { exerciseResult: undefined as T, events };
  }

  // ── package discovery (v2 only) ──────────────────────────────────────────

  async listPackageIds(): Promise<string[]> {
    if (!this.isV2) {
      throw new Error("listPackageIds is only supported on JSON Ledger API v2");
    }
    const res = await this.v2Call<{ packageIds: string[] }>(
      "GET",
      "/v2/packages",
    );
    return res.packageIds ?? [];
  }

  // ── DAR upload (v2 only) ─────────────────────────────────────────────────

  async uploadDar(dar: Uint8Array): Promise<unknown> {
    if (!this.isV2) {
      throw new Error("DAR upload is only supported on JSON Ledger API v2");
    }
    const token = await this.getToken();
    const res = await fetch(
      `${this.jsonApiUrl}/v2/dars?vetAllPackages=true`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/octet-stream",
        },
        body: dar,
      },
    );
    const parsed = (await res.json()) as
      | unknown
      | { code?: string; cause?: string };
    if (
      !res.ok ||
      (parsed &&
        typeof parsed === "object" &&
        ("code" in parsed || "cause" in parsed))
    ) {
      const err =
        (parsed as { cause?: string }).cause ??
        (parsed as { message?: string }).message ??
        `HTTP ${res.status}`;
      throw new Error(`Canton v2 DAR upload failed: ${err}`);
    }
    return parsed;
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private async submitTransaction(
    party: string,
    commands: unknown[],
  ): Promise<V2TransactionResponse> {
    const userId = this.effectiveUserId();
    const body: Record<string, unknown> = {
      commands: {
        commandId: this.commandId(),
        commands,
        actAs: [party],
        readAs: [party],
        workflowId: this.applicationId,
      },
    };
    if (userId) {
      (body.commands as Record<string, unknown>).userId = userId;
    }
    return this.v2Call<V2TransactionResponse>(
      "POST",
      "/v2/commands/submit-and-wait-for-transaction",
      body,
    );
  }
}

// Convenience factory that pulls from env at construction time so consumers
// don't have to plumb config through. Returns null when Canton isn't configured.
export function makeCantonLedgerClientFromEnv(): CantonLedgerClient | null {
  const url = process.env.CANTON_JSON_API_URL;
  if (!url) return null;
  const applicationId = process.env.CANTON_APPLICATION_ID ?? "cognivern";
  const ledgerId = process.env.CANTON_LEDGER_ID ?? "sandbox";
  const ledgerUserId = process.env.CANTON_LEDGER_USER_ID;
  const jwtSecret = process.env.CANTON_JWT_SECRET ?? "";
  const bearerToken = process.env.CANTON_BEARER_TOKEN;

  const oidcTokenUrl = process.env.CANTON_OIDC_TOKEN_URL;
  const oidcClientId = process.env.CANTON_OIDC_CLIENT_ID;
  const oidc: CantonLedgerClientOptions["oidc"] | undefined =
    oidcTokenUrl && oidcClientId
      ? {
          tokenUrl: oidcTokenUrl,
          clientId: oidcClientId,
          clientSecret: process.env.CANTON_OIDC_CLIENT_SECRET,
          username: process.env.CANTON_OIDC_USERNAME,
          password: process.env.CANTON_OIDC_PASSWORD,
          audience: process.env.CANTON_OIDC_AUDIENCE,
          scope: process.env.CANTON_OIDC_SCOPE,
        }
      : undefined;

  const mode = bearerToken || oidc ? "v2" : "v1";
  logger.info(
    `Canton: JSON Ledger client bound to ${url} (app=${applicationId}, mode=${mode})`,
  );
  return new CantonLedgerClient({
    jsonApiUrl: url,
    applicationId,
    ledgerId,
    ledgerUserId,
    jwtSecret,
    bearerToken,
    oidc,
  });
}
