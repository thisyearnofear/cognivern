"""Test Cognivern API health and public endpoints.

Verifies that core public endpoints respond correctly without authentication.
These are the endpoints listed in PUBLIC_API_PATHS that should be accessible
to anyone (landing page data, health checks, status endpoints).
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


def test_audit_logs_requires_auth():
    """GET /api/audit/logs is not public — tenant audit data must be scoped.

    Commit 38ef3a71 ("chore: harden Cleanverse monitoring and acceptance")
    deliberately removed '/audit/logs' and '/audit/insights' from
    PUBLIC_API_PATHS: unauthenticated callers must not fall through to
    global CRE data. The authenticated path is covered by
    workspace_apikey_audit_webhooks.py.
    """
    r = _request("GET", f"{BASE}/api/audit/logs")
    assert r.status_code in (401, 403), (
        f"expected 401/403, got {r.status_code}: {r.text[:200]}"
    )
    body = r.json()
    assert body.get("success") is False
    assert "auth" in body.get("error", "").lower()


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
test_audit_logs_requires_auth()
test_projects_list_returns_success()
test_fhenix_status_returns_success()

print("All health and public endpoint tests passed.")
