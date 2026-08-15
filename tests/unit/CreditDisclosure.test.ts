// pragma: allowlist secret — every "secret" below (cvk_, ghp_, xoxb-, AIza…,
// RSA blocks, sk-proj-) is a deliberate FAKE fixture for testing the redaction
// logic. None is a real credential.
import { describe, expect, it } from "vitest";

import {
  flattenMessages,
  redactSecrets,
  redactedExcerpt,
} from "@backend/services/credits/redaction.js";
import {
  CEILING_DISCLOSURE_MULTIPLIERS,
  DISCLOSURE_TIERS,
  allocationForTier,
  describeTiers,
  fieldsPersistedAt,
  isDisclosureTier,
  resolveMultipliers,
  tierAtLeast,
} from "@backend/services/credits/disclosure.js";
import { classifyTask } from "@backend/services/credits/taskClassifier.js";
import { usdToNano } from "@backend/services/credits/money.js";

describe("secret redaction", () => {
  // Fake credentials, assembled from parts so no secret-shaped literal exists
  // in the repo (GitHub push protection scans blobs and flags these even
  // though every one is a deliberate fixture for the redaction tests). The
  // concatenated values still match the redaction regexes at runtime.
  const parts = (...p: string[]) => p.join("");
  const cases: Array<[string, string, string]> = [
    ["OpenAI key", `use ${parts("sk-", "proj-", "abcdefghijklmnopqrstuvwxyz012345")}`, "openai_key"],
    ["Anthropic key", `ANTHROPIC=${parts("sk-", "ant-api03-", "abcdefghijklmnopqrstuvwxyz")}`, "anthropic_key"],
    ["Cognivern gateway key", `key is ${parts("cvk_", "AbCdEfGhIjKlMnOpQrStUvWx")}`, "cognivern_key"],
    ["0G management key", `admin ${parts("mk-", "abcdefghijklmnopqrstuvwx")}`, "zerog_key"],
    ["GitHub PAT", `token ${parts("ghp_", "abcdefghijklmnopqrstuvwxyz01234567")}`, "github_token"],
    ["Slack token", parts("xoxb-", "123456789012-", "abcdefghijkl"), "slack_token"],
    ["AWS access key", `${parts("AKIA", "IOSFODNN7EXAMPLE")} is mine`, "aws_access_key"],
    ["Google API key", parts("AIza", "SyA1234567890abcdefghijklmnopqrstuvw"), "google_api_key"],
    ["Stripe key", parts("sk_", "live_", "abcdefghijklmnopqrstuvwx"), "stripe_key"],
    [
      "JWT",
      `Cookie: ${parts(
        "eyJhbGciOiJIUzI1NiIs",
        "InR5cCI6IkpXVCJ9",
        ".eyJzdWIiOiIxMjM0NTY3ODkwIn0",
        ".dBjftJeZ4CVPmB92K27uhbUJU1p1r",
      )}`,
      "jwt",
    ],
    [
      "hex private key",
      `PK=${parts("0x4c0883a69102937d6231471b5dbb6204", "fe512961708279b0b4c0d3b9a5d0f2a1")}`,
      "hex_private_key",
    ],
    ["bearer token", `${parts("Authorization: Bearer ", "abcdefghijklmnop1234")}`, "bearer_token"],
    ["URL credentials", parts("postgres://admin:", "sup3rs3cret@db.internal:5432/app"), "url_credentials"],
    ["email", "contact me at someone@example.com", "email"],
    ["generic assignment", 'password = "hunter2hunter2"', "generic_secret_assignment"],
  ];

  for (const [label, input, expectedCategory] of cases) {
    it(`strips ${label}`, () => {
      const result = redactSecrets(input);
      expect(result.count).toBeGreaterThan(0);
      expect(result.categories).toContain(expectedCategory);
      expect(result.text).toContain("[REDACTED:");
    });
  }

  it("removes an entire PEM private key block", () => {
    const input = [
      "here is my key",
      "-----BEGIN RSA PRIVATE KEY-----",
      "MIIEowIBAAKCAQEAxGZ1s2Vd7fT8n0pQrStUvWxYz",
      "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789",
      "-----END RSA PRIVATE KEY-----",
    ].join("\n");

    const result = redactSecrets(input);
    expect(result.categories).toContain("private_key_block");
    expect(result.text).not.toContain("MIIEowIBAAKCAQEA");
    expect(result.text).not.toContain("BEGIN RSA PRIVATE KEY");
  });

  it("leaves public identifiers alone", () => {
    // A tx hash and an EVM address are public and useful in an audit trail.
    const input =
      "tx 0x1234567890abcdef1234567890abcdef12345678 from 0xAbCdEf0123456789AbCdEf0123456789AbCdEf01";
    const result = redactSecrets(input);
    expect(result.count).toBe(0);
    expect(result.text).toBe(input);
  });

  it("leaves ordinary prose and code untouched", () => {
    const input = "function add(a, b) { return a + b; } // sums two numbers";
    expect(redactSecrets(input).count).toBe(0);
  });

  it("redacts before truncating, so a secret near the cut-off cannot survive", () => {
    const secret = parts("sk-proj-", "abcdefghijklmnopqrstuvwxyz012345");
    const input = `${"a".repeat(40)}${secret}${"b".repeat(200)}`;

    const { excerpt, redaction } = redactedExcerpt(input, 60);
    expect(redaction.count).toBeGreaterThan(0);
    expect(excerpt).not.toContain(secret);
    expect(excerpt).not.toContain(parts("sk-proj-", ""));
  });

  it("handles nullish and empty input without throwing", () => {
    expect(redactSecrets(null).count).toBe(0);
    expect(redactSecrets(undefined).text).toBe("");
    expect(redactSecrets("").categories).toEqual([]);
  });

  it("is stateless across calls despite module-level global regexes", () => {
    const input = parts("sk-proj-", "abcdefghijklmnopqrstuvwxyz012345");
    const first = redactSecrets(input);
    const second = redactSecrets(input);
    expect(second).toEqual(first);
  });

  it("catches a distinctive-prefix key pasted flush against other characters", () => {
    // No space, quote or delimiter before the key — the case a \b-anchored
    // pattern misses.
    const result = redactSecrets(
      `myconfig${parts("sk-proj-", "abcdefghijklmnopqrstuvwxyz012345")}trailing`,
    );
    expect(result.categories).toContain("openai_key");
    expect(result.text).not.toContain("abcdefghijklmnopqrstuvwxyz");
  });

  it("does not mistake ordinary hyphenated prose for a bare sk- key", () => {
    // Documents why bare `sk-` keeps its word boundary while the distinctive
    // prefixes do not.
    const result = redactSecrets("our risk-management-system-alpha-release is ready");
    expect(result.count).toBe(0);
  });
});

