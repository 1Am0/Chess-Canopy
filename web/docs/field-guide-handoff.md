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
