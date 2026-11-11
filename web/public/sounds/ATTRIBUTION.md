# Sound attribution

The move sounds in `standard/` (`Move.mp3`, `Capture.mp3`) are Lichess's default sound set, copied
unmodified from [`public/sound/standard`](https://github.com/lichess-org/lila/tree/master/public/sound)
in [lichess-org/lila](https://github.com/lichess-org/lila).

In Lila's [COPYING.md](https://github.com/lichess-org/lila/blob/master/COPYING.md) the other sounds in
`public/sound` are listed under "Exceptions (non-free)", so their license for redistribution is not
clearly free. They are bundled at the project owner's request so the app sounds like the Lichess
default. Remove the `standard/` folder to ship without them.

Lichess's game-over, victory and notification sounds are deliberately not included.
The rest of this project is MIT licensed (see the top-level `LICENSE`).
