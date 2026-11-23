# Canton Community Research Grants: November 2026

Status (November 23): field note published and shared on X with the
required tags; discretionary grant outcome pending. Do not describe this as
awarded.

Canonical article: [Sealed from whom? What each party can see in a Canton
procurement auction](https://dev.to/papajams/sealed-from-whom-what-each-party-can-see-in-a-canton-procurement-auction-442b) (DEV, posted November 22 2026).

## Published finding

The field note explains the auction's actual privacy boundary: before close,
each bidder can read only its own active `Bid`, while the auction manager can
read every active bid because the manager observes the contract. After close,
eligible bidders and the manager can read the winner and winning amount from
`AuctionResult`; losing prices are not disclosed by that result contract. The
article is explicit that this is party-scoped disclosure, not encryption from
the auctioneer or proof about web users, logs, or participant operators.

## Evidence trail

- [Visibility evidence workflow](../../daml/README.md#visibility-evidence-manual):
  fresh GitHub-hosted Linux cgroup, model/scripts DAR builds, Daml reference
  ledger plus local Canton sandbox, toolchain and DAR hashes recorded.
- [Isolated staging replay](../../daml/README.md#staging-replay-isolated-vm-only):
  private Canton sandbox plus private backend in a loopback-only namespace; no
  production, hosted TestSprite, or shared-ledger access.
- Hosted replay source revision: `caa6e29c201b428c8a6713e66019218bb876de41`;
  Canton SDK `3.4.11`, Temurin JDK `17.0.21+9`, Ubuntu 24.04 runner.
- The hosted build-through-sandbox run took 49 seconds and peaked at
  2,716,205,056 bytes (2.53 GiB) for the measured process group; SDK
  provisioning and the web backend were outside that measurement.

## Program boundary

The Foundation announcement invited original public articles or videos
published November 1-30 and asked participants to share the canonical link by
December 4 with `@CantonFdn` and `#CantonResearchNov26`. The article is public
and the social share is complete; any selection or discretionary grant outcome
should be recorded separately when verified.
