# Field Guide, round 2: shared handoff

This is the working document for everyone (human or agent) on the second
Field Guide pass. **Read all of it before you touch code.** When you finish,
append to the [Status log](#status-log); if you need something from a file you
don't own, add it to [Requests](#requests) instead of editing that file.

The first pass and its reasoning are in `docs/visual-identity.md`. Tokens and
contrast results live in `app/globals.css` and `docs/palette.md`.

---

## 1. What we are trying to achieve

The owner loves the naturalist field-guide look and wants it pushed further,
**with custom UI for everything**: no surface should still read as stock
shadcn/Radix. Today the explorer, header and welcome page are on theme, but
the **filters sheet, appearance (settings) menu, player popover, dialogs,
toasts, tooltips, form controls, empty and loading states** are not.

The app should feel like a well-made naturalist's field guide and specimen
cabinet that happens to be a fast analysis tool:

- **A field guide** (the book): plates with figure numbers and captions,
  taxonomy breadcrumbs, kicker labels, index tabs down the edge.
- **A specimen cabinet** (the collection): accession tags with mono numbers,
  labelled drawers, catalogue cards, counted lists ("Bullet (12)").
- **A field notebook** (the instrument): ruled pages with a margin rule,
  measuring scales with ticks, ink ticks in boxes, dated stamps.

**It must still be a precise, fast tool.** Data stays dense and legible; the
theme lives in frames, labels, controls and small gestures, never on top of data.

### Taste rules (read twice)

1. **One signature gesture per surface.** A sheet gets a binding edge *or*
   ruled lines in its header, not tape *and* stamps *and* deckle *and* ruling.
2. **No costume.** No handwriting fonts, no fake barcodes, no aged/stained
   paper, no sepia filters, no skeuomorphic leather, no illustrations of leaves
   sprinkled around. The warmth comes from cream ground, ink, rules and type.
   Real collection sites (NHM, Smithsonian, BHL) are flat; copy that restraint.
3. **Numbers must label something real.** "Fig. 2" or "No. 014" only where it
   names a thing a user could cite (a position, a player, a filter group).
4. **Rotation ≤ 2°, and only on stamps.** Nothing else is tilted.
5. **Italics** only for names (openings, players in the switcher, captions),
   never for prose or controls.
6. **One accent** (forest green `--primary`). Results keep their own tokens.

## 2. Inspiration (researched, not copied)

| Source | Element we take |
| --- | --- |
| Audubon bird guide (audubon.org/bird-guide) | Filter groups each with their own small "Clear" link |
| Smithsonian NMNH collection search | Counted lists: "Blitz (24)"; plain-language record totals |
| Biodiversity Heritage Library | Cream ground and ink; "Plate 10 / Tab. 330" captions; browse-tab rows |
| Kew, Plants of the World Online | Small-caps **kicker** above a name ("SPECIES" over the binomial) |
| iNaturalist observation pages | Short metadata grid (Who / What / Where / When) |
| Public Domain Review | Slash-separated category trail under a title |
| NYBG Virtual Herbarium | Mono reserved for accession / catalogue codes |
| Field notebooks, rulers (CSS technique refs: freefrontend range sliders, MDN repeating-linear-gradient) | Ruled lines with a margin rule; tick-mark scales; ink tick checkbox |

## 3. The Field Kit (component vocabulary)

Workstream A builds these. Everyone else **uses** them and does not restyle
primitives locally. New shared pieces live in `components/field/`; shadcn
primitives in `components/ui/` are restyled in place (keep file names,
exports, variant names, sizes and every aria attribute).

### 3a. CSS utilities (in `app/globals.css`, `@utility`)

| Utility | Look |
| --- | --- |
| `label-caps` (exists) | small caps, 0.06em tracking, muted |
| `kicker` | `label-caps` + primary-tinted ink, 11px, sits 2px above a serif title |
| `ruled` | faint horizontal rules every `--rule-gap` (default 1.75rem) via repeating-linear-gradient in `--rule` at ~60% |
| `margin-rule` | one vertical hairline in `--rule-strong` (light: a muted red-brown `--margin`, see tokens) at `--margin-x` (default 2.25rem) from the left, like a notebook margin |
| `ticks` | bottom-edge tick scale: minor ticks every N px, taller major ticks every 5th, in `--rule-strong` |
| `perforated` | top edge of perforation dots (radial-gradient), for toast slips / tear-off |
| `stamp` | inset double border (3px double) in currentColor, mono uppercase 0.12em, rotate(-1.5deg); no texture mask (keep it crisp) |
| `leader` | dotted leader between a label and a value (flex filler with dotted bottom border) |
| `binding` | left edge "binding": 6px band of `--specimen` with a hairline on its inner side |

Every utility that draws meaning with backgrounds must also have a
`@media (forced-colors: active)` fallback using borders, or be purely
decorative.

### 3b. New tokens (additive)

`--margin` (notebook margin rule: light ≈ oklch(0.62 0.09 30 / 0.55), dark ≈
oklch(0.7 0.08 30 / 0.45)), `--rule-gap`, `--margin-x`, `--stamp` (stamp ink,
default `--primary`), `--paper-shadow` (soft, warm, 2-layer shadow for floating
paper: `0 1px 0 oklch(… / .06), 0 8px 24px -8px oklch(… / .25)`), `--tape`
(only if used at all).

### 3c. Primitives restyle (`components/ui/*`)

| Primitive | Field-guide form |
| --- | --- |
| `sheet` | **Field-notebook page.** Paper (`--card`) with `binding` on the edge toward the app, `--paper-shadow`. Header: `kicker` + serif title, then a double rule. Body gets generous 20-24px padding. Footer actions sit on a hairline. No ruling behind controls (readability). |
| `dialog` | **Index card / plate page.** `--card`, square-ish (radius-md), hairline frame plus an inner hairline inset 4px (a printed plate border), `--paper-shadow`. Title serif; optional `kicker`; close button as a small square "×" tag. |
| `dropdown-menu`, `popover`, `select` content, `command` | **Card-catalogue card.** `--card`, hairline frame, `--paper-shadow`. Group labels as `kicker`. Items: 32px rows, hairline separators between groups, highlighted item = `--specimen` with a 2px primary left rule (no full green fill). Checked radio/checkbox indicators as ink ticks (see checkbox). Shortcuts in mono. |
| `tooltip` | **Specimen tag.** Small ink (`--foreground`) tag with paper text, square corners, a tiny "eyelet" dot at the leading edge (pseudo-element), mono or sans 12px. Arrow kept but squared. |
| `sonner` (toasts) | **Field note slip.** `--card` paper, `perforated` top edge, hairline frame, `--paper-shadow`, a `kicker` line ("Noted", "Imported", "Copied") above the message where the API allows, icon in primary ink. Errors use `--destructive` ink, never a red fill. |
| `checkbox` | **Ink tick in a box.** 16px square, 1.5px `--foreground` border, radius 2px; checked = an ink check stroke (not a filled green box). Indeterminate = short ink dash. |
| `slider` | **Measuring scale.** Track is a hairline with `ticks` below; range is a 2px primary bar; thumbs are small square "sighting" markers (or a 2px-wide pin with a square head) with a visible focus ring; keep Radix keyboard behaviour. Optional numeric min/max labels at the ends in mono. |
| `toggle-group` | **Index tabs.** Segments as tab-cards along a shared baseline: hairline box, active = `--card` raised (no fill colour), primary 2px top rule, ink text; inactive = `--specimen`, muted. Never pill-shaped. |
| `input` | **Ledger field.** Bottom border in `--rule-strong` (1px) + faint full hairline frame at 40% (kept for affordance and contrast ≥3:1 on the bottom rule); focus = 2px primary bottom rule + ring. Placeholder muted. Mono for numeric inputs (`inputMode=numeric`). |
| `badge` | **Accession tag.** mono, square, hairline, `--specimen`. Variant `stamp` uses the `stamp` utility. |
| `button` | Keep variants. `default`: ink-green solid, square-ish. `outline`: hairline paper. `ghost`: no frame, underline-on-hover in ink. Add variant `tag` (small mono uppercase, hairline, specimen ground) for "Clear"/"Reset" links. |
| `tabs` | Already ledger tabs; leave. |
| `skeleton` | **Faint ruled lines** (2 or 3 hairlines) instead of grey blocks; gentle opacity pulse, off under reduced motion. |
| `separator` | Hairline in `--rule`; optional `double` variant. |
| `scroll-area` | Thin rule-coloured thumb. |

### 3d. New shared components (`components/field/`)

- `Kicker` (`<p className="kicker">`), `PlateCaption` ("Fig. 2 —" + italic serif caption), `SpecimenTag` (mono code in hairline box), `Stamp` (rotated double-border mono stamp; `tone` = primary | muted | destructive), `Leader` (label …… value row), `MetaGrid` (2-column definition list: label-caps term, value; hairline rows), `CountedOption` (label + `(n)` tabular count; used in filter chips), `FieldSection` (kicker heading + optional "Clear" `tag` button + content, hairline above; used in the filter sheet and appearance menu), `EmptySpecimen` (an empty-state block: a small dashed specimen-tag outline drawn in hairline, a serif italic title like "No specimens collected here", a one-line muted hint, optional action).

All must be accessible (real semantic elements, decorative parts `aria-hidden`)
and work in both themes.

## 4. Surfaces and who owns them

| WS | Owner files | Goal |
| --- | --- | --- |
| **A. Field Kit** (runs first) | `app/globals.css`, `components/ui/*`, `components/field/*` (new), `docs/palette.md` | Sections 3a-3d. Write a short usage section for each new component at the bottom of this doc (Field Kit reference). |
| **B. Settings & filters** | `components/filters/*`, `components/layout/{ThemeToggle,SoundToggle,Header}.tsx` | Filter sheet becomes a field-notebook page: `FieldSection`s with per-group Clear, result as index tabs, time control as `CountedOption` chips (counts come from data only if already available cheaply; otherwise no counts — don't add worker APIs), ratings as measuring-scale sliders with ledger inputs, date presets as index tabs and a "date stamp" custom-range pair, opponent as a catalogue-card combobox. Appearance menu becomes a **settings card**: sections Theme / Board / Move sounds as `kicker` groups; theme as three index tabs or radio rows with ink ticks; board themes as **swatch specimens** (a 2×2 mini-board chip with the two square colours, name in italic serif, a "default" stamp on Lichen); sound sets as rows with mono tags. Keep every `menuitemradio` role/name (e2e). Header: optional thin kicker strip, keep h-14 and all controls. |
| **C. Dialogs & players** | `components/players/*`, `components/layout/ShortcutsDialog.tsx`, `components/onboarding/*` | Import dialog as an index card with "Accession" framing (source tabs as index tabs, drop zones as dashed specimen trays with a ruled inner area), progress as a measuring tape (ticks + primary fill, mono numbers). Player manager as a **collection register**: each player a catalogue card with `SpecimenTag` (source), `MetaGrid` (games, last sync, colours), actions as `tag` buttons; delete confirmation with a destructive `Stamp`. Player switcher popover as a counted index. Shortcuts dialog as a "Key to symbols" plate (two-column `Leader` rows, mono keycaps). Welcome page: adopt kit pieces only where it improves consistency. |
| **D. Explorer states** | `components/explorer/*`, `components/board/*`, `components/layout/AppShell.tsx` | Empty / error / loading states use `EmptySpecimen` and ruled skeletons (moves table, games list, canopy, LoadingShell). Opening header gains a **taxonomy trail** (family / variation as slash-separated muted crumbs, final name italic) within its fixed h-7. Games list row metadata reads like a register (mono date, label-caps time class). Board toolbar icon buttons get specimen-tag tooltips (via the kit). A plate caption for the board ("Fig. — after 2. Nf3") only if it fits an existing slot without changing geometry; otherwise skip. |

**Order:** A first. B, C, D start when A has logged "done" (they run in
parallel and own disjoint files). If B/C/D need a kit change, they add a
Request; the coordinator applies it.

## 5. Hard constraints (all workstreams)

- **Layout stability is a tested contract.** `e2e/layout-stability.spec.ts`
  measures slot rects; don't change heights of: header (h-14), side switch
  (h-11), opening header (h-7), filter row (h-8), line strip (h-11), summary
  (52px), table header (28px), rows/total (32px), button sizes (h-9 / h-8 /
  size-9), board geometry. Visual-only changes inside those boxes.
- **Accessible names, roles and texts used by e2e must not change.** Before
  editing a component, grep `e2e/` for its labels/roles. Examples: tabs
  "Chess.com/Lichess/PGN/JSON", "Import games", "Appearance", `menuitemradio`
  names (Light, Dark, System, Lichen, Green, Brown, Blue, Slate, sound names),
  "Add filter", rating inputs, "Reset to start", heading /Your openings/.
- **Accessibility:** keep focus-visible rings, keyboard behaviour, aria
  attributes; text contrast ≥ 4.5:1, control boundaries ≥ 3:1 (check with
  the contrast script noted in `palette.md`); every decorative SVG/pseudo is
  `aria-hidden`; `prefers-reduced-motion` turns off motion; meaning-bearing
  rules/ticks have a `forced-colors` fallback.
- **CSP:** no external assets or fonts; inline SVG / data URIs only.
- **Performance:** no animated SVG filters; textures are static tiles.
- **Process:** don't commit (coordinator commits). Don't run `pnpm build` or
  `pnpm e2e` (coordinator runs them). Do run `pnpm typecheck`, `pnpm lint`,
  `pnpm test` in `web/` before logging done.

## 6. Definition of done

- No stock-looking surface left in your area in light **and** dark.
- Uses Field Kit pieces instead of local one-off styles.
- Typecheck, lint and unit tests pass; nothing in section 5 broken.
- Status log entry: what changed (files), what you deliberately skipped, open
  risks, and any Requests.

---

## Field Kit reference

_(Workstream A fills this in: one short entry per utility/component with its
props and a usage example.)_

## Requests

_(Format: `- [WS-x → owner] what you need and why`. Coordinator resolves and
marks ✅.)_

## Status log

- **Coordinator:** research done (2 rounds: natural-history collection sites,
  field-notebook control techniques). Baseline screenshots of the off-theme
  surfaces taken. Workstream A started.
