#!/usr/bin/env python3
"""Generate ElevenLabs voiceover + background music for the Arbitrum promo video."""
import json
import os
import subprocess
import sys
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[2]
VIDEO_DIR = ROOT / "videos" / "cognivern-arbitrum-promo"
AUDIO_DIR = VIDEO_DIR / "audio"
AUDIO_DIR.mkdir(parents=True, exist_ok=True)

API_KEY = os.environ.get("ELEVENLABS_API_KEY", "")
if not API_KEY:
    print("ERROR: set ELEVENLABS_API_KEY in your environment.")
    sys.exit(1)

VOICE_ID = "ykMqqjWs4pQdCIvGPn0z"  # Constance Lee — female, Chinese accent

# (frame, text, delivery_settings)
LINES = [
    (1, "AI agents are spending real money — autonomously.",
     {"stability": 0.35, "similarity_boost": 0.75, "style": 0.30, "use_speaker_boost": True}),
    (2, "No budgets. No audit trail. No human in the loop.",
     {"stability": 0.40, "similarity_boost": 0.75, "style": 0.25, "use_speaker_boost": True}),
    (3, "Introducing Cognivern — spend governance for AI agent wallets.",
     {"stability": 0.45, "similarity_boost": 0.80, "style": 0.20, "use_speaker_boost": True}),
    (4, "Every spend flows through policy evaluation — budgets encrypted on-chain with FHE, decisions provable to auditors.",
     {"stability": 0.40, "similarity_boost": 0.75, "style": 0.25, "use_speaker_boost": True}),
    (5, "A Gemini-powered agent enforces a strict protocol — plan, evidence, preview, confirm, execute, audit. Human-in-the-loop, before any real spend.",
     {"stability": 0.40, "similarity_boost": 0.75, "style": 0.30, "use_speaker_boost": True}),
    (6, "Deployed and verified on Arbitrum Sepolia and Robinhood Chain — FHE spend policies, governance, and execution vaults, all on-chain.",
     {"stability": 0.45, "similarity_boost": 0.80, "style": 0.20, "use_speaker_boost": True}),
    (7, "Cognivern — govern what your agents spend. Try the live demo at cognivern.vercel.app.",
     {"stability": 0.40, "similarity_boost": 0.75, "style": 0.35, "use_speaker_boost": True}),
]


