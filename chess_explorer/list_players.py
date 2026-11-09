import argparse
from pathlib import Path

from .storage import list_players_by_source, load_store


def describe_players(games_dir: Path, legacy_path: Path | None) -> list[tuple[str, int]]:
    """Count games for every player file in ``games_dir`` and its source subdirectories.

    A name present under several sources is listed once per source, as ``name (source)``.
    """
    files: list[tuple[str, str, Path]] = []  # (name, source, path)
    for source, names in list_players_by_source(games_dir).items():
        base = games_dir if source == "legacy" else games_dir / source
        files.extend((name, source, base / f"{name}.json") for name in names)

    seen: dict[str, int] = {}
    for name, _, _ in files:
        seen[name] = seen.get(name, 0) + 1

    entries: list[tuple[str, int]] = []
    for name, source, path in sorted(files, key=lambda f: (f[0], f[1])):
        label = name if seen[name] == 1 else f"{name} ({source})"
        entries.append((label, len(load_store(path).get("games", []))))
    if legacy_path and legacy_path.exists():
        store = load_store(legacy_path)
        entries.insert(0, ("default", len(store.get("games", []))))
    return entries


def main() -> None:
    parser = argparse.ArgumentParser(description="List available player stores (games/<player>.json or games/<source>/<player>.json)")
    parser.add_argument("--games-dir", default="games", help="Directory for per-player JSON files (default games)")
    parser.add_argument(
        "--legacy-games",
        default=None,
        help="Optional legacy single games file (default autodetect games.json if present)",
    )
    args = parser.parse_args()

    games_dir = Path(args.games_dir).resolve()
    legacy_path = Path(args.legacy_games).resolve() if args.legacy_games else Path("games.json").resolve()
    if not legacy_path.exists():
        legacy_path = None

    games_dir.mkdir(parents=True, exist_ok=True)
    entries = describe_players(games_dir, legacy_path)

    if not entries:
        print("No players found. Add one via import or create a JSON under games/.")
        return

    for name, count in entries:
        print(f"{name}: {count} games")


if __name__ == "__main__":
    main()
