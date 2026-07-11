"""Test Cognivern API FHE/Fhenix endpoints.

Verifies Fhenix status, encrypt, and decrypt endpoints. These power
confidential policy evaluation via Fully Homomorphic Encryption.
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



def test_fhenix_status():
    """GET /api/fhenix/status returns 200 with FHE integration status.
    May be enabled or disabled depending on configuration."""
    r = _request("GET", f"{BASE}/api/fhenix/status", timeout=15)
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is True
    data = body.get("data", {})
    assert "fhenixEnabled" in data, "missing fhenixEnabled field"
    # If enabled, should have chainId and contract; if disabled, should have reason
    if data.get("fhenixEnabled"):
        assert "chainId" in data, "enabled Fhenix missing chainId"
        assert "contract" in data, "enabled Fhenix missing contract address"
    else:
        assert "reason" in data, "disabled Fhenix missing reason field"


def test_fhenix_encrypt_missing_amount():
    """POST /api/fhenix/encrypt without amount returns 400."""
    r = _request("POST", f"{BASE}/api/fhenix/encrypt", json={}, timeout=15)
    assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is False
    assert "amount" in body.get("error", "").lower(), (
        f"error should mention amount, got: {body.get('error')}"
    )


def test_fhenix_encrypt_with_amount():
    """POST /api/fhenix/encrypt with amount returns 200 (encrypted) or
    503 (service unavailable if FHE not configured)."""
    r = _request("POST", f"{BASE}/api/fhenix/encrypt", json={"amount": "1000000"}, timeout=30)
    assert r.status_code in (200, 503), (
        f"expected 200 or 503, got {r.status_code}: {r.text[:200]}"
    )
    body = r.json()
    if r.status_code == 200:
        assert body.get("success") is True
        data = body.get("data", {})
        assert "encryptedData" in data, "missing encryptedData in response"
    else:
        assert body.get("success") is False
        assert "unavailable" in body.get("error", "").lower(), (
            f"503 error should mention unavailable, got: {body.get('error')}"
        )


def test_fhenix_decrypt_missing_fields():
    """POST /api/fhenix/decrypt without required fields returns 400."""
    r = _request("POST", f"{BASE}/api/fhenix/decrypt", json={}, timeout=15)
    assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is False


# Required: invoke all tests so assertions actually run
test_fhenix_status()
test_fhenix_encrypt_missing_amount()
test_fhenix_encrypt_with_amount()
test_fhenix_decrypt_missing_fields()

print("All Fhenix endpoint tests passed.")
