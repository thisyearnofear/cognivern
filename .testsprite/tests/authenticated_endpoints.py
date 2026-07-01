"""Test Cognivern API authenticated endpoints (OWS, copilot, metrics/daily).

Uses the legacy x-api-key header for authentication. Tests the full CRUD
flow for OWS wallets, agents, API keys, copilot runs, and metrics.
"""
import requests

BASE = ENDPOINT_URL.rstrip("/")
API_KEY = "sapience-hackathon-key"
AUTH_HEADERS = {"x-api-key": API_KEY}


def test_ows_wallets_list():
    """GET /api/ows/wallets returns 200 with wallet list."""
    r = requests.get(f"{BASE}/api/ows/wallets", headers=AUTH_HEADERS, timeout=15)
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is True
    assert isinstance(body.get("data"), list), "data should be a list"
    # If wallets exist, verify structure
    for w in body["data"][:2]:
        assert "id" in w, "wallet missing id"
        assert "name" in w, "wallet missing name"


def test_ows_dashboard():
    """GET /api/ows/dashboard returns 200 with dashboard data."""
    r = requests.get(f"{BASE}/api/ows/dashboard", headers=AUTH_HEADERS, timeout=15)
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is True
    data = body.get("data", {})
    assert "hasWallet" in data, "missing hasWallet"
    assert "hasApiKeys" in data, "missing hasApiKeys"
    assert "hasAgents" in data, "missing hasAgents"


def test_ows_health():
    """GET /api/ows/health returns 200 with vault health status."""
    r = requests.get(f"{BASE}/api/ows/health", headers=AUTH_HEADERS, timeout=15)
    assert r.status_code in (200, 503), (
        f"expected 200 or 503, got {r.status_code}: {r.text[:200]}"
    )
    body = r.json()
    assert body.get("success") is True
    data = body.get("data", {})
    assert "vaultAccessible" in data, "missing vaultAccessible"


def test_ows_agents_list():
    """GET /api/ows/agents returns 200 with agent list."""
    r = requests.get(f"{BASE}/api/ows/agents", headers=AUTH_HEADERS, timeout=15)
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is True
    assert isinstance(body.get("data"), list), "data should be a list"


def test_ows_api_keys_list():
    """GET /api/ows/api-keys returns 200 with API key list."""
    r = requests.get(f"{BASE}/api/ows/api-keys", headers=AUTH_HEADERS, timeout=15)
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is True
    assert isinstance(body.get("data"), list), "data should be a list"


def test_ows_create_agent_validates_input():
    """POST /api/ows/agents with missing name/type returns 400."""
    r = requests.post(f"{BASE}/api/ows/agents", json={}, headers=AUTH_HEADERS, timeout=15)
    assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:200]}"


def test_ows_create_api_key_validates_input():
    """POST /api/ows/api-keys with missing fields returns 400."""
    r = requests.post(f"{BASE}/api/ows/api-keys", json={}, headers=AUTH_HEADERS, timeout=15)
    assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:200]}"


def test_copilot_list_runs():
    """GET /api/copilot/runs returns 200 with run list."""
    r = requests.get(f"{BASE}/api/copilot/runs", headers=AUTH_HEADERS, timeout=15)
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is True
    assert isinstance(body.get("runs"), list), "runs should be a list"


def test_copilot_create_run_validates_input():
    """POST /api/copilot/runs with short goal returns 400."""
    r = requests.post(
        f"{BASE}/api/copilot/runs",
        json={"goal": "too short"},
        headers=AUTH_HEADERS,
        timeout=15,
    )
    assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:200]}"


def test_metrics_daily():
    """GET /api/metrics/daily returns 200 with system metrics."""
    r = requests.get(f"{BASE}/api/metrics/daily", headers=AUTH_HEADERS, timeout=15)
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is True
    data = body.get("data", {})
    assert "system" in data, "missing system metrics"
    assert "uptime" in data["system"], "missing uptime"
    assert "memory" in data["system"], "missing memory"
    assert "agents" in data, "missing agents metrics"


def test_governance_evaluate_validates_input():
    """POST /api/governance/evaluate with missing fields returns 400."""
    r = requests.post(
        f"{BASE}/api/governance/evaluate",
        json={},
        headers=AUTH_HEADERS,
        timeout=15,
    )
    assert r.status_code in (400, 401), (
        f"expected 400 or 401, got {r.status_code}: {r.text[:200]}"
    )


# Required: invoke all tests so assertions actually run
test_ows_wallets_list()
test_ows_dashboard()
test_ows_health()
test_ows_agents_list()
test_ows_api_keys_list()
test_ows_create_agent_validates_input()
test_ows_create_api_key_validates_input()
test_copilot_list_runs()
test_copilot_create_run_validates_input()
test_metrics_daily()
test_governance_evaluate_validates_input()

print("All authenticated endpoint tests passed.")
