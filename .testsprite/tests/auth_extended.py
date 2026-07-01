import requests

BASE = "https://cognivern.thisyearnofear.com".rstrip("/")
TIMEOUT = 15


def test_verify_invalid_payload():
    """POST /auth/verify with invalid SIWE payload should return 400 or 401."""
    payload = {"message": "test", "signature": "0xinvalid"}
    resp = requests.post(f"{BASE}/auth/verify", json=payload, timeout=TIMEOUT)
    assert resp.status_code in (400, 401), (
        f"Expected 400 or 401 for invalid SIWE payload, got {resp.status_code}: {resp.text}"
    )
    print(f"test_verify_invalid_payload passed (status={resp.status_code})")


def test_verify_email_invalid_token():
    """POST /auth/verify-email with invalid token should return 404."""
    payload = {"token": "invalid-token-12345"}
    resp = requests.post(f"{BASE}/auth/verify-email", json=payload, timeout=TIMEOUT)
    assert resp.status_code == 404, (
        f"Expected 404 for invalid email verification token, got {resp.status_code}: {resp.text}"
    )
    print(f"test_verify_email_invalid_token passed (status={resp.status_code})")


def test_refresh_without_bearer():
    """POST /auth/refresh without Bearer token should return 401."""
    resp = requests.post(f"{BASE}/auth/refresh", timeout=TIMEOUT)
    assert resp.status_code == 401, (
        f"Expected 401 for refresh without Bearer token, got {resp.status_code}: {resp.text}"
    )
    print(f"test_refresh_without_bearer passed (status={resp.status_code})")


def test_refresh_with_invalid_token():
    """POST /auth/refresh with invalid Bearer token should return 401."""
    headers = {"Authorization": "Bearer invalidtoken123"}
    resp = requests.post(f"{BASE}/auth/refresh", headers=headers, timeout=TIMEOUT)
    assert resp.status_code == 401, (
        f"Expected 401 for refresh with invalid token, got {resp.status_code}: {resp.text}"
    )
    print(f"test_refresh_with_invalid_token passed (status={resp.status_code})")


def test_logout_without_bearer():
    """POST /auth/logout without Bearer token should return 401."""
    resp = requests.post(f"{BASE}/auth/logout", timeout=TIMEOUT)
    assert resp.status_code == 401, (
        f"Expected 401 for logout without Bearer token, got {resp.status_code}: {resp.text}"
    )
    print(f"test_logout_without_bearer passed (status={resp.status_code})")


def test_register_duplicate_email():
    """POST /auth/register with duplicate email should return 409 or 400."""
    payload = {"email": "testsprite-test@cognivern.com", "password": "SomePass123!"}
    resp = requests.post(f"{BASE}/auth/register", json=payload, timeout=TIMEOUT)
    assert resp.status_code in (409, 400), (
        f"Expected 409 or 400 for duplicate email registration, got {resp.status_code}: {resp.text}"
    )
    print(f"test_register_duplicate_email passed (status={resp.status_code})")


def test_login_wrong_password():
    """POST /auth/login with wrong password should return 401."""
    payload = {"email": "testsprite-test@cognivern.com", "password": "WrongPass123!"}
    resp = requests.post(f"{BASE}/auth/login", json=payload, timeout=TIMEOUT)
    assert resp.status_code == 401, (
        f"Expected 401 for login with wrong password, got {resp.status_code}: {resp.text}"
    )
    print(f"test_login_wrong_password passed (status={resp.status_code})")


def test_login_missing_fields():
    """POST /auth/login with missing fields should return 400."""
    payload = {}
    resp = requests.post(f"{BASE}/auth/login", json=payload, timeout=TIMEOUT)
    assert resp.status_code == 400, (
        f"Expected 400 for login with missing fields, got {resp.status_code}: {resp.text}"
    )
    print(f"test_login_missing_fields passed (status={resp.status_code})")


def test_forgot_password_valid_email():
    """POST /auth/forgot-password with valid email format should return 200."""
    payload = {"email": "nonexistent@cognivern.com"}
    resp = requests.post(f"{BASE}/auth/forgot-password", json=payload, timeout=TIMEOUT)
    assert resp.status_code == 200, (
        f"Expected 200 for forgot-password with valid email, got {resp.status_code}: {resp.text}"
    )
    print(f"test_forgot_password_valid_email passed (status={resp.status_code})")


def test_nonce():
    """POST /auth/nonce should return 200 with nonce and expiresAt."""
    resp = requests.post(f"{BASE}/auth/nonce", timeout=TIMEOUT)
    assert resp.status_code == 200, (
        f"Expected 200 for nonce endpoint, got {resp.status_code}: {resp.text}"
    )
    body = resp.json()
    assert "nonce" in body, f"Expected 'nonce' in response body, got: {body}"
    assert "expiresAt" in body, f"Expected 'expiresAt' in response body, got: {body}"
    print(f"test_nonce passed (status={resp.status_code}, nonce={body.get('nonce')})")


if __name__ == "__main__":
    test_verify_invalid_payload()
    test_verify_email_invalid_token()
    test_refresh_without_bearer()
    test_refresh_with_invalid_token()
    test_logout_without_bearer()
    test_register_duplicate_email()
    test_login_wrong_password()
    test_login_missing_fields()
    test_forgot_password_valid_email()
    test_nonce()
    print("All auth extended tests passed.")
