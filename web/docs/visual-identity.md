# Visual identity

Chess Canopy is a quiet, dense tool for reading your own openings. The interface stays out of the way of the data.

## Look

- Light mode only. A neutral light palette with one deep teal-green accent. The exact values live in [`palette.md`](palette.md); do not copy them elsewhere.
- One sans font, Schibsted Grotesk, for all UI text. Martian Mono for SAN moves, FEN strings and ECO codes.
- Flat panels with 1px borders. Shadow is used only on floating layers (popovers, dialogs, toasts).
- Corners are lightly rounded and consistent across controls and panels.

## Canopy view

The Canopy tab draws the next few plies as a branching tree. Branch width is the number of games that reached the position. Branch color is your score from the current position, running from the low end to the high end of the score scale in `palette.md`.

## Constraints

- Fixed slot geometry. The board column and every workspace slot keep the same size while you play, and `--board-size` drives the layout. `e2e/layout-stability.spec.ts` guards this; run it after any layout or CSS change.
- Accessibility. Roles and aria attributes stay in place, the live region keeps announcing results, focus rings stay visible, and text meets AA contrast.
- Static export and CSP. No third-party origins, fonts are self-hosted through `next/font`, and inline scripts are covered by the hashes from `scripts/csp-hashes.mjs`.
- Motion uses only opacity and transform, and is off under `prefers-reduced-motion`.
