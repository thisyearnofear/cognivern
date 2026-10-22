"""Test Cognivern API speech transcription endpoint.

Verifies input validation and service availability checks for the
speech-to-text endpoint powered by ElevenLabs.
"""
import time
import requests

BASE = __import__("os").environ.get("ENDPOINT_URL", "https://api.cognivern.persidian.com").rstrip("/")

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



def test_speech_transcribe_missing_audio():
    """POST /api/speech/transcribe without audio returns 400 (validation)
    or 503 (service not configured). Both indicate the endpoint is reachable."""
    r = _request("POST", f"{BASE}/api/speech/transcribe", json={}, timeout=15)
    assert r.status_code in (400, 503), (
        f"expected 400 or 503, got {r.status_code}: {r.text[:200]}"
    )
    body = r.json()
    assert body.get("success") is False


def test_speech_transcribe_invalid_audio():
    """POST /api/speech/transcribe with non-base64 audio returns 400
    or 503 (service not configured)."""
    r = _request("POST", 
        f"{BASE}/api/speech/transcribe",
        json={"audio": "not-valid-base64!@#"},
        timeout=15,
    )
    assert r.status_code in (400, 503), (
        f"expected 400 or 503, got {r.status_code}: {r.text[:200]}"
    )
    body = r.json()
    assert body.get("success") is False


def test_speech_transcribe_empty_audio():
    """POST /api/speech/transcribe with empty audio buffer returns 400
    or 503 (service not configured)."""
    r = _request("POST", 
        f"{BASE}/api/speech/transcribe",
        json={"audio": ""},
        timeout=15,
    )
    assert r.status_code in (400, 503), (
        f"expected 400 or 503, got {r.status_code}: {r.text[:200]}"
    )


# Required: invoke all tests so assertions actually run
test_speech_transcribe_missing_audio()
test_speech_transcribe_invalid_audio()
test_speech_transcribe_empty_audio()

print("All speech transcription tests passed.")
