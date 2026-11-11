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

_Workstream A: all in `app/globals.css` (utilities, tokens) and `components/field/` (import from `@/components/field`)._

### CSS utilities

| Utility | Usage |
| --- | --- |
| `kicker` | `<p className="kicker">Filters</p>` over a serif title. 11px small caps, primary ink, `margin-bottom: 2px` (add `mb-0` when inside a flex/gap parent). |
| `ruled` | `<div className="ruled">` faint rules every `--rule-gap` (override: `[--rule-gap:1.5rem]`). Decorative; keep under prose, never under controls. |
| `margin-rule` | `<div className="relative margin-rule">` vertical red-brown hairline at `--margin-x`. Needs a positioned element. Uses `::after`, so it pairs with `binding`. |
| `ticks` | `<span aria-hidden className="ticks h-2 [--tick-gap:5%]">` ruler scale on the bottom edge (default gap 8px, taller tick every 5th, closing tick at the right edge). Sizing is the caller's. `--tick-color` overrides ink. |
| `perforated` | `<div className="perforated pt-5 ...">` dotted tear-off edge along the top. Leave about 6px of top padding. Uses background-image (add `!`, as `perforated!`, if another rule sets the `background` shorthand, e.g. Sonner). |
| `stamp` | `<span className="stamp">Default</span>` or use `<Stamp>`. 3px double border, mono caps, -1.5deg. Ink from `--stamp`. |
| `leader` | `<div className="flex items-baseline gap-2"><span>Label</span><span className="leader" aria-hidden /><span>Value</span></div>`, or use `<Leader>`. |
| `binding` / `binding-end` | `<div className="relative binding">` 7px specimen band with a hairline on the left / right edge (positioned element). Sheets apply it automatically (right sheet: `binding`, left sheet: `binding-end`). |
| `skeleton-lines` | Faint ruled lines as a placeholder fill; `Skeleton` already uses it. |
| `shadow-paper` | Tailwind shadow utility from `--paper-shadow`, for floating paper (dialog, sheet, popovers, toasts). |

All have `forced-colors` fallbacks (system `GrayText` borders) or are decorative.

### Components in `components/field/`

- `Kicker`: `as?: "p"|"span"|"div"|"h2"|"h3"|"h4"` plus normal props. `<Kicker>Opening</Kicker>`.
- `PlateCaption`: `fig?` (number or string; omit for a bare caption), `as?: "p"|"figcaption"|"div"`. `<PlateCaption fig={2}>After 2. Nf3</PlateCaption>` renders "FIG. 2 -- *After 2. Nf3*".
- `SpecimenTag`: span with mono code in a hairline box. `<SpecimenTag>B12</SpecimenTag>`.
- `Stamp`: `tone?: "primary"|"muted"|"destructive"` (default primary). `<Stamp tone="destructive">Deleted</Stamp>`. Tilt is baked in; don't add other rotation.
- `Leader`: `label`, children = value. `<Leader label="Next move"><kbd>→</kbd></Leader>`.
- `MetaGrid`: `items: {label, value}[]`; renders a `dl` with hairline rows. `<MetaGrid items={[{label:"Games", value:60},{label:"Last sync", value:"3 Nov"}]} />`.
- `CountedOption`: `label`, `count?` (omit to hide the "(n)"). Inline spans, safe inside a chip/button: `<button><CountedOption label="Bullet" count={12} /></button>`.
- `FieldSection`: `title`, `onClear?`, `clearLabel?` (default "Clear"), `clearDisabled?`, plus `section` props. Client component. Renders hairline-topped `section` (first one has none) with a `h3.kicker` and a `tag` button named "Clear <title>" (accessible name, visible text "Clear"). `<FieldSection title="Result" onClear={reset}>...</FieldSection>`.
- `EmptySpecimen`: `title`, `hint?`, `action?`. Add `role="status"` yourself if it is a live state. `<EmptySpecimen title="No specimens collected here" hint="Play a move to start." />`.
- `InkTick`, `InkDash`: the hand-ruled check / dash SVGs (decorative) used by checkbox, select and menu indicators.

### Primitive changes in `components/ui/` (all additive, nothing renamed)

- `Button`: new variant `tag` (small mono uppercase, hairline, specimen ground) and size `xs` (h-6). Use `variant="tag" size="xs"` for Clear/Reset. `ghost` now underlines on hover.
- `Badge`: default is now an accession tag (mono, hairline, specimen), not a solid green pill. New variant `stamp`.
- `Separator`: new prop `variant="double"` (3px double rule).
- `DialogHeader`, `SheetHeader`: new optional `kicker` prop, rendered above the title. `SheetHeader` now carries the double rule under it and `SheetFooter` the hairline above; keep titles in `DialogTitle`/`SheetTitle` (serif).
- `DropdownMenuShortcut`, `CommandShortcut`: new mono shortcut spans (`ml-auto`).
- `Toaster`: kicker line ("Noted", "Note", "Caution", "Problem") is drawn by CSS from the toast type, so `toast.success(...)` etc. need no change. Errors use destructive ink.
- `Slider`: ticks are drawn automatically (20 divisions). Root is now h-6 (was 16px). Keep passing the same props.
- `Input`: ledger field; numeric/`inputMode="numeric"|"decimal"` inputs automatically use mono tabular figures.
- `ToggleGroup`: index tabs. Group has no border of its own (heights unchanged); items are h-9 as before.
- `Checkbox`: ink tick, indeterminate dash supported.
- `Tooltip`: specimen tag with an eyelet; no arrow (there was none).

## Requests

_(Format: `- [WS-x → owner] what you need and why`. Coordinator resolves and
marks ✅.)_

## Status log

- **Coordinator:** research done (2 rounds: natural-history collection sites,
  field-notebook control techniques). Baseline screenshots of the off-theme
  surfaces taken. Workstream A started.
- **Workstream A (Field Kit): done.**
  - Files: `app/globals.css` (tokens `--margin --rule-gap --margin-x --stamp --paper-shadow`, `--shadow-paper`,
    `--color-margin/stamp`; utilities kicker, ruled, margin-rule, ticks, perforated, stamp, leader, binding,
    binding-end, skeleton-lines, each with a forced-colors fallback), all of `components/ui/*` except `card`,
    `label`, `tabs`, `collapsible`, `keys` (left as is), new `components/field/*` (Kicker, PlateCaption,
    SpecimenTag, Stamp, Leader, MetaGrid, CountedOption, FieldSection, EmptySpecimen, InkTick/InkDash, index.ts),
    `docs/palette.md` (new tokens + 10 contrast rows, all pass).
  - Checked: `pnpm typecheck`, `pnpm lint`, `pnpm test` pass. CSS compiles through `@tailwindcss/postcss`; a static
    mock of the utilities was screenshotted in light and dark. Radix/Sonner components were NOT visually
    verified in the real app (no rebuild by design): coordinator please eyeball sheet, dialog, menus, toast.
  - Deliberate skips: tooltip arrow (never existed), `--tape` (unused), slider min/max labels (consumer's call),
    no `card` restyle, dialog footer left borderless. Badge default changed from green solid to specimen tag
    (only used with `outline` today).
  - Risks: (1) Toast kicker is CSS `content` on `[data-content]::before`, depends on Sonner's `data-content` /
    `data-icon` attributes and `perforated!` beating its `background` shorthand. (2) Slider root grew from 16px to
    24px tall and the old filter sheet layout shifts slightly (WS B restyles it anyway). (3) `FieldSection` Clear
    button has accessible name "Clear <title>" (visible "Clear"). (4) `binding` pseudo-element sits at the sheet's
    edge; sheet bodies should keep >= 12px horizontal padding. (5) DropdownMenu/Select/Command rows use
    `border-l-2` for the highlight, so row content is inset 2px versus before.
  - Requests: none.
- **Coordinator review of WS-A (after a rebuild):** kit verified in the real
  app. Toast slip (perforated, "Noted" kicker), index-tab toggle group, ticked
  slider scales and ledger inputs render well in light and dark. Still off-theme
  and now owned by B: time-control and date-preset **pill** chips (local classes
  in `FilterSheet.tsx`), native `mm/dd/yyyy` date inputs, the opponent combobox
  trigger, the sheet's footer buttons, and the appearance dropdown (still a
  plain list with lucide icons and coloured squares). C: player popover is close
  but should become a counted index; import dialog and player manager untouched.
  D: empty/loading states untouched. B, C and D start now, in parallel.
