"""Test Cognivern API sealed-bid vendor selection — Canton (Daml) backend.

Complements sealed_bid_endpoints.py. That file covers the FHE-backed path
which cannot complete the reveal ("threshold decryption not wired"). These
tests exercise the Canton backend which DOES complete the reveal atomically,
and asserts the properties Canton is supposed to give us:

  - The `backend: "canton"` opt-in is honoured end-to-end and surfaces in
    both the create response and the round list.
  - Reveal actually returns a winner instead of a 400 — atomic multi-party
    settlement on the Daml ledger.
  - Per-round bid isolation (fix from adding `roundId` to the Daml Bid
    template): a fresh round's bidCount reflects only its own bids, even
    though other rounds may exist under the same auctioneer.

Canton's demo eligible-bidder list is hardcoded to Alice/Bob/Charlie in
CantonSealedBidBackend — using other bidder names would trigger the
"bidder not in eligibleBidders" assertion.
"""
import time
import requests

BASE = __import__("os").environ.get("ENDPOINT_URL", "https://cognivern.thisyearnofear.com").rstrip("/")
TIMEOUT = 60
MAX_RETRIES = 5
RETRY_DELAY = 8


def _request(method, url, **kwargs):
    """Send an HTTP request with retry on 502/503 (server temporarily down)."""
    kwargs.setdefault("timeout", TIMEOUT)
    last_resp = None
    for attempt in range(MAX_RETRIES):
        r = requests.request(method, url, **kwargs)
        if r.status_code not in (502, 503):
            return r
        last_resp = r
        if attempt < MAX_RETRIES - 1:
            time.sleep(RETRY_DELAY)
    return last_resp


def _create_canton_round(description="TestSprite Canton lifecycle", max_bids=5):
    r = _request(
        "POST",
        f"{BASE}/api/vendor/sealed-bid/rounds",
        json={
            "description": description,
            "serviceCategory": "compute",
            "deadline": "2026-12-31T23:59:59Z",
            "maxBids": max_bids,
            "backend": "canton",
            "manager": "Auctioneer",
        },
    )
    assert r.status_code in (200, 201), (
        f"create canton round: expected 200/201, got {r.status_code}: {r.text[:200]}"
    )
    body = r.json()
    assert body.get("success") is True
    data = body.get("data", {})
    assert data.get("backend") == "canton", (
        f"expected backend=canton, got {data.get('backend')} — canton backend "
        "may not be registered on this deployment"
    )
    return data


def test_sealed_bid_canton_lifecycle_and_atomic_reveal():
    """create → 3 bids (Alice/Bob/Charlie) → close → reveal picks the lowest.

    This is the test the FHE backend could not pass — the reveal endpoint
    used to unconditionally throw. On Canton the reveal is one atomic
    ledger transaction that archives every bid and emits the AuctionResult.
    """
    round_data = _create_canton_round("TestSprite Canton atomic reveal")
    round_id = round_data["roundId"]
    assert round_data.get("status") == "open"

    # Alice/Bob/Charlie submit — Bob's $24,500 is the intended winner.
    for bidder, amount in (("Alice", 32000), ("Bob", 24500), ("Charlie", 41000)):
        r = _request(
            "POST",
            f"{BASE}/api/vendor/sealed-bid/rounds/{round_id}/bid",
            json={"bidder": bidder, "amountUsd": amount},
        )
        assert r.status_code in (200, 201), (
            f"submit bid ({bidder}): expected 200/201, got {r.status_code}: {r.text[:200]}"
        )
        body = r.json()
        assert body.get("success") is True

    # Close — bidCount must reflect ONLY this round's bids (per-round
    # isolation via the roundId field on the Daml Bid template).
    close_r = _request(
        "POST",
        f"{BASE}/api/vendor/sealed-bid/rounds/{round_id}/close",
        json={"manager": "Auctioneer"},
    )
    assert close_r.status_code in (200, 201), (
        f"close: expected 200/201, got {close_r.status_code}: {close_r.text[:200]}"
    )
    close_body = close_r.json()
    close_data = close_body.get("data", {})
    assert close_data.get("bidCount") == 3, (
        f"expected bidCount=3 (roundId isolation), got {close_data.get('bidCount')} — "
        "if this is higher, bids from other rounds are leaking into this round's query"
    )

    # Reveal — on Canton this must actually succeed with a winner, not 400.
    reveal_r = _request(
        "POST",
        f"{BASE}/api/vendor/sealed-bid/rounds/{round_id}/reveal",
        json={"selectionMethod": "lowest-bid"},
    )
    assert reveal_r.status_code in (200, 201), (
        f"canton reveal: expected 200/201, got {reveal_r.status_code}: {reveal_r.text[:200]} — "
        "the whole point of the Canton backend is that this endpoint no longer throws"
    )
    reveal_body = reveal_r.json()
    assert reveal_body.get("success") is True
    reveal_data = reveal_body.get("data", {})
    # Canton parties look like "Bob::<hash>" — accept both plain and namespaced.
    winner = reveal_data.get("winner", "")
    assert "bob" in winner.lower(), (
        f"lowest-bid winner should be Bob, got {winner!r}"
    )
    assert reveal_data.get("winningBid") == 24500, (
        f"winning bid should be 24500, got {reveal_data.get('winningBid')}"
    )
    assert reveal_data.get("status") == "revealed"


