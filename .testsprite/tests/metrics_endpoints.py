"""Test Cognivern API metrics endpoints.

Verifies metrics/daily, metrics/ux-events (POST), and metrics/ux-summary.
These track system performance and user experience events.
"""
import requests

BASE = ENDPOINT_URL.rstrip("/")


def test_metrics_ux_summary():
    """GET /api/metrics/ux-summary returns 200 with event summary data."""
    r = requests.get(f"{BASE}/api/metrics/ux-summary", timeout=15)
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
    r = requests.post(f"{BASE}/api/metrics/ux-events", json={}, timeout=15)
    assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is False
    assert "eventType" in body.get("error", ""), (
        f"error should mention eventType, got: {body.get('error')}"
    )


def test_metrics_ux_events_accepts_valid_event():
    """POST /api/metrics/ux-events with valid eventType returns 200."""
    r = requests.post(
        f"{BASE}/api/metrics/ux-events",
        json={"eventType": "testsprite_test_event", "payload": {"source": "testsprite"}},
        timeout=15,
    )
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is True


def test_metrics_daily_requires_auth():
    """GET /api/metrics/daily is NOT in PUBLIC_API_PATHS and requires auth."""
    r = requests.get(f"{BASE}/api/metrics/daily", timeout=15)
    assert r.status_code == 401, f"expected 401 (protected), got {r.status_code}: {r.text[:200]}"


# Required: invoke all tests so assertions actually run
test_metrics_ux_summary()
test_metrics_ux_events_requires_event_type()
test_metrics_ux_events_accepts_valid_event()
test_metrics_daily_requires_auth()

print("All metrics endpoint tests passed.")
