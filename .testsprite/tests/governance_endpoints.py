"""Test Cognivern API governance endpoints.

Verifies that governance policy endpoints work correctly. /api/governance/policies
is listed in PUBLIC_API_PATHS and should be accessible without workspace auth.
"""
import requests

BASE = ENDPOINT_URL.rstrip("/")


def test_governance_policies_public_access():
    """GET /api/governance/policies is in PUBLIC_API_PATHS and should return 200
    without requiring x-api-key or JWT auth."""
    r = requests.get(f"{BASE}/api/governance/policies", timeout=15)
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
    r = requests.get(f"{BASE}/api/governance/health", timeout=15)
    assert r.status_code == 401, (
        f"expected 401 (protected endpoint), got {r.status_code}: {r.text[:200]}"
    )


def test_spendos_status_returns_404():
    """GET /api/spendos/status is listed in PUBLIC_API_PATHS but has no route
    handler — currently returns 404. This test documents the gap until the
    endpoint is implemented."""
    r = requests.get(f"{BASE}/api/spendos/status", timeout=15)
    assert r.status_code == 404, (
        f"expected 404 (no route handler yet), got {r.status_code}: {r.text[:200]}"
    )


# Required: invoke all tests so assertions actually run
test_governance_policies_public_access()
test_governance_health_requires_auth()
test_spendos_status_returns_404()

print("All governance endpoint tests passed.")
