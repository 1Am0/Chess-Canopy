import data from "./openings.json";

export type OpeningMatch = { eco: string; name: string; family?: string };

type Entry = { eco: string; name: string; family?: string };

let index: Map<string, Entry> | null = null;

/** Strips annotation suffixes such as "+", "#", "!?" from a SAN token. */
function normalizeSan(token: string): string {
  return token.replace(/[!?+#]+$/g, "");
}

function buildIndex(): Map<string, Entry> {
  const map = new Map<string, Entry>();
  for (const [eco, name, line] of data.openings as [string, string, string][]) {
    // Keys are normalized like the query ("Bb5+" -> "Bb5"); check marks follow from the
    // position, so normalized keys stay unique. Keep the first row when two share a line.
    const moves = line.split(" ").map(normalizeSan).join(" ");
    if (map.has(moves)) continue;
    const colon = name.indexOf(":");
    const entry: Entry = { eco, name };
    if (colon > 0) entry.family = name.slice(0, colon).trim();
    map.set(moves, entry);
  }
  return map;
}

function getIndex(): Map<string, Entry> {
  if (index === null) index = buildIndex();
  return index;
}

/**
 * Returns the longest opening whose move sequence is a prefix of `moves`
 * (SAN tokens, no move numbers), or null when even the first move is unknown.
 */
export function lookupOpening(moves: string[]): OpeningMatch | null {
  if (moves.length === 0) return null;
  const map = getIndex();

  // Build every prefix key in one pass, then check from the longest down.
  const keys: string[] = [];
  let key = "";
  for (let i = 0; i < moves.length; i++) {
    const token = normalizeSan(moves[i]);
    key = i === 0 ? token : `${key} ${token}`;
    keys.push(key);
  }

  for (let i = keys.length - 1; i >= 0; i--) {
    const entry = map.get(keys[i]);
    if (entry) return { ...entry };
  }
  return null;
}

/** Number of opening rows in the bundled dataset. */
export function openingCount(): number {
  return (data.openings as unknown[]).length;
}
