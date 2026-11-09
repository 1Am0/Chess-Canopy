"""Import games from Lichess.org"""
import argparse
import io
import re
import time
from pathlib import Path
from typing import Dict, Generator, List, Optional, Set

import chess.pgn
import requests
from tqdm import tqdm

from .constants import USER_AGENT
from .import_games import parse_game
from .storage import load_store, path_for_player, save_store

HEADERS = {"User-Agent": USER_AGENT, "Accept": "application/x-chess-pgn"}

_EVENT_SPEED_RE = re.compile(r"\b(ultrabullet|bullet|blitz|rapid|classical|correspondence)\b", re.IGNORECASE)
_SPEED_ALIASES = {"ultrabullet": "bullet", "correspondence": "daily"}
_DAYS_RE = re.compile(r"^\s*(\d+)\s+days?\s+per\s+move\s*$", re.IGNORECASE)


def lichess_speed_label(tc: str, event: str = "") -> str:
    """Time-control label for a Lichess game, matching the web importer's rule.

    Uses Lichess's own speed (the ``Event`` header, e.g. "Rated Blitz game") and maps
    ultraBullet -> bullet, correspondence -> daily. Without a speed in ``Event``, falls back
    to Lichess thresholds on base + 40 * increment (<180 bullet, <480 blitz, <1500 rapid,
    else classical); correspondence/daily controls are "daily".
    """
    m = _EVENT_SPEED_RE.search(event or "")
    if m:
        speed = m.group(1).lower()
        return _SPEED_ALIASES.get(speed, speed)
    if not tc or tc == "-" or "/" in tc or re.search(r"day", tc, re.IGNORECASE):
        return "daily"
    try:
        base, _, inc = tc.partition("+")
        total = int(base) + 40 * (int(inc) if inc else 0)
    except ValueError:
        return "rapid"
    if total < 180:
        return "bullet"
    if total < 480:
        return "blitz"
    if total < 1500:
        return "rapid"
    return "classical"


def lichess_raw_time_control(tc: str) -> str:
    """Normalise "N days per move" to the web importer's ``1/<seconds>`` form."""
    m = _DAYS_RE.match(tc or "")
    return f"1/{int(m.group(1)) * 86400}" if m else (tc or "")


def parse_lichess_game(pgn_text: str, username: str) -> Optional[Dict]:
    """parse_game with Lichess speed labels; None for variant / from-position games."""
    headers = chess.pgn.read_headers(io.StringIO(pgn_text))
    if headers is None:
        raise ValueError("Invalid PGN")
    tc = headers.get("TimeControl", "")
    return parse_game(
        pgn_text,
        username,
        time_class=lichess_speed_label(tc, headers.get("Event", "")),
        time_control_raw=lichess_raw_time_control(tc),
    )


def fetch_lichess_games(
    username: str,
    *,
    max_games: Optional[int] = None,
    rated: Optional[bool] = None,
    perf_type: Optional[str] = None,
    show_progress: bool = True,
) -> Generator[str, None, None]:
    """
    Fetch games from Lichess API via streaming.
    Yields PGN strings one by one.
    """
    url = f"https://lichess.org/api/games/user/{username}"
    params = {
        "pgnInJson": "false",
        "clocks": "false",
        "evals": "false",
        "opening": "false",
        "literate": "false",
    }

    if max_games:
        params["max"] = str(max_games)
    if rated is not None:
        params["rated"] = "true" if rated else "false"
    if perf_type:
        params["perfType"] = perf_type

    session = requests.Session()
    session.headers.update(HEADERS)

    try:
        if show_progress:
            print(f"Requesting: {url}", flush=True)

        # Stream the response to avoid loading huge files into RAM
        response = session.get(url, params=params, stream=True, timeout=60)
        
        if show_progress:
            print(f"Response status: {response.status_code}", flush=True)
            
        response.raise_for_status()

        # Wrap the raw socket in a text wrapper so chess.pgn can read directly
        # 'utf-8-sig' handles potential BOM from some sources, though Lichess is usually clean utf-8
        wrapper = io.TextIOWrapper(response.raw, encoding='utf-8')

        while True:
            # Reads one game from the stream (handles headers, moves, and result)
            game = chess.pgn.read_game(wrapper)
            
            if game is None:
                break
            
            # Convert the game object back to a PGN string for processing
            # We use strict=False to allow for potentially non-standard headers
            exporter = chess.pgn.StringExporter(headers=True, variations=True, comments=True)
            pgn_string = game.accept(exporter)
            
            if pgn_string:
                yield pgn_string

    except requests.exceptions.RequestException as e:
        print(f"\nNetwork error during fetch: {e}")
    except Exception as e:
        print(f"\nError processing PGN stream: {e}")
    finally:
        session.close()


