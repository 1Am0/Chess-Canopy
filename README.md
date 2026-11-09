# Chess Canopy

A fast, private opening explorer for your own chess.com and Lichess games.

## Features

- **Runs fully in the browser.** No backend. Games are stored in IndexedDB and nothing is uploaded.
- **Import from anywhere.** Pull games from chess.com or Lichess (incremental sync re-fetches only new games), load local PGN files, or drop in JSON exported by the Python CLI.
- **Standard chess only.** Variant games (Chess960, Crazyhouse, King of the Hill, ...) and games that start from a custom position are skipped at import, in the web app and in the Python CLI, and the import message reports how many were skipped.
- **One time-control rule.** Chess.com games use chess.com's own `time_class`, Lichess games use Lichess's `speed`, and everything else is classified from `base + 40 * increment` seconds (bullet under 180, blitz under 600, rapid under 3600, else classical; daily for correspondence). The web importers and the CLI agree.
- **Multi-player merge.** Select several players and explore their games together.
- **Per-position stats.** Win/draw/loss for every candidate move, a move table, and the top moves drawn as arrows on the board. Arrows carry no text: thickness and opacity encode how often you played the move, and hovering a table row previews its arrow.
- **White / Draw / Black bars.** The result bar beside the board and the bars in the move table use the chess convention (white, gray, near-black segments, oriented with the board) and a tooltip such as "White 49% · Draw 8% · Black 43%". Win / Loss from your point of view appears only in the score text and the Recent games chips.
- **Stable layout.** On desktop the board column and every workspace slot (side switch, opening header, filter row, line panel, summary, Moves | Games tabs) have fixed geometry, so nothing moves while you play moves, as on Lichess or chess.com. New results replace the previous ones in place (the old rows stay dimmed and inert while loading). On mobile the board and toolbar stay put and the tab panel has a fixed height. A Playwright test (`web/e2e/layout-stability.spec.ts`) guards this.
- **Side switch.** A White | Black switch picks whose repertoire you explore. Switching keeps the current line and only changes the side and board orientation.
- **Openings.** 3,800+ openings from [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings) (CC0), with ECO codes and names shown as you play.
- **Filters.** Result (Win / Draw / Loss), time control, rating ranges (yours and your opponent's), date (rolling 30 days / 90 days / 1 year, or a custom range), and opponent, via the **Add filter** button. Active filters show as removable chips in a fixed-height row.
- **Recent games.** See the games that reached the current position, with links to the original game.
- **Shareable lines.** The current line is kept in the URL (`?line=e4,c5,Nf3`) with `replaceState`, so refresh and sharing work (the Back button leaves the app rather than stepping through moves; use the arrow keys). The board toolbar's copy-link button also adds `&side=white|black`, which is read on load.
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
- **Web end-to-end tests (Playwright):** `pnpm e2e` in `web/` (run `pnpm build` first). The tests run against `pnpm start`, which serves `out/` with the same Content-Security-Policy headers as production (`web/serve.json`, kept in sync with `vercel.json`), and fail on CSP violations. They include the layout-stability test, which imports a synthetic 60-game fixture, plays 12 plies, steps back, switches side, applies a filter and changes tabs at 1440x900 and 1280x720 (plus a 390x844 mobile check), asserting that key element rectangles move by at most 1px. CI runs e2e too, in its own job. In container-style local environments with a preinstalled Chromium, set `PW_CHROMIUM_PATH` (for example `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm e2e`) to use that browser instead of downloading one.
- **Python tests (pytest):** `pip install -e .[dev]`, then `pytest` from the repo root. Lint with `ruff check --select F chess_explorer tests`.

CI (`.github/workflows/ci.yml`) runs three jobs. The `web` job runs lint, typecheck, Vitest, and the build. The `e2e` job installs Chromium and runs the Playwright suite. The `python` job runs `ruff check --select F chess_explorer tests` (pyflakes) and pytest.

## License

See [LICENSE](LICENSE).
