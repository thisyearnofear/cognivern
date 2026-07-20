# Agentic Commerce Demo Runbook

Use this sequence for the 3-minute submission demo. It demonstrates a real
commercial control, not an AI wrapper: an agent initiates a private vendor RFP;
policy prevents premature execution; Canton performs the confidential auction
and atomic settlement.

## Demo data

Create one **Canton-backed**, agent-governed round:

| Field | Value |
| --- | --- |
| Agent | `procurement-agent-1` |
| Description | `Security audit RFP — Q3 2026` |
| Category | `security-audit` |
| Max bids | `3` |
| Settlement | `74,500 USDC` |
| Manager | `auctioner-cognivern` |

Submit exactly three bids: Alice at 81,000, Bob at 74,500, and Charlie at
79,000. The values are private until the final Canton reveal.

Use a deadline that is several minutes in the future when the round is
created. Attempt one close before it expires, then complete the close after it
expires. Do not create throwaway rounds against the live Devnet participant:
the visible demo round is the submission evidence.

## Required screen sequence

1. Select the named agent and create the Canton-backed RFP. Show the returned
   agent badge and governance run ID.
2. Submit Alice, Bob, and Charlie bids. Toggle Party view to show each party
   cannot inspect competitors' bids.
3. Attempt to close early. Show the `deadline_elapsed` policy failure.
4. Close after the deadline. Show all three policy checks passing: minimum
   bids, deadline, and settlement budget.
5. Reveal the winner. Show that Canton reveals Bob and transfers the escrowed
   deposit atomically, while losing bids remain undisclosed.
6. Open the governance timeline. Show `round_created`, three
   `bid_submitted` commitments, both policy decisions, `round_closed`, and
   `winner_revealed`, each with a SHA-256 event hash.

## Safe claims

Use these statements in the pitch and video:

- “An agent initiates a private procurement workflow under fixed spending and
  execution policy.”
- “Canton keeps bids private to the parties involved and atomically closes,
  reveals, and settles the result.”
- “Cognivern records a hash-linked, tamper-evident CRE timeline for the
  governed workflow.”

Do **not** claim that the event hashes are wallet signatures, immutable
on-chain records, or independent proof of agent identity. They are SHA-256
integrity evidence stored in Cognivern's CRE run record. The product has normal
write authentication; the current demo's `agentId` identifies the selected
Cognivern agent but is not a standalone cryptographic delegation protocol.

## Pre-recording verification

Run the offline acceptance test before recording:

```bash
pnpm exec vitest run tests/integration/AgentGovernedSealedBid.integration.test.ts
```

Then verify the deployed backend only with the read-only rounds endpoint:

```bash
curl -s https://cognivern.thisyearnofear.com/api/vendor/sealed-bid/rounds
```

The round selected for the recording must report `backend: "canton"` and a
future deadline before bids are submitted.
