"""Test Cognivern API MCP governance check and agent endpoints.

Verifies the MCP tool manifest, governance check execution, and the
agent status endpoints (unified, governance, portfolio, connections).
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



def test_mcp_governance_check_manifest():
    """GET /api/mcp/governance-check returns 200 with tool manifest
    describing the governance-check MCP tool schema."""
    r = _request("GET", f"{BASE}/api/mcp/governance-check", timeout=15)
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is True
    data = body.get("data", {})
    assert data.get("schema_version") == "v1", f"expected schema_version=v1"
    assert data.get("name") == "governance-check", f"expected name=governance-check"
    assert "input_schema" in data, "missing input_schema"
    assert "output_schema" in data, "missing output_schema"
    assert isinstance(data.get("categories"), list), "categories should be a list"


def test_mcp_governance_check_validates_input():
    """POST /api/mcp/governance-check with missing agentId returns 400."""
    r = _request("POST", f"{BASE}/api/mcp/governance-check", json={}, timeout=15)
    assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is False


def test_agents_unified():
    """GET /api/agents/unified returns 200 with system health, agents list,
    and recent activity."""
    r = _request("GET", f"{BASE}/api/agents/unified", timeout=15)
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is True
    data = body.get("data", {})
    assert "systemHealth" in data, "missing systemHealth"
    assert "agents" in data, "missing agents list"
    assert "recentActivity" in data, "missing recentActivity"
    sys_health = data["systemHealth"]
    assert "status" in sys_health, "systemHealth missing status"
    assert "totalPolicies" in sys_health, "systemHealth missing totalPolicies"


def test_agents_governance_status():
    """GET /api/agents/governance/status returns 200 with governance agent
    status including trade count and performance metrics."""
    r = _request("GET", f"{BASE}/api/agents/governance/status", timeout=15)
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert "agent" in body, "missing agent field"
    assert "status" in body, "missing status field"
    agent = body["agent"]
    assert agent.get("type") == "governance", f"expected type=governance, got {agent.get('type')}"
    status = body["status"]
    assert "isActive" in status, "status missing isActive"
    assert "tradesExecuted" in status, "status missing tradesExecuted"


def test_agents_portfolio_status():
    """GET /api/agents/portfolio/status returns 200 with portfolio agent
    status."""
    r = _request("GET", f"{BASE}/api/agents/portfolio/status", timeout=15)
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert "agent" in body, "missing agent field"
    assert "status" in body, "missing status field"
    assert body["agent"].get("type") == "portfolio"


def test_agents_sapience_status():
    """GET /api/agents/sapience/status returns 200 with sapience agent
    status. Previously returned 500 because 'sapience' was missing from
    demoAgentNames in AgentsController."""
    r = _request("GET", f"{BASE}/api/agents/sapience/status", timeout=15)
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert "agent" in body, "missing agent field"
    assert "status" in body, "missing status field"
    assert body["agent"].get("type") == "sapience"
    assert body["agent"].get("name") == "Sapience Forecasting Agent"


def test_agents_connections():
    """GET /api/agents/connections returns 200 with connections list."""
    r = _request("GET", f"{BASE}/api/agents/connections", timeout=15)
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is True
    assert isinstance(body.get("data"), list), "data should be a list"


def test_agents_governance_decisions():
    """GET /api/agents/governance/decisions returns 200 with decision list."""
    r = _request("GET", f"{BASE}/api/agents/governance/decisions", timeout=15)
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is True
    assert isinstance(body.get("data"), list), "data should be a list"
    # If there are decisions, verify their structure
    decisions = body["data"]
    for d in decisions[:3]:
        assert "id" in d, "decision missing id"
        assert "action" in d, "decision missing action"
        assert "symbol" in d, "decision missing symbol"
        assert "confidence" in d, "decision missing confidence"
        assert "riskScore" in d, "decision missing riskScore"


def test_audit_insights():
    """GET /api/audit/insights returns 200 with audit insight data."""
    r = _request("GET", f"{BASE}/api/audit/insights", timeout=15)
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is True


def test_dashboard_bundle():
    """GET /api/dashboard/bundle returns 200 with aggregated dashboard data
    (stats, agents, activity)."""
    r = _request("GET", f"{BASE}/api/dashboard/bundle", timeout=15)
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is True
    data = body.get("data", {})
    assert "stats" in data, "missing stats"
    assert "agents" in data, "missing agents"
    assert "activity" in data, "missing activity"


# Required: invoke all tests so assertions actually run
test_mcp_governance_check_manifest()
test_mcp_governance_check_validates_input()
test_agents_unified()
test_agents_governance_status()
test_agents_portfolio_status()
test_agents_sapience_status()
test_agents_connections()
test_agents_governance_decisions()
test_audit_insights()
test_dashboard_bundle()

print("All MCP and agent endpoint tests passed.")