- **Workstream D (Explorer states): done.**
  - Files: `components/explorer/{MoveTable,GamesList,OpeningHeader,CanopyTree}.tsx`, `components/board/BoardControls.tsx` (kbd chip colour only).
  - MoveTable, GamesList (failed / other-colour / filtered-out / no games) and CanopyTree empty states now use `EmptySpecimen`; out-of-book and "no games reach" use the title "No specimens collected here" with the old text as hint. Overlays use `overflow-hidden` + `py-2` so they stay inside the existing region. Alert roles and button labels kept.
  - OpeningHeader: slash-separated sans muted family crumbs, final name serif italic; same h-7, nav "Opening", ECO tag, truncation.
  - GamesList rows: mono tabular muted date, label-caps time class kept, result chip is now mono uppercase 11px (win/draw/loss *-text tokens kept). Row/header heights untouched.
  - Canopy legend/depth: `Kicker` labels; depth control is now index tabs (active = card + primary top rule).
  - Skipped: LoadingShell/PositionSummary/MoveTable skeletons already use the restyled `Skeleton` with identical slots (no change needed); BoardControls already used the kit Tooltip with labels (only the shortcut chip colour was adjusted); board PlateCaption skipped (no free slot without geometry change).
  - Risks: result chip uses a plain border, not the 3px double `stamp` (too heavy at 20px); EmptySpecimen is ~170px tall with an action, so very short panels clip it (overflow-hidden). Not visually verified. typecheck, lint, test pass. Requests: none.
- **Workstream C (Dialogs & players): done.**
  - Files: `components/players/{ImportDialog,ImportForm,ImportProgress,ImportIndicator,PlayerManager,PlayerSwitcher}.tsx`,
    `components/layout/ShortcutsDialog.tsx`, `components/onboarding/Welcome.tsx`.
  - Import dialog: "Accession" kicker; source tabs restyled locally as index tabs (class overrides on `TabsTrigger`, `tabs.tsx` untouched);
    drop zones are dashed trays with a `ruled` inner area; progress is a ticked measuring tape (same progressbar role/aria, Cancel unchanged);
    header indicator has a thin primary fill along its bottom edge. Manager: "Collection register" kicker, catalogue cards (No. 00n kicker,
    italic serif name, `SpecimenTag` source, `MetaGrid` Games / Last sync), `tag` buttons with unchanged aria-labels, destructive `Stamp`
    on the delete confirmation. Switcher: "Collection" kicker, italic names, dotted leader to mono counts. Shortcuts: "Key to symbols", dotted leader rows with mono keycaps.
    Welcome: `Kicker` swaps only (plus "Accession" kicker over the form).
  - Skipped: `ImportProvider` untouched; "No. 00n" is list position (not a stable id); `onboarding/SpecimenPlate` untouched.
  - Risks: not visually verified in the real app (no build). Index-tab overrides rely on class precedence over `TabsTrigger` defaults (`cn`/twMerge).
    Manager list now scrolls (max-h 60vh) when long. Typecheck, lint, unit tests pass.
  - Requests: none.
- **Workstream B (Settings & filters): done.**
  - Files: `components/filters/FilterSheet.tsx` (kicker "Sampling criteria" over "Filters"; six `FieldSection`s each with a
    per-group Clear; Result and Date presets as index tabs; time control as square tag chips via `CountedOption`, no counts;
    ratings keep slider + ledger inputs, with mono 400 / 3000+ scale labels; date range as `DateStamp` fields with a
    label-caps From/To prefix over native date inputs; opponent trigger as a ledger field with italic serif name and
    `InkTick` in the list; footer = tag "Clear all (n)" + primary "Done"), `components/filters/FilterRow.tsx` (chips in mono
    tag style), `components/layout/ThemeToggle.tsx` (settings card: kicker groups, 2x2 mini-board swatches, italic serif
    names, aria-hidden "default" Stamp on Lichen; radio roles and names unchanged).
  - Checked: typecheck, lint, unit tests pass. Not visually verified in the real app.
  - Skips: `Header.tsx` and `SoundToggle.tsx` untouched (already kit-consistent, 320px test safe); no time-control counts
    (no cheap data); no custom-range preset tab.
  - Risks: the old "Reset (n)" is now "Clear all (n)"; the separate "Clear opponent" X button is replaced by the section's
    "Clear opponent" tag; Date presets are now radios in a radiogroup "Date presets" (were aria-pressed buttons); sheet
    needs a look for 320px width and date field height (h-11).
  - Requests: none.
- **Coordinator, round 2 close:** rebuilt with A-D merged; full e2e 34/34
  passing, unit tests 385 passing. Reviewed in light and dark: filter sheet
  (field-notebook page, per-group Clear, index tabs, ticked rating scales),
  appearance catalogue card (mini-board swatches, "default" stamp), import
  index card, collection popover with leaders, perforated toast slips.

## Backlog (noted for later, not started)

- **Custom board arrows that match the theme.** The current arrows (saturated
  blue candidates, orange hover preview, rgba user arrows in
  `components/board/BoardOverlay.tsx` and `ExplorerBoard.tsx`) pop far too much
  against the paper look. Redo them as ink/pencil-style marks: muted ink
  colours from the tokens, thinner tapered strokes, a hand-drawn or
  nib-like head, lower opacity, maybe a slight paper "pressed in" feel.
  Keep: thickness/opacity still encodes how often a move was played, the hover
  preview stays distinguishable from candidates, and the fixed SVG node count
  (layout/perf contract). Owner request from 11 Nov 2026.
- **Direction check: "scrapbook" paper theme.** The owner meant a real
  scrapbook / paper-craft feel (physical paper, layered cut-outs, tape, etc.),
  more tactile than the current field-notebook restraint. Research is under
  way; nothing implemented until the owner approves the direction.

---

# Round 3: "Naturalist's collected scrapbook" (direction A)

The owner picked **direction A**: a naturalist's collected scrapbook. Real
paper pieces pasted onto a board, held with tape and photo corners, specimen
tags on string, the odd handwritten margin note. The owner explicitly asked
for **real craft, not shortcuts**: no generic `rotate(1deg)` + `box-shadow`
and calling it done, no emoji, no stock icons pretending to be tape. Every
paper object is a deliberately drawn piece.

**Step 1 is a prototype of one screen** (the explorer view plus the filter
sheet), reviewed by the owner before anything else changes.

## R3.1 The scene

Think of a page in a botanist's scrapbook photographed flat under soft daylight:

- **Ground (the scrapbook board):** a light kraft card in light mode, with
  visible but quiet fibre (a static texture tile: fine noise plus a few longer
  fibres). Dark mode: a deep walnut-brown board, not grey. The ground is what
  the cream sheets sit *on*, so the sheets read as separate objects.
- **Sheets (cream paper):** every main surface (board mount, explorer panel,
  sheets, dialogs) is a cut piece of cream paper with its own fibre tile, a
  real two-part paper shadow (tight contact shadow + soft lifted shadow, offset
  slightly down-right as if lit from the top-left), and **slightly imperfect
  edges** (not rounded-corner rectangles: square corners, and where noted a
  deckled or torn edge).
- **Data never sits on texture it can't afford.** Tables, numbers, moves and
  the board squares stay on flat, high-contrast paper. Texture lives in the
  margins, frames and fixings.

## R3.2 Objects to draw (custom, deterministic)

All shapes are generated by a small seeded generator (`lib/paper.ts`): given
a seed and a size it returns SVG path data, so a torn edge or tape end is
irregular but **identical on every render** (no `Math.random` at render time).
Unit-test the generator (determinism, bounds, path validity).

