"""Variant / from-position games must be dropped by every importer and counted in the summary."""
import io
import json
from pathlib import Path
from unittest.mock import Mock, patch

import requests

from chess_explorer import import_games, import_lichess, import_pgn
from chess_explorer.import_games import START_FEN, parse_game

STD = """[Event "Live Chess"]
[Site "https://www.chess.com/game/live/1"]
[Date "2025.01.01"]
[White "hero"]
[Black "villain"]
[Result "1-0"]
[WhiteElo "1500"]
[BlackElo "1400"]
[TimeControl "300"]

1. e4 e5 2. Nf3 Nc6 1-0
"""

CHESS960 = STD.replace("/live/1", "/live/2").replace(
    '[Result "1-0"]', '[Result "1-0"]\n[Variant "Chess960"]\n[SetUp "1"]\n[FEN "bbqnnrkr/pppppppp/8/8/8/8/PPPPPPPP/BBQNNRKR w KQkq - 0 1"]'
)
CRAZYHOUSE = STD.replace("/live/1", "/live/3").replace('[Result "1-0"]', '[Result "1-0"]\n[Variant "Crazyhouse"]')
FROM_POSITION = STD.replace("/live/1", "/live/4").replace(
    '[Result "1-0"]', '[Result "1-0"]\n[SetUp "1"]\n[FEN "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1"]'
)
STANDARD_VARIANT_HEADER = STD.replace("/live/1", "/live/5").replace('[Result "1-0"]', '[Result "1-0"]\n[Variant "Standard"]')


def test_parse_game_drops_variant_headers():
    assert parse_game(STD, "hero") is not None
    assert parse_game(STANDARD_VARIANT_HEADER, "hero") is not None
    assert parse_game(CHESS960, "hero") is None
    assert parse_game(CRAZYHOUSE, "hero") is None
    assert parse_game(FROM_POSITION, "hero") is None


def test_parse_game_keeps_start_fen_without_setup():
    pgn = STD.replace('[Result "1-0"]', f'[Result "1-0"]\n[FEN "{START_FEN}"]')
    assert parse_game(pgn, "hero") is not None


def test_parse_game_handles_unknown_elo():
    pgn = STD.replace('[WhiteElo "1500"]', '[WhiteElo "?"]').replace('[BlackElo "1400"]', '')
    g = parse_game(pgn, "hero")
    assert g["my_rating"] is None and g["opponent_rating"] is None


# ---- chess.com JSON ---------------------------------------------------------

def _record(pgn, **extra):
    return {"pgn": pgn, "time_class": "blitz", "time_control": "300", "rules": "chess", **extra}


def test_chesscom_records_filter_rules_and_initial_setup():
    ok = import_games._parse_single_game((_record(STD), "hero"))
    assert ok is not None and ok["game_id"] == "1"
    assert import_games._parse_single_game((_record(STD, rules="crazyhouse"), "hero")) is None
    assert import_games._parse_single_game((_record(STD, rules="chess960"), "hero")) is None
    assert import_games._parse_single_game((_record(STD, initial_setup="4k3/8/8/8/8/8/4P3/4K3 w - - 0 1"), "hero")) is None
    # standard initial_setup is fine; so is a missing "rules" key
    assert import_games._parse_single_game((_record(STD, initial_setup=START_FEN), "hero")) is not None
    rec = _record(STD)
    del rec["rules"]
    assert import_games._parse_single_game((rec, "hero")) is not None
    # PGN-level variant headers are caught even when the JSON says rules=chess
    assert import_games._parse_single_game((_record(CHESS960), "hero")) is None


def test_import_games_counts_variants(tmp_path: Path, capsys):
    raw = [
        _record(STD),
        _record(CRAZYHOUSE, rules="crazyhouse"),
        _record(CHESS960, rules="chess960"),
        _record(FROM_POSITION, initial_setup="4k3/8/8/8/8/8/4P3/4K3 w - - 0 1"),
    ]
    out = tmp_path / "c.json"
    with patch.object(import_games, "fetch_all_archives", return_value=raw):
        import_games.import_games("hero", out_path=out)
    games = json.loads(out.read_text())["games"]
    assert [g["game_id"] for g in games] == ["1"]
    assert "Skipped 3 non-standard" in capsys.readouterr().out


# ---- Lichess PGN ------------------------------------------------------------

def _lichess_pgn(site, event="Rated Blitz game", extra=""):
    return f"""[Event "{event}"]
[Site "https://lichess.org/{site}"]
[Date "2025.01.01"]
[White "hero"]
[Black "villain"]
[Result "1-0"]
{extra}[TimeControl "300+0"]

1. e4 e5 2. Nf3 Nc6 1-0

"""


def test_import_lichess_drops_variants_and_counts(tmp_path: Path, capsys):
    stream = (
        _lichess_pgn("std00001")
        + _lichess_pgn("kothxxxx", "Rated King of the Hill game", '[Variant "King of the Hill"]\n')
        + _lichess_pgn("c960xxxx", "Rated Chess960 game", '[Variant "Chess960"]\n[SetUp "1"]\n[FEN "bbqnnrkr/pppppppp/8/8/8/8/PPPPPPPP/BBQNNRKR w KQkq - 0 1"]\n')
        + _lichess_pgn("fenxxxxx", "Casual Blitz game", '[SetUp "1"]\n[FEN "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1"]\n')
    )
    resp = Mock(spec=requests.Response)
    resp.status_code = 200
    resp.raise_for_status = Mock()
    resp.raw = io.BytesIO(stream.encode())
    out = tmp_path / "l.json"
    with patch("requests.Session") as sess:
        sess.return_value.get.return_value = resp
        import_lichess.import_lichess_games("hero", out_path=out)
    games = json.loads(out.read_text())["games"]
    assert [g["game_id"] for g in games] == ["std00001"]
    assert "Variants skipped: 3" in capsys.readouterr().out


# ---- generic PGN ------------------------------------------------------------

def test_import_pgn_drops_variants_and_counts(tmp_path: Path, capsys):
    pgn = tmp_path / "mix.pgn"
    pgn.write_text("\n".join([STD, CHESS960, CRAZYHOUSE, FROM_POSITION]), encoding="utf-8")
    out = tmp_path / "p.json"
    import_pgn.import_pgn_files("hero", [pgn], out_path=out)
    games = json.loads(out.read_text())["games"]
    assert [g["game_id"] for g in games] == ["1"]
    assert "Skipped 3 non-standard" in capsys.readouterr().out


def test_import_pgn_survives_unknown_elo(tmp_path: Path):
    pgn = tmp_path / "elo.pgn"
    pgn.write_text(STD.replace('[WhiteElo "1500"]', '[WhiteElo "?"]'), encoding="utf-8")
    out = tmp_path / "e.json"
    import_pgn.import_pgn_files("hero", [pgn], out_path=out, quiet=True)
    assert json.loads(out.read_text())["games"][0]["my_rating"] is None


# ---- chess.com archive fetching ---------------------------------------------

def test_get_with_retry_backs_off_then_succeeds(monkeypatch):
    sleeps = []
    monkeypatch.setattr(import_games, "_sleep", sleeps.append)
    resp = [Mock(status_code=403, headers={}), Mock(status_code=429, headers={"Retry-After": "5"}), Mock(status_code=200, headers={})]
    session = Mock()
    session.get.side_effect = resp
    assert import_games._get_with_retry(session, "u", 5) is resp[2]
    assert sleeps == [2.0, 5.0]
    assert import_games.MAX_ARCHIVE_WORKERS == 2