describe("message flattening", () => {
  it("flattens string content with roles", () => {
    const text = flattenMessages([
      { role: "system", content: "be brief" },
      { role: "user", content: "hello" },
    ]);
    expect(text).toContain("system: be brief");
    expect(text).toContain("user: hello");
  });

  it("flattens multipart content and reduces non-text parts to a marker", () => {
    const text = flattenMessages([
      {
        role: "user",
        content: [
          { type: "text", text: "what is this" },
          { type: "image_url", image_url: { url: "data:image/png;base64,AAAA" } },
        ],
      },
    ]);
    expect(text).toContain("what is this");
    expect(text).toContain("<image_url>");
    // Binary payloads must never be carried through.
    expect(text).not.toContain("base64");
  });

  it("returns empty string for malformed input", () => {
    expect(flattenMessages(null)).toBe("");
    expect(flattenMessages("not an array")).toBe("");
    expect(flattenMessages([null, 42])).toBe("");
  });
});

describe("disclosure tiers", () => {
  it("orders tiers correctly", () => {
    expect(tierAtLeast("open", "standard")).toBe(true);
    expect(tierAtLeast("private", "standard")).toBe(false);
    expect(tierAtLeast("standard", "standard")).toBe(true);
  });

  it("validates tier names", () => {
    expect(isDisclosureTier("detailed")).toBe(true);
    expect(isDisclosureTier("public")).toBe(false);
    expect(isDisclosureTier(null)).toBe(false);
  });

  it("gates stored fields so private records hold no content at all", () => {
    const priv = fieldsPersistedAt("private");
    expect(priv.promptDigest).toBe(false);
    expect(priv.responseDigest).toBe(false);
    expect(priv.taskClass).toBe(false);
    expect(priv.projectTag).toBe(false);
    expect(priv.excerpts).toBe(false);
  });

  it("adds digests at standard but still no content", () => {
    const standard = fieldsPersistedAt("standard");
    expect(standard.promptDigest).toBe(true);
    expect(standard.taskClass).toBe(false);
    expect(standard.excerpts).toBe(false);
  });

  it("adds classification at detailed and excerpts only at open", () => {
    expect(fieldsPersistedAt("detailed").taskClass).toBe(true);
    expect(fieldsPersistedAt("detailed").excerpts).toBe(false);
    expect(fieldsPersistedAt("open").excerpts).toBe(true);
  });

  it("makes disclosure monotonic — no tier reveals less than a lower one", () => {
    const keys = ["promptDigest", "responseDigest", "taskClass", "projectTag", "excerpts"] as const;
    for (let i = 1; i < DISCLOSURE_TIERS.length; i += 1) {
      const lower = fieldsPersistedAt(DISCLOSURE_TIERS[i - 1]);
      const higher = fieldsPersistedAt(DISCLOSURE_TIERS[i]);
      for (const key of keys) {
        if (lower[key]) expect(higher[key]).toBe(true);
      }
    }
  });

  it("rejects nonsensical multiplier overrides rather than minting credit", () => {
    const resolved = resolveMultipliers({
      private: -1,
      standard: Number.POSITIVE_INFINITY,
      detailed: 500,
      open: 1.75,
    } as never);

    expect(resolved.private).toBe(1.0);
    expect(resolved.standard).toBe(1.25);
    expect(resolved.detailed).toBe(1.5);
    expect(resolved.open).toBe(1.75);
  });

  it("computes integer allocations", () => {
    const base = usdToNano(20);
    expect(allocationForTier(base, "open")).toBe(usdToNano(40));
    expect(Number.isInteger(allocationForTier(base + 1, "detailed"))).toBe(true);
  });

  it("caps allocation at the configured amount under ceiling multipliers", () => {
    const base = usdToNano(20);
    for (const tier of DISCLOSURE_TIERS) {
      expect(allocationForTier(base, tier, CEILING_DISCLOSURE_MULTIPLIERS)).toBeLessThanOrEqual(base);
    }
    expect(allocationForTier(base, "open", CEILING_DISCLOSURE_MULTIPLIERS)).toBe(base);
  });

  it("describes every tier with what is and is not recorded", () => {
    const described = describeTiers();
    expect(described).toHaveLength(4);
    for (const tier of described) {
      expect(tier.sponsorSees.length).toBeGreaterThan(0);
      expect(tier.neverRecorded.length).toBeGreaterThan(0);
      expect(tier.summary.length).toBeGreaterThan(0);
    }
  });
});

