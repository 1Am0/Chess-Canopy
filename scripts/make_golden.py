#!/usr/bin/env python3
"""One-off: produce golden parity fixtures for the TypeScript engine port.

Run from anywhere:  python scripts/make_golden.py

Writes into web/tests/fixtures/golden/:
  explorer_golden.json     filter combos x color tries x paths -> stats + next moves
  time_control_golden.json time_control_label inputs -> outputs
  pgn_golden.json          tests/fixtures/sample.pgn parsed as user "Hero"
  sample_games.json        copy of examples/sample_games.json
  sample.pgn               copy of tests/fixtures/sample.pgn
"""

from __future__ import annotations

import json
import shutil
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from chess_explorer.filter_games import build_color_tries, filter_games  # noqa: E402
from chess_explorer.import_games import time_control_label  # noqa: E402
from chess_explorer.import_pgn import import_pgn_files  # noqa: E402
from chess_explorer.storage import load_games, load_store  # noqa: E402

SAMPLE_GAMES = ROOT / "examples" / "sample_games.json"
SAMPLE_PGN = ROOT / "tests" / "fixtures" / "sample.pgn"
OUT_DIR = ROOT / "web" / "tests" / "fixtures" / "golden"

PGN_USERNAME = "Hero"  # matches tests/test_cli_smoke.py

TIME_CONTROL_INPUTS = [
    "", "60", "120+1", "180", "180+2", "300", "600", "600+5",
    "900+10", "1800", "3600", "5400+30", "1/86400", "86400", "abc", "300+x",
]


def write_json(name: str, data) -> Path:
    path = OUT_DIR / name
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return path


def next_moves_for_path(trie, path: list[str]) -> list[dict]:
    """Same ordering as next_moves_for_path in the deleted serve_frontend.py."""
    node = trie.find(path)
    if node is None:
        return []
    items = sorted(
        node.next_moves().items(),
        key=lambda kv: (kv[1].get("total", 0), kv[0]),
        reverse=True,
    )
    return [{"move": move, "stats": stats} for move, stats in items]


def build_explorer_golden(games: list[dict]) -> dict:
    first = games[0]
    first_moves = first.get("moves", [])
    opponent = first.get("opponent", "")

    paths: list[list[str]] = [
        [],
        first_moves[:1],
        first_moves[:2],
        first_moves[:4],
        ["e4"],
        ["d4"],
        ["e4", "e5"],
    ]

    filter_combos: list[dict] = [
        {},
        {"color": "white"},
        {"color": "black"},
        {"result": "1-0"},
        {"time_control": "blitz"},
        {"min_opponent_rating": 1200},
        {"date_from": "2023-01-01"},
        {"moves_start": 0, "moves_end": 4},
        {"opponent": opponent.upper()},
    ]

    combos_out: list[dict] = []
    cases: list[dict] = []
    for filters in filter_combos:
        filtered = filter_games(games, **filters)
        combos_out.append({"filters": filters, "filtered_count": len(filtered)})
        tries = build_color_tries(filtered)
        for color in ("white", "black"):
            trie = tries[color]
            for path in paths:
                cases.append(
                    {
                        "filters": filters,
                        "color": color,
                        "path": path,
                        "filtered_count": len(filtered),
                        "stats": trie.stats(path),
                        "next": next_moves_for_path(trie, path),
                    }
                )

    return {
        "source": "examples/sample_games.json",
        "games_total": len(games),
        "first_game_id": first.get("game_id"),
        "opponent_upper": opponent.upper(),
        "combos": combos_out,
        "cases": cases,
    }


def build_time_control_golden() -> list[dict]:
    return [{"input": tc, "output": time_control_label(tc)} for tc in TIME_CONTROL_INPUTS]


def build_pgn_golden() -> list[dict]:
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "pgn.json"
        import_pgn_files(PGN_USERNAME, [SAMPLE_PGN], out_path=out, quiet=True)
        return load_store(out)["games"]


def main() -> None:
    # Creates web/tests/fixtures/ as a parent of golden/ (only golden/ is written into).
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    games = load_games(SAMPLE_GAMES)
    if not games:
        raise SystemExit("examples/sample_games.json produced no games")

    explorer = build_explorer_golden(games)
    pgn_games = build_pgn_golden()

    # Non-triviality guards: parity fixtures are worthless if they are empty.
    empty_next = [c for c in explorer["cases"] if not c["next"]]
    print(f"explorer cases: {len(explorer['cases'])}, with empty next: {len(empty_next)}")
    if len(empty_next) == len(explorer["cases"]):
        raise SystemExit("every explorer case has an empty next list")
    if not pgn_games:
        raise SystemExit("PGN import produced no games for user Hero")

    outputs = [
        write_json("explorer_golden.json", explorer),
        write_json("time_control_golden.json", build_time_control_golden()),
        write_json("pgn_golden.json", pgn_games),
    ]
    shutil.copy2(SAMPLE_GAMES, OUT_DIR / "sample_games.json")
    shutil.copy2(SAMPLE_PGN, OUT_DIR / "sample.pgn")

    for p in outputs:
        print(f"wrote {p} ({p.stat().st_size} bytes)")
    print(f"copied fixtures into {OUT_DIR}")


if __name__ == "__main__":
    main()
