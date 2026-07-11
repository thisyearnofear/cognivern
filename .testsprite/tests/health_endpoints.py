"""Test Cognivern API health and readiness endpoints.

Verifies all health check variants: /health, /health/ready, /health/live,
/health/slo, /system/health, and /health?deep=true for dependency checks.
These are critical for monitoring and deployment verification.
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



def test_health_basic():
    """GET /health returns 200 with status=ok and uptime."""
    r = _request("GET", f"{BASE}/health", timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert body.get("status") == "ok"
    assert "uptime" in body
    assert "timestamp" in body


def test_health_ready():
    """GET /health/ready returns 200 with status=ready (or 503 if not ready)."""
    r = _request("GET", f"{BASE}/health/ready", timeout=15)
    assert r.status_code in (200, 503)
    body = r.json()
    if r.status_code == 200:
        assert body.get("status") == "ready"
    else:
        assert body.get("status") == "not ready"
    assert "timestamp" in body


def test_health_live():
    """GET /health/live returns 200 with status=alive."""
    r = _request("GET", f"{BASE}/health/live", timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert body.get("status") == "alive"
    assert "timestamp" in body


def test_health_slo():
    """GET /health/slo returns 200 with SLO metrics including route-level
    request counts, error rates, and latency percentiles."""
    r = _request("GET", f"{BASE}/health/slo", timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert "windowSeconds" in body, "missing windowSeconds"
    assert "routes" in body, "missing routes object"
    assert "overall" in body, "missing overall metrics"
    overall = body["overall"]
    assert "requestCount" in overall, "missing requestCount"
    assert "errorCount" in overall, "missing errorCount"
    assert "p50Ms" in overall, "missing p50Ms"
    assert "p95Ms" in overall, "missing p95Ms"


def test_system_health():
    """GET /system/health returns 200 with component health map."""
    r = _request("GET", f"{BASE}/system/health", timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert "overall" in body, "missing overall field"
    assert "components" in body, "missing components field"
    assert "metrics" in body, "missing metrics field"
    assert "timestamp" in body, "missing timestamp"
    components = body["components"]
    # Verify key components are present
    assert "arbitrum" in components, "missing arbitrum component"
    assert "policies" in components, "missing policies component"


def test_health_deep_returns_dependencies():
    """GET /health?deep=true returns 200 with dependency check results."""
    r = _request("GET", f"{BASE}/health", params={"deep": "true"}, timeout=30)
    assert r.status_code == 200
    body = r.json()
    assert "dependencies" in body, "missing dependencies array in deep health"
    deps = body["dependencies"]
    assert isinstance(deps, list), "dependencies should be a list"
    # Each dependency should have name and status
    for dep in deps:
        assert "name" in dep, f"dependency missing name: {dep}"
        assert "status" in dep, f"dependency {dep.get('name')} missing status"


# Required: invoke all tests so assertions actually run
test_health_basic()
test_health_ready()
test_health_live()
test_health_slo()
test_system_health()
test_health_deep_returns_dependencies()

print("All health endpoint tests passed.")
