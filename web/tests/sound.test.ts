import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { classifyMove, soundForStep } from "@/lib/sound";

describe("classifyMove", () => {
  it.each([
    ["e4", "move"],
    ["Nf3", "move"],
    ["exd5", "capture"],
    ["Bxf7", "capture"],
    ["Qh5+", "move"],
    ["Bxf7+", "capture"],
    ["Qxf7#", "mate"],
    ["Qh5#", "mate"],
    ["O-O", "castle"],
    ["O-O-O", "castle"],
    ["e8=Q", "promote"],
    ["exd8=N", "promote"],
    ["a1=Q+", "promote"],
    ["b8=Q#", "mate"],
  ] as const)("%s → %s", (san, kind) => expect(classifyMove(san)).toBe(kind));

  it("falls back to a plain move", () => {
    expect(classifyMove(undefined)).toBe("move");
    expect(classifyMove("")).toBe("move");
  });
});

describe("soundForStep", () => {
  const path = ["e4", "e5", "Nf3", "Nc6", "Bxc6", "dxc6"];
  const at = (cursor: number) => ({ cursor, path });

  it("is silent when the visible position did not change", () => {
    expect(soundForStep(at(2), at(2))).toBeNull();
  });
  it("plays the move's own sound, full volume, when stepping forward one ply", () => {
    expect(soundForStep(at(4), at(5))).toEqual({ kind: "capture", soft: false });
    expect(soundForStep(at(0), at(1))).toEqual({ kind: "move", soft: false });
  });
  it("plays a soft tap when stepping back", () => {
    expect(soundForStep(at(5), at(4))).toEqual({ kind: "move", soft: true });
    expect(soundForStep(at(1), at(0))).toEqual({ kind: "move", soft: true });
  });
  it("jumping forward is soft and uses the landing move; jumping to the start is a reset tick", () => {
    expect(soundForStep(at(0), at(5))).toEqual({ kind: "capture", soft: true });
    expect(soundForStep(at(5), at(0))).toEqual({ kind: "reset", soft: true });
    expect(soundForStep(at(5), at(2))).toEqual({ kind: "move", soft: true });
  });
  it("playing a new move that diverges still counts as one ply forward", () => {
    expect(soundForStep({ cursor: 2, path }, { cursor: 3, path: ["e4", "e5", "Qh5"] })).toEqual({ kind: "move", soft: false });
  });
});