def generate_voiceover():
    """Generate each voiceover line as a separate MP3, then concatenate."""
    line_files = []
    for frame, text, settings in LINES:
        out_path = AUDIO_DIR / f"vo-frame-{frame:02d}.mp3"
        if out_path.exists() and out_path.stat().st_size > 1000:
            print(f"  VO frame {frame} already exists ({out_path.stat().st_size} bytes), skipping")
            line_files.append(out_path)
            continue

        url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}"
        headers = {"xi-api-key": API_KEY, "Content-Type": "application/json"}
        body = {
            "text": text,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": settings,
        }
        print(f"  Generating VO frame {frame}: {text[:50]}...")
        resp = requests.post(url, headers=headers, json=body, timeout=60)
        if resp.status_code != 200:
            print(f"  ERROR ({resp.status_code}): {resp.text[:300]}")
            sys.exit(1)
        out_path.write_bytes(resp.content)
        print(f"  Saved {out_path} ({len(resp.content)} bytes)")
        line_files.append(out_path)

    # Concatenate all VO lines into one file with small gaps
    concat_list = AUDIO_DIR / "vo-concat.txt"
    concat_lines = []
    for i, f in enumerate(line_files):
        concat_lines.append(f"file '{f}'")
        if i < len(line_files) - 1:
            # Add a short silence between lines
            silence = AUDIO_DIR / f"silence-{i:02d}.mp3"
            subprocess.run([
                "ffmpeg", "-y", "-f", "lavfi", "-i",
                "anullsrc=channel_layout=mono:sample_rate=44100",
                "-t", "0.3", "-c:a", "libmp3lame", "-b:a", "128k", str(silence)
            ], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            concat_lines.append(f"file '{silence}'")

    concat_list.write_text("\n".join(concat_lines))
    full_vo = AUDIO_DIR / "voiceover.mp3"
    subprocess.run([
        "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat_list),
        "-c:a", "libmp3lame", "-b:a", "192k", str(full_vo)
    ], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    # Get duration
    result = subprocess.run([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", str(full_vo)
    ], capture_output=True, text=True)
    duration = float(result.stdout.strip())
    print(f"Full voiceover: {full_vo} ({duration:.1f}s)")
    return full_vo, duration


def generate_music(target_duration: float):
    """Generate background music via ElevenLabs sound generation."""
    music_path = AUDIO_DIR / "bgm.mp3"
    if music_path.exists() and music_path.stat().st_size > 1000:
        print(f"  BGM already exists ({music_path.stat().st_size} bytes), skipping")
        return music_path

    url = "https://api.elevenlabs.io/v1/sound-generation"
    headers = {"xi-api-key": API_KEY, "Content-Type": "application/json"}
    body = {
        "text": "modern electronic tech startup background music, upbeat but professional, clean synth pads, driving bass, corporate innovation, instrumental, no vocals, energetic confident",
        "duration_seconds": min(max(target_duration + 5, 30), 60),
        "loop": False,
        "prompt_influence": 0.5,
        "model_id": "eleven_text_to_sound_v2",
    }
    print(f"  Generating background music ({body['duration_seconds']}s)...")
    resp = requests.post(url, headers=headers, json=body, timeout=180)
    if resp.status_code != 200:
        print(f"  Music generation failed ({resp.status_code}): {resp.text[:300]}")
        return None
    music_path.write_bytes(resp.content)
    print(f"  Saved {music_path} ({len(resp.content)} bytes)")
    return music_path


def mix_audio(voiceover: Path, music: Path):
    """Mix voiceover with background music at a low volume."""
    mixed = AUDIO_DIR / "final-audio.mp3"
    if music and music.exists():
        cmd = [
            "ffmpeg", "-y",
            "-i", str(voiceover),
            "-i", str(music),
            "-filter_complex",
            "[1:a]volume=0.15,aloop=loop=-1:size=2e9[bg];"
            "[0:a][bg]amix=inputs=2:duration=first:dropout_transition=0:weights='1 0.2'[a]",
            "-map", "[a]",
            "-c:a", "libmp3lame", "-b:a", "192k",
            str(mixed),
        ]
    else:
        cmd = [
            "ffmpeg", "-y", "-i", str(voiceover),
            "-c:a", "libmp3lame", "-b:a", "192k", str(mixed),
        ]
    subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    result = subprocess.run([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", str(mixed)
    ], capture_output=True, text=True)
    duration = float(result.stdout.strip())
    print(f"Final mixed audio: {mixed} ({duration:.1f}s)")
    return mixed, duration


def main():
    print("=== Generating voiceover (Constance Lee — Asian female) ===")
    voiceover, vo_duration = generate_voiceover()

    print("\n=== Generating background music ===")
    music = generate_music(vo_duration)

    print("\n=== Mixing audio ===")
    final, final_duration = mix_audio(voiceover, music)

    # Write audio metadata for the composition
    meta = {
        "voiceover": str(voiceover.relative_to(VIDEO_DIR)),
        "music": str(music.relative_to(VIDEO_DIR)) if music else None,
        "final_audio": str(final.relative_to(VIDEO_DIR)),
        "voiceover_duration": vo_duration,
        "final_duration": final_duration,
        "voice": "Constance Lee (ElevenLabs) — female, Chinese accent",
        "voice_id": VOICE_ID,
    }
    meta_path = VIDEO_DIR / "audio_meta.json"
    meta_path.write_text(json.dumps(meta, indent=2))
    print(f"\nAudio metadata: {meta_path}")
    print(f"Total video duration target: {final_duration:.1f}s")


if __name__ == "__main__":
    main()
