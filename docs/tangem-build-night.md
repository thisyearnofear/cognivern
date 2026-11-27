# Tangem Build Night: Who approved this payment?

Thu 26 Nov 2026, Encode Hub London. **Partner discovery only. No integration committed.**

## What we want to learn

When an agent payment needs a human decision, can the budget owner later show which funded mandate it belonged to, why it was held, who approved or declined it, and whether any money moved? The question matters regardless of which wallet the operator uses.

## Conversation at the workshop

1. **Start with their last case.** Ask a budget owner: “Tell us about the last payment someone had to approve outside the normal flow. When finance asked about it later, what did you have to piece together?” If speaking with Tangem rather than an operator, ask for an introduction to someone who owns that workflow.
2. **Show the decision, not a wallet demo.** Use existing Cognivern material to walk through an illustrative supplier payment: the amount fits the remaining budget, but the vendor is not on the approved list. Pause at **Human review required — no funds sent.** Contrast that with a payment over the remaining budget: policy stops it; it never goes to a signer. No new screen, live transfer, or wallet pairing is needed.
3. **Test the proposed record.** Sketch the mandate and action reference, vendor and amount, reason for the hold, reviewer and decision, and payment status with its evidence. An approval is for this action only; it does not change the mandate. Approval is not settlement, and neither proves the supplier delivered. Ask: “Would this have answered finance’s question in your case? What’s missing?”

**One question for Tangem:** Can an approval or decline be matched to the exact payment request, and can settlement be verified separately? Treat this as an open question, not an integration claim.

## What counts as a result

Leave with a named operator willing to walk through a recent case and a specific gap in their records, or document why there is no reason to pursue it. A card tap, positive feedback, or a future prize is not evidence of demand.

## When to revisit engineering

Only reopen engineering if operator evidence identifies a gap we would prioritize without this event. The candidate capability is an approval or decline attached to the original action in the existing mandate history; Tangem would be one optional signer, not the feature. Follow the [design-partner strategy](./PRODUCT_STRATEGY.md#distribution-built-into-the-product): validate repeated need before productizing.

Any event entry must pass [all six selection tests](./HACKATHON_PIPELINE.md#alignment-filter--apply-before-entering-anything). Do not displace the Telegraph S2 close or the Prezenti Celo mainnet milestone. No event-specific page, policy engine, or MCP shim is in scope.
