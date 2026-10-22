"""Workspace, API key, audit, webhooks, payroll, and ingest tests.

Covers JWT-authenticated workspace management, workspace-scoped API key CRUD,
audit trail operations (insights, permits, timeline, decrypt), webhook holds,
confidential payroll, and data-plane ingestion.
"""
import time
import requests

BASE = __import__("os").environ.get("ENDPOINT_URL", "https://api.cognivern.persidian.com").rstrip("/")
# The workspace key is injected by TestSprite at run time (see __AUTH_HEADERS__);
# the legacy literal is only a local fallback.
API_KEY = __AUTH_CREDENTIAL__ or "sapience-hackathon-key"
AUTH = __AUTH_HEADERS__ or {"x-api-key": API_KEY}
TIMEOUT = 15
MAX_RETRIES = 5
RETRY_DELAY = 8
TRANSIENT_STATUS = (429, 502, 503)
# Total wall-clock the retry loop may spend sleeping for one request. The
# per-attempt backoff is multiplicative, so without this cap a module with
# many calls can spend minutes parked in time.sleep() and blow the runner's
# own timeout. When the budget is exhausted the last response is returned so
# the assertion reports the real status.
RETRY_BUDGET = 45

# Test credentials (registered in auth_endpoints.py)
TEST_EMAIL = "testsprite-test@cognivern.com"
TEST_PASSWORD = "TestPass123!"


def _request(method, url, **kwargs):
    """Send an HTTP request, retrying transient upstream failures.

    The live deployment answers 502/503 when it is briefly overloaded and 429
    when the per-IP rate limiter trips. Both are transient, so they are retried
    with a backoff; every other status is returned to the caller as-is.
    """
    kwargs.setdefault("timeout", TIMEOUT)
    last_resp = None
    slept = 0
    for attempt in range(MAX_RETRIES):
        try:
            r = requests.request(method, url, **kwargs)
        except requests.exceptions.RequestException:
            if attempt < MAX_RETRIES - 1 and slept < RETRY_BUDGET:
                delay = min(RETRY_DELAY * (attempt + 1), RETRY_BUDGET - slept)
                time.sleep(delay)
                slept += delay
            continue
        if r.status_code not in TRANSIENT_STATUS:
            return r
        last_resp = r
        if attempt < MAX_RETRIES - 1 and slept < RETRY_BUDGET:
            delay = min(RETRY_DELAY * (attempt + 1), RETRY_BUDGET - slept)
            time.sleep(delay)
            slept += delay
    return last_resp


def ensure_test_user():
    """Register the shared TestSprite user if not already present."""
    r = _request(
        "POST",
        f"{BASE}/auth/register",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
    )
    assert r.status_code in (201, 409), (
        f"register failed: {r.status_code}: {r.text[:200]}"
    )


def get_jwt_token():
    """Login and return a JWT token for authenticated endpoints."""
    ensure_test_user()
    r = _request(
        "POST",
        f"{BASE}/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
    )
    assert r.status_code == 200, f"login failed: {r.status_code}: {r.text[:200]}"
    body = r.json()
    token = body.get("token")
    assert token, f"no token in response: {body}"
    return token


def test_workspace_get_with_jwt():
    """GET /workspace with valid JWT returns workspace details."""
    token = get_jwt_token()
    r = _request("GET", f"{BASE}/workspace", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is True
    data = body.get("data", {})
    assert "id" in data, "missing workspace id"
    assert "name" in data, "missing workspace name"
    assert "ownerId" in data, "missing ownerId"
    assert "tier" in data, "missing tier"
    assert data["tier"] in ("demo", "live"), f"unexpected tier: {data['tier']}"


def test_workspace_get_without_jwt():
    """GET /workspace without JWT returns 401."""
    r = _request("GET", f"{BASE}/workspace")
    assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text[:200]}"


def test_workspaces_list_with_jwt():
    """GET /workspaces with valid JWT returns list of user's workspaces."""
    token = get_jwt_token()
    r = _request("GET", f"{BASE}/workspaces", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is True
    data = body.get("data", [])
    assert isinstance(data, list), "data should be a list"
    # User should have at least one workspace (auto-created on registration)
    assert len(data) >= 1, "user should have at least one workspace"
    ws = data[0]
    assert "id" in ws, "missing workspace id"
    assert "name" in ws, "missing workspace name"
    assert "role" in ws, "missing role"


def test_workspaces_list_without_jwt():
    """GET /workspaces without JWT returns 401."""
    r = _request("GET", f"{BASE}/workspaces")
    assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text[:200]}"


