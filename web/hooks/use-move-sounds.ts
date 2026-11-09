"use client";

import { useEffect } from "react";
import { useExplorerStore } from "@/lib/store";
import { playSound, setSoundTheme, setSoundsEnabled, soundForStep, unlockSound, type LineState } from "@/lib/sound";

/**
 * Plays a sound whenever the visible position in the line changes (a move played from
 * the board or the table, stepping with the arrows or the strip, jumping to the start).
 * Each kind of move sounds different; see lib/sound.ts.
 *
 * Nothing plays until the app has loaded and the first user gesture has unlocked audio,
 * so restoring a ?line= URL or the saved session stays silent.
 */
export function useMoveSounds() {
  const soundEnabled = useExplorerStore((s) => s.soundEnabled);
  const ready = useExplorerStore((s) => s.ready);

  const soundTheme = useExplorerStore((s) => s.soundTheme);

  useEffect(() => setSoundsEnabled(soundEnabled), [soundEnabled]);
  useEffect(() => setSoundTheme(soundTheme), [soundTheme]);

  // Browsers only allow audio after a user gesture.
  useEffect(() => {
    const unlock = () => unlockSound();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    let armed = false;
    let prev: LineState = { cursor: 0, path: [] };
    // Let the initial restore (URL line, persisted state) settle before listening.
    const timer = setTimeout(() => {
      armed = true;
      const s = useExplorerStore.getState();
      prev = { cursor: s.cursor, path: s.path };
    }, 600);
    const unsubscribe = useExplorerStore.subscribe((s) => {
      const next: LineState = { cursor: s.cursor, path: s.path };
      const before = prev;
      prev = next;
      if (!armed) return;
      const sound = soundForStep(before, next);
      if (sound) playSound(sound.kind, { soft: sound.soft });
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [ready]);
}
