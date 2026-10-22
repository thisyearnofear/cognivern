"""Test Cognivern API metrics endpoints.

Verifies metrics/daily, metrics/ux-events (POST), and metrics/ux-summary.
These track system performance and user experience events.
"""
import time
import requests

BASE = __import__("os").environ.get("ENDPOINT_URL", "https://api.cognivern.persidian.com").rstrip("/")
TIMEOUT = 15
MAX_RETRIES = 5
RETRY_DELAY = 8
TRANSIENT_STATUS = (429, 502, 503)
# Total wall-clock the retry loop may spend sleeping for one request. The
# per-attempt backoff is multiplicative, so without this cap a module with
# many calls can spend minutes parked in time.sleep() and blow the runner's
# own timeout. When the budget is exhausted the last response is returned so
# the assertion reports the real status.
RETRY_BUDGET = 45


def _request(method, url, **kwargs):
    """Send an HTTP request, retrying transient upstream failures.

    The live deployment answers 502/503 when it is briefly overloaded and 429
    when the per-IP rate limiter trips. Both are transient, so they are retried
    with a backoff; every other status is returned to the caller as-is.
    """
    kwargs.setdefault("timeout", TIMEOUT)
    last_resp = None
    slept = 0
    for attempt in range(MAX_RETRIES):
        try:
            r = requests.request(method, url, **kwargs)
        except requests.exceptions.RequestException:
            if attempt < MAX_RETRIES - 1 and slept < RETRY_BUDGET:
                delay = min(RETRY_DELAY * (attempt + 1), RETRY_BUDGET - slept)
                time.sleep(delay)
                slept += delay
            continue
        if r.status_code not in TRANSIENT_STATUS:
            return r
        last_resp = r
        if attempt < MAX_RETRIES - 1 and slept < RETRY_BUDGET:
            delay = min(RETRY_DELAY * (attempt + 1), RETRY_BUDGET - slept)
            time.sleep(delay)
            slept += delay
    return last_resp


def test_metrics_ux_summary():
    """GET /api/metrics/ux-summary returns 200 with event summary data."""
    r = _request("GET", f"{BASE}/api/metrics/ux-summary")
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is True
    data = body.get("data", {})
    assert "totalEvents" in data, "missing totalEvents"
    assert "byType" in data, "missing byType"
    assert "rates" in data, "missing rates"
    assert "lastEventAt" in data, "missing lastEventAt"


def test_metrics_ux_events_requires_event_type():
    """POST /api/metrics/ux-events without eventType returns 400."""
    r = _request("POST", f"{BASE}/api/metrics/ux-events", json={})
    assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is False
    assert "eventType" in body.get("error", ""), (
        f"error should mention eventType, got: {body.get('error')}"
    )


def test_metrics_ux_events_accepts_valid_event():
    """POST /api/metrics/ux-events with valid eventType returns 200."""
    r = _request(
        "POST",
        f"{BASE}/api/metrics/ux-events",
        json={"eventType": "testsprite_test_event", "payload": {"source": "testsprite"}},
    )
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is True


def test_metrics_daily_requires_auth():
    """GET /api/metrics/daily is NOT in PUBLIC_API_PATHS and requires auth."""
    r = _request("GET", f"{BASE}/api/metrics/daily")
    assert r.status_code == 401, f"expected 401 (protected), got {r.status_code}: {r.text[:200]}"


# Required: invoke all tests so assertions actually run
test_metrics_ux_summary()
test_metrics_ux_events_requires_event_type()
test_metrics_ux_events_accepts_valid_event()
test_metrics_daily_requires_auth()

print("All metrics endpoint tests passed.")
