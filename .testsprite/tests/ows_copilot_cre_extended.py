import requests

BASE = "https://cognivern.thisyearnofear.com".rstrip("/")
API_KEY = "sapience-hackathon-key"
AUTH = {"x-api-key": API_KEY}
TIMEOUT = 15


def test_ows_status():
    """GET /api/ows/status — returns 200 with OWS system status."""
    r = requests.get(f"{BASE}/api/ows/status", headers=AUTH, timeout=TIMEOUT)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    body = r.json()
    assert body.get("success") is True, f"Expected success=true, got: {body}"
    data = body.get("data")
    assert data is not None, f"Expected data field, got: {body}"
    assert "provider" in data, f"Expected 'provider' in data, got: {data}"
    print("test_ows_status passed")


def test_ows_bootstrap():
    """POST /api/ows/bootstrap — returns 200 with bootstrap wallet data."""
    r = requests.post(f"{BASE}/api/ows/bootstrap", headers=AUTH, timeout=TIMEOUT)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    body = r.json()
    assert body.get("success") is True, f"Expected success=true, got: {body}"
    data = body.get("data")
    assert data is not None, f"Expected data field, got: {body}"
    assert "id" in data, f"Expected 'id' in data, got: {data}"
    assert "name" in data, f"Expected 'name' in data, got: {data}"
    assert "accounts" in data, f"Expected 'accounts' in data, got: {data}"
    print("test_ows_bootstrap passed")


def test_ows_wallet_get_nonexistent():
    """GET /api/ows/wallets/:id — get non-existent wallet returns 404."""
    r = requests.get(
        f"{BASE}/api/ows/wallets/nonexistent-wallet-12345",
        headers=AUTH,
        timeout=TIMEOUT,
    )
    assert r.status_code == 404, (
        f"Expected 404, got {r.status_code}: {r.text}"
    )
    print("test_ows_wallet_get_nonexistent passed")


def test_ows_wallet_connect_missing_fields():
    """POST /api/ows/wallets/connect — connect with missing fields returns 400."""
    r = requests.post(
        f"{BASE}/api/ows/wallets/connect", headers=AUTH, json={}, timeout=TIMEOUT
    )
    assert r.status_code == 400, (
        f"Expected 400, got {r.status_code}: {r.text}"
    )
    print("test_ows_wallet_connect_missing_fields passed")


def test_ows_wallet_import_missing_fields():
    """POST /api/ows/wallets/import — import with missing fields returns 400."""
    r = requests.post(
        f"{BASE}/api/ows/wallets/import", headers=AUTH, json={}, timeout=TIMEOUT
    )
    assert r.status_code == 400, (
        f"Expected 400, got {r.status_code}: {r.text}"
    )
    print("test_ows_wallet_import_missing_fields passed")


def test_ows_api_key_get_nonexistent():
    """GET /api/ows/api-keys/:id — get non-existent API key returns 404."""
    r = requests.get(
        f"{BASE}/api/ows/api-keys/nonexistent-key-12345",
        headers=AUTH,
        timeout=TIMEOUT,
    )
    assert r.status_code == 404, (
        f"Expected 404, got {r.status_code}: {r.text}"
    )
    print("test_ows_api_key_get_nonexistent passed")


def test_ows_api_key_delete_nonexistent():
    """DELETE /api/ows/api-keys/:id — delete non-existent API key returns 404."""
    r = requests.delete(
        f"{BASE}/api/ows/api-keys/nonexistent-key-12345",
        headers=AUTH,
        timeout=TIMEOUT,
    )
    assert r.status_code == 404, (
        f"Expected 404, got {r.status_code}: {r.text}"
    )
    print("test_ows_api_key_delete_nonexistent passed")


def test_ows_permissions_missing_fields():
    """POST /api/ows/permissions — with missing fields returns 400."""
    r = requests.post(
        f"{BASE}/api/ows/permissions", headers=AUTH, json={}, timeout=TIMEOUT
    )
    assert r.status_code == 400, (
        f"Expected 400, got {r.status_code}: {r.text}"
    )
    print("test_ows_permissions_missing_fields passed")


def test_ows_permissions_get_nonexistent_wallet():
    """GET /api/ows/permissions/:walletId — get permissions for non-existent wallet."""
    r = requests.get(
        f"{BASE}/api/ows/permissions/nonexistent-wallet-12345",
        headers=AUTH,
        timeout=TIMEOUT,
    )
    assert r.status_code == 200, (
        f"Expected 200, got {r.status_code}: {r.text}"
    )
    body = r.json()
    data = body.get("data")
    assert data == [] or data is None or (
        isinstance(data, list) and len(data) == 0
    ), f"Expected empty list, got: {data}"
    print("test_ows_permissions_get_nonexistent_wallet passed")


def test_copilot_run_get_nonexistent():
    """GET /api/copilot/runs/:runId — get non-existent run returns 404."""
    r = requests.get(
        f"{BASE}/api/copilot/runs/nonexistent-run-12345",
        headers=AUTH,
        timeout=TIMEOUT,
    )
    assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text}"
    print("test_copilot_run_get_nonexistent passed")


def test_copilot_run_confirm_nonexistent():
    """POST /api/copilot/runs/:runId/confirm — confirm non-existent run."""
    r = requests.post(
        f"{BASE}/api/copilot/runs/nonexistent-run-12345/confirm",
        headers=AUTH,
        timeout=TIMEOUT,
    )
    assert r.status_code in (200, 404), (
        f"Expected 200 or 404, got {r.status_code}: {r.text}"
    )
    print("test_copilot_run_confirm_nonexistent passed")


def test_cre_runs_list():
    """GET /api/cre/runs — list CRE runs returns 200 with list."""
    r = requests.get(f"{BASE}/api/cre/runs", headers=AUTH, timeout=TIMEOUT)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    body = r.json()
    runs = body.get("runs")
    if runs is None:
        runs = body.get("data")
    assert isinstance(runs, list), (
        f"Expected 'runs' or 'data' to be a list, got: {type(runs)} in {body}"
    )
    print("test_cre_runs_list passed")


def test_cre_run_get_nonexistent():
    """GET /api/cre/runs/:runId — get non-existent CRE run returns 404."""
    r = requests.get(
        f"{BASE}/api/cre/runs/nonexistent-run-12345",
        headers=AUTH,
        timeout=TIMEOUT,
    )
    assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text}"
    print("test_cre_run_get_nonexistent passed")


def test_cre_run_cancel_nonexistent():
    """POST /api/cre/runs/:runId/cancel — cancel non-existent run."""
    r = requests.post(
        f"{BASE}/api/cre/runs/nonexistent-run-12345/cancel",
        headers=AUTH,
        timeout=TIMEOUT,
    )
    assert r.status_code in (400, 404), (
        f"Expected 400 or 404, got {r.status_code}: {r.text}"
    )
    print("test_cre_run_cancel_nonexistent passed")


def test_cre_run_retry_nonexistent():
    """POST /api/cre/runs/:runId/retry — retry non-existent run."""
    r = requests.post(
        f"{BASE}/api/cre/runs/nonexistent-run-12345/retry",
        headers=AUTH,
        timeout=TIMEOUT,
    )
    assert r.status_code in (400, 404), (
        f"Expected 400 or 404, got {r.status_code}: {r.text}"
    )
    print("test_cre_run_retry_nonexistent passed")


if __name__ == "__main__":
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
