/**
 * Tiny procedural sound engine (Web Audio). Everything is synthesised at
 * runtime, so there are no audio files to license or download.
 *
 * `initSfx()` only creates the audio context (enough for UI sounds, e.g. on the launch screen).
 * `initAudio()` additionally starts the background music.
 */
import { attachMusic, disposeMusic } from "./music";

type Kind = "zone" | "skill" | "achievement" | "message";
type Ui = "open" | "close" | "click" | "hover" | "tab" | "success" | "whoosh" | "launch";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let musicStarted = false;
let muted = false;

const MASTER_LEVEL = 0.6;

function createContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return AC ? new AC() : null;
}

function ensureContext(): AudioContext | null {
  if (!ctx) {
    ctx = createContext();
    if (!ctx) return null;
    master = ctx.createGain();
    master.gain.value = muted ? 0 : MASTER_LEVEL;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** UI sounds only (no music). Must be called from a user gesture. */
export function initSfx() {
  ensureContext();
}

/** UI sounds + background music. Must be called from a user gesture (browsers block audio until then). */
export function initAudio() {
  const c = ensureContext();
  if (!c || !master) return;
  if (!musicStarted) {
    musicStarted = true;
    attachMusic(c, master);
  }
}

export function setMuted(next: boolean) {
  muted = next;
  if (ctx && master) master.gain.setTargetAtTime(next ? 0 : MASTER_LEVEL, ctx.currentTime, 0.05);
}

export function disposeAudio() {
  disposeMusic();
  musicStarted = false;
  if (ctx) void ctx.close();
  ctx = null;
  master = null;
  noise = null;
}

function tone(freq: number, delay: number, dur: number, type: OscillatorType, vol: number, slideTo?: number) {
  if (!ctx || !master || muted) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

/** Filtered noise that sweeps from one frequency to another (whooshes, swipes). */
function sweep(delay: number, dur: number, fromHz: number, toHz: number, vol: number) {
  if (!ctx || !master || muted) return;
  if (!noise) {
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t0 = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = "bandpass";
  f.Q.value = 1.1;
  f.frequency.setValueAtTime(fromHz, t0);
  f.frequency.exponentialRampToValueAtTime(toHz, t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + dur * 0.35);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
}

export const sfx: Record<Kind | Ui, () => void> = {
  skill() {
    tone(880, 0, 0.12, "sine", 0.22, 1320);
    tone(1320, 0.06, 0.16, "sine", 0.16);
  },
  zone() {
    [523.25, 659.25, 783.99].forEach((f, i) => tone(f, i * 0.09, 0.28, "triangle", 0.2));
  },
  achievement() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.1, 0.4, "triangle", 0.22));
    tone(2093, 0.4, 0.5, "sine", 0.09);
  },
  message() {
    [659.25, 880, 1318.5].forEach((f, i) => tone(f, i * 0.07, 0.22, "sine", 0.16));
  },
  open() {
    tone(320, 0, 0.2, "sine", 0.12, 640);
    sweep(0, 0.22, 500, 2400, 0.05);
  },
  close() {
    tone(640, 0, 0.18, "sine", 0.1, 320);
    sweep(0, 0.2, 2200, 450, 0.04);
  },
  /** Crisp button press. */
  click() {
    tone(1700, 0, 0.04, "square", 0.03, 800);
    tone(360, 0, 0.07, "sine", 0.1, 230);
  },
  /** Very quiet tick when the pointer moves onto a control. */
  hover() {
    tone(2600, 0, 0.025, "sine", 0.016);
  },
  /** Tabs, filters, toggles. */
  tab() {
    tone(720, 0, 0.07, "triangle", 0.1, 1080);
    tone(1440, 0.03, 0.05, "sine", 0.04);
  },
  /** Downloads, copy, saved. */
  success() {
    [784, 988, 1319].forEach((f, i) => tone(f, i * 0.07, 0.18, "triangle", 0.14));
  },
  whoosh() {
    sweep(0, 0.7, 260, 4200, 0.2);
  },
  /** Starting Tour / Explore from the launch screen. */
  launch() {
    sweep(0, 1.1, 220, 5200, 0.24);
    tone(110, 0, 1.0, "sawtooth", 0.04, 440);
    [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.18 + i * 0.1, 0.35, "triangle", 0.13));
  },
};
