"""Player listing and --player resolution across games/<source>/ subdirectories."""
import json
import sys
from pathlib import Path

import pytest

from chess_explorer import explore_trie, list_players, top_positions
from chess_explorer.filter_games import build_color_tries
from chess_explorer.storage import find_player_path, resolve_games_path


def _store(path: Path, n: int, color: str = "white"):
    path.parent.mkdir(parents=True, exist_ok=True)
    games = [
        {"game_id": str(i), "moves": ["e4", "e5"], "result": "1-0", "color": color, "date": "2025-01-01",
         "opponent": "x", "time_control": "blitz"}
        for i in range(n)
    ]
    path.write_text(json.dumps({"version": 1, "games": games}), encoding="utf-8")


@pytest.fixture()
def games_dir(tmp_path: Path) -> Path:
    d = tmp_path / "games"
    _store(d / "chess.com" / "alice.json", 3)
    _store(d / "lichess" / "bob.json", 2)
    _store(d / "legacy.json", 1)
    return d


def test_describe_players_counts_source_subdirs(games_dir: Path):
    assert list_players.describe_players(games_dir, None) == [("alice", 3), ("bob", 2), ("legacy", 1)]


def test_describe_players_same_name_in_two_sources(games_dir: Path):
    _store(games_dir / "lichess" / "alice.json", 5)
    entries = dict(list_players.describe_players(games_dir, None))
    assert entries["alice (chess.com)"] == 3
    assert entries["alice (lichess)"] == 5


def test_players_cli_prints_counts(games_dir: Path, monkeypatch, capsys):
    monkeypatch.chdir(games_dir.parent)
    monkeypatch.setattr(sys, "argv", ["chess-explore-players", "--games-dir", str(games_dir)])
    list_players.main()
    out = capsys.readouterr().out
    assert "alice: 3 games" in out and "bob: 2 games" in out


def test_find_and_resolve_player_path(games_dir: Path):
    assert find_player_path("alice", games_dir) == games_dir / "chess.com" / "alice.json"
    assert find_player_path("legacy", games_dir) == games_dir / "legacy.json"
    assert find_player_path("nobody", games_dir) is None
    assert resolve_games_path("games.json", "bob", games_dir) == games_dir / "lichess" / "bob.json"
    assert resolve_games_path("games.json", "nobody", games_dir) is None
    # an explicit --input wins over --player
    assert resolve_games_path("custom.json", "bob", games_dir) == Path("custom.json")


def test_explore_player_resolves_source_dir(games_dir: Path, monkeypatch, capsys):
    monkeypatch.chdir(games_dir.parent)
    monkeypatch.setattr(sys, "argv", ["explore", "--player", "alice", "--color", "white"])
    monkeypatch.setattr(explore_trie, "interactive_traverse", lambda trie, **kw: print("TRAVERSE", trie.root.children.keys()))
    explore_trie.main()
    out = capsys.readouterr().out
    assert "Loaded 3 white games" in out and "TRAVERSE" in out


def test_explore_player_not_found(games_dir: Path, monkeypatch, capsys):
    monkeypatch.chdir(games_dir.parent)
    monkeypatch.setattr(sys, "argv", ["explore", "--player", "nobody"])
    explore_trie.main()
    assert "not found" in capsys.readouterr().out


def test_top_positions_player_resolves_source_dir(games_dir: Path, monkeypatch, capsys):
    monkeypatch.chdir(games_dir.parent)
    monkeypatch.setattr(sys, "argv", ["top", "--player", "bob", "--plys", "2", "--skip-eval"])
    top_positions.main()
    assert "Found 2 games" in capsys.readouterr().out


@pytest.mark.parametrize("module", [explore_trie, top_positions])
def test_time_control_accepts_daily(module, games_dir: Path, monkeypatch, capsys):
    monkeypatch.chdir(games_dir.parent)
    monkeypatch.setattr(sys, "argv", ["x", "--player", "bob", "--time-control", "daily"])
    module.main()  # argparse would SystemExit on an invalid choice
    assert "No games match" in capsys.readouterr().out


def test_build_color_tries_skips_unknown_results():
    games = [
        {"color": "white", "moves": ["e4"], "result": "1-0"},
        {"color": "white", "moves": ["d4"], "result": "*"},
    ]
    tries = build_color_tries(games)
    assert list(tries["white"].root.children) == ["e4"]
