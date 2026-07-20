# 90-Second Demo Video Script — Agent-Governed Procurement on Canton

**Target length:** ~1:25–1:30
**Tracks demonstrated:** Track 1 (Private DeFi) + Track 3 (Agentic Commerce)
**Video source:** Playwright screen recording of `https://cognivern.vercel.app/sealed-bid`
**Output:** YouTube (upload the generated MP4 — file is local, not in git)

This script replaces `demo-video-script.md` for the final submission. 90
seconds, two tracks, one coherent flow: an agent creates a governed RFP,
policy gates the close, and the winner settles atomically — with every
event hash-signed.

## Setup before recording

1. At least one active agent exists in the Agents page (or use a demo agent).
2. Backend has the agent-governance integration deployed (Persons 1 + 2).
3. Clear stale rounds so the list starts clean.
4. Pre-seed one agent-governed round that's already past its deadline with
   3 bids, so the "blocked close" and "allowed close" can be shown back-to-back
   without waiting 2 minutes on camera.

## Narration (read by `say` — ~140 words, ~90s at natural pace)

> Cognivern — agent-governed private procurement on Canton Network.
>
> An agent initiates a confidential vendor RFP. Canton's disclosure model keeps bid amounts visible only to the auctioneer. And the auctioneer can't close until policy checks pass.
>
> We select an agent and create a governed round. The backend starts a tamper-evident governance run — every event gets a SHA-256 hash.
>
> Three vendors submit sealed bids. Competitors never see each other's amounts — that's structural sub-transaction privacy, enforced by the ledger.
>
> The auctioneer tries to close early. The policy gate blocks it — deadline not elapsed. This is the agent governance layer enforcing commercial safety, server-side.
>
> After the deadline, close succeeds. Reveal is atomic: winner selection, losing-bid archival, and value transfer to the winner all commit in one transaction. Bob wins at seventy-four thousand five hundred.
>
> The governance timeline shows every event — hash-signed, tamper-evident. Agents procure privately, safely, and atomically on Canton.

## Shot list / timing

| Time | Shot | Action |
| --- | --- | --- |
| 0:00–0:06 | Landing | Static on `/sealed-bid` list. Narration intro. |
| 0:06–0:18 | Agent round form | Click **Agent round**, select an agent, fill RFP (description, $50,000 settlement), click **Create governed round**. |
| 0:18–0:24 | Round created | Round appears with "Agent" badge. Click to open. |
| 0:24–0:36 | Three bids | Quickly submit Alice $91k, Bob $74.5k, Charlie $108k. (Can be pre-seeded + shown via refresh to save time.) |
| 0:36–0:48 | Policy gate blocks | Click **Close bidding · check policy**. Red panel: `deadline_elapsed: failed`. |
| 0:48–0:56 | Policy gate allows | Click close again (pre-seeded past-deadline round). All checks pass. Round closes. |
| 0:56–1:08 | Atomic reveal | Click **Reveal winner atomically**. Winner banner + "Value settled atomically" badge + `settledAssetCid`. |
| 1:08–1:22 | Governance timeline | Scroll to timeline. Slow pan across 6 events with SHA-256 hashes. |
| 1:22–1:30 | Outro hold | Hold on full round detail — winner + timeline visible. Narration closes. |

## Key moments for judges (3 beats)

1. **0:06–0:18 — Agent initiates (Track 3).** Agent selected from dropdown → round created under governance run. The visible "software agent initiates a commercial action" moment.

2. **0:36–0:56 — Policy gate (Track 3).** Blocked close with `deadline_elapsed: failed`, then allowed close. Server-enforced commercial safety, not a UI hint.

3. **0:56–1:08 — Atomic settlement (Track 1).** "Value settled atomically" badge + `settledAssetCid` — winner selection + losing-bid archival + value transfer in one transaction.

The governance timeline (1:08–1:22) reinforces both tracks: hash-signed events prove the agent's governance, and the `winner_revealed` event with `winningBid` matches the on-ledger `AuctionResult`.

## Time-saving tricks for the recording

- **Pre-seed the bids.** Don't submit all three live — submit them before
  recording, then refresh the page so they appear instantly. The narration
  says "three vendors submit sealed bids" while the bids are already there.
- **Pre-seed a past-deadline round.** The blocked close needs a round before
  its deadline; the allowed close needs one past it. Have both ready and
  switch between them, or use devtools to edit the deadline between clicks.
- **Skip the party view.** The 3-second narration line "competitors never
  see each other's amounts" covers Track 1 privacy without a separate demo
  shot. The party view is in the product for judges who explore on their own.
- **Don't read the hashes.** The narration says "hash-signed, tamper-evident"
  while the camera pans the timeline. Judges can pause the video to read them.

## Re-running

```bash
pnpm tsx scripts/demo/record-demo-video.ts
```

Update the recording script to follow this 90-second shot list before
re-running. Requires macOS `say` and `ffmpeg`.
