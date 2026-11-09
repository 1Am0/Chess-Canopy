import Dexie, { type Table } from "dexie";
import type { Game, Player } from "./engine/types";

export type StoredGame = Game & { id: string };

class CanopyDB extends Dexie {
  players!: Table<Player, string>;
  games!: Table<StoredGame, string>;
  constructor() {
    super("chess-canopy");
    this.version(1).stores({
      players: "&id, source",
      games: "&id, playerId, date",
    });
  }
}

export const db = new CanopyDB();

export const storedId = (playerId: string, gameId: string) => `${playerId}|${gameId}`;

/** Insert games not yet stored (by `${playerId}|${game_id}`). */
export async function upsertGames(playerId: string, games: Game[]): Promise<{ added: number; duplicates: number }> {
  const rows: StoredGame[] = [];
  const seen = new Set<string>();
  for (const g of games) {
    const id = storedId(playerId, g.game_id);
    if (seen.has(id)) continue;
    seen.add(id);
    rows.push({ ...g, playerId, id });
  }
  if (rows.length === 0) return { added: 0, duplicates: games.length };
  const existing = await db.games.bulkGet(rows.map((r) => r.id));
  const fresh = rows.filter((_, i) => !existing[i]);
  if (fresh.length) await db.games.bulkAdd(fresh);
  return { added: fresh.length, duplicates: games.length - fresh.length };
}

export async function getGamesForPlayers(ids: string[] | "all"): Promise<Game[]> {
  let rows: StoredGame[];
  if (ids === "all") rows = await db.games.toArray();
  else if (ids.length === 0) rows = [];
  else rows = await db.games.where("playerId").anyOf(ids).toArray();
  return rows.map((r) => {
    const g: Partial<StoredGame> = { ...r };
    delete g.id;
    return g as Game;
  });
}

export async function countGames(playerId: string): Promise<number> {
  return db.games.where("playerId").equals(playerId).count();
}

export async function listPlayers(): Promise<Player[]> {
  return db.players.toArray();
}

export async function getPlayer(id: string): Promise<Player | undefined> {
  return db.players.get(id);
}

export async function deletePlayer(id: string): Promise<void> {
  await db.transaction("rw", db.players, db.games, async () => {
    await db.games.where("playerId").equals(id).delete();
    await db.players.delete(id);
  });
}

/** Create or merge-update a player record. */
export async function updatePlayer(id: string, patch: Partial<Player>): Promise<void> {
  const cur = await db.players.get(id);
  if (cur) await db.players.put({ ...cur, ...patch, id });
  else await db.players.put({ id, ...patch } as Player);
}
