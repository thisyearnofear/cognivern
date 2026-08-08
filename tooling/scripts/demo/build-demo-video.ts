import { execSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

const shotsDir = path.join(process.cwd(), ".artifacts", "demo-shots");
const artifactsDir = path.join(process.cwd(), ".artifacts");
const outputPath = path.join(process.cwd(), "docs", "demo-video.mp4");
const audioPath = path.join(artifactsDir, "demo-narration.aiff");
const narrationText = `Cognivern. Private sealed-bid RFPs and OTC selection on Canton Network.

Institutional RFPs leak pricing. Email RFPs let competitors band. Procurement portals centralize unblinding, creating counterparty risk. OTC desks won't quote tight spreads if print levels leak.

Canton fixes this structurally. In our Daml model, each bid is signatory bidder plus observer manager only. CloseAndReveal selects the winner, archives every losing bid in flight, and emits the AuctionResult in one atomic transaction.

Here is the live product on Canton DevNet. We create a private round, submit three bids, and prove competitors cannot read each other's amounts.

Create a Canton-backed round. Alice bids $91,000. Bob bids $74,500. Charlie bids $108,000.

Toggle the party view. Alice sees only Alice. Bob sees only Bob. Charlie sees only Charlie. The auctioneer sees all three. This disclosure happens inside the Canton participant node, not our backend.

The auctioneer closes bidding and reveals the winner atomically. Bob wins at $74,500. Losing amounts are never disclosed.

That is structural privacy, end-to-end tested on Canton DevNet. Try the demo at cognivern dot vercel dot app slash sealed-bid.`;

interface Scene {
  file: string;
  duration: number;
  caption: string;
}

const scenes: Scene[] = [
  { file: "01-landing.png", duration: 6, caption: "Cognivern — private sealed-bid RFPs on Canton Network" },
  { file: "02-round-empty.png", duration: 6, caption: "Create a Canton-backed private round" },
  { file: "03-bid-alice.png", duration: 7, caption: "Alice submits $91,000" },
  { file: "04-bid-bob.png", duration: 7, caption: "Bob submits $74,500" },
  { file: "05-bid-charlie.png", duration: 7, caption: "Charlie submits $108,000" },
  { file: "06-view-alice.png", duration: 7, caption: "Alice sees only her own bid" },
  { file: "07-view-bob.png", duration: 7, caption: "Bob sees only his own bid" },
  { file: "08-view-auctioneer.png", duration: 8, caption: "The auctioneer sees every bid" },
  { file: "09-closed.png", duration: 7, caption: "Close bidding — one atomic reveal" },
  { file: "10-revealed.png", duration: 14, caption: "Bob wins. Losing amounts stay private." },
];

const fontPath = "/System/Library/Fonts/Helvetica.ttc";
const fps = 25;

async function generateNarration() {
  const scriptFile = path.join(artifactsDir, "demo-narration.txt");
  await fs.writeFile(scriptFile, narrationText, "utf-8");
  execSync(`say -f ${scriptFile} -o ${audioPath}`, { stdio: "inherit" });
  console.log(`Narration saved to ${audioPath}`);
}

function buildClip(scene: Scene, index: number, clipPath: string) {
  const input = path.join(shotsDir, scene.file);
  const totalFrames = Math.round(scene.duration * fps);
  const zoomStart = 1.0;
  const zoomEnd = 1.08;
  const zoomExpr = `'if(eq(in,0),${zoomStart},min(${zoomEnd},zoom+${(zoomEnd - zoomStart) / totalFrames}))'`;
  const drawtext = `drawtext=fontfile=${fontPath}:text='${scene.caption.replace(/'/g, "'\\''")}':fontcolor=white:fontsize=28:x=(w-text_w)/2:y=h-text_h-40:box=1:boxcolor=black@0.5:boxborderw=8:enable='between(t,0,${scene.duration})'`;
  const vf = `zoompan=z=${zoomExpr}:d=${totalFrames}:s=1280x720:fps=${fps},format=yuv420p,fade=t=in:st=0:d=0.4,fade=t=out:st=${scene.duration - 0.4}:d=0.4,${drawtext}`;
  const cmd = `ffmpeg -y -loop 1 -i ${input} -t ${scene.duration} -vf "${vf}" -r ${fps} -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p -an ${clipPath}`;
  console.log(`Building clip ${index + 1}: ${scene.file}`);
  execSync(cmd, { stdio: "pipe" });
}

async function buildVideo() {
  await fs.mkdir(artifactsDir, { recursive: true });
  await generateNarration();

  const clips: string[] = [];
  for (let i = 0; i < scenes.length; i++) {
    const clipPath = path.join(artifactsDir, `demo-clip-${String(i + 1).padStart(2, "0")}.mp4`);
    buildClip(scenes[i], i, clipPath);
    clips.push(clipPath);
  }

  // Concatenate clips with crossfade using xfade for smoother transitions.
  const inputs = clips.map((c) => `-i ${c}`).join(" ");
  const totalDuration = scenes.reduce((sum, s) => sum + s.duration, 0);
  const transitionDuration = 0.4;
  const n = scenes.length;
  // offsets for xfade: each clip starts after previous minus transition overlap.
  let filter = "";
  let currentOffset = 0;
  for (let i = 0; i < n - 1; i++) {
    currentOffset += scenes[i].duration - transitionDuration;
    const prev = i === 0 ? "0:v" : `[v${i}]`;
    const next = `${i + 1}:v`;
    const out = i === n - 2 ? "[outv]" : `[v${i + 1}]`;
    filter += `[${prev}][${next}]xfade=transition=fade:duration=${transitionDuration}:offset=${currentOffset.toFixed(2)}${out};`;
  }
  // Audio: loop or pad to match video. Video will match audio duration if audio is longer.
  const audioDuration = Number(execSync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ${audioPath}`).toString().trim());
  const videoDuration = totalDuration - (n - 1) * transitionDuration;
  const padDuration = Math.max(0, audioDuration - videoDuration);

  // Build final command.
  // If audio is longer than video, extend last frame. We use -shortest? No, we want audio length.
  // Approach: create video loop from concatenated clips then trim/pad to audio length.
  const concatFile = path.join(artifactsDir, "demo-concat.txt");
  await fs.writeFile(
    concatFile,
    clips.map((c) => `file '${c}'`).join("\n"),
    "utf-8",
  );

  // First concatenate, then loop the whole thing if needed? Simpler: just concat and add audio.
  // If audio longer, the video will freeze on last frame (ffmpeg default when not using -shortest).
  const cmd = `ffmpeg -y -f concat -safe 0 -i ${concatFile} -i ${audioPath} -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p -c:a aac -b:a 128k ${outputPath}`;
  console.log(`Muxing final video to ${outputPath}`);
  execSync(cmd, { stdio: "inherit" });

  const stat = await fs.stat(outputPath);
  console.log(`Demo video saved to ${outputPath} (${(stat.size / 1e6).toFixed(1)} MB)`);
}

buildVideo().catch((err) => {
  console.error(err);
  process.exit(1);
});