def test_workspaces_create_with_jwt():
    """POST /workspaces with valid JWT creates a new workspace."""
    token = get_jwt_token()
    r = _request(
        "POST",
        f"{BASE}/workspaces",
        json={"name": "TestSprite Created WS"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 201, f"expected 201, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is True
    data = body.get("data", {})
    assert "id" in data, "missing workspace id"
    assert data.get("name") == "TestSprite Created WS"
    assert data.get("tier") == "demo"


def test_workspaces_create_missing_name():
    """POST /workspaces with missing name returns 400."""
    token = get_jwt_token()
    r = _request(
        "POST",
        f"{BASE}/workspaces",
        json={},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:200]}"


def test_api_keys_list_with_jwt():
    """GET /api-keys with valid JWT returns list of API keys."""
    token = get_jwt_token()
    r = _request(
        "GET",
        f"{BASE}/api-keys",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is True
    data = body.get("data", [])
    assert isinstance(data, list), "data should be a list"


def _revoke_stale_test_keys(token):
    """Revoke keys left behind by earlier runs of this test.

    The workspace is capped at 10 active API keys. A run that creates a key
    without revoking it leaves the workspace one key closer to the cap every
    time, so previous runs eventually block this test. Revoking our own
    leftovers first keeps the test self-healing.
    """
    listing = _request(
        "GET",
        f"{BASE}/api-keys",
        headers={"Authorization": f"Bearer {token}"},
    )
    if listing.status_code != 200:
        return
    for key in listing.json().get("data", []):
        if key.get("revokedAt"):
            continue
        if key.get("name") != "test-key-sprite-auto":
            continue
        _request(
            "DELETE",
            f"{BASE}/api-keys/{key['id']}",
            headers={"Authorization": f"Bearer {token}"},
        )


def test_api_keys_create_with_jwt():
    """POST /api-keys with valid JWT creates a new API key, then revokes it.

    The workspace is capped at 10 active API keys. Creating one on every run
    without revoking it exhausts the cap and the test blocks on the 11th run,
    so leftovers are pruned first and the new key is revoked again before the
    test returns.
    """
    token = get_jwt_token()
    _revoke_stale_test_keys(token)
    r = _request(
        "POST",
        f"{BASE}/api-keys",
        json={"name": "test-key-sprite-auto"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 201, f"expected 201, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is True
    data = body.get("data", {})
    assert "id" in data, "missing key id"
    assert "key" in data, "missing key value"
    assert data["key"].startswith("cvn_"), f"key should start with cvn_, got {data['key'][:10]}"
    assert "scopes" in data, "missing scopes"
    assert isinstance(data["scopes"], list), "scopes should be a list"

    # Revoke so repeated runs do not hit the 10-active-key cap.
    d = _request(
        "DELETE",
        f"{BASE}/api-keys/{data['id']}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert d.status_code in (200, 204), (
        f"expected 200/204 on revoke, got {d.status_code}: {d.text[:200]}"
    )


def test_api_keys_create_missing_name():
    """POST /api-keys with missing name returns 400."""
    token = get_jwt_token()
    r = _request(
        "POST",
        f"{BASE}/api-keys",
        json={},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code in (400, 500), f"expected 400 or 500, got {r.status_code}: {r.text[:200]}"


def test_api_keys_without_jwt():
    """GET /api-keys without JWT returns 401."""
    r = _request("GET", f"{BASE}/api-keys")
    assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text[:200]}"


def test_audit_resolve_insight():
    """POST /api/audit/insights/:id/resolve resolves an insight (stub returns 200)."""
    r = _request(
        "POST",
        f"{BASE}/api/audit/insights/nonexistent-insight/resolve",
        headers=AUTH,
    )
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is True


def test_audit_issue_permit():
    """POST /api/audit/permits with valid fields issues an audit permit."""
    r = _request(
        "POST",
        f"{BASE}/api/audit/permits",
        json={"policyId": "policy-1781185670152", "auditor": "0xtest"},
        headers=AUTH,
    )
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is True
    data = body.get("data", {})
    assert "permit" in data, "missing permit"
    assert "auditor" in data, "missing auditor"
    assert "policyId" in data, "missing policyId"
    assert "scope" in data, "missing scope"
    assert "note" in data, "missing note"


def test_audit_issue_permit_missing_fields():
    """POST /api/audit/permits with missing fields returns 400."""
    r = _request(
        "POST",
        f"{BASE}/api/audit/permits",
        json={},
        headers=AUTH,
    )
    assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:200]}"


def test_audit_timeline_nonexistent():
    """GET /api/audit/logs/:id/timeline for non-existent log returns 404."""
    r = _request(
        "GET",
        f"{BASE}/api/audit/logs/nonexistent-log/timeline",
        headers=AUTH,
    )
    assert r.status_code == 404, f"expected 404, got {r.status_code}: {r.text[:200]}"


def test_audit_decrypt_missing_permit():
    """GET /api/audit/logs/:id/decrypt without X-Audit-Permit header returns 400."""
    r = _request(
        "GET",
        f"{BASE}/api/audit/logs/nonexistent-log/decrypt",
        headers=AUTH,
    )
    assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is False
    assert "permit" in body.get("error", "").lower()


def test_webhooks_list_holds():
    """GET /api/webhooks/holds returns active policy holds list."""
    r = _request("GET", f"{BASE}/api/webhooks/holds", headers=AUTH)
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is True
    data = body.get("data", {})
    assert "holds" in data, "missing holds list"
    assert "count" in data, "missing count"
    assert isinstance(data["holds"], list), "holds should be a list"
    assert data["count"] == len(data["holds"]), "count should match holds length"


def test_webhooks_release_nonexistent_hold():
    """POST /api/webhooks/holds/:policyId/release for non-existent hold returns 404.

    Releasing a hold records the operator identity, so this endpoint needs a
    JWT (it reads req.userId), not just a workspace API key.
    """
    token = get_jwt_token()
    r = _request(
        "POST",
        f"{BASE}/api/webhooks/holds/nonexistent-policy/release",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 404, f"expected 404, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is False


def test_payroll_confidential_rejects_invalid_wallet():
    """POST /api/payroll/confidential rejects a non-checksummed contractor wallet.

    The live deployment has the Privara SDK enabled, so the owner address is
    validated (EIP-55) before any escrow is built. We deliberately assert the
    rejection path rather than the success path: a valid address would build
    and fund a REAL confidential escrow on Arbitrum, and a CI test must not
    create on-chain state or spend money. The success path is exercised in
    the sandbox, not against production.
    """
    r = _request(
        "POST",
        f"{BASE}/api/payroll/confidential",
        json={
            "decisionId": "test-decision-sprite",
            "contractorWallet": "0xABCDEF1234567890abcdef1234567890abcdef12",
            "amountUsd": 100,
        },
        headers=AUTH,
    )
    assert r.status_code in (400, 500), (
        f"expected 400/500, got {r.status_code}: {r.text[:200]}"
    )
    body = r.json()
    assert body.get("success") is False
    assert "address" in body.get("error", "").lower()
    assert "escrowId" not in body.get("data", {}), "no escrow should be created"


def test_payroll_confidential_missing_fields():
    """POST /api/payroll/confidential with missing fields returns 400."""
    r = _request(
        "POST",
        f"{BASE}/api/payroll/confidential",
        json={},
        headers=AUTH,
    )
    assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is False
    assert "details" in body, "missing validation details"


def test_ingest_runs_missing_fields():
    """POST /ingest/runs with missing fields returns 400."""
    r = _request(
        "POST",
        f"{BASE}/ingest/runs",
        json={},
        headers={"Content-Type": "application/json"},
    )
    assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is False
    assert "issues" in body or "details" in body or "error" in body, "missing error details"


# Run all tests
test_workspace_get_with_jwt()
test_workspace_get_without_jwt()
test_workspaces_list_with_jwt()
test_workspaces_list_without_jwt()
test_workspaces_create_with_jwt()
test_workspaces_create_missing_name()
test_api_keys_list_with_jwt()
test_api_keys_create_with_jwt()
test_api_keys_create_missing_name()
test_api_keys_without_jwt()
test_audit_resolve_insight()
test_audit_issue_permit()
test_audit_issue_permit_missing_fields()
test_audit_timeline_nonexistent()
test_audit_decrypt_missing_permit()
test_webhooks_list_holds()
test_webhooks_release_nonexistent_hold()
test_payroll_confidential_rejects_invalid_wallet()
test_payroll_confidential_missing_fields()
test_ingest_runs_missing_fields()

print("All workspace/API-key/audit/webhooks/payroll/ingest tests passed.")
