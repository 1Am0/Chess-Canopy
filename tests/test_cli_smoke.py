import sys

import chess_explorer.top_positions as top_positions


def test_top_positions_cli_skip_eval(sample_games_path, monkeypatch, capsys):
    argv = ["top_positions.py", "--input", str(sample_games_path), "--plys", "4", "--limit", "2", "--skip-eval"]
    monkeypatch.setattr(sys, "argv", argv)
    top_positions.main()
    out = capsys.readouterr().out
    assert "Found" in out
    assert "FEN:" in out
