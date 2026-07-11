"""Test Cognivern API governance endpoints.

Verifies that governance policy endpoints work correctly. /api/governance/policies
is listed in PUBLIC_API_PATHS and should be accessible without workspace auth.
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



def test_governance_policies_public_access():
    """GET /api/governance/policies is in PUBLIC_API_PATHS and should return 200
    without requiring x-api-key or JWT auth."""
    r = _request("GET", f"{BASE}/api/governance/policies", timeout=15)
    assert r.status_code == 200, (
        f"expected 200 (public endpoint), got {r.status_code}: {r.text[:200]}"
    )
    body = r.json()
    assert body.get("success") is True, f"expected success=true, got {body.get('success')}"
    assert isinstance(body.get("data"), list), (
        f"expected data to be a list, got {type(body.get('data'))}"
    )


def test_governance_health_requires_auth():
    """GET /api/governance/health is NOT in PUBLIC_API_PATHS and should require auth."""
    r = _request("GET", f"{BASE}/api/governance/health", timeout=15)
    assert r.status_code == 401, (
        f"expected 401 (protected endpoint), got {r.status_code}: {r.text[:200]}"
    )


def test_spendos_status_returns_404():
    """GET /api/spendos/status is listed in PUBLIC_API_PATHS but has no route
    handler — currently returns 404. This test documents the gap until the
    endpoint is implemented."""
    r = _request("GET", f"{BASE}/api/spendos/status", timeout=15)
    assert r.status_code == 404, (
        f"expected 404 (no route handler yet), got {r.status_code}: {r.text[:200]}"
    )


# Required: invoke all tests so assertions actually run
test_governance_policies_public_access()
test_governance_health_requires_auth()
test_spendos_status_returns_404()

print("All governance endpoint tests passed.")