| Object | Spec |
| --- | --- |
| **Masking/washi tape** | A strip 18-24px tall, 70-110px long, translucent (pale ochre masking tape `oklch(0.9 0.05 92 / 0.72)`, and a sage washi variant), **torn ends** drawn as irregular zig-zags from the generator, faint lengthwise fibre and a subtle highlight band; `mix-blend-mode: multiply` in light mode so it tints what's under it; dark mode uses a lower-alpha lighter tape without multiply. Placed across a sheet edge at -3° to +4°. Purely decorative (`aria-hidden`, `pointer-events: none`). |
| **Photo corners** | The four classic black/kraft paper photo corners (right-angle triangles with a folded-pocket look: a darker inner triangle edge and a tiny highlight) that "hold" the chessboard print on its mount. Inline SVG, sized ~22px. |
| **Under-sheet** | A second sheet peeking from under a panel (offset a few px, rotated ≤1°, slightly different paper tone), giving the stacked-paper look. Pseudo-element or absolutely positioned SVG; never changes the measured rect. |
| **Torn edge** | For the header strip's bottom edge: an irregular torn paper edge (generator path used as an SVG mask/clip on a decorative layer) with the paper's fibres showing as a slightly lighter rim. |
| **Specimen string tag** | A small manila tag (rectangle with clipped corners and a reinforced punched hole) tied with a thin string line, used for the ECO code in the opening header (inside its fixed h-7). |
| **Folder/index tabs** | Moves / Games / Canopy as paper tabs sticking up from the panel's top edge, the active tab joined to the sheet (same paper, no line between), inactive tabs a shade darker and slightly behind. Same h-9 slot. |
| **Handwritten margin note** | One font, **Caveat** (OFL, self-hosted via next/font), in a pencil-graphite or ink colour, used **only** for short annotations, never data. In the prototype: one note that says something true and useful (e.g. near the summary: "your best scoring reply" with a hand-drawn arrow, only when it can be placed without geometry changes; or as a tape label). |

## R3.3 Colour additions

New tokens (light / dark): `--desk` (kraft board ≈ `oklch(0.82 0.04 78)` /
`oklch(0.22 0.025 55)`), `--desk-fibre`, `--sheet` (cream ≈ current card),
`--sheet-under` (slightly darker/yellower cream), `--tape-ochre`,
`--tape-sage`, `--photo-corner`, `--string`, `--pencil` (graphite for
handwriting ≈ `oklch(0.38 0.01 80)` / `oklch(0.8 0.01 80)`), `--sheet-shadow`
(contact + lift). Text contrast rules from palette.md still apply; header
controls and anything on the kraft ground must pass 4.5:1 or sit on a sheet.

## R3.4 Constraints (unchanged from round 2, section 5)

Layout-stability geometry, e2e names/roles, a11y, CSP (`style-src` allows
inline styles; no external assets), reduced motion, forced-colors fallbacks
(hide decorative paper objects, keep borders). Decorations are absolutely
positioned / pseudo-elements with `pointer-events: none` and must not change
any measured rect (overflow-visible wrappers or box-shadow, never padding).

## R3.5 Prototype scope (step 1)

1. Desk ground + sheet primitives + texture tiles + tokens.
2. Header as a torn strip of cream paper across the top of the desk.
3. Board column: the chessboard as a print mounted on a cream mat with four
   photo corners; eval bar and player strips on the same mat.
4. Explorer column: one cream sheet with an under-sheet, held at the top by a
   strip of tape; folder tabs; ECO string tag; one handwritten note.
5. Filter sheet: an index card pinned/taped on the right (keep Radix sheet
   behaviour and section content from round 2).
6. Light and dark. Then stop for owner review.

## Status log (round 3)

- **Round 3 prototype (R3.5): done, awaiting owner review.**
  - Files: `lib/paper.ts` (seeded mulberry32 + generators: `edgeProfile`, `tornStripPath`, `tornEdgeLine`, `tapePath`,
    `deckledPath`, `wobbleLine`, `handArrow`, `fibreStrands`, `svgDataUri`, validators), `tests/paper.test.ts`,
    `components/paper/{PaperSheet,Tape,PhotoCorners,UnderSheet,TornEdge,StringTag,Handnote,use-size,index}`,
    `scripts/gen-paper-textures.mts` -> `app/paper-textures.css` (static desk + sheet fibre tiles, light/dark),
    `app/globals.css` (R3.3 tokens light+dark, `desk`, `sheet-paper`, `paper-scope`, `paper-deco`, `folder-tab` utilities, `font-hand`),
    `app/layout.tsx` (Caveat, preload false), `components/explorer/best-move.ts` + `tests/best-move.test.ts`.
    Applied in: `AppShell` (desk ground on the explorer wrapper only, paddings, board chrome 12rem -> 14.25rem), `Header`, `BoardColumn`,
    `ExplorerBoard` (radius only), `ExplorerPanel`, `PositionSummary`, `OpeningHeader`, `FilterSheet`, `ui/sheet.tsx` (overlay uses new `--scrim`; the old `bg-ink/50` washed out in dark).
  - Objects: header = cream strip with a seeded torn bottom edge (darker under-strip, lighter fibre rim, contact + lift shadow);
    board = print on a cream mat, four folded photo corners (flap, fold line, highlight), eval bar/strips/toolbar on the mat;
    explorer = one cream sheet over a deckled under-sheet (5,7px, 0.7deg) with an ochre tape strip; Moves/Games/Canopy = chamfered folder tabs
    (active joined to the panel, inactive darker and 4px lower, same h-9 slot); ECO = manila string tag with reinforced hole and string inside the h-7;
    filters = index card (red head rule) taped top and bottom (ochre + sage), Radix behaviour kept, inset 16px from the edge on desktop.
  - Handnote: "best for you: <move> . <score>" from `bestCandidate` (best score among non-rare moves, needs 2+ candidates and no tie), shown in the
    free middle of the summary row when the sheet is >= 38rem wide, otherwise as a handwritten tape label on the top strip. Absolute, no rect changes.
  - Checked: typecheck, lint, vitest (incl. 18 new), e2e 34/34. Reviewed light + dark at 2x over two build iterations (first pass had the under-sheet
    painting over the sheet: a stacking context paints its own background below negative-z children, so it now lives in a sibling wrapper).
  - Skips / not done: arrow variant of Handnote exists but is unused (nothing fixed to point at); SideSwitch, FilterRow, LinePanel, toolbar still
    rounded 2-4px controls; dialogs/popovers/toasts/Welcome/loading shell not converted; mobile only checked by e2e (no screenshots);
    forced-colors fallback untested visually; no new contrast rows in palette.md (sheet tones are close to the old card; dark sheet is oklch 0.295).
  - Risks: TornEdge uses CSS `mask-image` data URIs (Chromium/WebKit/Firefox OK, prefixed too); UnderSheet measures via ResizeObserver (renders after hydration);
    `@container/sheet` adds layout containment to the explorer sheet; dark sheet vs walnut desk contrast is low-key (shadows carry the separation);
    decorations on kraft (tape) are subtle in light mode by design (multiply).
- **Round 3 refinement pass (coordinator review): done.**
  - Photo corners: 29px, two layers of paper (darker back, lighter folded front), bright crease, shadow cast on the print, own contact shadow.
  - Tape: 120x22 default, stronger ochre/sage alpha, deeper zig-zag ends (jag 4.8), two-part edge shadow. Photo corners hold the print; sage tape holds the mat
    (top-left/top-right); ochre tape on the explorer sheet's top-left/top-right (left strip carries the note on narrow sheets). Header is now z-5 and the
    mat/sheet wrappers z-10, so tape lies over the torn strip instead of under it.
  - Layering: explorer under-sheet 7,8px at -1deg (fans out bottom-left), deckle amp 2.2; the mat has its own under-sheet (5,6px, +0.7deg). Aside bottom padding 12 -> 20px so it is not clipped.
  - Double framing removed: tab panel has only a hairline top rule (active tab covers it), no box; SideSwitch and LinePanel are square printed hairline boxes.
  - Sheet: fibre tile stronger, `--sheet-vignette` as an inset glow on `--sheet-shadow` (margins only; the table is on the plain sheet), header paper is its own `--strip` tone.
  - Dark: desk L 0.185, sheet L 0.305 warm, light top rim (inset 1px). Contrast rows added to `docs/palette.md` (all pass; sheet vs desk is only 1.4:1 by design, shadows and rim do the rest).
  - Board size: top padding 18px, mat padding 10px, chrome 14.25rem -> 13.5rem (board is 12px bigger than the first prototype, still 21px under the original 12rem).
  - StringTag redrawn: 22px manila tag, washer, string with knot loop and a frayed hanging strand; screenshots after 1.e4 e5 2.Nf3 in `shots/r3-final-moves-*.png`.
  - Checks: typecheck, lint, vitest and e2e 34/34 re-run after the pass.

