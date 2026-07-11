"""Test Cognivern API intent and projects endpoints.

Verifies the intent classification endpoint (NLP-powered query routing)
and project discovery endpoints.
"""
import time
import requests

BASE = __import__("os").environ.get("ENDPOINT_URL", "https://cognivern.thisyearnofear.com").rstrip("/")

TIMEOUT = 15
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



def test_intent_requires_query():
    """POST /api/intent without query returns 400."""
    r = _request("POST", f"{BASE}/api/intent", json={}, timeout=15)
    assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is False
    assert "query" in body.get("error", "").lower(), (
        f"error should mention query, got: {body.get('error')}"
    )


def test_intent_with_valid_query():
    """POST /api/intent with a valid query returns 200 with classification.
    Uses circuit breaker with fallback — should always return a response."""
    r = _request("POST", 
        f"{BASE}/api/intent",
        json={"query": "show me governance policies", "context": {}},
        timeout=30,
    )
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is True
    data = body.get("data", {})
    assert "type" in data, "missing type field in intent response"
    assert "response" in data, "missing response field"
    assert "component" in data, "missing component field"
    # Type should be a valid classification
    valid_types = {"forensic", "governance", "agent", "risk", "policy", "stats", "create", "unknown"}
    assert data["type"] in valid_types, f"invalid intent type: {data['type']}"


def test_intent_metrics():
    """GET /api/intent/metrics returns 200 with circuit breaker stats."""
    r = _request("GET", f"{BASE}/api/intent/metrics", timeout=15)
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is True
    data = body.get("data", {})
    assert "totalRequests" in data, "missing totalRequests"
    assert "circuitBreakerState" in data, "missing circuitBreakerState"
    assert data["circuitBreakerState"] in ("closed", "open", "half-open"), (
        f"invalid circuitBreakerState: {data['circuitBreakerState']}"
    )


def test_projects_list():
    """GET /api/projects returns 200 with project list for UI discovery."""
    r = _request("GET", f"{BASE}/api/projects", timeout=15)
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is True


def test_projects_usage():
    """GET /api/projects/:projectId/usage returns 200 with usage data."""
    # Use 'default' as a known project ID
    r = _request("GET", f"{BASE}/api/projects/default/usage", timeout=15)
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is True
    assert "projectId" in body or "data" in body


def test_projects_tokens():
    """GET /api/projects/:projectId/tokens returns 200 with token list."""
    r = _request("GET", f"{BASE}/api/projects/default/tokens", timeout=15)
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is True


# Required: invoke all tests so assertions actually run
test_intent_requires_query()
test_intent_with_valid_query()
test_intent_metrics()
test_projects_list()
test_projects_usage()
test_projects_tokens()

print("All intent and projects endpoint tests passed.")
