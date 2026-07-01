"""Test Cognivern API auth endpoints.

Auth endpoints (register, login, nonce, verify-email, forgot-password,
reset-password) are mounted at /auth/* (NOT /api/auth/*) and should be
publicly accessible — you can't require auth to create an account.
Protected endpoints (me, refresh, logout) require JWT Bearer.
"""
import requests

BASE = ENDPOINT_URL.rstrip("/")


def test_auth_nonce_is_public():
    """POST /auth/nonce should be accessible without auth.
    It generates a SIWE nonce for wallet-based auth flow."""
    r = requests.post(f"{BASE}/auth/nonce", json={}, timeout=15)
    assert r.status_code == 200, (
        f"expected 200 (public endpoint), got {r.status_code}: {r.text[:200]}"
    )
    body = r.json()
    assert "nonce" in body, f"response should contain nonce field, got: {body}"


def test_auth_register_is_public():
    """POST /auth/register should be accessible without auth.
    It creates a new user account — requiring auth to register is a bug."""
    r = requests.post(
        f"{BASE}/auth/register",
        json={"email": "testsprite-test@cognivern.com", "password": "TestPass123!"},
        timeout=15,
    )
    # 201 = created, 409 = already exists — both mean the endpoint is reachable
    assert r.status_code in (201, 409), (
        f"expected 201 or 409 (public endpoint), got {r.status_code}: {r.text[:200]}"
    )
    body = r.json()
    if r.status_code == 201:
        assert body.get("success") is True
        assert "userId" in body
    elif r.status_code == 409:
        assert body.get("success") is False
        assert "already exists" in body.get("error", "").lower()


def test_auth_register_validates_input():
    """POST /auth/register with missing fields returns 400."""
    r = requests.post(f"{BASE}/auth/register", json={}, timeout=15)
    assert r.status_code == 400, (
        f"expected 400 (validation), got {r.status_code}: {r.text[:200]}"
    )


def test_auth_login_is_public():
    """POST /auth/login should be accessible without auth."""
    r = requests.post(
        f"{BASE}/auth/login",
        json={"email": "nonexistent@test.com", "password": "wrongpass"},
        timeout=15,
    )
    # 401 = invalid credentials (endpoint reachable), 400 = missing fields
    assert r.status_code in (400, 401), (
        f"expected 400 or 401 (public endpoint), got {r.status_code}: {r.text[:200]}"
    )
    # Should NOT get the apiKeyMiddleware 401 message
    if r.status_code == 401:
        body = r.json()
        assert "Invalid email or password" in body.get("error", ""), (
            f"should get 'Invalid email or password', got: {body.get('error')}"
        )


def test_auth_me_requires_jwt():
    """GET /auth/me requires JWT Bearer token."""
    r = requests.get(f"{BASE}/auth/me", timeout=15)
    assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text[:200]}"


def test_auth_forgot_password_is_public():
    """POST /auth/forgot-password should be accessible without auth."""
    r = requests.post(
        f"{BASE}/auth/forgot-password",
        json={"email": "nonexistent@test.com"},
        timeout=15,
    )
    assert r.status_code == 200, (
        f"expected 200 (always returns success to prevent enumeration), got {r.status_code}: {r.text[:200]}"
    )
    body = r.json()
    assert body.get("success") is True


def test_auth_reset_password_validates_input():
    """POST /auth/reset-password with missing fields returns 400."""
    r = requests.post(f"{BASE}/auth/reset-password", json={}, timeout=15)
    assert r.status_code == 400, (
        f"expected 400 (validation), got {r.status_code}: {r.text[:200]}"
    )


# Required: invoke all tests so assertions actually run
test_auth_nonce_is_public()
test_auth_register_is_public()
test_auth_register_validates_input()
test_auth_login_is_public()
test_auth_me_requires_jwt()
test_auth_forgot_password_is_public()
test_auth_reset_password_validates_input()

print("All auth endpoint tests passed.")
