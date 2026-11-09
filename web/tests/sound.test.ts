import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { classifyMove, soundForStep } from "@/lib/sound";

describe("classifyMove", () => {
  it.each([
    ["e4", "move"],
    ["Nf3", "move"],
    ["exd5", "capture"],
    ["Bxf7", "capture"],
    ["Qh5+", "check"],
    ["Bxf7+", "check"],
    ["Qxf7#", "mate"],
    ["Qh5#", "mate"],
    ["O-O", "castle"],
    ["O-O-O", "castle"],
    ["e8=Q", "promote"],
    ["exd8=N", "promote"],
    ["a1=Q+", "check"],
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

/** A minimal fake Web Audio graph that counts what each sound creates. */
function installFakeAudio() {
  const created = { osc: 0, noise: 0, gain: 0 };
  const node = () => {
    const n: Record<string, unknown> = {
      connect: (x: unknown) => x ?? n,
      start: () => {},
      stop: () => {},
      gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      frequency: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      Q: { value: 1 },
    };
    return n;
  };
  class FakeAudioContext {
    state = "running";
    currentTime = 0;
    sampleRate = 8000;
    destination = node();
    resume() {
      return Promise.resolve();
    }
    createDynamicsCompressor() {
      return node();
    }
    createGain() {
      created.gain++;
      return node();
    }
    createBiquadFilter() {
      return node();
    }
    createOscillator() {
      created.osc++;
      return node();
    }
    createBufferSource() {
      created.noise++;
      return node();
    }
    createBuffer(_c: number, len: number) {
      return { getChannelData: () => new Float32Array(len) };
    }
  }
  (globalThis as unknown as { window: unknown }).window = { AudioContext: FakeAudioContext };
  return created;
}

describe("playSound", () => {
  let now = 1000;
  beforeEach(() => {
    vi.resetModules();
    now = 1000;
    vi.spyOn(performance, "now").mockImplementation(() => (now += 100));
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as { window?: unknown }).window;
  });

  it("does nothing, and never throws, without Web Audio", async () => {
    const { playSound } = await import("@/lib/sound");
    expect(() => playSound("move")).not.toThrow();
  });

  it("each kind of move sounds different (different graphs)", async () => {
    const created = installFakeAudio();
    const { playSound } = await import("@/lib/sound");
    const shape = (kind: Parameters<typeof playSound>[0]) => {
      const before = { ...created };
      playSound(kind);
      return `${created.osc - before.osc}/${created.noise - before.noise}`;
    };
    const shapes = new Map<string, string>();
    for (const kind of ["move", "capture", "castle", "check", "promote", "mate", "illegal", "reset", "done"] as const) shapes.set(kind, shape(kind));
    expect(shapes.get("move")).toBe("1/1");
    expect(shapes.get("capture")).toBe("2/2");
    expect(shapes.get("castle")).toBe("2/2");
    expect(shapes.get("check")).toBe("3/1");
    expect(shapes.get("promote")).toBe("5/1");
    expect(shapes.get("mate")).toBe("4/1");
    expect(shapes.get("illegal")).toBe("2/0");
    expect(shapes.get("done")).toBe("2/0");
    // Kinds with the same node count (capture/castle, illegal/done) differ in pitch and timing,
    // but every other kind has its own graph.
    const distinct = new Set(["move", "check", "promote", "mate", "capture"].map((k) => shapes.get(k)));
    expect(distinct.size).toBe(5);
  });

  it("is silent when sounds are disabled", async () => {
    const created = installFakeAudio();
    const { playSound, setSoundsEnabled } = await import("@/lib/sound");
    setSoundsEnabled(false);
    playSound("capture");
    expect(created.osc + created.noise).toBe(0);
    setSoundsEnabled(true);
    playSound("capture");
    expect(created.osc + created.noise).toBeGreaterThan(0);
  });

  it("rate-limits a burst (held arrow key)", async () => {
    const created = installFakeAudio();
    vi.spyOn(performance, "now").mockReturnValue(5000);
    const { playSound } = await import("@/lib/sound");
    playSound("move");
    const first = created.osc;
    playSound("move");
    playSound("move");
    expect(created.osc).toBe(first);
  });
});
