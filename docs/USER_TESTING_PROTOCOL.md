# Cognivern User-Testing Protocol

**Status:** Ready for internal dry runs; external pilot requires the environment gates below.

This protocol is for moderated sessions with people who did not build the latest
UX slice. It tests whether Cognivern's core governance workflow is understandable
without teaching participants the underlying protocols first.

## Before inviting participants

Do not run external sessions until all of these are true:

- [ ] The team has named one canonical pilot URL. Use the **Live app** URL in
      `docs/TESTER_GUIDE.md`; do not mix Vercel, API, and legacy hostnames in
      participant instructions.
- [ ] The pilot uses an isolated workspace or staging deployment with no real
      funds, production API keys, or other users' data.
- [ ] The workspace has predictable seeded data: at least one approved, held,
      and denied decision, plus one awaiting or failed run where those states
      are part of the study.
- [ ] A reset procedure has been tested and can restore the workspace between
      sessions.
- [ ] The moderator has verified sign-in, dashboard loading, audit loading, and
      route navigation immediately before each session.
- [ ] Any action that can approve, reject, execute, pause, resume, or revoke is
      either disabled for the pilot or explicitly limited to disposable test
      records.
- [ ] The participant has agreed to the session format and recording, if used.

The current repository has public/demo browser coverage and an opt-in
authenticated smoke test. That is a release-safety check, not a substitute for
an internal dry run or a real staging environment.

## Study goals

1. Can a new user tell whether anything needs attention?
2. Can they distinguish an approved, held, and denied decision?
3. Can they find the reason and next safe action without learning Cognivern's
   architecture first?
4. Can they understand the difference between an API identity and an example
   identity?
5. Can they tell which actions are safe to explore and which actions mutate
   governed state?

## Suggested participants

Run at least five moderated sessions after two internal dry runs. Prefer a mix
of:

- an operations or compliance user;
- a technical integrator or agent builder;
- a treasury, finance, or fund operator;
- an agent/product engineer;
- a crypto-native user who is not familiar with Cognivern.

Do not recruit only engineers. The central question is whether the operating
model is legible to the person responsible for deciding what an agent may do.

## Session format: 30–45 minutes

### 1. Welcome and consent — 3 minutes

Say:

> We are testing the product, not you. Please think aloud as you work. If
> something is unclear, tell me what you expected to happen before I explain
> anything. I may ask what you would do next, but I will not correct you during
> the task.

Explain whether the session is recorded. Do not request a participant's real
wallet, private key, production credentials, or sensitive financial data.

### 2. Unprompted first impression — 3 minutes

Open the canonical pilot URL and ask:

> What do you think this product helps you do?
>
> What would you do first?

Do not introduce terms such as policy, governance check, API identity, or sealed
bid unless the participant asks what a visible term means.

### 3. Core tasks — 20–25 minutes

Run these tasks in order. Give the participant the task text only. Record the
first click, hesitation, wrong turns, and whether they ask for help.

#### Task A — Operating state

> You have just signed in. Is there anything that needs your attention? Tell me
> what you would do next.

**Observe:** whether the participant notices the attention summary, understands
held versus denied, and finds the relevant route without prompting.

#### Task B — Governance check

> Check whether a $500 swap should proceed under the current rules. Explain the
> result in your own words.

**Observe:** whether the participant finds Governance Check, submits the action,
and reads outcome → reason → next action rather than getting lost in technical
evidence.

#### Task C — Investigate a decision

> Find out why one decision was held or denied and tell me what you would do
> next.

**Observe:** Dashboard → Audit navigation, use of **Needs attention**, search and
filters, row expansion, and whether denied is understood as a final outcome
rather than a pending approval.

#### Task D — Resolve execution work

> Find the execution that needs attention and inspect its next safe action.

**Observe:** whether awaiting and failed runs are visible in the first viewport,
whether the participant understands **Review approval** versus **Inspect failure**,
and whether completed history distracts from unresolved work.

#### Task E — Configure a governed system

> Find where you would create or manage a system that is allowed to spend. Tell
> me what you think the next step is.

**Observe:** whether the participant finds **API Identities**, understands real
versus demo identities, and understands the policy → API identity → API key
relationship. Only demonstrate batch actions on disposable test records.

### 4. Reflection — 7–10 minutes

Ask after all tasks, not during them:

- What would you trust Cognivern to do automatically?
- What would you expect to require your approval?
- Which word or label was least clear?
- Where did you expect to find something but did not?
- What made you feel confident or uncertain?
- What would make you come back to this product next week?
- In one sentence, what is Cognivern for?

## Moderator rules

- Do not explain the product architecture before a task.
- Do not point to a control unless the participant is blocked for more than two
  minutes; record that intervention as help.
- Do not silently fix a URL, refresh, or workspace state during a task.
- Do not ask participants to approve real spends or use a real wallet.
- If a destructive control appears, stop the task and confirm the workspace is
  disposable before proceeding.
- Prefer follow-up questions such as “What did you expect?” over “Did you like
  it?”
- Capture what the participant did, not just what they say they would do.

## Observation sheet

| Field                        | Notes                                              |
| ---------------------------- | -------------------------------------------------- |
| Participant type             | New / returning / developer / operations / finance |
| Task                         | A / B / C / D / E                                  |
| Start and finish time        |                                                    |
| First click                  |                                                    |
| Completion                   | Independent / prompted / blocked                   |
| Wrong turns                  |                                                    |
| Terms misunderstood          |                                                    |
| Help or documentation opened |                                                    |
| Confidence, 1–5              |                                                    |
| Severity                     | Critical / major / minor / observation             |
| Verbatim quote               |                                                    |

## Severity rubric

- **Critical:** data exposure, cross-workspace visibility, unsafe mutation, auth
  failure, or a blocker that prevents the core governance task.
- **Major:** a participant cannot complete a core task without moderator help,
  or repeatedly misinterprets a held/denied outcome.
- **Minor:** hesitation, unclear copy, extra navigation, or a recoverable empty
  state.
- **Observation:** preference or idea that does not affect task completion.

Fix all critical issues before continuing sessions. Fix repeated major issues
before broadening beyond the initial five participants.

## Go / no-go criteria

Proceed from internal dry runs to the five-person pilot when:

- [ ] the authenticated smoke check passes against the disposable environment;
- [ ] 2 internal reviewers complete the Dashboard → Governance Check → Audit
      journey without architecture instruction;
- [ ] no critical auth, tenancy, data-leakage, or unsafe-mutation issue remains;
- [ ] the workspace reset has been performed successfully at least twice.

Proceed from the five-person pilot to broader testing when:

- [ ] at least 4 of 5 participants complete the core journey;
- [ ] at least 80% correctly distinguish approved, held, and denied;
- [ ] at least 4 of 5 find the next safe action without moderator direction;
- [ ] no participant is blocked by loading, empty, or error behavior;
- [ ] repeated major findings have an owner and a planned fix.

## Automated preflight

The authenticated UI smoke test is intentionally opt-in. It requires a
**disposable existing test account** and does not register accounts or mutate
records:

```bash
E2E_TEST_EMAIL='tester@example.com' \
E2E_TEST_PASSWORD='use-a-disposable-account-password' \
pnpm exec playwright test tests/e2e/authenticated-smoke.spec.ts
```

The public/demo suite can run without credentials:

```bash
pnpm test:e2e tests/e2e/landing.spec.ts tests/e2e/demo-flow.spec.ts
```

If the authenticated test is skipped because credentials are not supplied, that
means only that the local preflight was not run; it is not evidence that the
production auth flow is healthy.
