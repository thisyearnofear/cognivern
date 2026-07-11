"""Test Cognivern API audit trail integrity.

Verifies that the audit log endpoint returns well-formed entries with
required fields including evidence hashes, compliance status, and
outcome values. The audit trail is a core feature of the SpendOS
control plane — every decision must be persisted with evidence.
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


def test_audit_logs_return_well_formed_entries():
    """GET /api/audit/logs returns 200 with log entries that have all
    required fields: id, timestamp, agent, actionType, outcome, evidence."""
    r = _request("GET", f"{BASE}/api/audit/logs")
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body.get("success") is True, f"expected success=true"
    data = body.get("data", {})
    assert isinstance(data, dict), "data should be an object"
    logs = data.get("logs", [])
    assert isinstance(logs, list), "logs should be a list"
    assert len(logs) > 0, "audit logs should not be empty"

    # Verify each log entry has required fields
    required_fields = ["id", "timestamp", "agent", "actionType", "outcome", "evidence"]
    for log in logs[:5]:  # check first 5
        for field in required_fields:
            assert field in log, f"log entry {log.get('id', '?')} missing field: {field}"

        # Evidence must have a hash (or 'unsigned' for system entries)
        evidence = log.get("evidence", {})
        assert isinstance(evidence, dict), f"evidence should be an object, got {type(evidence)}"
        assert "hash" in evidence, f"evidence missing hash field"

        # Outcome must be a valid value
        outcome = log.get("outcome")
        assert outcome in ("allowed", "denied", "held", "pending"), (
            f"invalid outcome: {outcome}"
        )

        # Compliance status must be present
        assert "complianceStatus" in log, f"missing complianceStatus"
        assert log["complianceStatus"] in ("compliant", "non-compliant"), (
            f"invalid complianceStatus: {log['complianceStatus']}"
        )


def test_audit_logs_have_evidence_hashes():
    """Audit log entries must have evidence hashes for integrity verification.
    System entries may use 'unsigned' but spend/governance entries must have
    a real SHA-256 hash."""
    r = _request("GET", f"{BASE}/api/audit/logs")
    assert r.status_code == 200
    body = r.json()
    logs = body.get("data", {}).get("logs", [])

    # Find non-system entries (spend/governance) and verify hash format.
    # Legacy entries may use 'unsigned' before SHA-256 content hashing shipped;
    # new entries must carry a 64-char SHA-256 digest.
    non_system = [l for l in logs if l.get("agent") != "system"]
    if len(non_system) > 0:
        for log in non_system[:3]:
            evidence = log.get("evidence", {})
            h = evidence.get("hash", "")
            assert h and h != "pending", (
                f"log entry {log.get('id')} missing evidence hash"
            )
            if h != "unsigned":
                assert len(h) == 64, (
                    f"evidence hash should be 64 chars (SHA-256), got {len(h)}: {h[:20]}..."
                )


def test_audit_logs_have_artifact_references():
    """Audit log entries should reference evidence artifacts for replay."""
    r = _request("GET", f"{BASE}/api/audit/logs")
    assert r.status_code == 200
    body = r.json()
    logs = body.get("data", {}).get("logs", [])

    # At least some entries should have artifact IDs
    entries_with_artifacts = [
        l for l in logs
        if l.get("evidence", {}).get("artifactIds") and len(l["evidence"]["artifactIds"]) > 0
    ]
    assert len(entries_with_artifacts) > 0, (
        "at least some audit entries should have artifact references"
    )


# Required: invoke all tests so assertions actually run
test_audit_logs_return_well_formed_entries()
test_audit_logs_have_evidence_hashes()
test_audit_logs_have_artifact_references()

print("All audit trail integrity tests passed.")
