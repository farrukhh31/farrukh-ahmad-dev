/**
 * Generative background music, synthesised live with Web Audio (no audio files to license or download).
 *
 * Three styles, switchable from the HUD music button or Settings:
 *  - Lo-fi chill: swung drums, warm electric-piano chords, soft bass and a wandering melody.
 *  - Synthwave:   four-on-the-floor kick, driving saw bass and a bright arpeggio.
 *  - Ambient:     the original slow pads with a sparse music-box melody, no drums.
 * Everything runs through a shared reverb and echo, so it sits quietly under the game and the tour.
 */

export type MusicTrack = "lofi" | "synth" | "calm";

export const MUSIC_TRACKS: { id: MusicTrack; label: string; hint: string }[] = [
  { id: "lofi", label: "Lo-fi chill", hint: "Warm keys and a soft beat" },
  { id: "synth", label: "Synthwave", hint: "Upbeat night-drive arpeggios" },
  { id: "calm", label: "Ambient", hint: "Slow pads, no drums" },
];

export interface MusicPref {
  on: boolean;
  /** 0..1 */
  vol: number;
  track: MusicTrack;
}

const KEY = "farrukh-music";
const DEFAULT_PREF: MusicPref = { on: true, vol: 0.7, track: "lofi" };
let pref: MusicPref = DEFAULT_PREF;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<MusicPref>;
      pref = {
        on: p.on !== false,
        vol: typeof p.vol === "number" ? Math.min(1, Math.max(0, p.vol)) : DEFAULT_PREF.vol,
        track: MUSIC_TRACKS.some((t) => t.id === p.track) ? (p.track as MusicTrack) : DEFAULT_PREF.track,
      };
    }
  } catch {
    /* storage blocked: use defaults */
  }
}

function commit(next: MusicPref) {
  pref = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  applyPref();
  listeners.forEach((l) => l());
}

export function subscribeMusic(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
export function getMusicPref(): MusicPref {
  load();
  return pref;
}
export const getServerMusicPref = (): MusicPref => DEFAULT_PREF;

export function setMusicOn(on: boolean) {
  load();
  commit({ ...pref, on });
}
export function setMusicVolume(vol: number) {
  load();
  commit({ ...pref, vol: Math.min(1, Math.max(0, vol)) });
}
/** Pick a style (and switch the music on). */
export function setMusicTrack(track: MusicTrack) {
  load();
  commit({ ...pref, track, on: true });
}
/** Lo-fi -> Synthwave -> Ambient -> off -> Lo-fi ... (used by the HUD music button). */
export function cycleMusic() {
  load();
  if (!pref.on) return commit({ ...pref, on: true, track: "lofi" });
  const i = MUSIC_TRACKS.findIndex((t) => t.id === pref.track);
  if (i >= MUSIC_TRACKS.length - 1) return commit({ ...pref, on: false });
  commit({ ...pref, track: MUSIC_TRACKS[i + 1].id });
}

/* ------------------------------- the engine ------------------------------- */

const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const LEVEL = 0.9;

let ctx: AudioContext | null = null;
let bus: GainNode | null = null;
let dryIn: GainNode | null = null;
let reverbIn: GainNode | null = null;
let echoIn: GainNode | null = null;
// per-track sends: faded out when the style changes so old notes never bleed into the new one
let tDry: GainNode | null = null;
let tRev: GainNode | null = null;
let tEcho: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let active: MusicTrack | null = null;
let nextT = 0;
let stepNo = 0;
let melody = 3;
let duck = 1;

function impulse(c: AudioContext, seconds: number) {
  const len = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
  }
  return buf;
}

