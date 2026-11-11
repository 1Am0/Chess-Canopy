/**
 * Cross-tab notifications (BroadcastChannel). Every tab has its own worker with its own
 * cached games, so a tab that imports, syncs or deletes tells the others to drop their
 * caches and reload the player list. One channel object is used for both posting and
 * listening (a channel never hears its own messages).
 */
const NAME = "chess-canopy";

type Message = { type: "data-changed" };

let channel: BroadcastChannel | null | undefined;
const listeners = new Set<() => void>();

function getChannel(): BroadcastChannel | null {
  if (channel !== undefined) return channel;
  channel = null;
  try {
    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel(NAME);
      channel.onmessage = (ev: MessageEvent<Message>) => {
        if (ev.data?.type !== "data-changed") return;
        for (const cb of [...listeners]) {
          try {
            cb();
          } catch {
            /* a listener must not break the others */
          }
        }
      };
    }
  } catch {
    channel = null;
  }
  return channel;
}

/** Tell the other tabs that the stored games or players changed. */
export function broadcastDataChanged(): void {
  try {
    getChannel()?.postMessage({ type: "data-changed" } satisfies Message);
  } catch {
    /* closed channel or unsupported: single-tab behaviour */
  }
}

/** Called when ANOTHER tab changed the data; returns an unsubscribe function. */
export function onDataChanged(cb: () => void): () => void {
  getChannel();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Tests only: simulate a message from another tab. */
export function emitDataChangedForTests(): void {
  for (const cb of [...listeners]) cb();
}
