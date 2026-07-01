"""Test Cognivern API speech transcription endpoint.

Verifies input validation and service availability checks for the
speech-to-text endpoint powered by ElevenLabs.
"""
import requests

BASE = ENDPOINT_URL.rstrip("/")


def test_speech_transcribe_missing_audio():
    """POST /api/speech/transcribe without audio returns 400 (validation)
    or 503 (service not configured). Both indicate the endpoint is reachable."""
    r = requests.post(f"{BASE}/api/speech/transcribe", json={}, timeout=15)
    assert r.status_code in (400, 503), (
        f"expected 400 or 503, got {r.status_code}: {r.text[:200]}"
    )
    body = r.json()
    assert body.get("success") is False


def test_speech_transcribe_invalid_audio():
    """POST /api/speech/transcribe with non-base64 audio returns 400
    or 503 (service not configured)."""
    r = requests.post(
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
    r = requests.post(
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
