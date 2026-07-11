"""Test Cognivern API spend endpoints.

Verifies that public spend endpoints (status, scan) respond correctly.
/spend and /spend/status and /spend/scan are in PUBLIC_API_PATHS.
/spend/preview is NOT public and should require auth.
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



def test_spend_status_returns_active_spendos():
    """GET /api/spend/status returns 200 with SpendOS layer active and
    wallet connected."""
    r = _request("GET", f"{BASE}/api/spend/status", timeout=15)
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is True, f"expected success=true"
    data = body.get("data", {})
    assert data.get("layer") == "SpendOS", f"expected layer=SpendOS"
    assert data.get("status") == "active", f"expected status=active"
    assert data.get("walletConnected") is True, f"expected walletConnected=true"
    assert "walletAddress" in data, "missing walletAddress"
    assert "features" in data, "missing features"
    features = data.get("features", [])
    assert isinstance(features, list), "features should be a list"
    assert len(features) > 0, "features list should not be empty"
    # Verify key SpendOS features are present
    assert "encrypted-local-wallet-storage" in features, "missing encrypted-local-wallet-storage feature"
    assert "pre-sign-policies" in features, "missing pre-sign-policies feature"
    assert "held-action-review" in features, "missing held-action-review feature"


def test_spend_scan_requires_address_param():
    """GET /api/spend/scan without address parameter returns 400 with
    a clear error message."""
    r = _request("GET", f"{BASE}/api/spend/scan", timeout=15)
    assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is False, f"expected success=false"
    assert "address" in body.get("error", "").lower(), (
        f"error should mention 'address' parameter, got: {body.get('error')}"
    )


def test_spend_scan_with_address_returns_audit_or_unavailable():
    """GET /api/spend/scan?address=<wallet> returns 200 with scan data
    when ChainGPT audit service is configured, or 503 'Audit service
    unavailable' when it is not (optional integration)."""
    # Use the wallet address from the spend status endpoint
    status_r = _request("GET", f"{BASE}/api/spend/status", timeout=15)
    status = status_r.json()
    wallet_addr = status.get("data", {}).get("walletAddress", "")
    assert wallet_addr, "could not get wallet address from spend status"

    r = _request("GET", f"{BASE}/api/spend/scan", params={"address": wallet_addr}, timeout=30)
    assert r.status_code in (200, 503), (
        f"expected 200 or 503, got {r.status_code}: {r.text[:200]}"
    )
    body = r.json()
    if r.status_code == 503:
        assert body.get("success") is False
        assert "audit" in body.get("error", "").lower(), (
            f"503 error should mention audit service, got: {body.get('error')}"
        )
    else:
        assert body.get("success") is True
        data = body.get("data", {})
        assert "address" in data
        assert "decision" in data


def test_spend_preview_requires_auth():
    """POST /api/spend/preview is NOT in PUBLIC_API_PATHS and should
    require authentication."""
    r = _request("POST", 
        f"{BASE}/api/spend/preview",
        json={"agent": "test", "action": "transfer", "amount": "1", "currency": "USDC"},
        timeout=15,
    )
    assert r.status_code == 401, f"expected 401 (protected), got {r.status_code}: {r.text[:200]}"


# Required: invoke all tests so assertions actually run
test_spend_status_returns_active_spendos()
test_spend_scan_requires_address_param()
test_spend_scan_with_address_returns_audit_or_unavailable()
test_spend_preview_requires_auth()

print("All spend endpoint tests passed.")
