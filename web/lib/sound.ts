/**
 * Sound feedback, synthesised with the Web Audio API (no audio files to ship or to allow
 * in the CSP). Each kind of move has its own sound:
 *
 *   move      a soft wooden tap
 *   capture   a sharper, double tap
 *   castle    two taps (king, then rook)
 *   check     a tap with a bright two-note ping
 *   promote   a tap with a rising arpeggio
 *   mate      a heavy tap with a low, ringing chord
 *   illegal   a short low buzz (a refused move)
 *   reset     a faint low tick (jumping back to the start)
 *   done      a pleasant two-note chime (import finished)
 *
 * The AudioContext is created lazily on the first user gesture (browsers refuse to play
 * before one). Everything is a no-op without Web Audio (SSR, old browsers, tests).
 */

export type SoundKind = "move" | "capture" | "castle" | "check" | "promote" | "mate" | "illegal" | "reset" | "done";

/** What kind of sound a SAN move makes. Mate beats check, check beats castling, then promotion, then capture. */
export function classifyMove(san: string | undefined): SoundKind {
  if (!san) return "move";
  if (san.includes("#")) return "mate";
  if (san.includes("+")) return "check";
  if (san.startsWith("O-O") || san.startsWith("0-0")) return "castle";
  if (san.includes("=")) return "promote";
  if (san.includes("x")) return "capture";
  return "move";
}

export interface LineState {
  cursor: number;
  path: string[];
}

/**
 * The sound for a change of the visible position in the line, or null for none.
 * Stepping forward plays that move's own sound; stepping back and jumps are softer.
 */
export function soundForStep(prev: LineState, next: LineState): { kind: SoundKind; soft: boolean } | null {
  const d = next.cursor - prev.cursor;
  if (d === 0) return null;
  if (d === 1) return { kind: classifyMove(next.path[next.cursor - 1]), soft: false };
  if (d === -1) return { kind: "move", soft: true };
  if (d > 1) return { kind: classifyMove(next.path[next.cursor - 1]), soft: true };
  return { kind: next.cursor === 0 ? "reset" : "move", soft: true };
}

let enabled = true;
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let lastPlayed = 0;

export function setSoundsEnabled(value: boolean): void {
  enabled = value;
}

type AudioContextCtor = typeof AudioContext;

function audioContext(): AudioContext | null {
  if (ctx) return ctx;
  if (typeof window === "undefined") return null;
  const Ctor: AudioContextCtor | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
    // A compressor keeps rapid sequences (holding an arrow key) from clipping.
    const comp = ctx.createDynamicsCompressor();
    master = ctx.createGain();
    master.gain.value = 0.7;
    master.connect(comp);
    comp.connect(ctx.destination);
    return ctx;
  } catch {
    return null;
  }
}

/** Create/resume the context. Call from a user gesture. */
export function unlockSound(): void {
  const c = audioContext();
  if (c && c.state === "suspended") void c.resume().catch(() => {});
}

function noiseBuffer(c: AudioContext): AudioBuffer {
  if (noise) return noise;
  const len = Math.floor(c.sampleRate * 0.12);
  noise = c.createBuffer(1, len, c.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
  return noise;
}

/** One percussive "piece on wood" hit: a filtered noise click plus a short low thump. */
function tap(c: AudioContext, t: number, o: { noiseHz: number; thumpHz: number; gain: number; dur: number }) {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  const band = c.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = o.noiseHz;
  band.Q.value = 1.1;
  const ng = c.createGain();
  ng.gain.setValueAtTime(0.0001, t);
  ng.gain.exponentialRampToValueAtTime(o.gain, t + 0.002);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  src.connect(band).connect(ng).connect(master!);
  src.start(t);
  src.stop(t + o.dur + 0.02);

  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(o.thumpHz, t);
  osc.frequency.exponentialRampToValueAtTime(o.thumpHz * 0.55, t + o.dur);
  const og = c.createGain();
  og.gain.setValueAtTime(0.0001, t);
  og.gain.exponentialRampToValueAtTime(o.gain * 0.8, t + 0.003);
  og.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  osc.connect(og).connect(master!);
  osc.start(t);
  osc.stop(t + o.dur + 0.02);
}

/** A pitched note with a quick attack and an exponential decay. */
function tone(c: AudioContext, t: number, o: { hz: number; gain: number; dur: number; type?: OscillatorType }) {
  const osc = c.createOscillator();
  osc.type = o.type ?? "sine";
  osc.frequency.value = o.hz;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  osc.connect(g).connect(master!);
  osc.start(t);
  osc.stop(t + o.dur + 0.02);
}

function buzz(c: AudioContext, t: number, vol: number) {
  for (const at of [0, 0.11]) {
    const osc = c.createOscillator();
    osc.type = "square";
    osc.frequency.value = 130;
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 520;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t + at);
    g.gain.exponentialRampToValueAtTime(0.16 * vol, t + at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + at + 0.09);
    osc.connect(lp).connect(g).connect(master!);
    osc.start(t + at);
    osc.stop(t + at + 0.11);
  }
}

