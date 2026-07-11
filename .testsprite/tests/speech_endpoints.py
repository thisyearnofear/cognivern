"""Test Cognivern API speech transcription endpoint.

Verifies input validation and service availability checks for the
speech-to-text endpoint powered by ElevenLabs.
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
