"""Test Cognivern API OWS endpoints auth boundaries.

All OWS endpoints (wallets, agents, api-keys, permissions) require
authentication. This test verifies the auth boundary is enforced and
that unauthenticated requests are rejected with 401.
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



def test_ows_status_requires_auth():
    """GET /api/ows/status requires authentication."""
    r = _request("GET", f"{BASE}/api/ows/status", timeout=15)
    assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text[:200]}"


def test_ows_health_requires_auth():
    """GET /api/ows/health requires authentication."""
    r = _request("GET", f"{BASE}/api/ows/health", timeout=15)
    assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text[:200]}"


def test_ows_dashboard_requires_auth():
    """GET /api/ows/dashboard requires authentication."""
    r = _request("GET", f"{BASE}/api/ows/dashboard", timeout=15)
    assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text[:200]}"


def test_ows_wallets_requires_auth():
    """GET /api/ows/wallets requires authentication."""
    r = _request("GET", f"{BASE}/api/ows/wallets", timeout=15)
    assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text[:200]}"


def test_ows_agents_requires_auth():
    """GET /api/ows/agents requires authentication."""
    r = _request("GET", f"{BASE}/api/ows/agents", timeout=15)
    assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text[:200]}"


def test_ows_api_keys_requires_auth():
    """GET /api/ows/api-keys requires authentication."""
    r = _request("GET", f"{BASE}/api/ows/api-keys", timeout=15)
    assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text[:200]}"


def test_ows_wallet_import_requires_auth():
    """POST /api/ows/wallets/import requires authentication."""
    r = _request("POST", 
        f"{BASE}/api/ows/wallets/import",
        json={"name": "test", "privateKey": "0x" + "0" * 64},
        timeout=15,
    )
    assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text[:200]}"


def test_ows_create_agent_requires_auth():
    """POST /api/ows/agents requires authentication."""
    r = _request("POST", 
        f"{BASE}/api/ows/agents",
        json={"name": "test-agent", "type": "trading"},
        timeout=15,
    )
    assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text[:200]}"


def test_ows_permissions_requires_auth():
    """POST /api/ows/permissions requires authentication."""
    r = _request("POST", 
        f"{BASE}/api/ows/permissions",
        json={"walletId": "test", "invoker": "test", "permissions": []},
        timeout=15,
    )
    assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text[:200]}"


def test_copilot_runs_requires_auth():
    """GET /api/copilot/runs requires authentication."""
    r = _request("GET", f"{BASE}/api/copilot/runs", timeout=15)
    assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text[:200]}"


def test_copilot_create_run_requires_auth():
    """POST /api/copilot/runs requires authentication."""
    r = _request("POST", 
        f"{BASE}/api/copilot/runs",
        json={"goal": "test goal for verification"},
        timeout=15,
    )
    assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text[:200]}"


# Required: invoke all tests so assertions actually run
test_ows_status_requires_auth()
test_ows_health_requires_auth()
test_ows_dashboard_requires_auth()
test_ows_wallets_requires_auth()
test_ows_agents_requires_auth()
test_ows_api_keys_requires_auth()
test_ows_wallet_import_requires_auth()
test_ows_create_agent_requires_auth()
test_ows_permissions_requires_auth()
test_copilot_runs_requires_auth()
test_copilot_create_run_requires_auth()

print("All OWS auth boundary tests passed.")
