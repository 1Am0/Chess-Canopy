# Chess Canopy

A fast, private opening explorer for your own chess.com and Lichess games.

## Features

- **Runs fully in the browser.** No backend. Games are stored in IndexedDB and nothing is uploaded.
- **Import from anywhere.** Pull games from chess.com or Lichess (incremental sync re-fetches only new games), load local PGN files, or drop in JSON exported by the Python CLI.
- **Multi-player merge.** Select several players and explore their games together.
- **Per-position stats.** Win/draw/loss for every candidate move, a move table, and the top moves drawn as arrows on the board.
- **Openings.** 3,800+ openings from [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings) (CC0), with ECO codes and names shown as you play.
- **Filters.** Color, result (Win / Draw / Loss), time control, rating ranges (yours and your opponent's), date range, opponent, and move range.
- **Recent games.** See the games that reached the current position, with links to the original game.
- **Shareable lines.** The current line is kept in the URL (`?line=e4,c5,Nf3`), so refresh, Back, and sharing all work.
- **Light and dark themes.**
- **Keyboard shortcuts:**

| Key | Action |
| --- | --- |
| ← / → | Previous / next move |
| ↑ / ↓ | Jump to start / end |
| F | Flip board |
| Esc | Clear move preview |
| ? | Show shortcuts |

## How it works

Chess Canopy is a static Next.js app. The UI sends work to a Web Worker, which holds the parsed games in memory and builds the statistics. IndexedDB (via Dexie) keeps the games between visits.

```
+-----------------------------+   Comlink   +-------------------------------+
|  React UI (Next.js)         | <---------> |  Explorer Web Worker          |
|  board, move table, panels  |             |  filter -> per-color move trie |
+-----------------------------+             |  -> stats                     |
                                            +---------------+---------------+
                                                            |
                                            +---------------v---------------+
                                            |  IndexedDB (Dexie)            |
                                            |  players, games               |
                                            +-------------------------------+

  Importers run in the browser and call the chess.com and Lichess public APIs directly.
```

## Development

Requirements: Node 22 and pnpm 10.

```bash
cd web
```

```bash
pnpm install
```

```bash
pnpm dev
```

```bash
pnpm test
```

```bash
pnpm build
```

```bash
pnpm e2e
```

`pnpm build` runs `prebuild` first, which runs the openings script. The script skips generation when `web/lib/openings/openings.json` already exists. To regenerate the openings file, run:

```bash
pnpm exec tsx scripts/build-openings.ts --force
```

## Deploying to Vercel

1. In Vercel, import this GitHub repository.
2. Set **Root Directory** to `web`. Vercel detects Next.js automatically. The app is built as a static export (`output: "export"`).
3. Deploy. Every branch and pull request gets its own preview URL.

`web/vercel.json` sets security headers. The Content Security Policy only allows network requests to `api.chess.com` and `lichess.org`. It also sets `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy`.

## Optional: Python CLI

The Python package in `chess_explorer/` is a power-user tool for importing games and exploring them in the terminal. It is not needed to use the web app.

Requirements: Python 3.10+.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e .
```

Console scripts:

| Command | Description |
| --- | --- |
| `chess-explore-import` | Import chess.com games into `games/chess.com/<player>.json`. |
| `chess-explore-import-pgn` | Import local PGN files (file or directory) into the same JSON schema. |
| `chess-explore-explore` | Filter games and explore the move tree interactively in the terminal. |
| `chess-explore-top` | Show the most common positions after N plies, with optional Lichess evals. |
| `chess-explore-players` | List the player stores in `games/`. |

The Lichess importer has no console script. Run it as a module:

```bash
python -m chess_explorer.import_lichess <username> --player <name>
```

It writes to `games/lichess/<player>.json`. Options include `--max`, `--rated`, and `--perf-type`.

**Moving data to the web app:** the CLI writes JSON in schema v1 (`{"version": 1, "games": [...]}`). Import that file in the web app with **Import → JSON**. You can also export a player from the web app's player manager in the same format.

## Project layout

```
.
├── chess_explorer/        Python CLI package (importers, trie, terminal explorer)
├── examples/              Sample data
├── games/                 Player data written by the CLI (games/<source>/<player>.json)
├── scripts/               make_golden.py (generates parity fixtures for the web tests)
├── tests/                 pytest suite for the Python CLI
├── benchmark_trie.py      Trie build benchmark for the Python engine
├── pyproject.toml         Python package and console scripts
└── web/                   Next.js app (Vercel root directory)
    ├── app/               Layout, explorer page, global CSS
    ├── components/        board/, explorer/, filters/, layout/, onboarding/, players/, ui/
    ├── hooks/             Import, explorer sync, position, and media-query hooks
    ├── lib/
    │   ├── engine/        Trie, filters, game types (ported from the Python engine)
    │   ├── importers/     chess.com, Lichess, PGN, JSON, time controls
    │   ├── openings/      Opening lookup and generated openings.json
    │   ├── db.ts         Dexie (IndexedDB) schema
    │   └── store.ts       Zustand store
    ├── workers/           Explorer Web Worker
    ├── scripts/           build-openings.ts
    ├── tests/             Vitest suites and golden fixtures
    └── e2e/               Playwright tests
```

## Testing

- **Web unit and parity tests (Vitest):** `pnpm test` in `web/`. The engine is checked against golden outputs produced by the Python engine (`scripts/make_golden.py`). Importers are tested with recorded fixtures, so no live network calls are made.
- **Web end-to-end tests (Playwright):** `pnpm e2e` in `web/` (run `pnpm build` first). CI runs e2e too, in its own job. In container-style local environments with a preinstalled Chromium, set `PW_CHROMIUM_PATH` (for example `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm e2e`) to use that browser instead of downloading one.
- **Python tests (pytest):** `pip install -e .[dev]`, then `pytest` from the repo root.

CI (`.github/workflows/ci.yml`) runs three jobs. The `web` job runs lint, typecheck, Vitest, and the build. The `e2e` job installs Chromium and runs the Playwright suite. The `python` job runs pytest.

## License

See [LICENSE](LICENSE).
