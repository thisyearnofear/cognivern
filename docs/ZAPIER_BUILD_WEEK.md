# Zapier Build Week — preview-only weekly vendor review pilot

> Status: Parked after the fictional two-pass rehearsal; no operator or live
> Zapier run yet. To resume, start with the interview below, not an account
> connection.
>
> Event: Nov 23–29, 2026. Promo window: free/trial tier allows up to 250
> Zapier MCP calls per account per day (resets midnight UTC), Nov 23 noon ET –
> Jan 5 2027 noon ET. Not a judged program — a window with promotional MCP
> pricing to rehearse a recurring operator
> workflow across Gmail and Sheets. Thin event doc; the durable evidence plan
> it serves is [OUTCOME_EVIDENCE_PLAN.md](./OUTCOME_EVIDENCE_PLAN.md).

Sources: [Build Week challenge guide](https://community.zapier.com/build-week-143/build-week-challenge-guide-54120) · [Zapier MCP usage docs](https://docs.zapier.com/mcp/overview/usage)

## The workflow

**Prepare my weekly vendor review** — a recurring Gmail-to-Sheets triage that
returns a change list for the operator: new, changed, held, and skipped vendor
requests, previewed only. Never sends, writes, or pays.

- Skill: [.claude/skills/weekly-vendor-review/SKILL.md](../.claude/skills/weekly-vendor-review/SKILL.md)
- Fictional rehearsal fixture (two passes): [.claude/skills/weekly-vendor-review/references/rehearsal.md](../.claude/skills/weekly-vendor-review/references/rehearsal.md)

## Challenges

- **Challenge 1 — a workflow across apps.** The review reads a named Gmail
  label for the review period and compares it with a private Sheets review
  tab. The deliverable is the operator-facing change list, not a mailbox
  summary.
- **Challenge 2 — save and re-invoke.** The same saved workflow runs again on
  the next period and reports only what changed against the operator's own
  sheet state — including holds that must not be re-proposed.

## Proposed order

1. **Interview an operator** before building anything. Verbatim prompt:
   > Show me last week's review, with private details removed. Which fields did you copy, which decisions did you make, and what must an assistant never do?

   Stop or pivot if the interview surfaces no recurring artifact worth
   automating.
2. **Compare an ordinary prompt against the skill** on the same sanitized
   inputs (the fixture passes). The operator checks for missed asks,
   duplicate proposals, invented dates, lost status/owner preservation, and
   correction handling — and times how long checking takes versus preparing.
3. **Supervised read-only preview** against a real operator-approved label and
   private sheet: the skill proposes, the human applies any changes manually.
4. **Next week:** does the operator independently invoke the workflow again,
   and did a held request or a source citation actually help?

## Boundaries

- Fixed read-only tools are separate from any future credentialed write
  executor. If a write path is ever built it must independently enforce the
  allowed destination and fields, require explicit approval, and carry
  idempotency/reconciliation — it is not assumed by this pilot, and no
  adapter exists yet.
- No receiver is presumed public: carry pointers to evidence, never raw
  bytes. [DATA_OWNERSHIP.md](./DATA_OWNERSHIP.md) governs what leaves the
  trust boundary; the digest is later and not the primary goal.

## First rehearsal (fictional inputs only)

| Pass | Ordinary weekly list | Saved skill preview |
| --- | --- | --- |
| Empty sheet | Listed all three asks and left missing dates unspecified. Cedar's bank change/payment appeared as an ordinary row. | Two new proposals; Cedar held for human review, with its message reference and no invented governance receipt. |
| Operator-reviewed sheet | Listed Alder's revised USD 975 quote and Beacon's unchanged reminder. | One item for re-review: Alder, USD 900 to 975 (M-11b). Two skipped: the reminder and the existing hold. No reviewed terms were replaced. |

This was one paired rehearsal on a constructed fixture, not a live Zapier run or a measure of time saved. Neither pass accessed Gmail, wrote to Sheets, or tested enforceable authorization. Next: ask one operator for a sanitized prior review and their non-delegable decisions before connecting any account.
