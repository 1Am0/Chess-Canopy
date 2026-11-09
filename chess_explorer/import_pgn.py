import argparse
import sys  # noqa: F401  (tests monkeypatch import_pgn.sys.argv)
from pathlib import Path
from typing import Iterable, List

import chess.pgn
from tqdm import tqdm

from .import_games import is_standard_headers, parse_game
from .storage import load_store, resolve_store_path, save_store


def _collect_pgn_files(paths: Iterable[Path]) -> List[Path]:
    files: List[Path] = []
    for p in paths:
        p = Path(p)
        if p.is_dir():
            files.extend(sorted(p.rglob("*.pgn")))
        elif p.is_file() and p.suffix.lower() == ".pgn":
            files.append(p)
    return files


def import_pgn_files(
    username: str,
    inputs: Iterable[Path],
    *,
    player: str | None = None,
    out_path: Path | None = None,
    quiet: bool = False,
) -> None:
    username_l = username.lower().strip()
    target_path = resolve_store_path(player or username, out_path)
    files = _collect_pgn_files(inputs)
    if not files:
        if not quiet:
            print("No PGN files found.")
        return

    store = load_store(target_path)
    existing_ids = {g.get("game_id") for g in store["games"]}
    new_entries = []
    variant_count = 0
    error_count = 0

    for file in files:
        with file.open("r", encoding="utf-8") as f:
            bar = tqdm(disable=quiet, desc=file.name, unit="game")
            game_idx = 0
            while True:
                game = chess.pgn.read_game(f)
                if game is None:
                    break
                game_idx += 1
                headers = game.headers
                white = headers.get("White", "").lower()
                black = headers.get("Black", "").lower()
                if white != username_l and black != username_l:
                    bar.update(1)
                    continue

                if not is_standard_headers(headers):
                    variant_count += 1
                    bar.update(1)
                    continue

                exporter = chess.pgn.StringExporter(headers=True, variations=True, comments=True)
                pgn_text = game.accept(exporter)
                try:
                    parsed = parse_game(
                        pgn_text,
                        username,
                        time_class=headers.get("TimeClass"),
                        time_control_raw=headers.get("TimeControl"),
                    )
                except ValueError:
                    error_count += 1
                    bar.update(1)
                    continue
                if parsed is None:
                    variant_count += 1
                    bar.update(1)
                    continue
                if not parsed.get("game_id"):
                    parsed["game_id"] = f"{file.name}-{game_idx}"

                if parsed["game_id"] in existing_ids:
                    bar.update(1)
                    continue

                new_entries.append(parsed)
                existing_ids.add(parsed["game_id"])
                bar.update(1)
            bar.close()

    if new_entries:
        store["games"] = new_entries + store["games"]
        save_store(store, target_path)

    if not quiet:
        print(f"Imported {len(new_entries)} new games to {target_path}")
        if variant_count:
            print(f"Skipped {variant_count} non-standard (variant / from-position) games")
        if error_count:
            print(f"Skipped {error_count} unreadable games")


def main() -> None:
    parser = argparse.ArgumentParser(description="Import local PGN files into games.json")
    parser.add_argument("username", help="Your username to identify color in PGNs")
    parser.add_argument("inputs", nargs="+", help="PGN files or directories containing PGNs")
    parser.add_argument("--player", help="Name to store under games/<player>.json (default: username)")
    parser.add_argument("--output", "-o", default=None, help="Path to output JSON (overrides --player)")
    parser.add_argument("--quiet", action="store_true", help="Suppress progress and summary output")
    args = parser.parse_args()

    import_pgn_files(
        args.username,
        [Path(p) for p in args.inputs],
        player=args.player or args.username,
        out_path=Path(args.output) if args.output else None,
        quiet=args.quiet,
    )


if __name__ == "__main__":
    main()
