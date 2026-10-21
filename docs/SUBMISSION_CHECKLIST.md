# Submission checklist — hackathons & judged programs

Reusable pre-submission pass. Written after HackCanton S3 (not shortlisted —
see `history/HACKATHON_SUBMISSION_HACKCANTON_S3.md` → Retrospective). Work it
top to bottom; every item exists because a submission lost or nearly lost on it.

## Story

- [ ] **One product, one story.** Pitch, value, and metrics sections describe
      the *same* product. If two different buyer problems appear, cut one.
- [ ] **The venue's tech is the wedge, not the expansion.** If a judge removed
      the venue technology, does the product collapse? If it merely degrades,
      the tech is decoration — either rebuild the story around it or skip
      the venue.
- [ ] **Scope pivots are submission decisions.** A mid-season mentor pivot
      changes the product thesis; re-check it against the venue's judging
      bar before carrying it into the form.

## Judge-verifiability ("can a judge verify a real build?")

- [ ] Public code exists and is linked — for venue-tech work, the *source of
      truth* is linked directly (e.g. `daml/` for Canton).
- [ ] Working demo or video, recorded against the live deployment — not a
      sandbox, not a mock.
- [ ] On-ledger / API evidence a judge can check themselves: contract IDs,
      transaction IDs, deep links (CC View, explorer), or a public endpoint.
      For Canton: the evidence checklist in `CANTON.md`.
- [ ] Every claim in the form is verifiable against the live app *today* —
      deadlines unexpired, links resolve, demo path works without signup
      where possible.

## Real work this season

- [ ] Venue-relevant code changed *during the season* and is easy to see:
      `git log --since=<season-start> -- <venue-path>` produces real commits,
      not just file moves.
- [ ] The season's work is named explicitly in the submission — judges should
      not have to diff the repo to find it.

## Form hygiene (the S3 miss)

Form fields are paste targets — nothing in the repo can lint them. Before
submitting:

- [ ] Paste **every** form field back out into a scratch file and read it as
      a stranger. Then grep it:
      `do not invent`, `recover from`, `TODO`, `FIXME`, `placeholder`,
      `your task`, `as an AI`, `lorem`, `N/A`, `TBD`.
- [ ] Numbers in Metrics/Value sections are real, sourced, and consistent
      across fields (a metric stated twice must match twice).
- [ ] No assistant instructions, draft notes, or "scope notes" meant for the
      team.

## Process

- [ ] **Submitted for judging** — upload ≠ submit. Confirm the submitted
      state, not just saved materials.
- [ ] Build diary / momentum entries posted where the program tracks them.
- [ ] Deadline met with buffer — final form pass happens *before* the day of
      the deadline, not during it.
