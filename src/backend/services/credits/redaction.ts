/**
 * Credential scrubbing for anything that might be persisted from a gateway
 * request or response body.
 *
 * The hard rule this file exists to enforce: no credential material is ever
 * written to `inference_records`, not even for participants who opted into the
 * most open disclosure tier. Transparency is about what a participant spent
 * credits on — it is never a reason to archive their API keys.
 *
 * Design notes:
 *  - Patterns are ordered most-specific-first. `applyAll` runs every pattern
 *    over the text, so overlapping matches are fine, but specific provider
 *    formats are listed before the generic key/value fallbacks so the reported
 *    category is the useful one.
 *  - Every replacement keeps a fixed-width marker (`[REDACTED:<category>]`) so
 *    a reader can see that something was removed and what kind of thing it was.
 *  - Redaction is reported, not silent: `RedactionResult.categories` is stored
 *    on the inference record so a participant can see "2 secrets were stripped
 *    before this call was logged" rather than having to trust us.
 */

export type RedactionCategory =
  | "openai_key"
  | "anthropic_key"
  | "cognivern_key"
  | "zerog_key"
  | "github_token"
  | "slack_token"
  | "aws_access_key"
  | "google_api_key"
  | "stripe_key"
  | "jwt"
  | "private_key_block"
  | "hex_private_key"
  | "bearer_token"
  | "url_credentials"
  | "email"
  | "generic_secret_assignment";

export interface RedactionResult {
  /** Text with every match replaced by a `[REDACTED:<category>]` marker. */
  text: string;
  /** Total number of substitutions made. */
  count: number;
  /** Distinct categories that matched, sorted for stable storage/comparison. */
  categories: RedactionCategory[];
}

interface Pattern {
  category: RedactionCategory;
  regex: RegExp;
  /**
   * When set, only this capture group is replaced and the rest of the match is
   * preserved. Used for key/value assignments so `api_key: <secret>` becomes
   * `api_key: [REDACTED:...]` instead of losing the field name.
   */
  captureGroup?: number;
}

