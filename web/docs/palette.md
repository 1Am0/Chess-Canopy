# Palette

One light theme: a neutral page, white panels, near-black text, light gray borders, and one deep teal accent. Tokens live in `app/globals.css` (`:root`, mapped to Tailwind colors in `@theme inline`). Values below are OKLCH with the sRGB hex approximation.

## Surfaces and text

| Token | Value | Hex | Use |
| --- | --- | --- | --- |
| `--background` | `oklch(0.972 0.003 250)` | `#f4f6f8` | page |
| `--card`, `--popover` | `oklch(1 0 0)` | `#ffffff` | panels, floating layers |
| `--secondary` | `oklch(0.955 0.003 250)` | `#f0f2f4` | quiet fills, badges, table hover |
| `--foreground` | `oklch(0.2 0.01 255)` | `#13161b` | text |
| `--ink` | `oklch(0.16 0.01 255)` | `#0b0e12` | headings, strong figures |
| `--muted-foreground` | `oklch(0.46 0.012 255)` | `#54585f` | secondary text |
| `--border` | `oklch(0.9 0.004 255)` | `#dcdee1` | 1px panel and row borders |
| `--input`, `--rule-strong` | `oklch(0.64 0.008 255)` | `#898c91` | control borders (3:1 against white) |
| `--scrim` | `oklch(0.2 0.01 255 / 0.4)` | | behind dialogs and sheets |

## Accent and status

| Token | Value | Hex | Use |
| --- | --- | --- | --- |
| `--primary` | `oklch(0.43 0.08 190)` | `#005d59` | primary buttons, links, active tab underline, selected toggle |
| `--primary-foreground` | `oklch(1 0 0)` | `#ffffff` | text on primary |
| `--ring` | `oklch(0.5 0.1 190)` | `#007570` | focus-visible outline |
| `--accent`, `--accent-foreground` | `oklch(0.95 0.012 195)`, `oklch(0.3 0.06 190)` | | hover and selected row fill |
| `--destructive` | `oklch(0.5 0.19 27)` | `#b7191c` | destructive buttons |
| `--win`, `--win-text` | `oklch(0.47 0.12 150)`, `oklch(0.42 0.11 150)` | | your wins (fill, text) |
| `--draw` | `oklch(0.5 0.015 255)` | | draws |
| `--loss`, `--loss-text` | `oklch(0.5 0.19 27)`, `oklch(0.46 0.19 27)` | | your losses |

## Result bars

White, mid-gray and near-black, flat, inside a 1px outline: `--bar-white #ffffff`, `--bar-draw #8b9096`, `--bar-black #1f2328`, `--bar-border #5c6168`. Label colors: `--bar-white-fg #1f2328`, `--bar-draw-fg #111111`, `--bar-black-fg #ffffff`.

## Canopy tree scale

A diverging scale for score, amber (low) through light gray (mid) to deep teal (high). Low and high differ in lightness (0.76 vs 0.42), so it stays readable without hue. Colors are mixed in `oklab`.

| Token | Value | Hex |
| --- | --- | --- |
| `--tree-low` | `oklch(0.76 0.14 65)` | `#ed9d44` |
| `--tree-mid` | `oklch(0.9 0.006 250)` | `#dbdee2` |
| `--tree-high` | `oklch(0.42 0.085 190)` | `#005b57` |

## Other

Shape: 4px radius for controls (`rounded-sm`, `rounded-md`), 6px for panels (`rounded-lg`). One shadow, `--pop-shadow` (`shadow-pop`), only on popovers, dialogs, sheets, dropdowns, tooltips and toasts.

Board squares: `--board-light #e8e4d4` and `--board-dark #8fa08a`.

## Contrast (WCAG 2.x)

Computed with a small script from the values above. Text needs 4.5:1 (3:1 large text and UI boundaries).

| Pair | Ratio |
| --- | --- |
| foreground on page / on card | 16.7 / 18.1 |
| ink on card | 19.4 |
| muted-foreground on page / card | 6.6 / 7.1 |
| primary-foreground on primary | 7.7 |
| primary on card / page (links, underline) | 7.7 / 7.1 |
| ring on card / page | 5.6 / 5.2 |
| control border on card / page | 3.4 / 3.1 |
| accent-foreground on accent | 11.4 |
| white on destructive | 6.6 |
| win-text, loss-text on card | 8.0, 7.8 |
| white on win, draw, loss fills | 6.5, 6.0, 6.6 |
| tree-low vs tree-high (lightness difference) | 3.6 |
| bar-white-fg on white / white on black / bar-draw-fg on gray | 15.8 / 15.8 / 5.9 |
| bar outline on card | 6.2 |
