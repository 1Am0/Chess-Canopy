import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import Dexie from "dexie";
import { CanopyDB } from "@/lib/db";

const game = (id: string, moves: string[], termination = "") => ({
  id: `json:hero|${id}`, game_id: id, playerId: "json:hero", moves, result: "1-0", color: "white", date: "2024-01-01",
  opponent: "x", my_rating: null, opponent_rating: null, time_control: "blitz", time_control_raw: "", termination, url: "", source: "json",
});

describe("DB v2 migration (C4 cleanup of stored variant games)", () => {
  it("removes non-standard games stored by v1 and fixes the player's count", async () => {
    const name = "canopy-migration-test";
    const v1 = new Dexie(name);
    v1.version(1).stores({ players: "&id, source", games: "&id, playerId, date" });
    await v1.open();
    await v1.table("players").put({ id: "json:hero", source: "json", username: "hero", displayName: "hero", gameCount: 5, lastSyncedAt: 1 });
    await v1.table("games").bulkAdd([
      game("ok1", ["e4", "e5", "Nf3"]),
      game("ok2", ["d4", "d5"]),
      game("zh", ["e4", "d5", "exd5", "Qxd5", "N@f3"]),
      game("koth", ["e4", "e5", "Ke2", "Nc6", "Ke3"], "hero won by the king reaching the hill"),
      game("960", ["Nge7"]),
    ]);
    v1.close();

    const v2 = new CanopyDB(name);
    await v2.open();
    expect(v2.verno).toBe(2);
    expect((await v2.games.toArray()).map((g) => g.game_id).sort()).toEqual(["ok1", "ok2"]);
    expect((await v2.players.get("json:hero"))?.gameCount).toBe(2);
    v2.close();
    await Dexie.delete(name);
  });
});
