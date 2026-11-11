# Chess Canopy

An opening explorer for your own chess.com and Lichess games. It runs entirely in the browser: nothing is uploaded and there is no backend.

## Running it

Requirements: Node 22 and pnpm 10.

```bash
cd web
pnpm install
pnpm dev        # development server
pnpm build      # static export to web/out
pnpm test       # unit tests (Vitest)
pnpm e2e        # Playwright tests; run pnpm build first
pnpm lint
pnpm typecheck
```

`pnpm build` generates `web/lib/openings/openings.json` from [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings) if it is missing. To regenerate it, run `pnpm exec tsx scripts/build-openings.ts --force`.

The static export deploys anywhere. On Vercel, set the root directory to `web`. `web/vercel.json` sets the security headers; the Content Security Policy only allows requests to `api.chess.com` and `lichess.org`.

## How it works

Games are imported in the browser from Chess.com, Lichess, a PGN file, or a JSON file exported by the Python CLI. They are stored in IndexedDB (via Dexie) and explored as an opening tree: for each position you see every move you played, with win/draw/loss counts, recent games and an opening name. A Web Worker builds the tree and the statistics, and a Stockfish build in a second worker evaluates positions that Lichess's cloud cache does not have. Variants and games from custom positions are skipped at import.

The current line is kept in the URL (`?line=e4,c5,Nf3`), so a refresh or a shared link restores it.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| Left / Right | Previous / next move |
| Up / Down | Jump to start / end |
| F | Flip board |
| Esc | Clear move preview |
| ? | Show shortcuts |

Shortcuts are paused while typing or when a dialog is open.

## Python CLI

`chess_explorer/` is an optional command line tool for importing games and exploring them in the terminal. It needs Python 3.10 or later.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e .
```

| Command | Description |
| --- | --- |
| `chess-explore-import` | Import chess.com games into `games/chess.com/<player>.json`. |
| `chess-explore-import-pgn` | Import local PGN files into the same JSON format. |
| `chess-explore-explore` | Filter games and explore the move tree in the terminal. |
| `chess-explore-top` | Show the most common positions after N plies. |
| `chess-explore-players` | List the player stores in `games/`. |

For Lichess, run `python -m chess_explorer.import_lichess <username> --player <name>`. Import the resulting JSON in the web app with Import, then JSON. Run the Python tests with `pip install -e .[dev]` and `pytest`.

## Layout

```
chess_explorer/   Python CLI
examples/         Sample data
scripts/          make_golden.py, generates fixtures for the web tests
tests/            pytest suite
web/              Next.js app
  app/            layout, page, global CSS
  components/     board, explorer, filters, layout, onboarding, players, ui
  hooks/          import, explorer sync, position hooks
  lib/            engine (trie, filters), importers, openings, store, database
  workers/        explorer worker
  tests/, e2e/    Vitest and Playwright
```

Design notes are in [`web/docs/visual-identity.md`](web/docs/visual-identity.md) and [`web/docs/palette.md`](web/docs/palette.md).

## License

MIT, see [LICENSE](LICENSE). Two exceptions: `web/public/stockfish/` holds an unmodified GPL-3.0 build of Stockfish (license and sources in that folder), and the move sounds come from Lichess (see `web/public/sounds/ATTRIBUTION.md`).
