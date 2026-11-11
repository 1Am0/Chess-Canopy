# Visual identity: "Field Guide"

Chess Canopy is a field guide to your own openings. The interface borrows from
naturalist field guides, herbarium specimen labels and printed opening
encyclopedias (MCO, ECO): warm paper, forest-green ink, hairline rules, a
serif for names and a catalogue mono for codes. The data stays dense and
exact; the personality lives in type, rules and a few signature details, never
in illustration on top of the data.

## Why this direction

Research (Firecrawl scrape of chess.com explorer, Lichess analysis,
OpeningTree, ChessMonitor, Aimchess, ChessBase web, Chessable, Chesstempo,
Audit Chess, Listudy, Chess Graph) showed every peer uses:

- sans-serif type only (Inter, Noto Sans, Poppins, Montserrat, system fonts);
- one saturated accent on charcoal/navy (green, amber, gold, blue, purple);
- uniform 4-8 px rounded corners and card chrome;
- plain white/gray/black W/D/B bars and green/red results;
- a table as the only view of the move tree.

Nobody uses editorial serif type, a paper-and-ink palette, or draws the
opening tree itself as the main picture. Those three gaps are the identity.

Reference points: NYBG Virtual Herbarium (mono reserved for catalogue codes,
serif for names), Biodiversity Heritage Library (cream ground, ink links),
Typewolf (zero-radius controls next to an editorial serif), Fonts In Use
(index rows with metadata lines), Nate Solon's repertoire Sankey (branch width
= frequency, colour = score), Linear's LCH-derived themes.

## Type

| Role | Font | Why |
| --- | --- | --- |
| Display, opening names, wordmark, headings | **Newsreader** (variable, opsz + wght, italic) | Editorial serif with real tabular figures (checked with fontTools) |
| UI text, numbers, tables | **Schibsted Grotesk** (variable wght) | News grotesk with `tnum`, not Inter (the peer default) |
| SAN moves, ECO codes, FEN | **Martian Mono** (variable wght + wdth, used at wdth 87.5) | Catalogue/accession-code feel, as on the NYBG herbarium |

All three are OFL and self-hosted by `next/font/google` (CSP `font-src 'self'`).
Every count and percentage uses `tabular-nums`.
Section labels and table headings use the `label-caps` utility: small caps
(`font-variant-caps: all-small-caps`), `letter-spacing: 0.06em`, muted ink.

## Colour

Token names are unchanged (shadcn and component classes depend on them); only
values move. New tokens are additive.

- **Light, "paper":** warm cream ground, near-black green ink, forest-green
  primary. Surfaces separate by hairline rules more than by shadows.
- **Dark, "lamp-lit study":** deep warm moss-black (never pure black), cream
  ink, lighter canopy green. Not a plain inversion: hues stay warm.
- **New tokens:** `--ink` (strongest text), `--rule` (hairline), `--rule-strong`
  (control borders, table header rule), `--specimen` (label/tag ground),
  `--tree-low` / `--tree-mid` / `--tree-high` (diverging score scale for the
  Canopy view: ochre to sand to teal-green; differs in lightness as well as
  hue, so it survives colour-blindness, and every branch also prints its score).
- **W/D/B bars:** keep the chess convention (white / gray / black) but as paper,
  graphite and ink, flat, with a hairline outline and no gloss.
- **Board:** new default theme **Lichen** (pale paper and grey-green), muted
  next to the saturated chess.com green. The older themes stay selectable.

## Shape and texture

- Radius scale tightened: base 6 px (`sm` 2, `md` 4, `lg` 6, `xl` 10).
  Controls are crisp, almost square.
- Hairlines (`--rule`) instead of shadows; `shadow-*` only for floating layers
  (popovers, dialogs, sheets, toasts).
- Static paper grain: one SVG `feTurbulence` tile as a `data:` background on
  `body` (never animated, never over the board or the tables, which have their own
  surface). Lower opacity in dark mode.
- The header sits on a double hairline rule like a printed running head.

## Signature details

1. **Logomark:** a pawn whose head is a tree canopy, drawn as one inline SVG
   (`components/layout/Logo.tsx`), also the favicon (`app/icon.svg`).
2. **Specimen label:** the opening header shows the ECO code as an accession
   tag (Martian Mono, square hairline box) and the opening name in Newsreader
   italic.
3. **Ledger move table:** hairline row rules, small-caps headings, a double
   rule above the totals row (accounting style). Moves with a small sample are
   drawn lighter so thin statistics read as thin.
4. **Canopy view:** a third tab next to Moves and Games draws the next plies
   from the current position as a left-to-right branching tree: branch
   thickness = games, colour = your score, labels in mono. Click a branch to
   play that line.
5. **Almanac welcome page:** a large serif headline, steps numbered I, II, III
   as marginalia rather than cards, and a hairline "specimen plate" of an
   opening tree.

## Constraints that do not change

- Fixed slot geometry and `--board-size` (guarded by `e2e/layout-stability.spec.ts`).
- Accessibility work: focus-visible rings, roles, live region, reduced motion,
  AA contrast for text (see `palette.md`).
- Static export and the CSP: no third-party origins, fonts self-hosted.
- Motion is opacity/transform only and is off under `prefers-reduced-motion`.
