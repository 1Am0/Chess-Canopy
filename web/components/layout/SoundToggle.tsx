"use client";

import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useExplorerStore } from "@/lib/store";
import { RAIL_LABEL_LG } from "@/components/layout/rail";
import { playSound, unlockSound } from "@/lib/sound";

/** Header button: mute / unmute the move sounds. */
export function SoundToggle({ className, label }: { className?: string; label?: string }) {
  const on = useExplorerStore((s) => s.soundEnabled);
  const setOn = useExplorerStore((s) => s.setSoundEnabled);
  return (
    <Button
      variant="chit"
      size="icon"
      className={className}
      aria-label="Move sounds"
      aria-pressed={on}
      title={on ? "Move sounds on (click to mute)" : "Move sounds off (click to unmute)"}
      onClick={() => {
        unlockSound();
        setOn(!on);
        if (!on) playSound("move"); // a tap confirms that sound is back on
      }}
    >
      {on ? <Volume2 /> : <VolumeX />}
      {label && <span className={RAIL_LABEL_LG}>{label}</span>}
    </Button>
  );
}
