let audioContext: AudioContext | null = null;
let masterGain: GainNode | null = null;
let soundEnabled = false;
let gestureSeen = false;

if (typeof window !== "undefined") {
  const markGesture = () => {
    gestureSeen = true;
  };
  window.addEventListener("pointerdown", markGesture, { once: true, capture: true });
  window.addEventListener("keydown", markGesture, { once: true, capture: true });
}

/** Pure gate chain, exported so the mute-by-default contract is testable. */
export function tactileSoundAllowed({
  enabled,
  hasUserGesture,
  reducedMotion,
}: {
  enabled: boolean;
  hasUserGesture: boolean;
  reducedMotion: boolean;
}) {
  return enabled && hasUserGesture && !reducedMotion;
}

export function setSoundEnabled(enabled: boolean) {
  soundEnabled = enabled;
}

export function isSoundEnabled() {
  return soundEnabled;
}

function reducedMotionPreferred() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function userGestureSeen() {
  return navigator.userActivation?.hasBeenActive ?? gestureSeen;
}

function audio() {
  if (
    typeof window === "undefined" ||
    !tactileSoundAllowed({
      enabled: soundEnabled,
      hasUserGesture: userGestureSeen(),
      reducedMotion: reducedMotionPreferred(),
    })
  ) {
    return null;
  }
  if (!audioContext) {
    const AudioCtor =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return null;
    audioContext = new AudioCtor();
    masterGain = audioContext.createGain();
    masterGain.gain.value = 0.1;
    masterGain.connect(audioContext.destination);
  }
  if (audioContext.state === "suspended") void audioContext.resume().catch(() => {});
  return { context: audioContext, output: masterGain! };
}

/** Create/resume the context inside the settings toggle click. */
export function primeTactileSound() {
  audio();
}

function tone(
  frequency: number,
  endFrequency: number,
  duration: number,
  filterType: BiquadFilterType,
  filterFrequency: number,
  delay = 0,
) {
  const nodes = audio();
  if (!nodes) return;
  const { context, output } = nodes;
  const start = context.currentTime + delay;
  const osc = context.createOscillator();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(frequency, start);
  osc.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
  filter.type = filterType;
  filter.frequency.value = filterFrequency;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(1, start + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(filter).connect(gain).connect(output);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function noiseBurst(duration: number, highpassFrequency: number) {
  const nodes = audio();
  if (!nodes) return;
  const { context, output } = nodes;
  const length = Math.max(1, Math.ceil(context.sampleRate * duration));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  source.buffer = buffer;
  filter.type = "highpass";
  filter.frequency.value = highpassFrequency;
  gain.gain.value = 0.8;
  source.connect(filter).connect(gain).connect(output);
  source.start();
}

/** 12ms threshold-tick detent. */
export function playDetent() {
  noiseBurst(0.012, 1800);
}

/** Semantic stamp: weighted thud for terminal outcomes, double-chime for held. */
export function playStamp(outcome: "approved" | "held" | "stopped") {
  if (outcome === "held") {
    tone(520, 520, 0.045, "lowpass", 1800);
    tone(760, 760, 0.05, "lowpass", 2200, 0.055);
    return;
  }
  const stopped = outcome === "stopped";
  tone(stopped ? 115 : 145, stopped ? 52 : 68, stopped ? 0.11 : 0.085, "lowpass", stopped ? 320 : 430);
}

/** 20ms latch click for sealing or revealing a bid. */
export function playSeal() {
  noiseBurst(0.02, 2500);
}