def import_lichess_games(
    username: str,
    *,
    player: Optional[str] = None,
    out_path: Optional[Path] = None,
    max_games: Optional[int] = None,
    rated: Optional[bool] = None,
    perf_type: Optional[str] = None,
    quiet: bool = False,
) -> None:
    """Import games from Lichess into the games store."""
    t_start = time.perf_counter()
    username = username.strip()

    # Determine target path
    if out_path:
        target_path = out_path
    else:
        target_path = path_for_player(player or username, source="lichess")

    t0 = time.perf_counter()
    if not quiet:
        print(f"Fetching games from Lichess for {username}...")

    # Load existing store to check for duplicates
    store = load_store(target_path)
    existing_ids: Set[str] = {g.get("game_id") for g in store.get("games", []) if g.get("game_id")}
    
    t1 = time.perf_counter()
    if not quiet:
        print(f"Loaded {len(existing_ids)} existing game IDs in {(t1-t0)*1000:.0f}ms")

    new_entries: List[Dict] = []
    duplicate_count = 0
    variant_count = 0
    error_count = 0

    # Stream games and process them one by one
    game_generator = fetch_lichess_games(
        username,
        max_games=max_games,
        rated=rated,
        perf_type=perf_type,
        show_progress=not quiet
    )

    # Use tqdm for progress bar if not quiet
    iterator = tqdm(game_generator, desc="Importing", unit="games", disable=quiet)
    
    for pgn_str in iterator:
        try:
            # Parse the game
            parsed = parse_lichess_game(pgn_str, username)

            if parsed is None:
                variant_count += 1  # variant or from-position game
                continue

            game_id = parsed.get("game_id")
            
            if game_id and game_id in existing_ids:
                duplicate_count += 1
                continue
            
            new_entries.append(parsed)
            if game_id:
                existing_ids.add(game_id)
                
        except Exception as e:
            error_count += 1
            if not quiet and error_count <= 3:
                print(f"\nError parsing game: {e}")
            continue

    t_end_fetch = time.perf_counter()

    summary = (
        f"Processed stream in {(t_end_fetch - t1):.2f}s. "
        f"New: {len(new_entries)}, Duplicates: {duplicate_count}, "
        f"Variants skipped: {variant_count}, Errors: {error_count}"
    )
    
    if not quiet:
        print(f"\n{summary}")

    if new_entries:
        if "games" not in store:
            store["games"] = []
            
        store["games"].extend(new_entries)

        # Sort games by date (descending)
        def _sort_key(game: Dict):
            return (game.get("date", "0000-00-00"), game.get("game_id", ""))

        store["games"].sort(key=_sort_key, reverse=True)
        
        save_store(store, target_path)
        
        t_final = time.perf_counter()
        if not quiet:
            print(f"Saved updated store to {target_path}")
            print(f"Total time: {(t_final - t_start):.2f}s")
    else:
        if not quiet:
            print("No new games to save.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Import Lichess games into games.json")
    parser.add_argument("username", nargs="?", help="Lichess username")
    parser.add_argument("--player", help="Name to store under games/lichess/<player>.json (default: username)")
    parser.add_argument(
        "--output",
        "-o",
        default=None,
        help="Path to output JSON (overrides --player)",
    )
    parser.add_argument("--max", type=int, help="Maximum number of games to fetch")
    parser.add_argument("--rated", action="store_true", help="Only fetch rated games")
    parser.add_argument(
        "--perf-type",
        choices=["ultraBullet", "bullet", "blitz", "rapid", "classical", "correspondence"],
        help="Filter by game type",
    )
    parser.add_argument("--quiet", action="store_true", help="Suppress progress and summary output")
    args = parser.parse_args()

    # Interactive prompt if username not provided
    if not args.username:
        username = input("Enter Lichess username: ").strip()
    else:
        username = args.username

    import_lichess_games(
        username,
        player=args.player or username,
        out_path=Path(args.output) if args.output else None,
        max_games=args.max,
        rated=args.rated if args.rated else None,
        perf_type=args.perf_type,
        quiet=args.quiet,
    )


if __name__ == "__main__":
    main()