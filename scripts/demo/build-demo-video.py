#!/usr/bin/env python3
"""Build a ~90s dynamic demo video from screenshot captures + narration."""
import os
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
SHOTS_DIR = ROOT / ".artifacts" / "demo-shots"
PROC_DIR = ROOT / ".artifacts" / "demo-processed"
ARTIFACTS_DIR = ROOT / ".artifacts"
OUTPUT = ROOT / "docs" / "demo-video.mp4"
AUDIO = ARTIFACTS_DIR / "demo-narration.aiff"
FONT = Path("/System/Library/Fonts/Helvetica.ttc")

NARRATION = """Cognivern. Private sealed-bid RFPs and OTC selection on Canton Network.

Institutional RFPs leak pricing. Email RFPs let competitors band. Procurement portals centralize unblinding, creating counterparty risk. OTC desks won't quote tight spreads if print levels leak.

Canton fixes this structurally. In our Daml model, each bid is signatory bidder plus observer manager only. CloseAndReveal selects the winner, archives every losing bid in flight, and emits the AuctionResult in one atomic transaction.

Here is the live product on Canton DevNet. We create a private round, submit three bids, and prove competitors cannot read each other's amounts.

Create a Canton-backed round. Alice bids $91,000. Bob bids $74,500. Charlie bids $108,000.

Toggle the party view. Alice sees only Alice. Bob sees only Bob. Charlie sees only Charlie. The auctioneer sees all three. This disclosure happens inside the Canton participant node, not our backend.

The auctioneer closes bidding and reveals the winner atomically. Bob wins at $74,500. Losing amounts are never disclosed.

That is structural privacy, end-to-end tested on Canton DevNet. Try the demo at cognivern dot vercel dot app slash sealed-bid."""

SCENES = [
    ("00-intro.png", 5, ""),
    ("01-landing.png", 5, "Cognivern — private sealed-bid RFPs on Canton Network"),
    ("02-round-empty.png", 5, "Create a Canton-backed private round"),
    ("03-bid-alice.png", 6, "Alice submits $91,000"),
    ("04-bid-bob.png", 6, "Bob submits $74,500"),
    ("05-bid-charlie.png", 6, "Charlie submits $108,000"),
    ("06-view-alice.png", 6, "Alice sees only her own bid"),
    ("07-view-bob.png", 6, "Bob sees only his own bid"),
    ("08-view-auctioneer.png", 7, "The auctioneer sees every bid"),
    ("09-closed.png", 6, "Close bidding — one atomic reveal"),
    ("10-revealed.png", 12, "Bob wins. Losing amounts stay private."),
    ("99-outro.png", 6, ""),
]

FPS = 25
CANVAS_W, CANVAS_H = 1280, 720


def generate_narration():
    script_file = ARTIFACTS_DIR / "demo-narration.txt"
    script_file.write_text(NARRATION, encoding="utf-8")
    subprocess.run(["say", "-f", str(script_file), "-o", str(AUDIO)], check=True)
    print(f"Narration saved to {AUDIO}")


def overlay_caption(image_path: Path, caption: str, out_path: Path):
    img = Image.open(image_path).convert("RGBA")
    img = img.resize((CANVAS_W, CANVAS_H), Image.Resampling.LANCZOS)

    # Font sizing
    size = 32
    font = None
    while size >= 18:
        try:
            font = ImageFont.truetype(str(FONT), size)
        except Exception:
            font = ImageFont.load_default(size)
        bbox = img.getbbox()
        if bbox is None:
            bbox = (0, 0, CANVAS_W, CANVAS_H)
        draw_tmp = ImageDraw.Draw(Image.new("RGBA", (CANVAS_W, CANVAS_H)))
        text_bbox = draw_tmp.textbbox((0, 0), caption, font=font, spacing=4)
        text_w = text_bbox[2] - text_bbox[0]
        if text_w <= CANVAS_W - 80:
            break
        size -= 2

    overlay = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    text_bbox = draw.textbbox((0, 0), caption, font=font, spacing=4)
    text_w, text_h = text_bbox[2] - text_bbox[0], text_bbox[3] - text_bbox[1]
    pad_x, pad_y = 24, 14
    box_w, box_h = text_w + pad_x * 2, text_h + pad_y * 2
    x = (CANVAS_W - box_w) // 2
    y = CANVAS_H - box_h - 40

    # rounded dark bar
    draw.rounded_rectangle([x, y, x + box_w, y + box_h], radius=16, fill=(0, 0, 0, 180))
    draw.text((x + pad_x, y + pad_y - text_bbox[1]), caption, font=font, fill=(255, 255, 255, 255), spacing=4)

    composited = Image.alpha_composite(img, overlay).convert("RGB")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    composited.save(out_path, quality=95)


