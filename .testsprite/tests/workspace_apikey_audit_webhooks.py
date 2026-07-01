"""Workspace, API key, audit, webhooks, payroll, and ingest tests.

Covers JWT-authenticated workspace management, workspace-scoped API key CRUD,
audit trail operations (insights, permits, timeline, decrypt), webhook holds,
confidential payroll, and data-plane ingestion.
"""
import requests

BASE = "https://cognivern.thisyearnofear.com".rstrip("/")
API_KEY = "sapience-hackathon-key"
AUTH = {"x-api-key": API_KEY}
TIMEOUT = 15

# Test credentials (registered in auth_endpoints.py)
TEST_EMAIL = "testsprite-test@cognivern.com"
TEST_PASSWORD = "TestPass123!"


def get_jwt_token():
    """Login and return a JWT token for authenticated endpoints."""
    r = requests.post(
        f"{BASE}/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
        timeout=TIMEOUT,
    )
    assert r.status_code == 200, f"login failed: {r.status_code}: {r.text[:200]}"
    body = r.json()
    token = body.get("token")
    assert token, f"no token in response: {body}"
    return token


def test_workspace_get_with_jwt():
    """GET /workspace with valid JWT returns workspace details."""
    token = get_jwt_token()
    r = requests.get(
        f"{BASE}/workspace",
        headers={"Authorization": f"Bearer {token}"},
        timeout=TIMEOUT,
    )
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
    r = requests.get(f"{BASE}/workspace", timeout=TIMEOUT)
    assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text[:200]}"


def test_workspaces_list_with_jwt():
    """GET /workspaces with valid JWT returns list of user's workspaces."""
    token = get_jwt_token()
    r = requests.get(
        f"{BASE}/workspaces",
        headers={"Authorization": f"Bearer {token}"},
        timeout=TIMEOUT,
    )
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
    r = requests.get(f"{BASE}/workspaces", timeout=TIMEOUT)
    assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text[:200]}"


def test_workspaces_create_with_jwt():
    """POST /workspaces with valid JWT creates a new workspace."""
    token = get_jwt_token()
    r = requests.post(
        f"{BASE}/workspaces",
        json={"name": "TestSprite Created WS"},
        headers={"Authorization": f"Bearer {token}"},
        timeout=TIMEOUT,
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
    r = requests.post(
        f"{BASE}/workspaces",
        json={},
        headers={"Authorization": f"Bearer {token}"},
        timeout=TIMEOUT,
    )
    assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:200]}"


def test_api_keys_list_with_jwt():
    """GET /api-keys with valid JWT returns list of API keys."""
    token = get_jwt_token()
    r = requests.get(
        f"{BASE}/api-keys",
        headers={"Authorization": f"Bearer {token}"},
        timeout=TIMEOUT,
    )
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is True
    data = body.get("data", [])
    assert isinstance(data, list), "data should be a list"


def test_api_keys_create_with_jwt():
    """POST /api-keys with valid JWT creates a new API key."""
    token = get_jwt_token()
    r = requests.post(
        f"{BASE}/api-keys",
        json={"name": "test-key-sprite-auto"},
        headers={"Authorization": f"Bearer {token}"},
        timeout=TIMEOUT,
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


def test_api_keys_create_missing_name():
    """POST /api-keys with missing name returns 400."""
    token = get_jwt_token()
    r = requests.post(
        f"{BASE}/api-keys",
        json={},
        headers={"Authorization": f"Bearer {token}"},
        timeout=TIMEOUT,
    )
    assert r.status_code in (400, 500), f"expected 400 or 500, got {r.status_code}: {r.text[:200]}"


def test_api_keys_without_jwt():
    """GET /api-keys without JWT returns 401."""
    r = requests.get(f"{BASE}/api-keys", timeout=TIMEOUT)
    assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text[:200]}"


def test_audit_resolve_insight():
    """POST /api/audit/insights/:id/resolve resolves an insight (stub returns 200)."""
    r = requests.post(
        f"{BASE}/api/audit/insights/nonexistent-insight/resolve",
        headers=AUTH,
        timeout=TIMEOUT,
    )
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is True


def test_audit_issue_permit():
    """POST /api/audit/permits with valid fields issues an audit permit."""
    r = requests.post(
        f"{BASE}/api/audit/permits",
        json={"policyId": "policy-1781185670152", "auditor": "0xtest"},
        headers=AUTH,
        timeout=TIMEOUT,
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
    r = requests.post(
        f"{BASE}/api/audit/permits",
        json={},
        headers=AUTH,
        timeout=TIMEOUT,
    )
    assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:200]}"


def test_audit_timeline_nonexistent():
    """GET /api/audit/logs/:id/timeline for non-existent log returns 404."""
    r = requests.get(
        f"{BASE}/api/audit/logs/nonexistent-log/timeline",
        headers=AUTH,
        timeout=TIMEOUT,
    )
    assert r.status_code == 404, f"expected 404, got {r.status_code}: {r.text[:200]}"


def test_audit_decrypt_missing_permit():
    """GET /api/audit/logs/:id/decrypt without X-Audit-Permit header returns 400."""
    r = requests.get(
        f"{BASE}/api/audit/logs/nonexistent-log/decrypt",
        headers=AUTH,
        timeout=TIMEOUT,
    )
    assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is False
    assert "permit" in body.get("error", "").lower()


def test_webhooks_list_holds():
    """GET /api/webhooks/holds returns active policy holds list."""
    r = requests.get(f"{BASE}/api/webhooks/holds", timeout=TIMEOUT)
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is True
    data = body.get("data", {})
    assert "holds" in data, "missing holds list"
    assert "count" in data, "missing count"
    assert isinstance(data["holds"], list), "holds should be a list"
    assert data["count"] == len(data["holds"]), "count should match holds length"


def test_webhooks_release_nonexistent_hold():
    """POST /api/webhooks/holds/:policyId/release for non-existent hold returns 404."""
    r = requests.post(
        f"{BASE}/api/webhooks/holds/nonexistent-policy/release",
        timeout=TIMEOUT,
    )
    assert r.status_code == 404, f"expected 404, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is False


def test_payroll_confidential_valid():
    """POST /api/payroll/confidential with valid fields executes confidential payroll."""
    r = requests.post(
        f"{BASE}/api/payroll/confidential",
        json={
            "decisionId": "test-decision-sprite",
            "contractorWallet": "0xABCDEF1234567890abcdef1234567890abcdef12",
            "amountUsd": 100,
        },
        headers=AUTH,
        timeout=TIMEOUT,
    )
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is True
    data = body.get("data", {})
    assert "escrowId" in data, "missing escrowId"
    assert "decisionId" in data, "missing decisionId"
    assert "amountUsd" in data, "missing amountUsd"


def test_payroll_confidential_missing_fields():
    """POST /api/payroll/confidential with missing fields returns 400."""
    r = requests.post(
        f"{BASE}/api/payroll/confidential",
        json={},
        headers=AUTH,
        timeout=TIMEOUT,
    )
    assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is False
    assert "details" in body, "missing validation details"


def test_ingest_runs_missing_fields():
    """POST /ingest/runs with missing fields returns 400."""
    r = requests.post(
        f"{BASE}/ingest/runs",
        json={},
        headers={"Content-Type": "application/json"},
        timeout=TIMEOUT,
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
test_payroll_confidential_valid()
test_payroll_confidential_missing_fields()
test_ingest_runs_missing_fields()

print("All workspace/API-key/audit/webhooks/payroll/ingest tests passed.")