- **Workstream K (Paper kit v2): done.**
  - Files: `components/ui/*` (every primitive; new `paper-chrome.tsx`), `components/paper/*` (new HighlighterWash, InkCircle, InkStroke, RubberStamp, PaperLabel, TicketEdge, Envelope, PaperClip, PencilHatch, HangTag), `components/field/{InkTick,SpecimenTag,EmptySpecimen}`, `lib/paper.ts` (+9 generators, 11 new tests in `tests/paper.test.ts`), `app/globals.css` (tokens, `.paper-btn/.paper-card/.paper-row/.paper-label/.paper-note`, `pencil-rule`, `ink-draw`, `paper-settle`, folder-tab also for toggles), `scripts/gen-paper-textures.mts` -> `app/paper-textures.css` (pencil rule tile, tape masks, stamp speck mask), `docs/palette.md` (tokens + 26 contrast pairs x2 modes, all pass), reference section above.
  - Built and reviewed in light and dark over three screenshot rounds (toast, error toast, tooltip, header, appearance menu with hover wash, players popover, filters sheet with focused slider, import dialog, shortcuts, plus a temporary gallery page of every primitive, deleted afterwards). Fixes found by looking: toast skin lost to Sonner's unlayered CSS (moved out of `@layer`), dark highlighter dimmed the text (wash now sits behind text, darker band), envelope folds crossed the label, tickets' notches too faint.
  - Deliberate choices: buttons/rows/cards are in `@layer components` so caller utilities win; menus use a hard offset shadow for the "second card" (rotation would be clipped by menu scroll areas); `DropdownMenuContent` gained an inner scroller (className now targets the card); `DialogContent` gained `bodyClassName` (CommandDialog uses it); no corner-cut on toasts (a mask/clip would cut the tape).
  - Risks: `ToggleGroupItem` and `TabsTrigger` overrides in SideSwitch / ImportForm / ExplorerPanel were not touched (they still render, F/H should drop the fake styling); `ghost` icon buttons are bare until hovered (toolbar strips are E's); sound toggle looks pushed-in while on (`aria-pressed`); TicketEdge/HighlighterWash/InkCircle render a plain box until first measurement; forced-colors fallbacks written but not visually tested.
  - Checks: typecheck, lint, vitest, e2e 34/34. Requests: none.

---

# Round 3, step 2: full rollout (owner approved the prototype)

Owner, after seeing the prototype: "I really like this. Make sure to fully
commit to this theme across everything, **especially inside all of the
components**, like custom UI for the eval bar etc."

So the bar is now: **no component interior may look like generic web UI.**
The prototype converted the *frames* (desk, sheets, tape, corners, tabs).
Step 2 converts the *insides*: every control, bar, indicator, list row, menu,
tooltip, toast and dialog becomes a crafted paper/ink object, built from the
paper system (`lib/paper.ts`, `components/paper/*`, tokens, textures) and the
Field Kit. Data still stays legible on flat paper (R3.1), but the things that
*hold* and *show* the data are paper objects.

## S2.1 Design language for interiors

- **Controls are paper, not plastic.** Buttons are small cut card pieces or
  printed boxes: square corners, a 1px printed ink border, a faint paper
  fibre, a pressed state that looks like the card pushed into the page
  (inset contact shadow, 1px down), never glossy fills. Primary actions are
  a solid forest-green card with cream ink, like a printed label.
- **Indicators are instruments drawn in ink.** Bars, gauges and progress are
  drawn like a naturalist's measuring instruments: ruled scales, ticks, ink
  fills with slightly irregular (seeded) edges, pencil labels for
  annotations only, mono for numbers.
- **Selection and focus are marks a person would make:** a pencil/ink
  underline, a circled item (seeded hand-drawn ellipse), a check in ink. Focus
  rings stay clearly visible (a11y), drawn as a crisp ink outline.
- **Overlays are pieces of paper put on top:** menus are index cards,
  tooltips are small tags on string, toasts are taped slips or sticky notes,
  dialogs are cards clipped or taped onto the page with a sheet under them.
- **Motion:** paper only moves like paper: a short settle (opacity +
  ≤4px translate) on open; none under reduced motion.

## S2.2 Component-by-component brief

| Area | Brief |
| --- | --- |
| **Eval bar** | A vertical paper **measuring strip** (like a botanist's ruler / thermometer card): cream strip with printed ticks every pawn (major at 0, ±2, ±5), the white share drawn as cream and the black share as an ink fill whose boundary is a slightly irregular inked edge (seeded), a small **pencil arrow / pointer tag** at the current value with the mono eval label, hatched pencil shading when there's no eval. Same width/height slot as now. |
| **Board** | Squares stay flat (legibility) but get the board theme as printed paper colours with a very faint fibre; last-move and selected squares as translucent **highlighter / watercolour wash** (multiply), legal-move dots as small ink dots; coordinates in printed small mono. **Arrows**: the backlog item, now in scope — tapered **ink/pencil strokes** (deterministic wobble seeded by the move), muted inks from tokens, multiply blend, a nib-like arrowhead; thickness/opacity still encode frequency; hover preview in a distinct pencil-graphite style; fixed SVG node count kept. User-drawn arrows the same family in a few ink colours. |
| **Player strips / toolbar** | Player names as small typed labels pasted on the mat (paper label with fibre, tiny shadow); side dot as an ink dot. Toolbar groups as a strip of card buttons (S2.1). |
| **Side switch** | Two **index-card tabs** / bookmark ribbons; active one sits forward with a pencil underline; counts in mono. |
| **Opening header** | StringTag (done) + name in italic serif; trail crumbs as faint pencil. |
| **Filter row** | Active filters as small **paper tags/labels** pinned with a tiny tape bit or paper clip; "Add filter" as a pencil "+ add" note. |
| **Line strip** | The move strip as a **paper ticket / receipt strip** (perforated ends), moves typed in mono, current move circled in ink (seeded ellipse), start as a stamp. |
| **Summary + W/D/B bars** | Bars as three **cut paper strips** laid side by side (paper / graphite card / ink card) with slightly irregular cut ends at segment joins, labels printed. Keep the chess convention and values; keep label contrast. Legend as tiny paper swatches. |
| **Move table** | Ledger on the sheet (keep), rows separated by printed rules; active row marked with a **highlighter wash** + a pencil tick in the margin; low-sample rows pencilled (lighter); Σ row with double rule. Sort indicators as small ink arrows. |
| **Games list** | Register rows; result as small **rubber stamps** (W / D / L, slightly uneven ink, ≤2° rotation), dates mono, links as ink-underlined. |
| **Canopy** | Ribbons as **watercolour/ink washes** on the sheet (multiply, soft edge), node bars as ink strokes, labels typed; legend as a little paper key card. |
| **Empty / loading** | Empty: a taped empty specimen envelope or blank card with a pencil note. Loading: ruled lines being "pencilled" (static shimmer off under reduced motion). |
| **Header controls** | Paper card buttons; player switcher as a paper label with a fold; theme/sound/help as small round **paper buttons/stamps**. |
| **Menus / popovers / select / command** | Index cards slightly offset over a second card, taped or pinned at the top; rows printed; highlighted row = highlighter wash; checks in ink. |
| **Tooltips** | Small manila tag on a string (reuse StringTag visual language), typed text. |
| **Toasts** | Sticky note or taped paper slip with a pencil kicker. |
| **Dialogs** | A card taped onto the page with an under-sheet; title in serif; sections as ruled card areas; import drop zones as an **envelope / pocket** you drop files into; progress as a measuring tape; player manager as specimen register cards; shortcuts as a "key to symbols" card. |
| **Welcome** | The landing page as a scrapbook spread: desk ground, the headline on a cream sheet, the specimen plate as a taped-in print with photo corners, the import form on an index card, steps as numbered paper tabs/labels, a pencil marginal note. |
| **Sliders / checkboxes / radios / inputs** | Slider: ruler card with ticks and a paper-clip or pin thumb. Checkbox: printed box with an ink check. Inputs: typed onto a ruled line. Toggle groups: index tabs. |

## S2.3 Workstreams

| WS | Files | Runs |
| --- | --- | --- |
| **K. Paper kit v2** | `components/ui/*`, `components/paper/*`, `components/field/*`, `lib/paper.ts`, `app/globals.css`, `app/paper-textures.css`, `docs/palette.md` | **First.** Paper buttons/controls, menus, tooltips, toasts, dialogs, sliders, checkboxes, inputs, toggle groups, new paper primitives needed by others (HighlighterWash, InkCircle, InkArrow/ink stroke helper, RubberStamp, PaperLabel, Ticket strip edge, Envelope). Write a reference section below. |
| **E. Board** | `components/board/*` (eval bar, board, overlay arrows, strips, toolbar) | After K. |
| **F. Explorer** | `components/explorer/*`, `components/filters/FilterRow.tsx`, `components/layout/SideSwitch.tsx` | After K. |
| **H. Overlays & pages** | `components/players/*`, `components/filters/FilterSheet.tsx`, `components/layout/{Header,ThemeToggle,SoundToggle,ShortcutsDialog,AppShell}.tsx`, `components/onboarding/*` | After K. |

Same hard constraints (section 5 and R3.4). Every agent screenshots its work
in light and dark (scripts in the scratchpad; coordinator rebuilds between
merges), self-reviews at least twice, and logs to the Status log.

- **Workstream H (Overlays & pages): done.**
  - Files: `components/layout/{Header,ThemeToggle,SoundToggle,ShortcutsDialog,AppShell}.tsx`, `components/players/{PlayerSwitcher,ImportForm,ImportProgress,ImportIndicator,PlayerManager}.tsx`, `components/filters/FilterSheet.tsx`, `components/onboarding/{Welcome,SpecimenPlate}.tsx`.
  - Header: theme / sound / help are round `chit` buttons; the player switcher trigger has a drawn dog-ear (folded corner); filter count is an ink dot. Appearance menu: dropped the local padding/separator overrides (kit card), `RubberStamp` "default", swatches are mounted mini prints. Switcher popover: `paper-row` rows (wash on hover / focus-within), manila `PaperLabel` source tags, pencil separators.
  - Import: source tabs now use the kit folder tabs (local overrides removed); drop zones are `Envelope` pockets (flap lifts on drag); progress is a manila measuring tape (ticks + numbers, ink-green length); header chip is a `paper-label`. Manager: each player is a `PaperSheet` register card with a taped manila source label, red head rule, `RubberStamp` on the delete confirmation, `EmptySpecimen` when empty. Shortcuts: "key to symbols" with paper keycaps (multi-key entry split into Tab / arrows / Enter).
  - Filters: time control chips are kit outline buttons (`aria-pressed` = pushed in), opponent trigger override dropped, the Win/Draw/Loss perspective is a pencil `Handnote` (the sentence stays in the description as `sr-only`).
  - AppShell LoadingShell: desk ground now also while loading, board mat + explorer sheet (`PaperSheet`) with the pencilled skeleton lines in the same slots.
  - Welcome: desk spread. Headline on a cream sheet over an under-sheet with tape, import form on an index card (red head rule, sage tape), the plate as a print with photo corners on a mat, steps as numbered manila tabs, one true pencil note ("wider ribbon = played more often"), footer line on a paper label. Checked at 320/390 px (no horizontal scroll). SpecimenPlate lost its own border/bg tint (mat provides the frame); caption reworded.
  - Checks: typecheck, lint, vitest, e2e 34/34. Screenshots in light and dark over two iterations (`shots/h2-*`, `h2b-*`, `h2c-*`).
  - Risks / notes: dark-mode Envelope pocket is a light grey overlay (kit `oklch(1 0 0 / .16)`), reads a little pale; Welcome desktop leaves empty desk under the plate column; forced-colors not visually tested. Requests: none.

---

# Paper kit v2 reference (Workstream K)

Import primitives from `@/components/paper`, shared bits from `@/components/field`, controls from `@/components/ui`.
Everything is deterministic (seeded by the `seed` prop, never `Math.random`), decorative parts are `aria-hidden` and
hidden in forced-colors mode. **Never restyle a primitive locally; pass layout classes only.** Heights and sizes of
`Button` (h-9 / h-8 / size-9 / h-6), `Input`, `ToggleGroupItem` (h-9), `Slider` (h-6) are unchanged.

## Design tokens and CSS classes (globals.css)

| Name | What it is |
| --- | --- |
| `.paper-btn` (+ `-primary`, `-quiet`, `-ghost`, `-tag`, `-chit`) | Cut-card button skin. States: hover lifts, `:active` / `aria-pressed` / `aria-expanded` / `data-state=open|on` = pushed in (1px down, inset shadow). Variants only set `--pb-*` variables. In `@layer components`, so utilities still override. |
| `.paper-card` | Index card with an offset second card under it (hard offset shadow + hairline) and the soft paper shadow. Sets `--card/--background/--popover/--specimen` for what is inside. Used by menus, popovers, dialogs. |
| `.paper-row` | Printed row; the highlighted row (`:focus`, `[data-highlighted]`, `[data-selected=true]`) gets a marker wash **behind** the text with uneven chisel ends. Parents up to the card must not paint a background. |
| `.paper-label` (`data-tone=cream|manila|sage`, `data-taped=true`) | Small pasted label: fibre, hairline edge, tiny shadow, optional tape bit. Badges and `SpecimenTag` use it. |
| `.paper-note` | Toast skin (sticky note + tape), unlayered because Sonner's CSS is. |
| `pencil-rule` (utility) | A 5px pencilled wobbly rule strip (separators in menus). |
| `ink-draw`, `paper-settle` (utilities) | Pen-draw-on for strokes (`pathLength=1`), 140ms open settle (opacity + 4px). Both off under reduced motion. |
| `skeleton-lines`, `stamp` | Now use the pencil tile / a speckled ink mask. |
| tokens | `--btn-*`, `--pop-shadow`, `--hilite*`, `--note*`, `--envelope*`, `--clip-*`, `--ink-wash`; Tailwind colours `btn-face`, `btn-edge`, `note`, `note-ink`, `hilite`, `envelope`, shadow `shadow-pop`. See palette.md. |

## components/ui (same exports, names, props, aria)

- **Button**: variants `default` (forest-green printed card, cream ink), `destructive` (same, red), `outline` (paper card), `secondary` (quiet slip), `ghost` (bare until hover, then a card lifts; stays pushed while `aria-pressed`/`open`), `tag` (small mono slip: Clear/Reset; use `size="xs"`), `link`, **new `chit`** (always-visible paper card; with `size="icon"` it is a round token with a printed ring, for header controls). Sizes unchanged. `<Button variant="chit" size="icon" aria-label="Help"><HelpCircle /></Button>`.
- **Input**: pressed-in field typed on a printed rule; mono tabular for numeric. **Checkbox**: printed box with an ink check (seeded pen stroke, draws on; indeterminate = dash).
- **Slider**: ruler card with 20 printed ticks, thick primary range, one **paper clip** per thumb (clip pokes ~3px above the strip). Same Radix props. **ToggleGroup**: index tabs on a shared baseline (the group draws it). **Tabs**: folder tabs (the `folder-tab` utility is now in `TabsTrigger` by default; ExplorerPanel's overrides keep working).
- **DropdownMenu / Popover / Select / Command**: `paper-card` + a strip of tape (ochre on menus, sage on popover/select; `<PopoverContent tape={false}>` to omit). `DropdownMenuContent` is now `card (overflow visible) > scroller div`, so `className` (width/padding) lands on the card. Items use `paper-row`; checks are `InkTick` that draw themselves; separators are `pencil-rule`. `Command` is transparent so the card shows through.
- **Tooltip**: `TooltipContent` renders a manila `HangTag` on string. Plain text/`<kbd>` children. **Toaster**: yellow sticky note with tape and a pencilled word (Noted / Note / Caution / Problem from the toast type), error = pink note, inked icons. `toast.success("Copied", { description })` unchanged.
- **Dialog**: `DialogContent` = positioned wrapper (`className`: width, e.g. `sm:max-w-md`) > `UnderSheet` + `paper-card` body (`bodyClassName`: padding/overflow, e.g. `p-0`) + a tape strip + a square paper close chit. Header/Title/Footer unchanged (`kicker` prop kept). **Sheet**: keeps the index-card look, close button is a paper chit.
- **Badge**: default/secondary/destructive/outline = `paper-label`; `stamp` = inked stamp. **Skeleton**: pencilled ruled lines. **Separator**: `variant="single|double|pencil"`. **ScrollArea**: paper-slip thumb on a groove. **Card**: cut card with fibre.
- **field/**: `SpecimenTag` is a paper label; `EmptySpecimen` is a blank taped index card with pencil rules; `InkTick` takes `seed` and `draw`; `Stamp` gets the speckled ink.

## components/paper (new)

| Component | Props | Usage |
| --- | --- | --- |
| `HighlighterWash` | `tone` yellow\|green\|pink\|blue, `seed`, `fill`, `amp`, `className` | `<HighlighterWash seed="nf3">Nf3</HighlighterWash>` (inline, behind text) or `<li className="relative isolate"><HighlighterWash fill seed={san} />...</li>` for a row. Measured to exact size (rectangle until then). Meaning must also be in aria (`aria-current`). |
| `InkCircle` | `seed`, `tone` ink\|pencil\|green\|red, `strokeWidth`, `padX`, `padY`, `draw` | `<InkCircle seed="move-3" aria-hidden={false}>Nf3</InkCircle>` circles the content without changing layout; ring is outside the box. |
| `InkStroke` | `from`, `to` ([x,y] px in the positioned parent), `seed`, `arrow`, `tone`, `opacity`, `width`, `taper`, `wobble`, `head`, `headWidth` | `<div className="relative"><InkStroke from={[8,40]} to={[120,12]} arrow width={5} seed="e2e4" /></div>` |
| `inkArrowPath` / `inkStrokePath` (lib/paper) | `(seed, x1, y1, x2, y2, { width, taper, wobble, samples, head, headWidth })` | Pure, ~22 points whatever the length (4000 calls < 400ms in tests). Returns a **filled outline**: `<path d={inkArrowPath(`${from}${to}`, x1, y1, x2, y2, { width: 3 + 8 * freq })} fill="var(--ink)" opacity={...} />`. Tip lands exactly on (x2, y2). Use for board arrows (keep thickness/opacity = frequency). |
| `RubberStamp` | `tone` primary\|muted\|destructive\|win\|draw\|loss, `variant` double\|single, `size` md\|sm, `rotate` (clamped ±2°), `seed` | `<RubberStamp tone="win" variant="single" size="sm" seed={game.id}>W</RubberStamp>`. Real text; seed shifts the speck mask so stamps differ. |
| `PaperLabel` | `tone` cream\|manila\|sage, `taped`, `rotate` (±1.5°), `as` | `<PaperLabel tone="manila" taped>You</PaperLabel>` mono 11px, one line. Player names on the mat, filter chips. |
| `TicketEdge` | `ends` perforated\|torn, `seed`, `notch`, `as` (div\|ol\|ul\|nav), `className` (the strip: give it height + padding), `wrapperClassName` | `<TicketEdge ends="perforated" className="flex h-11 items-center px-4">…moves…</TicketEdge>`. Clip-path from `ticketPath`; shadow on the wrapper. |
| `Envelope` | `open`, `as` (div\|label\|section), `className` | `<Envelope as="label" open={dragging} className="min-h-28 p-4">Drop a PGN here</Envelope>`. Manila body, V flap (lifts when `open`), pocket cut along the bottom; content sits in the clear middle band. |
| `PaperClip` | `size`, `angle` (±12°) | Steel gem clip, 11×28 at size 1 (slider thumbs). |
| `PencilHatch` | `gap`, `dir` 1\|-1, `seed`, `opacity`, `color` | `<div className="relative h-full w-3"><PencilHatch gap={4} /></div>` graphite hatching fill (eval bar with no eval). |
| `HangTag` | children | Auto-height manila tag on string (tooltips). `StringTag` stays the fixed 22px ECO tag. |
| `CardTape` (`@/components/ui/paper-chrome`) | `variant`, `length`, `height`, `angle`, `seed`, `align` | Tape across the top edge of a floating card (needs `relative`, no clipping). |

Generators in `lib/paper.ts` (all tested in `tests/paper.test.ts`): `inkStrokePath`, `inkArrowPath`, `inkEllipsePath`, `washPath`, `speckPath`, `speckleMaskSvg`, `ticketPath`, `pencilHatchSvg`, `inkCheckPath`. The generator script `scripts/gen-paper-textures.mts` also emits `--pencil-rule`, `--tape-mask-*`, `--stamp-mask`.

## Notes for E / F / H

- Existing local overrides keep working (twMerge), but delete any that fake paper (borders, bg tints) on `Button`/`Input` and let the kit draw them. `ExplorerPanel` tabs and `SideSwitch` still carry their own overrides on `TabsTrigger` / `ToggleGroupItem`.
- Toggle/pressed look is built into `.paper-btn` (`aria-pressed`, `aria-expanded`, `data-state=open|on`), so toolbar toggles need no extra classes.
- Dark mode: highlight washes are dark bands behind text, tapes are low-alpha without multiply, notes are olive; do not hard-code light-only colours in new objects, use the tokens.
- `PaperSheet`/`paper-scope` inside menus is not needed: `.paper-card` already redefines `--card/--background/--specimen`.

- **Workstream E (Board): done.**
  - Files: `components/board/{EvalBar,BoardOverlay,ExplorerBoard,PlayerStrip,BoardControls,BoardColumn}.tsx` only.
  - Eval bar: cream measuring strip, printed ticks per pawn (major 0/+-2/+-5, cream copies over the ink), black share is an ink fill cut with a seeded
    irregular `clip-path` polygon (same vertex count, so it still animates), a paper tag with a notch at the boundary carries the mono value on the larger side.
    States: loading = pulsing pencil hatch, no eval = static hatch, cloud = manila tag, local = dashed cream tag, mate = inverted ink tag. Same slot (w-7, self-stretch), role="img" + labels unchanged.
  - Board: squares flat with a faint seeded fibre tile; last-move / selected = two-pass highlighter wash as a background image of the square (multiply with the square colour in light,
    lighter alpha in dark, pieces stay crisp); legal moves = ink dots, captures = seeded ink rings (overlay); coordinates mono in ink tones, no outline.
  - Arrows: three overlay layers (ink dots + coords, paper under-stroke, ink). Candidates = tapered `inkArrowPath` in blue-black ink (knights are an L: stroke + arrow), width and opacity still encode share,
    hover preview = graphite pencil with a second thinner pass. Seeded by from+to. Fixed node count kept (3 candidate slots + 1 hover, each with a constant number of nodes). User-drawn arrows: the library now only paints the
    in-progress drag (muted ink at 45%); committed arrows (`onArrowsChange`) are redrawn as ink in green / red / ochre / blue / graphite (default / Shift / Ctrl / Alt / Cmd).
  - Strips / toolbar: names are `PaperLabel`s (You = manila), side = ink blot (Black) or pen ring (White); toolbar = two runs of `outline` card buttons sharing borders (32px / 36px, all names kept).
    Toolbar loses the board-edge indent below 360px so both runs stay on one row at 320 (checked 320/360/390).
  - Local tokens: `--ov-*` ink colours are defined in a `<style>` inside BoardOverlay (light + `.dark`), because `globals.css` is not mine. Candidate for K to promote to tokens if wanted.
  - Risks: overlay highlights moved from the overlay to `squareStyles`, which reads `resolvedTheme` (light for one frame before hydration); user-drag preview uses literal colour strings; hairline wash edges look cut at the square boundary by design.
  - Checks: typecheck, lint, vitest; screenshots `shots/e2-*` (light/dark/mobile, select, hover, user arrows, eval states). Requests: none.

- **Workstream F (Explorer, S2.2): done.**
  - Files: `components/explorer/{WdbBar,MoveRow,MoveTable,LinePanel,GamesList,CanopyTree,OpeningHeader}.tsx`, new `components/explorer/ink.tsx` (seeded pencil underline / margin tick / sort arrow / cross / slash marks), `components/filters/FilterRow.tsx`, `components/layout/SideSwitch.tsx`.
  - Side switch: kit ToggleGroup items with `folder-tab`, active forward with a pencil underline under the name, mono counts (h-11, radio roles/names kept). Opening header: faint pencil crumbs with pencil slashes, italic serif name. Filter row: `PaperLabel` manila tags held by a small `PaperClip`, drawn cross to remove, tag-button "Clear all", "+ add filter" as a Caveat pencil note (aria-label "Add filter", h-8 kept).
  - Line strip: `TicketEdge` perforated (role=region "Line"), mono moves, current move in an `InkCircle` seeded per ply, "Start" a small `RubberStamp` (aria-current, keep-in-view, h-11 kept).
  - W/D/B bar: three strips (paper / graphite / ink) with seeded irregular cut ends (clip-path), a printed hairline outline via drop-shadows, mono labels; legend swatches are tiny paper snips. `WdbBar` takes a `seed`.
  - Move table: active row = `HighlighterWash` across the row (the `tr` is the containing block) + pencil margin tick; low-sample rows pencilled; ink sort arrows; rare toggle as a pencil note. Games: `RubberStamp` W/D/L (seeded tilt within 1.8deg), mono dates, ink-underlined names, loaded game = green wash. Canopy: three-layer multiplied watercolour ribbons, node bars via `inkStrokePath`, legend as a paper key card, depth buttons are kit outline `xs` buttons.
  - Dropped local fake styling (borders / tints / ring classes) on Button and the Line box; kept `TRIGGER` overrides in `ExplorerPanel` (they still merge with the kit's folder tab).
  - Checks: typecheck, lint, vitest, e2e (see log). Screenshots: `scratchpad/shots/f2-{light,dark}-{a-start,b-moves,c-games,d-canopy,e-black}.png`, `f2-mobile-light.png`.
  - Risks: the row wash relies on `position: relative` on `tr` (works in Chromium; Firefox/Safari untested, falls back to the wash behind the first cell only). The PencilUnderline needs an inline size because `Button` forces `svg:size-4`. Canopy hover emphasis now raises three stacked opacities.
  - Requests: none.

---

# Round 4: one look only, and a custom board

Owner (11 Nov 2026): "Plan and implement a custom board that fits the theme.
For now don't worry about anything other than **light mode on the Lichen board
with Lichess sounds**. Remove all the customization for that, we'll work on it
later, so that tab is useless; don't spend effort on UI for each colour or
light/dark mode."

## R4.1 Scope decisions

- **Only one configuration ships:** light theme, Lichen board, Lichess
  ("standard") move sounds. No theme, board-colour or sound-set pickers.
- **Keep the plumbing, drop the UI.** Leave `lib/board-themes.ts`, the sound
  sets and the dark CSS tokens in the code (the owner will revisit), but
  nothing reachable can select them: next-themes is forced to light, the
  store always resolves board = lichen and sound set = standard (including
  for returning users with older persisted values).
- **The Appearance menu goes away.** Its one non-appearance item (Keyboard
  shortcuts, mobile only) must stay reachable on mobile: show the help button
  at every width. Sound **mute** stays (it's not a customization).
- **No more dark-mode or per-board work** in any workstream until further notice.

## R4.2 The custom board: "Pasted specimen plate"

The board becomes a printed naturalist's plate on the cream mat, with the
pieces as engraved figures cut out and pasted on, like specimens in the
scrapbook. Must stay as instantly readable as a normal board.

**Squares**
- Light squares: the cream sheet paper (`--sheet` family) with its faint fibre.
- Dark squares: the Lichen grey-green **printed as an engraved tint**: a fine
  diagonal hatch / stipple in a slightly deeper lichen ink over a flat lichen
  base, so it reads as ink on paper, not a flat fill. Very subtle, seeded,
  uneven ink density per square (± a few %), never noisy enough to compete with
  pieces. One shared pattern definition, not 32 filters.
- A printed **plate frame**: a thin ink double rule hugging the 8×8 (drawn in
  the existing mat gap with box-shadow/outline, so the board rect does not
  change), like the border of an engraved plate.
- Coordinates: small printed figures in ink tones (keep their positions).
- Highlights, legal dots and ink arrows from round 3 stay; check they still
  read on the new squares.

**Pieces ("cut-out engravings")**
- Silhouettes: start from the piece shapes the app already ships (the
  react-chessboard default set) so recognition and licensing stay as they are
  today; redraw/restyle them, don't invent unfamiliar silhouettes.
- White pieces: cream paper fill, crisp dark-ink outline, a few fine engraved
  hatching lines on the shadow side (right/bottom).
- Black pieces: deep green-black ink fill (not pure #000), with a few fine cream
  highlight lines on the lit side (left/top) so the form stays readable.
- Every piece has a narrow **cut-paper margin** (a cream outline around the
  silhouette, like scissors left a border) and a tiny **lift shadow** under it,
  as if pasted onto the plate. While dragging, the lift shadow grows.
- Rendered as React SVG components via react-chessboard's `pieces` option;
  hatch patterns defined once and shared; no per-render randomness.
- Pieces stay `aria-hidden` / out of the tab order (existing MutationObserver),
  board keeps its `role="img"` description.

## R4.3 Workstreams

| WS | Files | Brief |
| --- | --- | --- |
| **S. Simplify** | `app/layout.tsx`, `components/layout/{Header,ThemeToggle,SoundToggle}.tsx`, `lib/store.ts`, `hooks/use-move-sounds.ts`, `lib/sound.ts`, `e2e/*` (only tests about appearance/theme/board/sound pickers), `README.md` | R4.1. Remove the Appearance menu and ThemeToggle from the header (delete the component if nothing else uses it), force light, force lichen + standard, keep help visible on mobile, update/remove the e2e tests that drove the menu (keep coverage of what still exists, e.g. sound mute), update README (no theme/board/sound pickers for now). |
| **P. Plate board** | `components/board/*` (mainly `ExplorerBoard.tsx`, new `components/board/pieces.tsx`, `BoardColumn.tsx` for the frame), `lib/paper.ts` only if a new seeded helper is needed (with tests) | R4.2. Light mode + Lichen only. |

Both run in parallel (disjoint files). Same hard constraints as before (layout
geometry, e2e names, a11y, CSP).

## Status log (round 4)

- **S (Simplify), done.** Appearance menu and `ThemeToggle.tsx` removed; Keyboard shortcuts button now shows at every width (320px no-overlap test passes, header still h-14). `ThemeProvider` has `forcedTheme="light"` and `enableSystem={false}`; `sonner.tsx` fixed to `theme="light"`. Store: `setBoardTheme`/`setSoundTheme` removed; `boardTheme` ("lichen") and `soundTheme` ("standard") stay as constants in state, no longer persisted; persist version 5 migration drops old stored values. `use-move-sounds` sets the standard set once. `lib/board-themes.ts`, other sound sets and dark tokens untouched. e2e: appearance-radio test replaced by a "no Appearance / no dark class under dark system preference / shortcuts reachable" test; sound test now checks standard recordings, unmute and mute remembered across reload. README updated. typecheck, lint, test (414), build and e2e (34) pass. Note for P: `components/board/ExplorerBoard.tsx` still reads `resolvedTheme` (next-themes, always "light" now) and `boardTheme` from the store (always "lichen"); both can be dropped.

## Status log (round 4, Workstream P)

- **Plate board: done.** Light + Lichen only.
  - Files: `components/board/pieces.tsx` (new: `PlateDefs` shared silhouettes/hatch patterns/masks rendered once, `PLATE_PIECES` for the `pieces` option, `PLATE_DRAGGING_STYLE`), `components/board/plate-squares.ts` (new: seeded dark engraved-tint and light fibre tiles, 6 variants each, exposed as `--cp-d0..5` / `--cp-l0..5` custom properties on the board; per-square variant by name hash; `PLATE_FRAME`), `ExplorerBoard.tsx` (no theme/board-theme branching any more, wash is light-only), `BoardOverlay.tsx` (coordinates in serif italic ink figures, deep ink on lichen squares / lichen ink on cream).
  - Pieces: default Cburnett silhouettes. Each is `<use>` layers over shared geometry: two offset lift-shadow copies (no filters), a 3.5-unit cream cut-paper margin stroke, fill, hatching (white: "/" shade pass + crossing "\" in deepest shade, masked to the right/bottom; black: cream "/" lines masked to the top-left), crisp outline, inner engraved lines. Seeded +-1.3 degree rotation per piece+square. The dragged piece gets scale 1.1 plus a CSS `drop-shadow` on that one element only.
  - Plate frame: box-shadow on the board element (hairline + paper strip + heavy rule = 3.5px, fits the 4px gap), board rect unchanged. No `globals.css` change needed.
  - Checks: typecheck, lint, test clean; 34/34 e2e pass; legible at 40px (mobile) and 85px squares.
  - Requests: none. `--board-light/--board-dark` in globals.css and `lib/board-themes.ts` are no longer read by the board (kept as plumbing).

---

# Round 5: better board arrows (drafts first)

Owner: the current arrows "are buns". Close-up review (coordinator): the
tapered ink stroke reads as a thin wobbly grey sliver with a doubled, ghosted
head; too faint against the hatched lichen squares, and it doesn't look like a
deliberate, skilled mark. Process: **draft 4 styles on the real board, owner
picks, then implement properly.**

## R5.1 What good chess arrows do (research, chessground `src/svg.ts`)

Units: S = one square.
- **Constant-width shaft** (chessground: 10/64 S ≈ 0.156 S), round caps.
  No taper: taper reads as sloppy at board scale.
- **Head with fixed proportions**: length ≈ 3× shaft width, base ≈ 4× shaft
  width, half-angle ≈ 30-34°. A defined, sharp head; never a blob.
- **Start at the origin square centre, stop short of the target centre**
  (margin ≈ 0.16 S; more when several arrows converge on one square) so the
  destination piece stays readable.
- **Frequency as a discrete width ladder** (3 steps) plus opacity
  (1 / ~0.75 / ~0.55), not opacity alone, which washes out on cream.
- **Hover preview must look different**, not just thicker: dashed or
  outline-only.
- Crossing arrows darken each other; manage with a paper-coloured under-stroke
  or ordering.
- Straight knight arrows are fine (Lichess); an L is optional.

## R5.2 Four drafts to build (all in the site's ink, on the plate board)

| Draft | Geometry |
| --- | --- |
| **A. Engraved hatch** | Shaft filled with fine 45° engraving hatch (clipped), outlined with a thin ink rule; solid ink head (length ≈ 0.30 S, base ≈ 0.36 S). Ladder 0.16 / 0.11 / 0.07 S. Hover: outline only, hairline. Fits the engraved pieces best; must survive a 40px-square render (check moiré). |
| **B. Pen stroke** | One confident constant-width ink stroke (0.10 / 0.075 / 0.055 S), crisp **open chevron** head (two legs, mitred, ~32°, length ≈ 0.28 S), opacity 1 / 0.75 / 0.55. Hover: same geometry, dashed. Cleanest "skilled pen" look. |
| **C. Letterpress ribbon** | Paper-coloured shaft (0.16 S) outlined by a thin ink double rule, outlined head with the same proportions; frequency by ink weight/fill. Hover: dashed outline. Reads printed; check it doesn't hide pieces. |
| **D. Printed block** | Flat ink shaft with butt caps (0.13 / 0.09 / 0.06 S), isosceles head (length ≈ 0.32 S, base ≈ 0.34 S) with a fine inner key line (printed-block detail); opacity ladder. Hover: key line / outline only. Closest to Lichess proportions, very legible. |

All drafts: same ink colour family for candidates (deep ink from tokens), a
thin paper-coloured under-stroke (halo) so arrows stay legible over pieces,
deterministic (no wobble unless it is the draft's point), fixed SVG node count
preserved, reduced-motion respected. User-drawn arrows: same style per draft in
the existing muted ink colours.

## R5.3 Draft mechanics

Build all four behind a temporary, non-UI switch (e.g. a `?arrows=a|b|c|d`
query parameter read once on load, default = current). Produce comparison
screenshots per draft: start position with the 3 candidate arrows; a hovered
table row (preview + candidates); a middlegame with a knight candidate; a
user-drawn arrow; desktop (~80px squares) and mobile (~40px squares). After the
owner picks, the switch and losing drafts are removed.

---

# Round 6: UI audit and fixes

Owner: "Do a major UI audit to make sure everything matches, spacing is right
and everything is legible; fix spacing and white-space issues on the welcome
page; fix the clutter of the buttons on mobile and the clutter in the info
area when analysing a position."

Audit inputs: coordinator screenshot review (1440 / 390) + an automated
Playwright audit over 8 states × 4 viewports (1440, 1280, 390, 320): text
size, contrast, clipping, tap targets, overlap, spacing. Raw data:
`scratchpad/audit/results.json`, screenshots `scratchpad/shots/audit-*.png`.
Contrast passed everywhere; no page-level horizontal scroll.

## R6.1 Findings

**Welcome page**
- W1. Desktop: the right column (plate) ends ~400px above the steps, leaving a
  large dead area of desk under it; the plate's top doesn't align with the
  headline sheet; the footer label floats far below the steps.
- W2. The entrance animation hides content for too long (steps were still
  faded ~1.5 s after load; on a 390px phone the import form and plate were
  invisible in a full-page screenshot). Content must never be hidden waiting
  for an animation.
- W3. Plate labels are ~8px ("50% · 14"), "No. 001" 10px, captions 10.5px:
  illegible.
- W4. The disabled "Import games" button is a muddy grey-green with weak text.

**Mobile buttons (390 / 320)**
- M1. Header has 6 controls in 390px (logo, player switcher, filters, import,
  sound, help); at 320 the "All players" label is truncated to ~10px (its only
  visible name) and Filters/Players boxes overlap the side switch by 8-10px.
- M2. The board mat's tape strips overlap the header controls on mobile.
- M3. Board toolbar buttons overlap each other by 1px (Copy FEN/PGN/link,
  start/previous).
- M4. The import toast never auto-dismisses and covers the moves table, the
  filter sheet footer (Clear all / Done) and games rows.

**Info area while analysing (explorer column)**
- I1. Too many competing decorative devices stacked in a few lines: string
  tag, pencil "+ add filter", perforated ticket + START rubber stamp + inked
  circle, tiny caps legend, cut-paper bar, handnote. Each is fine alone;
  together they're noisy.
- I2. The summary legend (WHITE 40% · DRAW 13% · BLACK 47%) is 10px caps and
  duplicates information.
- I3. Mobile: the line-strip hint "Play a move on the board or pick one from
  the table" is clipped mid-word; at 320 the "MOVE" header clips to "MOVI";
  the Canopy depth buttons 3/4 run off-screen.
- I4. Small text: bar segment labels 10px, Games-tab W/D/L stamps 10px, eval
  label 9px.
- I5. Spacing rhythm in the explorer column is inconsistent (8px gaps with
  one 0px gap).

## R6.2 Rules for the fixes

- **Minimum sizes:** no visible text under 11px (12px preferred for data
  labels); handwriting ≥ 15px; tap targets ≥ 32px on mobile with ≥ 4px gaps.
- **One rhythm:** explorer column and welcome page use an 8px base (8 / 12 /
  16 / 24 / 32); no ad-hoc 0px or 5px gaps.
- **Decoration budget for the info area:** at most two decorative devices
  visible at once above the tabs (keep the ECO string tag and the inked circle
  on the current move; everything else plain, quiet print). The handnote is
  the one optional extra and only when it says something useful.
- **Never hide content behind animation;** entrance motion ≤ 250ms total,
  opacity starts ≥ 0.6 or none at all.
- Layout-stability geometry and e2e names still apply.

## R6.3 Workstreams

| WS | Files | Fixes |
| --- | --- | --- |
| **WL. Welcome** | `components/onboarding/*` | W1-W3: rebalance the spread (desktop: fill/align the right column, e.g. plate + steps in the right column, or plate height matched to the left stack; consistent 24/32px gaps; footer close to content); mobile order headline → form → steps → plate with even spacing; fix the entrance animation; plate text ≥ 11px. |
| **MB. Mobile header & global** | `components/layout/Header.tsx`, `components/layout/SoundToggle.tsx`, `components/players/PlayerSwitcher.tsx`, `components/players/ImportIndicator.tsx`, `components/ui/sonner.tsx`, `components/ui/button.tsx`, `components/layout/ShortcutsDialog.tsx` | M1, M4, W4: declutter the mobile header (e.g. below `sm`: logo, player switcher, Filters, Import as clear 36px controls, and sound + help moved into one small paper "more" menu; keep accessible names reachable and update e2e that click them); player switcher label never truncates to nothing (icon + count at 320); toasts auto-dismiss (~4 s) and sit where they don't cover the filter footer (e.g. top-centre on mobile); readable disabled primary button. |
| **IA. Info area** | `components/explorer/*`, `components/filters/FilterRow.tsx`, `components/layout/SideSwitch.tsx` | I1-I5: apply the decoration budget (e.g. plain "Start" text button instead of the rubber stamp, quieter ticket edges, plain-print "Add filter" link), remove the separate legend by labelling the summary bar segments (as the table bars do), fix the clipped hint on mobile (shorter copy or wrap within the fixed height), "MOVE" header and Canopy depth controls at 320px, label sizes ≥ 11px, 8px rhythm. |
| **BC. Board column** (after the arrow drafts land) | `components/board/*` | M2, M3, I4 eval label: tape not over the header on mobile, toolbar overlaps, eval label ≥ 11px, spacing. |
