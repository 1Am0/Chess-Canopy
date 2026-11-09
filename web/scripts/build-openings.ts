// Generates lib/openings/openings.json from the CC0 lichess-org/chess-openings TSVs.
// Skips when the file already exists unless --force is passed. The generated file is
// committed so builds do not depend on the network.
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE = "lichess-org/chess-openings (CC0)";
const BASE_URL = "https://raw.githubusercontent.com/lichess-org/chess-openings/master";
const LETTERS = ["a", "b", "c", "d", "e"] as const;
const target = fileURLToPath(new URL("../lib/openings/openings.json", import.meta.url));

type OpeningRow = [eco: string, name: string, moves: string];

/** Converts "1. e4 e5 2. Nf3" into "e4 e5 Nf3". Results and comments are dropped. */
export function pgnToSan(pgn: string): string {
  return pgn
    .replace(/\{[^}]*\}/g, " ")
    .split(/\s+/)
    .map((token) => token.replace(/^\d+\.+/, ""))
    .filter((token) => token.length > 0 && !["1-0", "0-1", "1/2-1/2", "*"].includes(token))
    .join(" ");
}

export function parseTsv(text: string): OpeningRow[] {
  const rows: OpeningRow[] = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines.slice(1)) {
    if (line.trim() === "") continue;
    const [eco, name, pgn] = line.split("\t");
    if (!eco || !name || pgn === undefined) continue;
    const moves = pgnToSan(pgn);
    if (moves === "") continue;
    rows.push([eco.trim(), name.trim(), moves]);
  }
  return rows;
}

async function fetchTsv(letter: string): Promise<string> {
  const url = `${BASE_URL}/${letter}.tsv`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} failed: HTTP ${res.status}`);
  return res.text();
}

async function main(): Promise<void> {
  const force = process.argv.includes("--force");
  if (existsSync(target) && !force) {
    console.log("openings.json present, skipping generation (pass --force to rebuild)");
    return;
  }

  const openings: OpeningRow[] = [];
  for (const letter of LETTERS) {
    const rows = parseTsv(await fetchTsv(letter));
    console.log(`${letter}.tsv: ${rows.length} openings`);
    openings.push(...rows);
  }

  const payload = { source: SOURCE, openings };
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(payload) + "\n", "utf8");
  console.log(`wrote ${openings.length} openings to ${target}`);
}

// Run only when executed directly, not when imported by tests.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
