# Sound attribution

The move sounds in this folder are recorded sounds from **Lichess**, copied unmodified from
[`public/sound/`](https://github.com/lichess-org/lila/tree/master/public/sound) in
[lichess-org/lila](https://github.com/lichess-org/lila):

| Folder here   | Lichess set   | Author                                       | License            |
| ------------- | ------------- | -------------------------------------------- | ------------------ |
| `standard/`   | `standard`    | Lichess                                      | **license unclear (see below)** |
| `sfx/`        | `sfx`         | [Enigmahack](https://github.com/Enigmahack)  | AGPL-3.0-or-later  |
| `piano/`      | `piano`       | Enigmahack                                   | AGPL-3.0-or-later  |
| `nes/`        | `nes`         | Enigmahack                                   | AGPL-3.0-or-later  |
| `futuristic/` | `futuristic`  | Enigmahack                                   | AGPL-3.0-or-later  |

Per Lila's [COPYING.md](https://github.com/lichess-org/lila/blob/master/COPYING.md) these four sets
are listed as free exceptions under the AGPL-3.0-or-later. Only five files of each AGPL set are used
(`Move`, `Capture`, `Check`, `Victory`, `GenericNotify`).

## The Standard set

`standard/` is Lichess's default sound set (`Move`, `Capture`, `GenericNotify`). In Lila's
[COPYING.md](https://github.com/lichess-org/lila/blob/master/COPYING.md) the "other sounds in
`public/sound`" are listed under *Exceptions (non-free)*, so their license for redistribution is
**not clearly free**. It is bundled at the project owner's request so the app sounds like the
Lichess default. Remove the `standard/` folder (and set `DEFAULT_SOUND_THEME` in `lib/sound.ts`
to `"sfx"`) to ship only the clearly AGPL-licensed sets.

The rest of this project is MIT licensed (see the top-level `LICENSE`); these audio files stay
under the AGPL-3.0-or-later. Lichess's "lisp" set is deliberately not bundled (CC BY-NC-SA, non-commercial only).