/** Called once by the audio engine when the AudioContext exists. */
export function attachMusic(c: AudioContext, master: GainNode) {
  if (ctx === c) return;
  ctx = c;
  bus = c.createGain();
  bus.gain.value = 0;
  bus.connect(master);

  dryIn = c.createGain();
  dryIn.connect(bus);

  const conv = c.createConvolver();
  conv.buffer = impulse(c, 3.2);
  const wet = c.createGain();
  wet.gain.value = 0.6;
  conv.connect(wet).connect(bus);
  reverbIn = c.createGain();
  reverbIn.connect(conv);

  // soft echo that feeds the reverb
  const delay = c.createDelay(2);
  delay.delayTime.value = 0.75;
  const fb = c.createGain();
  fb.gain.value = 0.36;
  const echoTone = c.createBiquadFilter();
  echoTone.type = "lowpass";
  echoTone.frequency.value = 2200;
  echoIn = c.createGain();
  echoIn.connect(delay);
  delay.connect(echoTone).connect(fb).connect(delay);
  echoTone.connect(reverbIn);
  echoTone.connect(dryIn);

  noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

  applyPref();
}

function closeTrackBus() {
  const c = ctx;
  for (const g of [tDry, tRev, tEcho]) {
    if (!g || !c) continue;
    g.gain.setTargetAtTime(0, c.currentTime, 0.12);
    setTimeout(() => g.disconnect(), 1500);
  }
  tDry = tRev = tEcho = null;
}

function openTrackBus() {
  if (!ctx || !dryIn || !reverbIn || !echoIn) return;
  closeTrackBus();
  tDry = ctx.createGain();
  tDry.connect(dryIn);
  tRev = ctx.createGain();
  tRev.connect(reverbIn);
  tEcho = ctx.createGain();
  tEcho.connect(echoIn);
}

function route(node: AudioNode, reverb: number, echo = 0) {
  if (!ctx || !tDry || !tRev || !tEcho) return;
  node.connect(tDry);
  if (reverb > 0) {
    const g = ctx.createGain();
    g.gain.value = reverb;
    node.connect(g).connect(tRev);
  }
  if (echo > 0) {
    const g = ctx.createGain();
    g.gain.value = echo;
    node.connect(g).connect(tEcho);
  }
}

/* ---- instruments ---- */

function kick(t: number, v = 1) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(46, t + 0.13);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.42 * v, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  o.connect(g);
  route(g, 0.02);
  o.start(t);
  o.stop(t + 0.34);
}

function noiseHit(t: number, dur: number, type: BiquadFilterType, freq: number, q: number, vol: number, rev: number) {
  if (!ctx || !noiseBuf) return;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g);
  route(g, rev);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.05);
}

function snare(t: number, v = 1) {
  noiseHit(t, 0.2, "bandpass", 1900, 0.8, 0.15 * v, 0.35);
  if (!ctx) return;
  const o = ctx.createOscillator();
  o.type = "triangle";
  o.frequency.setValueAtTime(220, t);
  o.frequency.exponentialRampToValueAtTime(140, t + 0.09);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.09 * v, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  o.connect(g);
  route(g, 0.2);
  o.start(t);
  o.stop(t + 0.15);
}

function hat(t: number, v = 1, open = false) {
  noiseHit(t, open ? 0.2 : 0.05, "highpass", 7200, 0.5, 0.05 * v, 0.06);
}

/** Warm electric-piano-ish note. */
function keys(midi: number, t: number, dur: number, vol: number) {
  if (!ctx) return;
  const c = ctx;
  const f = hz(midi);
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 2100;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  lp.connect(g);
  const parts: [OscillatorType, number, number][] = [["sine", 1, 1], ["triangle", 1, 0.35], ["sine", 2, 0.16]];
  for (const [type, mult, gain] of parts) {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = f * mult;
    const og = c.createGain();
    og.gain.value = gain;
    o.connect(og).connect(lp);
    o.start(t);
    o.stop(t + dur + 0.1);
  }
  route(g, 0.5, 0.15);
}

function bass(midi: number, t: number, dur: number, type: OscillatorType, vol: number, cutoff: number) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = hz(midi);
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = cutoff;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(f).connect(g);
  route(g, 0.04);
  o.start(t);
  o.stop(t + dur + 0.05);
}

