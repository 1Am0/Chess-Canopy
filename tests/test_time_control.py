"""Time-control labels must match web/lib/importers/timeControl.ts and the Lichess speed mapping."""
import pytest

from chess_explorer.import_games import time_control_label
from chess_explorer.import_lichess import (
    lichess_raw_time_control,
    lichess_speed_label,
    parse_lichess_game,
)


@pytest.mark.parametrize(
    "tc,expected",
    [
        ("", "rapid"), ("60", "bullet"), ("120+1", "bullet"), ("180", "blitz"), ("300", "blitz"),
        ("600", "rapid"), ("900+10", "rapid"), ("1800", "rapid"), ("3600", "classical"),
        ("86400", "daily"), ("1/86400", "daily"), ("1 day per move", "daily"), ("3 days per move", "daily"),
        ("-", "daily"), ("abc", "rapid"), ("300+x", "rapid"),
    ],
)
def test_time_control_label(tc, expected):
    assert time_control_label(tc) == expected


@pytest.mark.parametrize(
    "tc,event,expected",
    [
        ("60+0", "Rated Bullet game", "bullet"),
        ("15+0", "Rated UltraBullet game", "bullet"),
        ("300+3", "Rated Blitz game", "blitz"),
        ("420+3", "Rated Rapid game", "rapid"),
        ("900+15", "Rated Classical game", "classical"),
        ("-", "Correspondence game", "daily"),
        ("1 day per move", "Rated Correspondence game", "daily"),
        # no speed in the Event header -> Lichess thresholds on base + 40 * inc
        ("300+5", "Casual game", "rapid"),
        ("480+0", "Casual game", "rapid"),
        ("179+0", "Casual game", "bullet"),
        ("900+15", "Casual game", "classical"),
        ("-", "Casual game", "daily"),
        ("1/86400", "Casual game", "daily"),
    ],
)
def test_lichess_speed_label(tc, event, expected):
    assert lichess_speed_label(tc, event) == expected


def test_lichess_raw_days_per_move():
    assert lichess_raw_time_control("1 day per move") == "1/86400"
    assert lichess_raw_time_control("3 days per move") == "1/259200"
    assert lichess_raw_time_control("300+3") == "300+3"


def test_parse_lichess_game_uses_speed_not_chesscom_thresholds():
    pgn = """[Event "Rated Rapid game"]
[Site "https://lichess.org/abcd1234"]
[Date "2025.01.01"]
[White "hero"]
[Black "villain"]
[Result "1-0"]
[TimeControl "300+5"]

1. e4 e5 1-0
"""
    g = parse_lichess_game(pgn, "hero")
    assert g["time_control"] == "rapid" and g["time_control_raw"] == "300+5"