def test_sealed_bid_canton_backend_field_visible_in_list():
    """Rounds created with backend=canton must be discoverable from the
    list endpoint with backend=canton in the summary — powers the backend
    badge in the frontend UI.
    """
    round_data = _create_canton_round("TestSprite Canton backend badge")
    round_id = round_data["roundId"]

    list_r = _request("GET", f"{BASE}/api/vendor/sealed-bid/rounds")
    assert list_r.status_code == 200, f"list: got {list_r.status_code}"
    rounds = list_r.json().get("data", [])
    match = next((r for r in rounds if r.get("roundId") == round_id), None)
    assert match is not None, "created round missing from list"
    assert match.get("backend") == "canton", (
        f"list summary must include backend=canton for round tracking, got "
        f"{match.get('backend')!r} — check SealedBidController summary mapping"
    )


def test_sealed_bid_canton_reveal_rejects_before_close():
    """Reveal on an open Canton round must be rejected — the dispatcher
    enforces status transitions independent of the backend.
    """
    round_data = _create_canton_round("TestSprite Canton reveal-before-close")
    round_id = round_data["roundId"]
    r = _request(
        "POST",
        f"{BASE}/api/vendor/sealed-bid/rounds/{round_id}/reveal",
        json={"selectionMethod": "lowest-bid"},
    )
    assert r.status_code == 400, (
        f"reveal on open round: expected 400, got {r.status_code}: {r.text[:200]}"
    )


def test_sealed_bid_canton_unknown_bidder_rejected():
    """Only Alice/Bob/Charlie are eligible bidders on the Canton demo
    backend — any other name must be rejected server-side, not silently
    accepted then failed at reveal.
    """
    round_data = _create_canton_round("TestSprite Canton bidder allowlist")
    round_id = round_data["roundId"]
    r = _request(
        "POST",
        f"{BASE}/api/vendor/sealed-bid/rounds/{round_id}/bid",
        json={"bidder": "MalloryTheImpostor", "amountUsd": 999},
    )
    assert r.status_code == 400, (
        f"unknown bidder: expected 400 (eligibility check), got "
        f"{r.status_code}: {r.text[:200]}"
    )


# Required: invoke all tests so assertions actually run.
test_sealed_bid_canton_lifecycle_and_atomic_reveal()
test_sealed_bid_canton_backend_field_visible_in_list()
test_sealed_bid_canton_reveal_rejects_before_close()
test_sealed_bid_canton_unknown_bidder_rejected()

print("All Canton sealed-bid tests passed.")