/** Bright detuned saw with a closing filter. */
function arp(midi: number, t: number, dur: number, vol: number) {
  if (!ctx) return;
  const c = ctx;
  const f = c.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.setValueAtTime(3400, t);
  f.frequency.exponentialRampToValueAtTime(900, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  f.connect(g);
  for (const d of [-8, 8]) {
    const o = c.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = hz(midi);
    o.detune.value = d;
    o.connect(f);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  route(g, 0.35, 0.4);
}

function pad(notes: number[], t: number, len: number, vol: number, cutoff: number, types: [OscillatorType, OscillatorType] = ["triangle", "sine"]) {
  if (!ctx) return;
  const c = ctx;
  const end = t + len + 2;
  for (const m of notes) {
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = cutoff;
    f.Q.value = 0.3;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + Math.min(2.6, len * 0.3));
    g.gain.setValueAtTime(vol, t + len - 0.4);
    g.gain.linearRampToValueAtTime(0.0001, end);
    f.connect(g);
    route(g, 0.65);
    types.forEach((type, i) => {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = hz(m);
      o.detune.value = i === 0 ? -5 : 6;
      o.connect(f);
      o.start(t);
      o.stop(end + 0.1);
    });
  }
}

function pluck(midi: number, t: number, vel = 1) {
  if (!ctx) return;
  const c = ctx;
  const f = hz(midi);
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 3200;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.085 * vel, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 3.4);
  filter.connect(g);
  route(g, 0.85, 0.5);
  const a = c.createOscillator();
  a.type = "sine";
  a.frequency.value = f;
  const b = c.createOscillator();
  b.type = "triangle";
  b.frequency.value = f * 2;
  const bGain = c.createGain();
  bGain.gain.value = 0.3;
  a.connect(filter);
  b.connect(bGain).connect(filter);
  a.start(t);
  b.start(t);
  a.stop(t + 3.5);
  b.stop(t + 3.5);
}

/* ---- the three styles. Every track is 16 steps per bar; `step` is called once per step. ---- */

interface TrackDef {
  bpm: number;
  swing: number;
  trim: number;
  step: (s: number, bar: number, t: number, sd: number) => void;
}

// Lo-fi: Dm9 - G13 - Cmaj9 - Am9
const LOFI = [
  { bass: 38, keys: [53, 57, 60, 64] },
  { bass: 43, keys: [53, 57, 59, 64] },
  { bass: 36, keys: [55, 59, 62, 64] },
  { bass: 33, keys: [55, 60, 64, 67] },
];
const D_MINOR_PENT = [62, 65, 67, 69, 72, 74, 77];

// Synthwave: Am - F - C - G
const SYNTH = [
  { bass: 45, tones: [57, 60, 64, 69], pad: [57, 60, 64] },
  { bass: 41, tones: [53, 57, 60, 65], pad: [53, 57, 60] },
  { bass: 48, tones: [60, 64, 67, 72], pad: [55, 60, 64] },
  { bass: 43, tones: [55, 59, 62, 67], pad: [55, 59, 62] },
];
const ARP_PATTERN = [0, 1, 2, 3, 2, 1, 2, 3];

// Ambient: Am7 - Fmaj7 - Cmaj7 - G6, one chord every 8 seconds
const CALM = [
  { bass: 45, pad: [57, 60, 64, 67] },
  { bass: 41, pad: [53, 57, 60, 64] },
  { bass: 48, pad: [52, 55, 59, 60] },
  { bass: 43, pad: [50, 55, 59, 62] },
];
const C_PENT = [72, 74, 76, 79, 81, 84, 86];

