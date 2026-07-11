"""Extended agents, market, and dashboard endpoint tests."""
import time
import requests

BASE = __import__("os").environ.get("ENDPOINT_URL", "https://cognivern.thisyearnofear.com").rstrip("/")
API_KEY = "sapience-hackathon-key"
AUTH = {"x-api-key": API_KEY}
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


def test_agents_stats():
    """GET /api/agents/stats returns 200 with stats data."""
    r = _request("GET", f"{BASE}/api/agents/stats", headers=AUTH)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    body = r.json()
    assert body.get("success") is True, f"Expected success=true, got {body}"
    data = body.get("data")
    assert isinstance(data, dict), f"Expected data dict, got {type(data)}"
    assert "totalAgents" in data, f"Missing totalAgents in {data}"
    assert "avgWinRate" in data, f"Missing avgWinRate in {data}"


def test_agents_leaderboard():
    """GET /api/agents/leaderboard returns 200 with list data."""
    r = _request("GET", f"{BASE}/api/agents/leaderboard", headers=AUTH)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    body = r.json()
    assert body.get("success") is True, f"Expected success=true, got {body}"
    assert "data" in body, f"Missing data in {body}"
    assert "count" in body, f"Missing count in {body}"
    assert isinstance(body["data"], list), f"Expected data list, got {type(body['data'])}"
    assert isinstance(body["count"], int), f"Expected count int, got {type(body['count'])}"


def test_agents_compare():
    """GET /api/agents/compare?agents=governance,portfolio returns 200."""
    r = _request(
        "GET",
        f"{BASE}/api/agents/compare",
        headers=AUTH,
        params={"agents": "governance,portfolio"},
    )
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    body = r.json()
    assert body.get("success") is True, f"Expected success=true, got {body}"
    assert "data" in body, f"Missing data in {body}"
    assert "count" in body, f"Missing count in {body}"
    assert isinstance(body["data"], list), f"Expected data list, got {type(body['data'])}"
    assert isinstance(body["count"], int), f"Expected count int, got {type(body['count'])}"


def test_agents_monitoring():
    """GET /api/agents/monitoring returns 200 with monitoring data."""
    r = _request("GET", f"{BASE}/api/agents/monitoring", headers=AUTH)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    body = r.json()
    assert body.get("success") is True, f"Expected success=true, got {body}"
    assert "data" in body, f"Missing data in {body}"


def test_agent_get_nonexistent():
    """GET /api/agents/nonexistent-agent returns 404 or 200 with demo data."""
    r = _request("GET", f"{BASE}/api/agents/nonexistent-agent", headers=AUTH)
    assert r.status_code in (200, 404), f"Expected 200 or 404, got {r.status_code}: {r.text}"
    if r.status_code == 200:
        body = r.json()
        assert body.get("success") is True, f"Expected success=true, got {body}"


def test_agents_register_missing_fields():
    """POST /api/agents/register with missing fields returns 400."""
    r = _request("POST", f"{BASE}/api/agents/register", headers=AUTH, json={})
    assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"


def test_agent_start_nonexistent():
    """POST /api/agents/test-agent-sprite/start returns 200 or 404."""
    r = _request("POST", f"{BASE}/api/agents/test-agent-sprite/start", headers=AUTH)
    assert r.status_code in (200, 404), f"Expected 200 or 404, got {r.status_code}: {r.text}"


def test_agent_stop_nonexistent():
    """POST /api/agents/test-agent-sprite/stop returns 200 or 404."""
    r = _request("POST", f"{BASE}/api/agents/test-agent-sprite/stop", headers=AUTH)
    assert r.status_code in (200, 404), f"Expected 200 or 404, got {r.status_code}: {r.text}"


def test_market_stats():
    """GET /api/market/stats returns 200 with market stats."""
    r = _request("GET", f"{BASE}/api/market/stats", headers=AUTH)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    body = r.json()
    assert body.get("success") is True, f"Expected success=true, got {body}"
    data = body.get("data")
    assert isinstance(data, dict), f"Expected data dict, got {type(data)}"
    assert "totalMarkets" in data, f"Missing totalMarkets in {data}"
    assert "totalVolume" in data, f"Missing totalVolume in {data}"
    assert "marketCap" in data, f"Missing marketCap in {data}"
    assert "dominance" in data, f"Missing dominance in {data}"
    dominance = data["dominance"]
    assert isinstance(dominance, dict), f"Expected dominance dict, got {type(dominance)}"
    assert "btc" in dominance, f"Missing btc in dominance {dominance}"
    assert "eth" in dominance, f"Missing eth in dominance {dominance}"
    assert "usdt" in dominance, f"Missing usdt in dominance {dominance}"


def test_market_top():
    """GET /api/market/top returns 200 with market data list."""
    r = _request("GET", f"{BASE}/api/market/top", headers=AUTH)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    body = r.json()
    assert body.get("success") is True, f"Expected success=true, got {body}"
    assert "data" in body, f"Missing data in {body}"
    assert isinstance(body["data"], list), f"Expected data list, got {type(body['data'])}"


def test_market_data_symbol():
    """GET /api/market/data/BTC returns 200 with market data for symbol."""
    r = _request("GET", f"{BASE}/api/market/data/BTC", headers=AUTH)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    body = r.json()
    assert body.get("success") is True, f"Expected success=true, got {body}"
    assert "data" in body, f"Missing data in {body}"


def test_market_historical_symbol():
    """GET /api/market/historical/ETH returns 200 with historical data."""
    r = _request("GET", f"{BASE}/api/market/historical/ETH", headers=AUTH)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    body = r.json()
    assert body.get("success") is True, f"Expected success=true, got {body}"
    assert "data" in body, f"Missing data in {body}"


def test_dashboard_bundle():
    """GET /api/dashboard/bundle returns 200 with bundled dashboard data."""
    r = _request("GET", f"{BASE}/api/dashboard/bundle", headers=AUTH)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    body = r.json()
    assert body.get("success") is True, f"Expected success=true, got {body}"
    data = body.get("data")
    assert isinstance(data, dict), f"Expected data dict, got {type(data)}"
    assert "stats" in data, f"Missing stats in {data}"
    stats = data["stats"]
    assert isinstance(stats, dict), f"Expected stats dict, got {type(stats)}"
    assert "totalAgents" in stats, f"Missing totalAgents in stats {stats}"


def test_agent_preferences():
    """GET /api/agents/test-agent-sprite/preferences returns 200 with preferences."""
    r = _request("GET", f"{BASE}/api/agents/test-agent-sprite/preferences", headers=AUTH)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    body = r.json()
    assert body.get("success") is True, f"Expected success=true, got {body}"
    assert "data" in body, f"Missing data in {body}"


# Required: invoke all tests so assertions actually run
test_agents_stats()
test_agents_leaderboard()
test_agents_compare()
test_agents_monitoring()
test_agent_get_nonexistent()
test_agents_register_missing_fields()
test_agent_start_nonexistent()
test_agent_stop_nonexistent()
test_market_stats()
test_market_top()
test_market_data_symbol()
test_market_historical_symbol()
test_dashboard_bundle()
test_agent_preferences()

print("All agents extended tests passed.")
