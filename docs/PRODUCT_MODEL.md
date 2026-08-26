# Cognivern product model

## Product promise

Cognivern is a calm control plane for reviewing, governing, and proving consequential agent actions.

The primary operator job is:

1. See what needs attention.
2. Understand why an action was allowed, held, or stopped.
3. Confirm what happened.
4. Verify the evidence and recorded reference.

The recurring product loop is:

```text
Mandate or request → policy evaluation → approved / held / stopped
  → execution or review → evidence → recorded outcome
```

## Primary user

The primary user is an operations, finance, or security owner responsible for agent actions. They should not need to understand the underlying chain, FHE, Canton, or CRE implementation to complete the core workflow. Technical details are progressive disclosure, not prerequisites.

## Canonical entities

| Term | Meaning | Where it belongs |
| --- | --- | --- |
| **Agent identity** | A system that may request or initiate an action | Controls |
| **Policy** | A boundary evaluated against an action | Controls |
| **Mandate** | Funded authorization for a defined objective and its measurement window | Programs / capital workflow |
| **Governed request** | A specific action presented to the control plane | Review / Activity |
| **Decision** | The policy result for a governed request | Review / Audit |
| **Activity** | The chronological view of governed actions and outcomes | Review |
| **Audit** | Investigation view for decisions, evidence, and recorded references | Review |
| **Run** | The execution record behind a governed action | Detail view / progressive disclosure |
| **Evidence** | Signals supporting a decision or outcome, such as policy checks, traces, artifacts, or transactions | Audit / detail views |
| **Sealed-bid round** | A private vendor-selection workflow in which competing bids are not disclosed to one another | Review workflow |
| **Sponsored credits** | A funding program that allocates and meters model usage for a cohort | Programs / funding workflow |

## Decision states

These states are intentionally distinct:

- **Approved** — the action passed policy and may proceed.
- **Held** — policy did not stop the action outright, but an operator must review it before execution.
- **Stopped** — policy rejected the action; it must not proceed without a new request or changed authorization.
- **Pending** — the system has not completed evaluation or execution yet.
- **Failed** — execution or evidence collection failed after the decision path began.
- **Recorded** — the decision has a stable reference. This is evidence about the record, not a decision outcome.

UI components must not present every lifecycle step as completed when the decision is held, stopped, pending, or failed.

## Sealed-bid lifecycle

```text
Define selection → set guardrails → review privacy and settlement → create round
  → receive sealed bids → close bidding → reveal winner atomically → verify evidence
```

### Privacy model

- Competing vendors do not see one another's bid amounts before selection.
- The auctioneer/manager is authorized to administer the round and may see the bids required by the implementation.
- Party View is a ledger-backed demonstration of disclosure, not a client-side visual filter.
- Privacy claims must say who cannot see what; avoid the ambiguous phrase "private bids" without a subject.

### Settlement model

- Creating a manual round does not escrow funds.
- A round without a settlement amount does not move funds when it is created, bids are submitted, or bidding is closed.
- An agent-governed round may include a settlement amount only when the configured Canton DAR exposes the `PaymentDeposit` template. In that case, the Canton backend escrows a payment deposit during creation and atomically transfers it to the winner during close-and-reveal.
- Demo and Sandbox agent rounds omit settlement because the fallback sandbox DAR has no `PaymentDeposit` template. They remain policy-governed but cannot reserve value.
- Production settlement requires an explicit acknowledgement of the exact amount and asset before the create request is sent. If the backend lacks settlement capability, it rejects the request rather than silently creating a funded-looking round.
- The UI must explain whether the current flow is merely selecting a vendor or also reserving settlement value.

## Environment model

Use these labels consistently:

- **Demo** — unauthenticated tour or curated sample data. No real funds can move.
- **Sandbox** — an authenticated demo-tier workspace. Data is safe sample data; no real funds can move.
- **Production** — an authenticated live-tier workspace. Actions may affect real systems or move funds.

Environment context must remain visible at consequential moments: creation, submission, approval, settlement, and reveal. Do not rely on a single dismissed banner.

## Audit and run linkage

- Dashboard activity rows and attention counts link into the filtered Audit view.
- Audit decisions link to a Run only when the payload is run-backed; Demo and synthetic records must not be presented as executable runs.
- Batch approval is limited to run-backed held decisions. Approved and stopped decisions, plus non-executable sample records, are never sent to the CRE approval endpoint.

## Navigation principles

- **Review** answers: what needs attention and what happened?
- **Controls** answers: what agents and policies are allowed to do?
- **Programs** answers: what work is funded, selected, or metered?
- **Developers** answers: how do I integrate or inspect the technical system?

A route may remain stable for compatibility, but its label and page heading should use canonical terminology.

## UX acceptance criteria

A first-time operator should be able to:

1. Identify the next action from the Dashboard without scanning every card.
2. Start a sealed-bid round and understand each field before submission.
3. Explain which parties can see bid information.
4. Tell whether the current workspace is Demo, Sandbox, or Production.
5. Know whether creating the round reserves funds.
6. Find the recorded evidence after a decision or winner reveal.
