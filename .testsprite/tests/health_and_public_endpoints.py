"""Test Cognivern API health and public endpoints.

Verifies that core public endpoints respond correctly without authentication.
These are the endpoints listed in PUBLIC_API_PATHS that should be accessible
to anyone (landing page data, health checks, status endpoints).
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


def test_health_returns_ok():
    """GET /health returns 200 with status=ok."""
    r = _request("GET", f"{BASE}/health")
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("status") == "ok", f"expected status=ok, got {body.get('status')}"
    assert "uptime" in body, "missing uptime field"
    assert "timestamp" in body, "missing timestamp field"


def test_agents_list_returns_success():
    """GET /api/agents returns 200 with success=true and data array."""
    r = _request("GET", f"{BASE}/api/agents")
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is True, f"expected success=true, got {body.get('success')}"
    assert isinstance(body.get("data"), list), f"expected data to be a list, got {type(body.get('data'))}"
    assert "count" in body, "missing count field"


def test_spend_status_returns_active():
    """GET /api/spend/status returns 200 with SpendOS layer active."""
    r = _request("GET", f"{BASE}/api/spend/status")
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is True, f"expected success=true, got {body.get('success')}"
    data = body.get("data", {})
    assert data.get("layer") == "SpendOS", f"expected layer=SpendOS, got {data.get('layer')}"
    assert data.get("status") == "active", f"expected status=active, got {data.get('status')}"
    assert "walletAddress" in data, "missing walletAddress field"
    assert "features" in data, "missing features field"
    assert isinstance(data.get("features"), list), "features should be a list"


def test_audit_logs_return_data():
    """GET /api/audit/logs returns 200 with audit log entries."""
    r = _request("GET", f"{BASE}/api/audit/logs")
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is True, f"expected success=true, got {body.get('success')}"
    assert isinstance(body.get("data"), dict), f"expected data to be an object"
    logs = body["data"].get("logs", [])
    assert isinstance(logs, list), "logs should be a list"
    if len(logs) > 0:
        log = logs[0]
        assert "id" in log, "log entry missing id"
        assert "timestamp" in log, "log entry missing timestamp"
        assert "actionType" in log, "log entry missing actionType"
        assert "outcome" in log, "log entry missing outcome"
        assert "evidence" in log, "log entry missing evidence"


def test_projects_list_returns_success():
    """GET /api/projects returns 200 with success=true."""
    r = _request("GET", f"{BASE}/api/projects")
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is True, f"expected success=true, got {body.get('success')}"


def test_fhenix_status_returns_success():
    """GET /api/fhenix/status returns 200 (FHE integration status)."""
    r = _request("GET", f"{BASE}/api/fhenix/status")
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is True, f"expected success=true, got {body.get('success')}"


# Required: invoke all tests so assertions actually run
test_health_returns_ok()
test_agents_list_returns_success()
test_spend_status_returns_active()
test_audit_logs_return_data()
test_projects_list_returns_success()
test_fhenix_status_returns_success()

print("All health and public endpoint tests passed.")
