"""Extended OWS, copilot, and CRE endpoint tests."""
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


def test_ows_status():
    """GET /api/ows/status — returns 200 with OWS system status."""
    r = _request("GET", f"{BASE}/api/ows/status", headers=AUTH)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    body = r.json()
    assert body.get("success") is True, f"Expected success=true, got: {body}"
    data = body.get("data")
    assert data is not None, f"Expected data field, got: {body}"
    assert "provider" in data, f"Expected 'provider' in data, got: {data}"


def test_ows_bootstrap():
    """POST /api/ows/bootstrap — returns 200 with bootstrap wallet data."""
    r = _request("POST", f"{BASE}/api/ows/bootstrap", headers=AUTH)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    body = r.json()
    assert body.get("success") is True, f"Expected success=true, got: {body}"
    data = body.get("data")
    assert data is not None, f"Expected data field, got: {body}"
    assert "id" in data, f"Expected 'id' in data, got: {data}"
    assert "name" in data, f"Expected 'name' in data, got: {data}"
    assert "accounts" in data, f"Expected 'accounts' in data, got: {data}"


def test_ows_wallet_get_nonexistent():
    """GET /api/ows/wallets/:id — get non-existent wallet returns 404."""
    r = _request(
        "GET",
        f"{BASE}/api/ows/wallets/nonexistent-wallet-12345",
        headers=AUTH,
    )
    assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text}"


def test_ows_wallet_connect_missing_fields():
    """POST /api/ows/wallets/connect — connect with missing fields returns 400."""
    r = _request("POST", f"{BASE}/api/ows/wallets/connect", headers=AUTH, json={})
    assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"


def test_ows_wallet_import_missing_fields():
    """POST /api/ows/wallets/import — import with missing fields returns 400."""
    r = _request("POST", f"{BASE}/api/ows/wallets/import", headers=AUTH, json={})
    assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"


def test_ows_api_key_get_nonexistent():
    """GET /api/ows/api-keys/:id — get non-existent API key returns 404."""
    r = _request(
        "GET",
        f"{BASE}/api/ows/api-keys/nonexistent-key-12345",
        headers=AUTH,
    )
    assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text}"


def test_ows_api_key_delete_nonexistent():
    """DELETE /api/ows/api-keys/:id — delete non-existent API key returns 404."""
    r = _request(
        "DELETE",
        f"{BASE}/api/ows/api-keys/nonexistent-key-12345",
        headers=AUTH,
    )
    assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text}"


def test_ows_permissions_missing_fields():
    """POST /api/ows/permissions — with missing fields returns 400."""
    r = _request("POST", f"{BASE}/api/ows/permissions", headers=AUTH, json={})
    assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"


def test_ows_permissions_get_nonexistent_wallet():
    """GET /api/ows/permissions/:walletId — get permissions for non-existent wallet."""
    r = _request(
        "GET",
        f"{BASE}/api/ows/permissions/nonexistent-wallet-12345",
        headers=AUTH,
    )
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    body = r.json()
    data = body.get("data")
    assert data == [] or data is None or (
        isinstance(data, list) and len(data) == 0
    ), f"Expected empty list, got: {data}"


def test_copilot_run_get_nonexistent():
    """GET /api/copilot/runs/:runId — get non-existent run returns 404."""
    r = _request(
        "GET",
        f"{BASE}/api/copilot/runs/nonexistent-run-12345",
        headers=AUTH,
    )
    assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text}"


def test_copilot_run_confirm_nonexistent():
    """POST /api/copilot/runs/:runId/confirm — confirm non-existent run."""
    r = _request(
        "POST",
        f"{BASE}/api/copilot/runs/nonexistent-run-12345/confirm",
        headers=AUTH,
    )
    assert r.status_code in (200, 404), (
        f"Expected 200 or 404, got {r.status_code}: {r.text}"
    )


def test_cre_runs_list():
    """GET /api/cre/runs — list CRE runs returns 200 with list."""
    r = _request("GET", f"{BASE}/api/cre/runs", headers=AUTH)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    body = r.json()
    runs = body.get("runs")
    if runs is None:
        runs = body.get("data")
    assert isinstance(runs, list), (
        f"Expected 'runs' or 'data' to be a list, got: {type(runs)} in {body}"
    )


def test_cre_run_get_nonexistent():
    """GET /api/cre/runs/:runId — get non-existent CRE run returns 404."""
    r = _request(
        "GET",
        f"{BASE}/api/cre/runs/nonexistent-run-12345",
        headers=AUTH,
    )
    assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text}"


def test_cre_run_cancel_nonexistent():
    """POST /api/cre/runs/:runId/cancel — cancel non-existent run."""
    r = _request(
        "POST",
        f"{BASE}/api/cre/runs/nonexistent-run-12345/cancel",
        headers=AUTH,
    )
    assert r.status_code in (400, 404), (
        f"Expected 400 or 404, got {r.status_code}: {r.text}"
    )


def test_cre_run_retry_nonexistent():
    """POST /api/cre/runs/:runId/retry — retry non-existent run."""
    r = _request(
        "POST",
        f"{BASE}/api/cre/runs/nonexistent-run-12345/retry",
        headers=AUTH,
    )
    assert r.status_code in (400, 404), (
        f"Expected 400 or 404, got {r.status_code}: {r.text}"
    )


# Required: invoke all tests so assertions actually run
test_ows_status()
test_ows_bootstrap()
test_ows_wallet_get_nonexistent()
test_ows_wallet_connect_missing_fields()
test_ows_wallet_import_missing_fields()
test_ows_api_key_get_nonexistent()
test_ows_api_key_delete_nonexistent()
test_ows_permissions_missing_fields()
test_ows_permissions_get_nonexistent_wallet()
test_copilot_run_get_nonexistent()
test_copilot_run_confirm_nonexistent()
test_cre_runs_list()
test_cre_run_get_nonexistent()
test_cre_run_cancel_nonexistent()
test_cre_run_retry_nonexistent()

print("All OWS/copilot/CRE extended tests passed.")