// NOTE: every regex must carry the `g` flag — `applyAll` relies on
// String.replace replacing all occurrences.
const PATTERNS: Pattern[] = [
  // ── PEM / SSH private key blocks ────────────────────────────────────────
  // Matched first: a key block can contain base64 that looks like other
  // patterns, and we want the whole block gone in one substitution.
  {
    category: "private_key_block",
    regex:
      /-----BEGIN[ A-Z0-9]*PRIVATE KEY-----[\s\S]*?-----END[ A-Z0-9]*PRIVATE KEY-----/g,
  },

  // ── Named provider credentials ──────────────────────────────────────────
  // Distinctive prefixes (`sk-ant-`, `sk-proj-`, `ghp_`, `AKIA`, …) deliberately
  // OMIT a leading \b. A key pasted flush against other word characters — no
  // space, quote, or delimiter — would otherwise slip through, and for
  // credential scrubbing a false positive costs excerpt fidelity while a false
  // negative leaks a secret. The prefixes are specific and the minimum lengths
  // long enough that spurious matches are not a practical concern.
  //
  // Bare `sk-` is the exception and KEEPS its \b: without it, ordinary text
  // like "risk-management-system-alpha" matches.
  { category: "anthropic_key", regex: /sk-ant-(?:api\d{2}-)?[A-Za-z0-9_-]{20,}/g },
  { category: "openai_key", regex: /sk-(?:proj|svcacct)-[A-Za-z0-9_-]{20,}/g },
  { category: "openai_key", regex: /\bsk-[A-Za-z0-9_-]{20,}/g },
  { category: "cognivern_key", regex: /cv[nk]_[A-Za-z0-9_-]{16,}/g },
  // 0G Router management keys. Keeps \b — "mk-" is short enough to appear
  // inside ordinary hyphenated words.
  { category: "zerog_key", regex: /\bmk-[A-Za-z0-9_-]{16,}/g },
  {
    category: "github_token",
    regex: /(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{28,}|github_pat_[A-Za-z0-9_]{40,}/g,
  },
  { category: "slack_token", regex: /xox[abprs]-[A-Za-z0-9-]{10,}/g },
  { category: "aws_access_key", regex: /(?:AKIA|ASIA)[0-9A-Z]{16}/g },
  // 35+ rather than exactly 35: over-matching a trailing character is harmless,
  // missing a key because the length shifted is not.
  { category: "google_api_key", regex: /AIza[0-9A-Za-z_-]{35,}/g },
  { category: "stripe_key", regex: /(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{20,}/g },

  // ── Generic credential shapes ───────────────────────────────────────────
  // JWT: three base64url segments. Requires the `eyJ` header prefix so we
  // don't shred ordinary dotted identifiers.
  {
    category: "jwt",
    regex: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  },
  // EVM / generic 32-byte hex secret. Deliberately requires the full 64 hex
  // chars so transaction hashes and addresses (40 chars) are left alone —
  // those are public and useful in an audit trail.
  { category: "hex_private_key", regex: /\b0x[a-fA-F0-9]{64}\b/g },
  {
    category: "bearer_token",
    regex: /\b(?:Bearer|Basic|Token)\s+([A-Za-z0-9_\-.=+/]{16,})/gi,
    captureGroup: 1,
  },
  // user:password@host in a URL.
  {
    category: "url_credentials",
    regex: /\b([a-z][a-z0-9+.-]*:\/\/)[^\s/:@]+:([^\s/@]+)@/gi,
    captureGroup: 2,
  },
  {
    category: "email",
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  },
  // Last resort: `secret = "..."`, `apiKey: ...`, `PASSWORD=...`. Runs after
  // the specific formats so a recognised provider key reports its real
  // category rather than this catch-all.
  {
    category: "generic_secret_assignment",
    regex:
      /\b(?:api[_-]?key|apikey|secret[_-]?key|secret|password|passwd|access[_-]?token|refresh[_-]?token|auth[_-]?token|private[_-]?key|client[_-]?secret)\b\s*[:=]\s*["']?([^\s"',;}]{8,})["']?/gi,
    captureGroup: 1,
  },
];

function marker(category: RedactionCategory): string {
  return `[REDACTED:${category}]`;
}

/**
 * Strip credential material from free text.
 *
 * Safe to call on untrusted input of any size; returns the empty result for
 * nullish or non-string input so callers don't need to guard.
 */
export function redactSecrets(input: string | null | undefined): RedactionResult {
  if (typeof input !== "string" || input.length === 0) {
    return { text: "", count: 0, categories: [] };
  }

  let text = input;
  let count = 0;
  const categories = new Set<RedactionCategory>();

  for (const pattern of PATTERNS) {
    // Reset lastIndex: PATTERNS is module-level and the regexes carry /g, so a
    // previous call could otherwise leave state behind.
    pattern.regex.lastIndex = 0;

    text = text.replace(pattern.regex, (match, ...groups) => {
      if (pattern.captureGroup === undefined) {
        count += 1;
        categories.add(pattern.category);
        return marker(pattern.category);
      }

      const captured = groups[pattern.captureGroup - 1];
      if (typeof captured !== "string" || captured.length === 0) return match;
      // Already scrubbed by an earlier, more specific pattern.
      if (captured.startsWith("[REDACTED:")) return match;

      count += 1;
      categories.add(pattern.category);
      return match.replace(captured, marker(pattern.category));
    });
  }

  return { text, count, categories: [...categories].sort() };
}

/**
 * Flatten an OpenAI-style `messages` array into plain text for digesting and
 * (at the most open disclosure tier) excerpting.
 *
 * Handles both the legacy `content: string` form and the multipart
 * `content: [{type:'text', text}]` form. Non-text parts (images, audio) are
 * reduced to a type marker — we never persist binary payloads.
 */
export function flattenMessages(messages: unknown): string {
  if (!Array.isArray(messages)) return "";

  const parts: string[] = [];
  for (const message of messages) {
    if (!message || typeof message !== "object") continue;
    const role = String((message as Record<string, unknown>).role ?? "unknown");
    const content = (message as Record<string, unknown>).content;

    if (typeof content === "string") {
      parts.push(`${role}: ${content}`);
      continue;
    }

    if (Array.isArray(content)) {
      const rendered = content
        .map((part) => {
          if (!part || typeof part !== "object") return "";
          const p = part as Record<string, unknown>;
          if (typeof p.text === "string") return p.text;
          return `<${String(p.type ?? "unknown")}>`;
        })
        .filter(Boolean)
        .join(" ");
      parts.push(`${role}: ${rendered}`);
    }
  }

  return parts.join("\n");
}

/**
 * Produce a bounded, credential-free excerpt.
 *
 * Redaction happens BEFORE truncation, so a secret can never survive by
 * sitting near the cut-off boundary.
 */
export function redactedExcerpt(
  input: string | null | undefined,
  maxLength: number,
): { excerpt: string; redaction: RedactionResult } {
  const redaction = redactSecrets(input);
  const excerpt =
    redaction.text.length > maxLength
      ? `${redaction.text.slice(0, maxLength)}…`
      : redaction.text;
  return { excerpt, redaction };
}
