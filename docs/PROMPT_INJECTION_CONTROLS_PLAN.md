# Prompt-Injection Controls Plan

## Problem

An agent that can read untrusted content, access private data, and send data or
value externally can be redirected by indirect prompt injection. Model
alignment, hidden-text filtering, and system-prompt instructions are helpful
signals but are not security boundaries. Cognivern must make consequential
actions independently enforceable outside the model context.

## Current Boundary

Cognivern already governs the wallet-spend path: a spend is evaluated against
policy, previewed, bound to an attestation, and routed through the wallet and
approval workflow. This reduces the risk that a manipulated agent silently
moves funds when the wallet is mediated by Cognivern.

This is not yet general prompt-injection protection. Today Cognivern does not
classify retrieved web, email, repository, document, or MCP content as
untrusted; propagate that classification through a plan; or govern general
egress channels such as email, GitHub publishing, webhooks, and storage export.
An agent holding a raw private key or an independent outbound credential can
bypass the control plane entirely.

## Implementation Status

Completed in the current release:

- Signed, operator-only source authorizations with exact spend binding and
  one-time execution nonces.
- Source-aware holds in both spend preview and execution, with provenance
  retained in the CRE spend artifact.
- Copilot tracking of MongoDB MCP output as `tool_output` provenance on later
  spend requests.
- Run-detail approval context showing source locators and authorization result
  before an operator broadcasts a held spend.
- Hidden-content fixture and deterministic source/authorization tests.

Still required for the broader claim: automatic provenance collectors for web,
email, repository, and document connectors; shared nonce storage for
multi-instance deployments; and egress policies for any publishing, messaging,
or data-export connectors added in the future.

The first egress slice now covers the connectors present in this repository:
agent/workspace webhooks, Slack alert webhooks, and MCP server POSTs. Set
`EGRESS_POLICY_ENFORCEMENT=true` and configure
`COGNIVERN_EGRESS_ALLOWLIST` to enforce HTTPS, hostname allowlisting, and a
64 KiB payload ceiling. Email, GitHub, and storage-export connectors are not
implemented here yet and remain follow-on work.

## Delivered: Source-Aware Spend Gate

This release is deliberately scoped to the existing wallet-spend path. It
proves that tagged untrusted content cannot silently expand a governed agent's
payment authority. Automatic provenance collection currently covers MongoDB MCP
outputs; the other source kinds below are accepted by the API for connector
integrations that have not shipped yet.

1. Record source provenance on an agent plan and spend intent. Sources include
   `user`, `web`, `email`, `repository`, `document`, and `tool_output`; all
   non-user content is untrusted by default.
2. Bind an operator authorization to the exact agent, recipient, asset, amount
   ceiling, purpose, expiry, and permitted source scope. The authorization is
   minted outside the model's tool loop and cannot be widened by tool output.
3. At preview and execution, hold an action when an untrusted source introduced
   a new recipient or changes any authorized parameter. The audit run records
   the source IDs, policy decision, and reason for the hold.
4. Keep the existing preview-to-execute attestation. The attestation proves the
   execution matches the preview; the operator authorization proves the preview
   fits the user's intended authority. Both are required for source-aware runs.
5. Show this chain in the product: user intent -> untrusted artifact -> proposed
   spend -> authorization/policy result -> execution or hold.

### Initial API surface

- `POST /api/spend/authorizations` mints a short-lived, HMAC-signed operator
  authorization. It requires authenticated operator identity and is not exposed
  as an agent tool.
- `POST /api/spend/preview` and `POST /api/spend` accept
  `metadata.sourceProvenance` and a transient `sourceAuthorization` token.
  The token is validated but never persisted; audit evidence contains only its
  validated scope and expiry. Preview does not consume it; execution consumes
  its nonce so it cannot authorize a second payment in the same backend process.
- Source-bearing requests without a matching authorization are held. Set
  `SOURCE_AWARE_SPEND_ENFORCEMENT=true` to require an authorization for every
  spend request while a deployment integrates provenance collection.
- Set `SPEND_AUTHORIZATION_SECRET` to a stable, deployment-managed secret.
  Without it, authorizations are valid only for the current backend process.
  Nonce consumption is currently in-process; production multi-instance rollout
  must move used nonces to shared durable storage before enabling enforcement.

## Adversarial Test Suite

`pnpm test:prompt-injection` currently covers a hidden HTML honeypot, direct
malicious spend requests, MCP tool-output provenance, authorization tampering,
and authorization replay. Email, GitHub issue, document, and other connector
fixtures are planned follow-up coverage.
The deterministic pass condition is not that a model repeats or ignores a
string. It is that malicious model output cannot create a new authorization,
alter a bound recipient or amount, or cause a transfer.

Optional live-model evaluations may record whether a model followed the
injection. They are telemetry only and cannot determine the security outcome.

## Acceptance Criteria

- A page containing a command to pay an attacker can be read and recorded as
  untrusted without granting payment authority.
- An attempt to preview or execute a spend to a recipient introduced by that
  page is held before signing or broadcast.
- A valid authorization for Vendor A cannot be replayed for Vendor B, a larger
  amount, a different asset, or after expiry.
- Every block or hold explains the matched authorization/policy constraint and
  retains source provenance in the CRE audit record.
- The test suite proves the enforcement even when a test double supplies the
  malicious spend request directly.

## Follow-On Scope

Once the spend gate is complete, apply the same capability and provenance model
to email, GitHub, Slack, HTTP/webhook, and storage connectors. Those connectors
also require destination allowlists, data classification, and exact-action
approval before Cognivern can claim to break the full private-data / untrusted-
content / egress trifecta.
