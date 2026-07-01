import requests

BASE = "https://cognivern.thisyearnofear.com".rstrip("/")
API_KEY = "sapience-hackathon-key"
AUTH = {"x-api-key": API_KEY}
TIMEOUT = 15


def test_agents_stats():
    """1. GET /api/agents/stats returns 200 with stats data."""
    r = requests.get(f"{BASE}/api/agents/stats", headers=AUTH, timeout=TIMEOUT)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    body = r.json()
    assert body.get("success") is True, f"Expected success=true, got {body}"
    data = body.get("data")
    assert isinstance(data, dict), f"Expected data dict, got {type(data)}"
    assert "totalAgents" in data, f"Missing totalAgents in {data}"
    assert "avgWinRate" in data, f"Missing avgWinRate in {data}"
    print("test_agents_stats passed")


def test_agents_leaderboard():
    """2. GET /api/agents/leaderboard returns 200 with list data."""
    r = requests.get(f"{BASE}/api/agents/leaderboard", headers=AUTH, timeout=TIMEOUT)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    body = r.json()
    assert body.get("success") is True, f"Expected success=true, got {body}"
    assert "data" in body, f"Missing data in {body}"
    assert "count" in body, f"Missing count in {body}"
    assert isinstance(body["data"], list), f"Expected data list, got {type(body['data'])}"
    assert isinstance(body["count"], int), f"Expected count int, got {type(body['count'])}"
    print("test_agents_leaderboard passed")


def test_agents_compare():
    """3. GET /api/agents/compare?agents=governance,portfolio returns 200."""
    r = requests.get(
        f"{BASE}/api/agents/compare",
        headers=AUTH,
        params={"agents": "governance,portfolio"},
        timeout=TIMEOUT,
    )
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    body = r.json()
    assert body.get("success") is True, f"Expected success=true, got {body}"
    assert "data" in body, f"Missing data in {body}"
    assert "count" in body, f"Missing count in {body}"
    assert isinstance(body["data"], list), f"Expected data list, got {type(body['data'])}"
    assert isinstance(body["count"], int), f"Expected count int, got {type(body['count'])}"
    print("test_agents_compare passed")


def test_agents_monitoring():
    """4. GET /api/agents/monitoring returns 200 with monitoring data."""
    r = requests.get(f"{BASE}/api/agents/monitoring", headers=AUTH, timeout=TIMEOUT)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    body = r.json()
    assert body.get("success") is True, f"Expected success=true, got {body}"
    assert "data" in body, f"Missing data in {body}"
    print("test_agents_monitoring passed")


def test_agent_get_nonexistent():
    """5. GET /api/agents/nonexistent-agent returns 404 or 200 with demo data."""
    r = requests.get(f"{BASE}/api/agents/nonexistent-agent", headers=AUTH, timeout=TIMEOUT)
    assert r.status_code in (200, 404), f"Expected 200 or 404, got {r.status_code}: {r.text}"
    if r.status_code == 200:
        body = r.json()
        assert body.get("success") is True, f"Expected success=true, got {body}"
    print("test_agent_get_nonexistent passed")


def test_agents_register_missing_fields():
    """6. POST /api/agents/register with missing fields returns 400."""
    r = requests.post(f"{BASE}/api/agents/register", headers=AUTH, json={}, timeout=TIMEOUT)
    assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"
    print("test_agents_register_missing_fields passed")


def test_agent_start_nonexistent():
    """7. POST /api/agents/test-agent-sprite/start returns 200 or 404."""
    r = requests.post(f"{BASE}/api/agents/test-agent-sprite/start", headers=AUTH, timeout=TIMEOUT)
    assert r.status_code in (200, 404), f"Expected 200 or 404, got {r.status_code}: {r.text}"
    print("test_agent_start_nonexistent passed")


def test_agent_stop_nonexistent():
    """8. POST /api/agents/test-agent-sprite/stop returns 200 or 404."""
    r = requests.post(f"{BASE}/api/agents/test-agent-sprite/stop", headers=AUTH, timeout=TIMEOUT)
    assert r.status_code in (200, 404), f"Expected 200 or 404, got {r.status_code}: {r.text}"
    print("test_agent_stop_nonexistent passed")


def test_market_stats():
    """9. GET /api/market/stats returns 200 with market stats."""
    r = requests.get(f"{BASE}/api/market/stats", headers=AUTH, timeout=TIMEOUT)
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
    print("test_market_stats passed")


def test_market_top():
    """10. GET /api/market/top returns 200 with market data list."""
    r = requests.get(f"{BASE}/api/market/top", headers=AUTH, timeout=TIMEOUT)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    body = r.json()
    assert body.get("success") is True, f"Expected success=true, got {body}"
    assert "data" in body, f"Missing data in {body}"
    assert isinstance(body["data"], list), f"Expected data list, got {type(body['data'])}"
    print("test_market_top passed")


def test_market_data_symbol():
    """11. GET /api/market/data/BTC returns 200 with market data for symbol."""
    r = requests.get(f"{BASE}/api/market/data/BTC", headers=AUTH, timeout=TIMEOUT)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    body = r.json()
    assert body.get("success") is True, f"Expected success=true, got {body}"
    assert "data" in body, f"Missing data in {body}"
    print("test_market_data_symbol passed")


def test_market_historical_symbol():
    """12. GET /api/market/historical/ETH returns 200 with historical data."""
    r = requests.get(f"{BASE}/api/market/historical/ETH", headers=AUTH, timeout=TIMEOUT)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    body = r.json()
    assert body.get("success") is True, f"Expected success=true, got {body}"
    assert "data" in body, f"Missing data in {body}"
    print("test_market_historical_symbol passed")


def test_dashboard_bundle():
    """13. GET /api/dashboard/bundle returns 200 with bundled dashboard data."""
    r = requests.get(f"{BASE}/api/dashboard/bundle", headers=AUTH, timeout=TIMEOUT)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    body = r.json()
    assert body.get("success") is True, f"Expected success=true, got {body}"
    data = body.get("data")
    assert isinstance(data, dict), f"Expected data dict, got {type(data)}"
    assert "stats" in data, f"Missing stats in {data}"
    stats = data["stats"]
    assert isinstance(stats, dict), f"Expected stats dict, got {type(stats)}"
    assert "totalAgents" in stats, f"Missing totalAgents in stats {stats}"
    print("test_dashboard_bundle passed")


def test_agent_preferences():
    """14. GET /api/agents/test-agent-sprite/preferences returns 200 with preferences."""
    r = requests.get(f"{BASE}/api/agents/test-agent-sprite/preferences", headers=AUTH, timeout=TIMEOUT)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    body = r.json()
    assert body.get("success") is True, f"Expected success=true, got {body}"
    assert "data" in body, f"Missing data in {body}"
    print("test_agent_preferences passed")


if __name__ == "__main__":
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