describe("task classification", () => {
  it("labels obvious shapes of work", () => {
    expect(classifyTask("Write a function that parses a CSV file in TypeScript")).toBe("code");
    expect(classifyTask("Here is my stack trace, why does this throw a NullPointerException?")).toBe(
      "debug",
    );
    expect(classifyTask("Please code review this pull request diff for correctness")).toBe("review");
    expect(classifyTask("Help me write the README documentation for this project")).toBe("docs");
    expect(
      classifyTask("Compare Postgres and MySQL, what are the trade-offs for our use case?"),
    ).toBe("research");
  });

  it("declines to guess on short or unclear input", () => {
    expect(classifyTask("hi")).toBe("chat");
    expect(classifyTask("")).toBe("other");
    expect(classifyTask("The weather today is quite pleasant and mild outside")).toBe("other");
  });

  it("only ever returns a known label", () => {
    const inputs = [
      "deploy this with docker compose and terraform to production",
      "SELECT id FROM users GROUP BY tenant",
      "design a responsive tailwind layout with a colour palette",
      "asdf qwer zxcv random noise that means nothing at all here",
    ];
    for (const input of inputs) {
      expect(["code", "debug", "review", "docs", "research", "data", "design", "ops", "chat", "other"]).toContain(
        classifyTask(input),
      );
    }
  });
});
