import Dexie, { type Table, type Transaction } from "dexie";
import type { Game, Player } from "./engine/types";
import { isStandardPlay } from "./importers/standard";

export type StoredGame = Game & { id: string };

export type PlayerBase = Pick<Player, "id" | "source" | "username" | "displayName">;

/**
 * v2 (one-time cleanup): earlier versions stored variant games (crazyhouse, chess960,
 * King of the Hill, Three-check) that polluted the tree with illegal moves. Remove every
 * stored game that does not replay as standard chess and fix the players' counts.
 */
async function dropNonStandardGames(tx: Transaction): Promise<void> {
  const removed = new Map<string, number>();
  await tx
    .table("games")
    .toCollection()
    .modify((g: StoredGame, ref: { value?: StoredGame }) => {
      if (Array.isArray(g.moves) && isStandardPlay(g.moves, g.termination)) return;
      removed.set(g.playerId, (removed.get(g.playerId) ?? 0) + 1);
      delete ref.value;
    });
  for (const [id, n] of removed) {
    await tx
      .table("players")
      .where("id")
      .equals(id)
      .modify((p: Player) => {
        p.gameCount = Math.max(0, (p.gameCount ?? 0) - n);
      });
  }
}

export class CanopyDB extends Dexie {
  players!: Table<Player, string>;
  games!: Table<StoredGame, string>;
  constructor(name = "chess-canopy") {
    super(name);
    this.version(1).stores({
      players: "&id, source",
      games: "&id, playerId, date",
    });
    this.version(2)
      .stores({
        players: "&id, source",
        games: "&id, playerId, date",
      })
      .upgrade(dropNonStandardGames);
  }
}

export const db = new CanopyDB();

export const storedId = (playerId: string, gameId: string) => `${playerId}|${gameId}`;

function toRows(playerId: string, games: Game[]): StoredGame[] {
  const rows: StoredGame[] = [];
  const seen = new Set<string>();
  for (const g of games) {
    const id = storedId(playerId, g.game_id);
    if (seen.has(id)) continue;
    seen.add(id);
    rows.push({ ...g, playerId, id });
  }
  return rows;
}

/** Low-level: insert games not yet stored (by `${playerId}|${game_id}`). Does not touch players. */
export async function upsertGames(playerId: string, games: Game[]): Promise<{ added: number; duplicates: number }> {
  const rows = toRows(playerId, games);
  if (rows.length === 0) return { added: 0, duplicates: games.length };
  const existing = await db.games.bulkGet(rows.map((r) => r.id));
  const fresh = rows.filter((_, i) => !existing[i]);
  if (fresh.length) await db.games.bulkAdd(fresh);
  return { added: fresh.length, duplicates: games.length - fresh.length };
}

/**
 * Store a batch of games and create/update the player row in the same transaction, so a
 * crash or network error can never leave games without a player (which no UI could delete),
 * and concurrent imports for one player cannot race between the existence check and the add.
 */
export async function saveGames(player: PlayerBase, games: Game[]): Promise<{ added: number; duplicates: number }> {
  const rows = toRows(player.id, games);
  return db.transaction("rw", db.players, db.games, async () => {
    const existing = rows.length ? await db.games.bulkGet(rows.map((r) => r.id)) : [];
    const fresh = rows.filter((_, i) => !existing[i]);
    if (fresh.length) await db.games.bulkAdd(fresh);
    const cur = await db.players.get(player.id);
    const gameCount = await db.games.where("playerId").equals(player.id).count();
    await db.players.put({ lastSyncedAt: null, ...(cur ?? {}), ...player, gameCount } as Player);
    return { added: fresh.length, duplicates: games.length - fresh.length };
  });
}

/** Ids of every stored player. */
async function playerIds(): Promise<string[]> {
  return (await db.players.toCollection().primaryKeys()) as string[];
}

/** Ids of every stored player, in key order. */
export async function listPlayerIds(): Promise<string[]> {
  return playerIds();
}

/** Primary keys are `${playerId}|${gameId}`, so one player's games are one contiguous key range. */
const playerRange = (id: string) => db.games.where(":id").between(`${id}|`, `${id}|\uffff`, true, true);

/**
 * All games of one player. Reads the contiguous primary-key range directly, which is quicker than going through the
 * `playerId` index (that costs a second lookup per row); the order is the same (index order within a player is key order).
 */
export async function getPlayerGames(id: string): Promise<Game[]> {
  const rows = await playerRange(id).toArray();
  return rows.map((r) => {
    const g: Partial<StoredGame> = { ...r };
    delete g.id;
    return g as Game;
  });
}

/** Games of the given players; "all" means every *known* player (orphan rows are ignored). */
export async function getGamesForPlayers(ids: string[] | "all"): Promise<Game[]> {
  const list = ids === "all" ? await playerIds() : ids;
  const rows = list.length ? await db.games.where("playerId").anyOf(list).toArray() : [];
  return rows.map((r) => {
    const g: Partial<StoredGame> = { ...r };
    delete g.id;
    return g as Game;
  });
}

/** Delete games whose player row is missing (left behind by older versions). Returns the count. */
export async function deleteOrphanGames(): Promise<number> {
  return db.transaction("rw", db.players, db.games, async () => {
    const ids = await playerIds();
    return db.games.where("playerId").noneOf(ids).delete();
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
    // one range delete instead of collecting every key through the index first
    await playerRange(id).delete();
    await db.games.where("playerId").equals(id).delete(); // anything stored under a non-standard key
    await db.players.delete(id);
  });
}

/** Create or merge-update a player record. */
export async function updatePlayer(id: string, patch: Partial<Player>): Promise<void> {
  await db.transaction("rw", db.players, async () => {
    const cur = await db.players.get(id);
    if (cur) await db.players.put({ ...cur, ...patch, id });
    else await db.players.put({ id, ...patch } as Player);
  });
}