/** A minimal fake Web Audio graph + fetch that counts which samples were started. */
function installFakeAudio() {
  const started: { at: number; rate: number; gain: number }[] = [];
  const fetched: string[] = [];
  const param = (v = 1) => ({ value: v });
  class FakeAudioContext {
    state = "running";
    currentTime = 0;
    destination = {};
    resume() {
      return Promise.resolve();
    }
    createDynamicsCompressor() {
      return { connect: (x: unknown) => x };
    }
    createGain() {
      const g = { gain: param(), connect: (x: unknown) => x };
      return g;
    }
    createBufferSource() {
      const node: Record<string, unknown> = {
        buffer: null,
        playbackRate: param(),
        connect: (g: { gain?: { value: number } }) => {
          node.gainNode = g;
          return { connect: () => ({}) };
        },
        start: (at: number) =>
          started.push({ at, rate: (node.playbackRate as { value: number }).value, gain: (node.gainNode as { gain: { value: number } }).gain.value }),
      };
      return node;
    }
    decodeAudioData(data: ArrayBuffer) {
      return Promise.resolve({ duration: 0.2, byteLength: data.byteLength });
    }
  }
  (globalThis as unknown as { window: unknown }).window = { AudioContext: FakeAudioContext };
  vi.stubGlobal("fetch", (url: string) => {
    fetched.push(url);
    return Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) });
  });
  return { started, fetched };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("playSound (recorded Lichess samples)", () => {
  let now = 1000;
  beforeEach(() => {
    vi.resetModules();
    now = 1000;
    vi.spyOn(performance, "now").mockImplementation(() => (now += 100));
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete (globalThis as { window?: unknown }).window;
  });

  it("does nothing, and never throws, without Web Audio", async () => {
    const { playSound, unlockSound } = await import("@/lib/sound");
    expect(() => playSound("move")).not.toThrow();
    expect(() => unlockSound()).not.toThrow();
  });

  it("each kind of move starts its own combination of recorded samples", async () => {
    const { started } = installFakeAudio();
    const { playSound, preloadSounds } = await import("@/lib/sound");
    await preloadSounds();
    const play = async (kind: Parameters<typeof playSound>[0], soft = false) => {
      started.length = 0;
      playSound(kind, { soft });
      await flush();
      return started.map((s) => ({ ...s }));
    };
    expect(await play("move")).toHaveLength(1);
    expect(await play("capture")).toHaveLength(1);
    const castle = await play("castle");
    expect(castle).toHaveLength(2); // king, then rook
    expect(castle[1].at).toBeGreaterThan(castle[0].at);
    const promote = await play("promote"); // three rising taps
    expect(promote).toHaveLength(3);
    expect(promote.map((p) => p.rate)).toEqual([1, 1.25, 1.5]);
    const mate = await play("mate"); // a heavy double thud, the second one lower
    expect(mate).toHaveLength(2);
    expect(mate[1].rate).toBeLessThan(1);
    const reset = await play("reset");
    expect(reset).toHaveLength(1);
    expect(reset[0].rate).toBeLessThan(1); // slower
    expect(reset[0].gain).toBeLessThan(0.6); // and quieter
  });

  it("defaults to Lichess's Standard theme, which has move and capture recordings", async () => {
    const { fetched } = installFakeAudio();
    const { preloadSounds, DEFAULT_SOUND_THEME } = await import("@/lib/sound");
    expect(DEFAULT_SOUND_THEME).toBe("standard");
    await preloadSounds();
    expect(fetched.sort()).toEqual(["Capture", "Move"].map((n) => `/sounds/standard/${n}.mp3`));
    // Never any game-over / victory / notification sample.
    expect(fetched.some((u) => /Victory|Defeat|Draw|GenericNotify/.test(u))).toBe(false);
  });

  it("loads the samples of the selected theme from /sounds/<theme>/ and switches themes", async () => {
    const { fetched } = installFakeAudio();
    const { preloadSounds, setSoundTheme } = await import("@/lib/sound");
    await preloadSounds();
    fetched.length = 0;
    setSoundTheme("piano");
    await flush();
    expect(fetched.every((u) => u.startsWith("/sounds/piano/"))).toBe(true);
    expect(fetched.sort()).toEqual(["Capture", "Move"].map((n) => `/sounds/piano/${n}.mp3`));
  });

  it("soft sounds are quieter", async () => {
    const { started } = installFakeAudio();
    const { playSound, preloadSounds } = await import("@/lib/sound");
    await preloadSounds();
    playSound("move");
    await flush();
    playSound("move", { soft: true });
    await flush();
    expect(started[1].gain).toBeLessThan(started[0].gain);
  });

  it("is silent when sounds are disabled", async () => {
    const { started } = installFakeAudio();
    const { playSound, setSoundsEnabled, preloadSounds } = await import("@/lib/sound");
    await preloadSounds();
    setSoundsEnabled(false);
    playSound("capture");
    await flush();
    expect(started).toHaveLength(0);
    setSoundsEnabled(true);
    playSound("capture");
    await flush();
    expect(started).toHaveLength(1);
  });

  it("survives a missing sample file", async () => {
    installFakeAudio();
    vi.stubGlobal("fetch", () => Promise.resolve({ ok: false, status: 404 }));
    const { playSound, preloadSounds } = await import("@/lib/sound");
    await expect(preloadSounds()).resolves.toBeUndefined();
    expect(() => playSound("move")).not.toThrow();
  });

  it("rate-limits a burst (held arrow key)", async () => {
    const { started } = installFakeAudio();
    vi.spyOn(performance, "now").mockReturnValue(5000);
    const { playSound, preloadSounds } = await import("@/lib/sound");
    await preloadSounds();
    playSound("move");
    playSound("move");
    playSound("move");
    await flush();
    expect(started).toHaveLength(1);
  });
});
