import argparse
import concurrent.futures
import datetime as dt
import functools
import io
import re
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import chess.pgn
import requests
from tqdm import tqdm

from .constants import USER_AGENT
from .storage import load_store, save_store

MAX_ARCHIVE_WORKERS = 2
HEADERS = {"User-Agent": USER_AGENT, "Accept-Encoding": "gzip, deflate"}


def _make_session() -> requests.Session:
    session = requests.Session()
    adapter = requests.adapters.HTTPAdapter(pool_connections=4, pool_maxsize=8)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    session.headers.update(HEADERS)
    return session


_RETRY_STATUSES = {403, 429, 500, 502, 503, 504}
_MAX_ATTEMPTS = 4
_sleep = time.sleep  # indirection so tests can avoid real waits


def _get_with_retry(session: requests.Session, url: str, timeout: int) -> requests.Response:
    """GET with exponential backoff (honouring Retry-After) on throttling/server errors."""
    for attempt in range(_MAX_ATTEMPTS):
        r = session.get(url, timeout=timeout)
        if r.status_code not in _RETRY_STATUSES or attempt == _MAX_ATTEMPTS - 1:
            r.raise_for_status()
            return r
        try:
            delay = float(r.headers.get("Retry-After", ""))
        except (TypeError, ValueError):
            delay = 2.0 * (2**attempt)
        _sleep(min(delay, 30.0))
    raise RuntimeError("unreachable")  # pragma: no cover


def _fetch_month(session: requests.Session, idx_url: Tuple[int, str]) -> Tuple[int, List[Dict]]:
    idx, archive_url = idx_url
    r = _get_with_retry(session, archive_url, 30)
    monthly_games = r.json().get("games", [])
    return idx, list(reversed(monthly_games))


def fetch_all_archives(username: str, *, show_progress: bool = True) -> List[Dict]:
    archives_url = f"https://api.chess.com/pub/player/{username}/games/archives"
    session = _make_session()
    try:
        r = _get_with_retry(session, archives_url, 15)
        archives = r.json().get("archives", [])
        if not archives:
            return []

        items: List[Tuple[int, str]] = [(i, url) for i, url in enumerate(reversed(archives))]
        total = len(items)
        all_games: List[Tuple[int, List[Dict]]] = []

        # chess.com throttles heavy crawls (403/429), so keep concurrency low.
        fetch = functools.partial(_fetch_month, session)
        with concurrent.futures.ThreadPoolExecutor(max_workers=min(MAX_ARCHIVE_WORKERS, total)) as ex:
            with tqdm(total=total, disable=not show_progress, desc="Fetching archives") as pbar:
                for idx, games in ex.map(fetch, items):
                    all_games.append((idx, games))
                    pbar.update(1)

        all_games_sorted: List[Dict] = []
        for _, games in sorted(all_games, key=lambda x: x[0]):
            all_games_sorted.extend(games)

        return all_games_sorted
    finally:
        session.close()


def time_control_label(tc: str) -> str:
    """Map a raw TimeControl to bullet/blitz/rapid/classical/daily.

    Must stay identical to ``timeControlLabel`` in ``web/lib/importers/timeControl.ts``.
    """
    if not tc:
        return "rapid"
    if "/" in tc or tc == "-" or re.search(r"day", tc, re.IGNORECASE):
        return "daily"
    parts = tc.split("+")
    try:
        base = int(parts[0])
        inc = int(parts[1]) if len(parts) > 1 else 0
    except ValueError:
        return "rapid"

    total = base + 40 * inc
    if total >= 86400:
        return "daily"
    if total < 180:
        return "bullet"
    if total < 600:
        return "blitz"
    if total < 3600:
        return "rapid"
    return "classical"


START_PLACEMENT = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR"
START_FEN = f"{START_PLACEMENT} w KQkq - 0 1"
_STANDARD_VARIANTS = {"", "standard", "chess"}


def _is_start_fen(fen: str) -> bool:
    parts = fen.split()
    return len(parts) >= 2 and parts[0] == START_PLACEMENT and parts[1] == "w"


def is_standard_headers(headers) -> bool:
    """True for a standard chess game starting from the initial position."""
    if str(headers.get("Variant", "")).strip().lower() not in _STANDARD_VARIANTS:
        return False
    if str(headers.get("SetUp", "")).strip() == "1":
        return False
    fen = str(headers.get("FEN", "")).strip()
    return not fen or _is_start_fen(fen)


def is_standard_record(raw: Dict) -> bool:
    """True for a chess.com archive record that is standard chess from the initial position."""
    if str(raw.get("rules", "chess")).strip().lower() != "chess":
        return False
    setup = str(raw.get("initial_setup") or "").strip()
    return not setup or _is_start_fen(setup)


def _parse_elo(value: str | None) -> Optional[int]:
    """Parse an Elo header; missing, ``?`` or non-numeric values become None."""
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return None