/** Play a sound. `soft` scales the volume down (stepping back, jumps). */
export function playSound(kind: SoundKind, opts: { soft?: boolean } = {}): void {
  if (!enabled) return;
  const c = audioContext();
  if (!c || !master) return;
  if (c.state === "suspended") void c.resume().catch(() => {});
  // Holding an arrow key repeats ~30 times a second: keep it a pleasant patter.
  const now = performance.now();
  if (now - lastPlayed < 28) return;
  lastPlayed = now;

  const v = opts.soft ? 0.55 : 1;
  const t = c.currentTime + 0.005;
  switch (kind) {
    case "move":
      tap(c, t, { noiseHz: 1800, thumpHz: 230, gain: 0.5 * v, dur: 0.07 });
      break;
    case "capture":
      tap(c, t, { noiseHz: 2700, thumpHz: 270, gain: 0.85 * v, dur: 0.1 });
      tap(c, t + 0.04, { noiseHz: 1500, thumpHz: 180, gain: 0.45 * v, dur: 0.08 });
      break;
    case "castle":
      tap(c, t, { noiseHz: 1600, thumpHz: 210, gain: 0.5 * v, dur: 0.07 });
      tap(c, t + 0.12, { noiseHz: 2000, thumpHz: 250, gain: 0.5 * v, dur: 0.07 });
      break;
    case "check":
      tap(c, t, { noiseHz: 2100, thumpHz: 240, gain: 0.55 * v, dur: 0.08 });
      tone(c, t + 0.05, { hz: 988, gain: 0.16 * v, dur: 0.22 });
      tone(c, t + 0.13, { hz: 1319, gain: 0.14 * v, dur: 0.28 });
      break;
    case "promote":
      tap(c, t, { noiseHz: 2000, thumpHz: 240, gain: 0.5 * v, dur: 0.07 });
      [523.25, 659.25, 783.99, 1046.5].forEach((hz, i) => tone(c, t + 0.06 + i * 0.07, { hz, gain: 0.14 * v, dur: 0.25, type: "triangle" }));
      break;
    case "mate":
      tap(c, t, { noiseHz: 2300, thumpHz: 200, gain: 0.9 * v, dur: 0.12 });
      tone(c, t + 0.05, { hz: 196, gain: 0.28 * v, dur: 0.95 });
      tone(c, t + 0.05, { hz: 293.66, gain: 0.2 * v, dur: 0.85 });
      tone(c, t + 0.05, { hz: 392, gain: 0.12 * v, dur: 0.7 });
      break;
    case "illegal":
      buzz(c, t, v);
      break;
    case "reset":
      tap(c, t, { noiseHz: 900, thumpHz: 140, gain: 0.35 * v, dur: 0.09 });
      break;
    case "done":
      tone(c, t, { hz: 659.25, gain: 0.18 * v, dur: 0.22, type: "triangle" });
      tone(c, t + 0.1, { hz: 987.77, gain: 0.18 * v, dur: 0.34, type: "triangle" });
      break;
  }
}