def make_card(text_lines: list[str], filename: str):
    img = Image.new("RGBA", (CANVAS_W, CANVAS_H), (11, 15, 47, 255))
    draw = ImageDraw.Draw(img)

    # Accent bar at top
    draw.rectangle([0, 0, CANVAS_W, 8], fill=(2, 195, 154, 255))

    y = CANVAS_H // 2 - (len(text_lines) * 45) // 2
    for i, line in enumerate(text_lines):
        size = 54 if i == 0 else 32
        font = ImageFont.truetype(str(FONT), size) if FONT.exists() else ImageFont.load_default(size)
        bbox = draw.textbbox((0, 0), line, font=font, spacing=4)
        text_w = bbox[2] - bbox[0]
        x = (CANVAS_W - text_w) // 2
        draw.text((x, y), line, font=font, fill=(255, 255, 255, 255), spacing=4)
        y += size + 24

    out = PROC_DIR / filename
    img.convert("RGB").save(out, quality=95)
    print(f"Generated card {out}")


def build_clip(processed: Path, duration: float, index: int, zoom: bool = True) -> Path:
    clip = ARTIFACTS_DIR / f"demo-clip-{index+1:02d}.mp4"
    frames = int(round(duration * FPS))
    if zoom:
        zoom_step = (1.08 - 1.0) / frames
        zoom_expr = f"'if(eq(in,0),1.0,min(1.08,zoom+{zoom_step}))'"
        vf = f"zoompan=z={zoom_expr}:d={frames}:s={CANVAS_W}x{CANVAS_H}:fps={FPS},format=yuv420p"
    else:
        vf = "format=yuv420p"
    cmd = [
        "ffmpeg", "-y", "-loop", "1", "-i", str(processed),
        "-t", str(duration), "-vf", vf,
        "-r", str(FPS), "-c:v", "libx264", "-preset", "fast", "-crf", "23",
        "-pix_fmt", "yuv420p", "-an", str(clip),
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    print(f"Built clip {index + 1}: {clip}")
    return clip


def main():
    PROC_DIR.mkdir(parents=True, exist_ok=True)
    generate_narration()

    # Intro and outro title cards
    make_card(["Cognivern", "Private sealed-bid RFPs on Canton Network", "Track 1 · Private DeFi & Capital Markets"], "00-intro.png")
    make_card(["Structural privacy, live on Canton DevNet", "cognivern.vercel.app/sealed-bid", "github.com/thisyearnofear/cognivern"], "99-outro.png")

    clips = []
    for i, (filename, duration, caption) in enumerate(SCENES):
        processed = PROC_DIR / filename
        is_card = filename.startswith("00-") or filename.startswith("99-")
        if not is_card:
            overlay_caption(SHOTS_DIR / filename, caption, processed)
        # Cards: no Ken Burns zoom; product shots: subtle zoom.
        clips.append(build_clip(processed, duration, i, zoom=not is_card))

    concat_file = ARTIFACTS_DIR / "demo-concat.txt"
    concat_file.write_text("\n".join(f"file '{c}'" for c in clips), encoding="utf-8")

    cmd = [
        "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat_file),
        "-i", str(AUDIO),
        "-c:v", "libx264", "-preset", "fast", "-crf", "23", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "128k",
        str(OUTPUT),
    ]
    print(f"Muxing final video to {OUTPUT}")
    subprocess.run(cmd, check=True)
    size_mb = OUTPUT.stat().st_size / 1e6
    print(f"Demo video saved to {OUTPUT} ({size_mb:.1f} MB)")


if __name__ == "__main__":
    main()