def parse_game(
    pgn_text: str,
    username: str,
    time_class: str | None = None,
    time_control_raw: str | None = None,
) -> Optional[Dict]:
    """Parse one PGN into a game record.

    Returns None for variant / from-position games (``Variant`` other than Standard,
    ``SetUp "1"``, or a non-initial ``FEN``); raises ValueError for unreadable PGN.
    """
    game = chess.pgn.read_game(io.StringIO(pgn_text))
    if game is None:
        raise ValueError("Invalid PGN")
    headers = game.headers
    if not is_standard_headers(headers):
        return None
    white = headers.get("White", "")
    black = headers.get("Black", "")
    username_l = username.lower()
    color = "white" if white.lower() == username_l else "black"
    opponent = black if color == "white" else white

    board = game.board()
    moves_san = []
    for move in game.mainline_moves():
        moves_san.append(board.san(move))
        board.push(move)

    raw_result = headers.get("Result", "*")
    if raw_result == "1-0":
        result = "1-0" if color == "white" else "0-1"
    elif raw_result == "0-1":
        result = "0-1" if color == "white" else "1-0"
    elif raw_result in ("1/2-1/2", "½-½"):
        result = "1/2-1/2"
    else:
        result = raw_result

    date_tag = headers.get("EndDate") or headers.get("UTCDate") or headers.get("Date", "0000.00.00")
    try:
        date = dt.datetime.strptime(date_tag, "%Y.%m.%d").date().isoformat()
    except ValueError:
        date = ""

    if time_class:
        tc = time_class.lower()
    else:
        tc = time_control_label(headers.get("TimeControl", ""))
    termination = headers.get("Termination", "")

    url = headers.get("Link") or headers.get("Site", "")
    game_id = url.rstrip("/").split("/")[-1] if url else headers.get("Event", "")

    my_rating = _parse_elo(headers.get("WhiteElo" if color == "white" else "BlackElo"))
    opp_rating = _parse_elo(headers.get("BlackElo" if color == "white" else "WhiteElo"))

    return {
        "game_id": game_id,
        "moves": moves_san,
        "result": result,
        "color": color,
        "date": date,
        "opponent": opponent,
        "my_rating": my_rating,
        "opponent_rating": opp_rating,
        "time_control": tc,
        "time_control_raw": time_control_raw or headers.get("TimeControl", ""),
        "termination": termination,
        "url": url,
    }


def _parse_single_game(args: Tuple[Dict, str]) -> Optional[Dict]:
    """Parse one chess.com archive record; None if empty, invalid, or not standard chess."""
    g, username = args
    pgn = g.get("pgn", "")
    if not pgn or not is_standard_record(g):
        return None
    try:
        return parse_game(
            pgn,
            username,
            time_class=g.get("time_class"),
            time_control_raw=g.get("time_control"),
        )
    except Exception:
        return None


def import_games(
    username: str,
    *,
    player: Optional[str] = None,
    out_path: Optional[Path] = None,
    quiet: bool = False,
) -> None:
    t_start = time.perf_counter()
    username = username.strip()
    
    # Use source parameter for chess.com games
    if out_path:
        target_path = out_path
    else:
        from .storage import path_for_player
        target_path = path_for_player(player or username, source="chess.com")
    
    t0 = time.perf_counter()
    raw_games = fetch_all_archives(username, show_progress=not quiet)
    t1 = time.perf_counter()
    if not quiet:
        print(f"Fetched {len(raw_games)} games in {(t1-t0)*1000:.0f}ms")
    
    if not raw_games:
        if not quiet:
            print("No games found.")
        return

    t2 = time.perf_counter()
    store = load_store(target_path)
    existing_ids = {g.get("game_id") for g in store["games"]}
    t3 = time.perf_counter()
    if not quiet:
        print(f"Loaded existing {len(store['games'])} games in {(t3-t2)*1000:.0f}ms")

    new_entries: List[Dict] = []

    t4 = time.perf_counter()
    
    # Parse games in parallel (4-8x speedup on typical CPUs)
    parse_args = [(g, username) for g in raw_games]
    parsed_games: List[Optional[Dict]] = []
    
    max_workers = min(8, len(raw_games))
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as ex:
        if not quiet:
            with tqdm(total=len(raw_games), desc="Parsing games") as pbar:
                for parsed in ex.map(_parse_single_game, parse_args):
                    parsed_games.append(parsed)
                    pbar.update(1)
        else:
            parsed_games = list(ex.map(_parse_single_game, parse_args))
    
    variant_count = sum(1 for g in raw_games if not is_standard_record(g))

    # Filter out None values and duplicates
    for game in parsed_games:
        if game is None:
            continue
        if game["game_id"] in existing_ids:
            continue
        new_entries.append(game)
        existing_ids.add(game["game_id"])
    
    t5 = time.perf_counter()
    if not quiet:
        print(f"Parsed {len(raw_games)} games in {(t5-t4)*1000:.0f}ms ({len(new_entries)} new)")
        print(f"Skipped {variant_count} non-standard (variant / from-position) games")

    if new_entries:
        store["games"] = new_entries + store["games"]

    def _sort_key(game: Dict) -> Tuple[str, str]:
        return (game.get("date", "0000-00-00"), game.get("game_id", ""))

    t6 = time.perf_counter()
    store["games"].sort(key=_sort_key, reverse=True)
    t7 = time.perf_counter()
    if not quiet:
        print(f"Sorted {len(store['games'])} games in {(t7-t6)*1000:.0f}ms")

    t8 = time.perf_counter()
    save_store(store, target_path)
    t9 = time.perf_counter()
    if not quiet:
        print(f"Saved JSON in {(t9-t8)*1000:.0f}ms")
        print(f"Total import time: {(t9-t_start)*1000:.0f}ms")
        print(f"Imported {len(new_entries)} new games to {target_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Import Chess.com games into games.json")
    parser.add_argument("username", nargs="?", help="Chess.com username")
    parser.add_argument("--player", help="Name to store under games/chess.com/<player>.json (default: username)")
    parser.add_argument(
        "--output",
        "-o",
        default=None,
        help="Path to output JSON (overrides --player)",
    )
    parser.add_argument("--quiet", action="store_true", help="Suppress progress and summary output")
    args = parser.parse_args()

    if args.username:
        import_games(
            args.username,
            player=args.player or args.username,
            out_path=Path(args.output) if args.output else None,
            quiet=args.quiet,
        )
    else:
        username = input("Enter chess.com username: ").strip()
        import_games(
            username,
            player=args.player or username,
            out_path=Path(args.output) if args.output else None,
            quiet=args.quiet,
        )


if __name__ == "__main__":
    main()
