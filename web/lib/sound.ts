/**
 * Sound feedback using recorded chess sounds from Lichess (lichess-org/lila, public/sound).
 * The mp3 files are fetched lazily on the first user gesture and played through the Web
 * Audio API for low latency. Only the two *piece* sounds (Move, Capture) are used.
 * Lichess's game-over / victory / notification sounds are deliberately NOT bundled, so
 * nothing here can be mistaken for a Lichess game ending.
 *
 * Each kind of move gets its own treatment, built from those recordings:
 *
 *   move      the recorded move sound
 *   capture   the recorded capture sound
 *   castle    the move sound twice, evenly spaced (king, then rook)
 *   promote   three rising taps
 *   mate      a heavy double thud: the capture sound, then a lower one
 *   reset     a slower, quieter move sound (jumping back to the start)
 *
 * One set is bundled: standard (the Lichess default). Everything is a no-op without Web Audio (SSR, old browsers, tests).
 */

export type SoundKind = "move" | "capture" | "castle" | "promote" | "mate" | "reset";

/** What kind of sound a SAN move makes. Checks sound like the underlying move. Mate beats castling, then promotion, then capture. */
export function classifyMove(san: string | undefined): SoundKind {
  if (!san) return "move";
  if (san.includes("#")) return "mate";
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
let lastPlayed = 0;
const buffers = new Map<string, Promise<AudioBuffer | null>>();

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
    master.gain.value = 0.9;
    master.connect(comp);
    comp.connect(ctx.destination);
    return ctx;
  } catch {
    return null;
  }
}

const SAMPLES = ["Move", "Capture"] as const;
type Sample = (typeof SAMPLES)[number];

/** Fetch + decode one sample (cached; null if it cannot be loaded). */
function sample(name: Sample): Promise<AudioBuffer | null> {
  const c = audioContext();
  if (!c) return Promise.resolve(null);
  const key = name;
  let p = buffers.get(key);
  if (!p) {
    p = fetch(`/sounds/standard/${name}.mp3`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((data) => c.decodeAudioData(data))
      .catch(() => {
        buffers.delete(key); // allow a retry later
        return null;
      });
    buffers.set(key, p);
  }
  return p;
}

/** Load every sample. Resolves when they are all ready. */
export async function preloadSounds(): Promise<void> {
  await Promise.all(SAMPLES.map((n) => sample(n)));
}

/** Create/resume the context and start loading the samples. Call from a user gesture. */
export function unlockSound(): void {
  const c = audioContext();
  if (!c) return;
  if (c.state === "suspended") void c.resume().catch(() => {});
  void preloadSounds();
}

/** Play one sample `at` seconds from now, with a volume and playback rate. */
function hit(name: Sample, o: { at?: number; gain?: number; rate?: number } = {}): void {
  void sample(name).then((buf) => {
    const c = ctx;
    if (!buf || !c || !master || !enabled) return;
    const src = c.createBufferSource();
    src.buffer = buf;
    if (o.rate) src.playbackRate.value = o.rate;
    const g = c.createGain();
    g.gain.value = o.gain ?? 1;
    src.connect(g).connect(master);
    src.start(c.currentTime + (o.at ?? 0));
  });
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
  switch (kind) {
    case "move":
      hit("Move", { gain: v });
      break;
    case "capture":
      hit("Capture", { gain: v });
      break;
    case "castle":
      hit("Move", { gain: v });
      hit("Move", { at: 0.13, gain: 0.85 * v });
      break;
    case "promote":
      hit("Move", { gain: v });
      hit("Move", { at: 0.07, gain: 0.85 * v, rate: 1.25 });
      hit("Move", { at: 0.14, gain: 0.8 * v, rate: 1.5 });
      break;
    case "mate":
      hit("Capture", { gain: v });
      hit("Capture", { at: 0.12, gain: 0.9 * v, rate: 0.75 });
      break;
    case "reset":
      hit("Move", { gain: 0.45 * v, rate: 0.75 });
      break;
  }
}