const TRACKS: Record<MusicTrack, TrackDef> = {
  lofi: {
    bpm: 76,
    swing: 0.28,
    trim: 1,
    step(s, bar, t, sd) {
      const ch = LOFI[bar % LOFI.length];
      if (s === 0) {
        ch.keys.forEach((m, i) => keys(m, t + i * 0.014, sd * 7, 0.034));
        bass(ch.bass, t, sd * 6, "sine", 0.17, 420);
      }
      if (s === 6) ch.keys.slice(1).forEach((m, i) => keys(m, t + i * 0.012, sd * 3.5, 0.022));
      if (s === 10) bass(ch.bass + 7, t, sd * 3, "sine", 0.1, 420);
      if (s === 0 || s === 10) kick(t, s === 0 ? 1 : 0.75);
      if (s === 4 || s === 12) snare(t, 0.8);
      if (s % 2 === 0) hat(t, 0.6 + (s % 4 === 0 ? 0.3 : 0), s === 14);
      if (s % 4 === 2 && Math.random() < 0.3) {
        melody = Math.min(D_MINOR_PENT.length - 1, Math.max(0, melody + Math.round((Math.random() - 0.5) * 4)));
        keys(D_MINOR_PENT[melody] + 12, t, sd * 5, 0.022);
      }
    },
  },
  synth: {
    bpm: 100,
    swing: 0,
    trim: 0.8,
    step(s, bar, t, sd) {
      const ch = SYNTH[bar % SYNTH.length];
      if (s === 0) pad(ch.pad, t, sd * 16, 0.011, 800, ["sawtooth", "triangle"]);
      if (s % 2 === 0) bass(ch.bass + (s % 8 === 6 ? 12 : 0), t, sd * 1.7, "sawtooth", 0.07, 540);
      const note = ch.tones[ARP_PATTERN[s % 8]] + (s >= 8 ? 12 : 0);
      arp(note, t, sd * 1.8, s % 2 === 0 ? 0.026 : 0.017);
      if (s % 4 === 0) kick(t, 0.85);
      if (s === 4 || s === 12) snare(t, 0.9);
      if (s % 4 === 2) hat(t, 0.8, true);
    },
  },
  calm: {
    bpm: 30, // 16 steps x 0.5 s = one 8-second chord
    swing: 0,
    trim: 1,
    step(s, bar, t) {
      const ch = CALM[bar % CALM.length];
      if (s === 0) {
        pad(ch.pad, t, 8, 0.019, 950);
        bass(ch.bass, t, 8, "sine", 0.11, 600);
      }
      if (s % 4 === 3 && s > 0 && Math.random() < 0.62) {
        melody = Math.min(C_PENT.length - 1, Math.max(0, melody + Math.round((Math.random() - 0.5) * 4)));
        pluck(C_PENT[melody], t, 0.7 + Math.random() * 0.5);
      }
    },
  },
};

function schedule() {
  if (!ctx || !active) return;
  const def = TRACKS[active];
  const sd = 60 / def.bpm / 4;
  const horizon = ctx.currentTime + 2;
  while (nextT < horizon) {
    const s = stepNo % 16;
    const bar = Math.floor(stepNo / 16);
    def.step(s, bar, nextT + (s % 2 === 1 ? sd * def.swing : 0), sd);
    stepNo++;
    nextT += sd;
  }
}

function startTrack(track: MusicTrack) {
  if (!ctx) return;
  openTrackBus();
  active = track;
  stepNo = 0;
  melody = 3;
  nextT = ctx.currentTime + 0.2;
  schedule();
}

function level() {
  return pref.on ? pref.vol * LEVEL * duck * TRACKS[pref.track].trim : 0;
}

function applyPref() {
  if (!ctx || !bus) return;
  if (pref.on) {
    if (!timer) timer = setInterval(schedule, 250);
    if (active !== pref.track || !tDry) startTrack(pref.track);
    bus.gain.setTargetAtTime(level(), ctx.currentTime, 1.2); // slow fade in
  } else {
    bus.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    active = null;
    closeTrackBus();
  }
}

/** Lower the music while a panel or dialog is open so it never competes with reading. */
export function duckMusic(on: boolean) {
  duck = on ? 0.35 : 1;
  if (ctx && bus && pref.on) bus.gain.setTargetAtTime(level(), ctx.currentTime, 0.35);
}

export function disposeMusic() {
  if (timer) clearInterval(timer);
  timer = null;
  active = null;
  ctx = null;
  bus = null;
  dryIn = null;
  reverbIn = null;
  echoIn = null;
  tDry = tRev = tEcho = null;
  noiseBuf = null;
}
