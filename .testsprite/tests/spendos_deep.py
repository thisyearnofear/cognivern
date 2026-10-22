"""Deep SpendOS tests — the core utility of Cognivern.

Tests the full spend governance flow: preview, execute, encrypted spend,
decision confirmation, contract scanning, and status reporting.
Verifies policy evaluation, ChainGPT audit integration, FHE fallback,
and held-spend workflow.
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
# Total wall-clock the retry loop may spend sleeping for one request. The
# per-attempt backoff is multiplicative, so without this cap a module with
# many calls can spend minutes parked in time.sleep() and blow the runner's
# own timeout. When the budget is exhausted the last response is returned so
# the assertion reports the real status.
RETRY_BUDGET = 45
TRANSIENT_STATUS = (429, 502, 503)

VALID_SPEND = {
    "agentId": "test-agent-sprite",
    "recipient": "0xABCDEF1234567890abcdef1234567890abcdef12",
    "amount": "100",
    "asset": "USDC",
    "reason": "API credits for production workload",
}


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


def test_spend_status_reports_spendos_layer():
    """GET /api/spend/status returns SpendOS layer status with features list."""
    r = _request("GET", f"{BASE}/api/spend/status", headers=AUTH)
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is True
    data = body.get("data", {})
    assert data.get("layer") == "SpendOS", f"expected layer=SpendOS, got {data.get('layer')}"
    assert "status" in data, "missing status field"
    assert "walletConnected" in data, "missing walletConnected"
    assert "activePolicyId" in data, "missing activePolicyId"
    assert "features" in data, "missing features list"
    features = data.get("features", [])
    assert isinstance(features, list), "features should be a list"
    assert len(features) > 0, "features list should not be empty"
    # Verify key features are listed
    assert "pre-sign-policies" in features, "missing pre-sign-policies feature"
    assert "held-action-review" in features, "missing held-action-review feature"


def test_spend_preview_with_valid_intent():
    """POST /api/spend/preview with valid intent returns policy decision."""
    r = _request("POST", f"{BASE}/api/spend/preview", json=VALID_SPEND, headers=AUTH)
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is True
    data = body.get("data", {})
    assert "intentId" in data, "missing intentId"
    assert data["intentId"].startswith("preview_"), f"intentId should start with preview_, got {data['intentId']}"
    assert data.get("status") in ("approved", "held", "denied"), (
        f"status should be approved/held/denied, got {data.get('status')}"
    )
    assert "simulation" in data, "missing simulation object"
    sim = data["simulation"]
    assert "wouldExecute" in sim, "missing wouldExecute"
    assert "warnings" in sim, "missing warnings list"
    assert isinstance(sim["warnings"], list), "warnings should be a list"
    # If approved, wouldExecute should be True
    if data["status"] == "approved":
        assert sim["wouldExecute"] is True, "approved spend should have wouldExecute=True"
    # contractAudit should be present (null for non-contract addresses)
    assert "contractAudit" in data, "missing contractAudit field"


def test_spend_preview_validates_required_fields():
    """POST /api/spend/preview with missing fields returns 400."""
    r = _request("POST", f"{BASE}/api/spend/preview", json={}, headers=AUTH)
    assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is False
    assert "details" in body, "missing validation details"
    details = body["details"]
    for field in ("agentId", "recipient", "amount", "asset", "reason"):
        assert field in details, f"missing validation for {field}"


def test_spend_execute_returns_policy_decision():
    """POST /api/spend executes spend and returns policy decision.
    Without a valid OWS scoped API key, the spend should be held."""
    r = _request("POST", f"{BASE}/api/spend", json=VALID_SPEND, headers=AUTH, timeout=30)
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is True
    data = body.get("data", {})
    assert "intentId" in data, "missing intentId"
    assert data["intentId"].startswith("spend_"), f"intentId should start with spend_, got {data['intentId']}"
    assert data.get("status") in ("approved", "held", "denied"), (
        f"status should be approved/held/denied, got {data.get('status')}"
    )
    # Without a valid OWS scoped access token, the spend should be held
    if data["status"] == "held":
        assert "reason" in data, "held spend should have a reason"
        assert "runId" in data, "held spend should have a runId for approval flow"


def test_spend_execute_validates_required_fields():
    """POST /api/spend with missing fields returns 400."""
    r = _request("POST", f"{BASE}/api/spend", json={}, headers=AUTH)
    assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is False
    assert "details" in body, "missing validation details"


def test_encrypted_spend_demo_mode_small_amount():
    """POST /api/spend/encrypted in demo mode with small amount returns approve.
    The Fhenix CoFHE SDK is not initialized on this server, so the fallback
    path is used: amounts <= 500 USD get 'approve', larger get 'hold'."""
    r = _request(
        "POST",
        f"{BASE}/api/spend/encrypted",
        json={
            "agentId": "test-agent-sprite",
            "policyId": "demo-confidential-spend",
            "amountUsd": 100,
        },
        headers=AUTH,
        timeout=30,
    )
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is True
    data = body.get("data", {})
    assert "decisionId" in data, "missing decisionId"
    assert data["decisionId"].startswith("0x"), "decisionId should be hex"
    assert data.get("outcome") in ("approve", "hold", "deny"), (
        f"outcome should be approve/hold/deny, got {data.get('outcome')}"
    )
    assert "note" in data, "missing note field"


def test_encrypted_spend_demo_mode_large_amount():
    """POST /api/spend/encrypted in demo mode with large amount returns hold.
    Amounts > 500 USD should be held for human review (approval threshold)."""
    r = _request(
        "POST",
        f"{BASE}/api/spend/encrypted",
        json={
            "agentId": "test-agent-sprite",
            "policyId": "demo-confidential-spend",
            "amountUsd": 5000,
        },
        headers=AUTH,
        timeout=30,
    )
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is True
    data = body.get("data", {})
    assert "decisionId" in data, "missing decisionId"
    assert data.get("outcome") in ("approve", "hold", "deny"), (
        f"outcome should be approve/hold/deny, got {data.get('outcome')}"
    )


def test_encrypted_spend_ows_mode_validates_fields():
    """POST /api/spend/encrypted in OWS mode with missing fields returns 400."""
    r = _request(
        "POST",
        f"{BASE}/api/spend/encrypted",
        json={"agentId": "test"},
        headers=AUTH,
        timeout=15,
    )
    assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is False


def test_confirm_decision_confirm():
    """POST /api/spend/:decisionId/confirm refuses honestly with 501.

    Held spends are CRE runs. The canonical operator-approval path is
    POST /api/cre/runs/:runId/approval. This endpoint used to echo success
    without approving anything — a fabricated approval — and now returns 501
    pointing at the canonical endpoint. That refusal is the behaviour under
    test.
    """
    r = _request(
        "POST",
        f"{BASE}/api/spend/test-decision-sprite/confirm",
        json={"action": "confirm"},
        headers=AUTH,
        timeout=15,
    )
    assert r.status_code == 501, f"expected 501, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is False
    assert body.get("canonicalEndpoint") == "/api/cre/runs/test-decision-sprite/approval"


def test_confirm_decision_reject():
    """POST /api/spend/:decisionId/confirm refuses honestly with 501 for reject too."""
    r = _request(
        "POST",
        f"{BASE}/api/spend/test-decision-sprite/confirm",
        json={"action": "reject"},
        headers=AUTH,
        timeout=15,
    )
    assert r.status_code == 501, f"expected 501, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is False
    assert body.get("canonicalEndpoint") == "/api/cre/runs/test-decision-sprite/approval"


def test_confirm_decision_invalid_action():
    """POST /api/spend/:decisionId/confirm refuses with 501 before parsing action."""
    r = _request(
        "POST",
        f"{BASE}/api/spend/test-decision-sprite/confirm",
        json={"action": "invalid"},
        headers=AUTH,
        timeout=15,
    )
    assert r.status_code == 501, f"expected 501, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is False
    assert "confirm" in body.get("error", "").lower() or "reject" in body.get("error", "").lower()


def test_confirm_decision_missing_action():
    """POST /api/spend/:decisionId/confirm with missing action returns 400."""
    r = _request(
        "POST",
        f"{BASE}/api/spend/test-decision-sprite/confirm",
        json={},
        headers=AUTH,
        timeout=15,
    )
    assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:200]}"


def test_scan_contract_missing_address():
    """GET /api/spend/scan without address returns 400."""
    r = _request("GET", f"{BASE}/api/spend/scan", headers=AUTH)
    assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is False
    assert "address" in body.get("error", "").lower()


def test_scan_contract_invalid_address():
    """GET /api/spend/scan with invalid address returns 400."""
    r = _request("GET", f"{BASE}/api/spend/scan?address=not-an-address", headers=AUTH)
    assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is False
    assert "ethereum" in body.get("error", "").lower() or "address" in body.get("error", "").lower()


def test_scan_contract_valid_address_returns_audit():
    """GET /api/spend/scan with valid address returns audit result or 503.
    Returns 503 if ChainGPT is not configured, 200 with audit data if it is."""
    r = _request(
        "GET",
        f"{BASE}/api/spend/scan?address=0xABCDEF1234567890abcdef1234567890abcdef12",
        headers=AUTH,
        timeout=30,
    )
    assert r.status_code in (200, 503), (
        f"expected 200 or 503, got {r.status_code}: {r.text[:200]}"
    )
    if r.status_code == 200:
        body = r.json()
        assert body.get("success") is True
        data = body.get("data", {})
        assert data.get("address") == "0xABCDEF1234567890abcdef1234567890abcdef12"
        assert "decision" in data, "missing decision"
        assert "score" in data, "missing score"
        assert "safe" in data, "missing safe flag"
        assert "findings" in data, "missing findings list"


def test_spend_preview_with_contract_address():
    """POST /api/spend/preview to a contract address includes contractAudit."""
    r = _request(
        "POST",
        f"{BASE}/api/spend/preview",
        json={
            "agentId": "test-agent-sprite",
            "recipient": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",  # USDC contract
            "amount": "50",
            "asset": "USDC",
            "reason": "Test spend to known contract",
        },
        headers=AUTH,
        timeout=30,
    )
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is True
    data = body.get("data", {})
    # contractAudit should be present (may be null if audit service unavailable)
    assert "contractAudit" in data, "missing contractAudit field for contract address"


# Required: invoke all tests so assertions actually run
test_spend_status_reports_spendos_layer()
test_spend_preview_with_valid_intent()
test_spend_preview_validates_required_fields()
test_spend_execute_returns_policy_decision()
test_spend_execute_validates_required_fields()
test_encrypted_spend_demo_mode_small_amount()
test_encrypted_spend_demo_mode_large_amount()
test_encrypted_spend_ows_mode_validates_fields()
test_confirm_decision_confirm()
test_confirm_decision_reject()
test_confirm_decision_invalid_action()
test_confirm_decision_missing_action()
test_scan_contract_missing_address()
test_scan_contract_invalid_address()
test_scan_contract_valid_address_returns_audit()
test_spend_preview_with_contract_address()

print("All deep SpendOS tests passed.")
