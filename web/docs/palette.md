# Chess Canopy palette

"Canopy": calm forest greens as the brand accent, warm paper surfaces in light mode, deep green-tinted charcoal (never pure black) in dark mode. All colors are authored in OKLCH in `app/globals.css`; hexes below are sRGB conversions (alpha tokens composited over `--background`).

Tailwind utilities exist for every token (`bg-primary`, `text-win-text`, `bg-brand-600`, `bg-paper-100`, `bg-arrow-candidate`, ...). The neutral scale is named `paper-*` (not `neutral-*`) so Tailwind's built-in `neutral-*` still works.

## Light mode (`:root`)

| Token | OKLCH | Hex | Usage |
|---|---|---|---|
| `--brand-50` | `oklch(0.977 0.014 155)` | `#f1faf3` | Brand scale |
| `--brand-100` | `oklch(0.95 0.03 155)` | `#e0f5e6` | Brand scale |
| `--brand-200` | `oklch(0.9 0.055 155)` | `#c2e9ce` | Brand scale |
| `--brand-300` | `oklch(0.83 0.09 155)` | `#98d9ae` | Brand scale |
| `--brand-400` | `oklch(0.73 0.13 154)` | `#5dbf82` | Brand scale |
| `--brand-500` | `oklch(0.63 0.14 154)` | `#2fa161` | Brand scale |
| `--brand-600` | `oklch(0.54 0.125 155)` | `#19834d` | Brand scale |
| `--brand-700` | `oklch(0.46 0.105 155)` | `#14693d` | Brand scale |
| `--brand-800` | `oklch(0.38 0.082 156)` | `#114f2f` | Brand scale |
| `--brand-900` | `oklch(0.31 0.062 157)` | `#0e3923` | Brand scale |
| `--brand-950` | `oklch(0.22 0.045 158)` | `#042112` | Brand scale |
| `--paper-50` | `oklch(0.985 0.005 90)` | `#fbfaf6` | Neutral scale |
| `--paper-100` | `oklch(0.967 0.008 90)` | `#f6f4ee` | Neutral scale |
| `--paper-200` | `oklch(0.93 0.011 90)` | `#ebe8e0` | Neutral scale |
| `--paper-300` | `oklch(0.87 0.013 90)` | `#d7d4cb` | Neutral scale |
| `--paper-400` | `oklch(0.71 0.014 95)` | `#a4a298` | Neutral scale |
| `--paper-500` | `oklch(0.55 0.015 105)` | `#737268` | Neutral scale |
| `--paper-600` | `oklch(0.45 0.014 120)` | `#54574e` | Neutral scale |
| `--paper-700` | `oklch(0.37 0.014 140)` | `#3c423b` | Neutral scale |
| `--paper-800` | `oklch(0.27 0.014 155)` | `#212923` | Neutral scale |
| `--paper-900` | `oklch(0.21 0.014 160)` | `#131a16` | Neutral scale |
| `--paper-950` | `oklch(0.16 0.012 160)` | `#090f0b` | Neutral scale |
| `--background` | `oklch(0.982 0.006 90)` | `#fbf9f5` | Page background |
| `--foreground` | `oklch(0.21 0.016 160)` | `#121b16` | Body text |
| `--card` | `oklch(0.992 0.004 90)` | `#fdfcf9` | Panels, cards |
| `--card-foreground` | `oklch(0.21 0.016 160)` | `#121b16` | Pairs with its base token |
| `--popover` | `oklch(0.992 0.004 90)` | `#fdfcf9` | Menus, dropdowns, toasts |
| `--popover-foreground` | `oklch(0.21 0.016 160)` | `#121b16` | Pairs with its base token |
| `--primary` | `oklch(0.46 0.105 155)` | `#14693d` | Brand buttons, links, active states, focus accents |
| `--primary-foreground` | `oklch(0.985 0.008 140)` | `#f7fbf6` | Pairs with its base token |
| `--secondary` | `oklch(0.953 0.012 95)` | `#f2f0e7` | Secondary buttons |
| `--secondary-foreground` | `oklch(0.27 0.016 155)` | `#202923` | Pairs with its base token |
| `--muted` | `oklch(0.953 0.012 95)` | `#f2f0e7` | Subtle fills, tab lists |
| `--muted-foreground` | `oklch(0.5 0.016 110)` | `#63645a` | Secondary text |
| `--accent` | `oklch(0.935 0.035 155)` | `#d8f1df` | Hover/selected rows (brand tint) |
| `--accent-foreground` | `oklch(0.31 0.062 157)` | `#0e3923` | Pairs with its base token |
| `--destructive` | `oklch(0.52 0.2 27)` | `#c2181d` | Destructive actions, errors |
| `--destructive-foreground` | `oklch(0.985 0.005 27)` | `#fdf9f8` | Pairs with its base token |
| `--border` | `oklch(0.89 0.013 95)` | `#dddbd1` | Dividers, card outlines |
| `--input` | `oklch(0.8 0.016 95)` | `#c1beb2` | Form control borders |
| `--ring` | `oklch(0.6 0.14 154)` | `#219858` | Focus ring |
| `--chart-1` | `oklch(0.54 0.125 155)` | `#19834d` | Chart series |
| `--chart-2` | `oklch(0.55 0.13 245)` | `#1777b8` | Chart series |
| `--chart-3` | `oklch(0.7 0.15 75)` | `#d48e00` | Chart series |
| `--chart-4` | `oklch(0.58 0.17 30)` | `#cb4838` | Chart series |
| `--chart-5` | `oklch(0.52 0.15 300)` | `#7750b1` | Chart series |
| `--sidebar` | `oklch(0.967 0.009 95)` | `#f6f4ed` | Sidebar surface |
| `--sidebar-foreground` | `oklch(0.21 0.016 160)` | `#121b16` | Pairs with its base token |
| `--sidebar-primary` | `oklch(0.46 0.105 155)` | `#14693d` | Sidebar surface |
| `--sidebar-primary-foreground` | `oklch(0.985 0.008 140)` | `#f7fbf6` | Pairs with its base token |
| `--sidebar-accent` | `oklch(0.935 0.035 155)` | `#d8f1df` | Sidebar surface |
| `--sidebar-accent-foreground` | `oklch(0.31 0.062 157)` | `#0e3923` | Pairs with its base token |
| `--sidebar-border` | `oklch(0.89 0.013 95)` | `#dddbd1` | Sidebar surface |
| `--sidebar-ring` | `oklch(0.6 0.14 154)` | `#219858` | Sidebar surface |
| `--win` | `oklch(0.47 0.13 148)` | `#0e6d2c` | Win fill (bars, dots), white text on top |
| `--win-foreground` | `oklch(1 0 0)` | `#ffffff` | Pairs with its base token |
| `--win-text` | `oklch(0.45 0.13 148)` | `#016826` | Win-colored text on surfaces |
| `--draw` | `oklch(0.52 0.025 255)` | `#5f6a77` | Draw fill |
| `--draw-foreground` | `oklch(1 0 0)` | `#ffffff` | Pairs with its base token |
| `--draw-text` | `oklch(0.45 0.03 255)` | `#4a5666` | Draw-colored text |
| `--loss` | `oklch(0.5 0.19 27)` | `#b7191c` | Loss fill |
| `--loss-foreground` | `oklch(1 0 0)` | `#ffffff` | Pairs with its base token |
| `--loss-text` | `oklch(0.47 0.19 27)` | `#ac0311` | Loss-colored text |
| `--board-light` | `#ecefd6` | `#ecefd6` | Default board light square |
| `--board-dark` | `#6e9358` | `#6e9358` | Default board dark square |
| `--arrow-candidate` | `oklch(0.44 0.19 262)` | `#0a46b9` | Candidate-move arrows |
| `--arrow-preview` | `oklch(0.72 0.17 65)` | `#eb8a00` | Hover/preview arrows |
| `--highlight-last` | `oklch(0.9 0.17 100)` | `#f9e03f` | Last-move square highlight (apply with alpha) |
| `--highlight-selected` | `oklch(0.62 0.19 255)` | `#1d84f5` | Selected square highlight (apply with alpha) |

## Dark mode (`.dark`)

The brand and paper scales are mode-independent (see light table). Overrides and extras:

| Token | OKLCH | Hex | Usage |
|---|---|---|---|
| `--background` | `oklch(0.205 0.014 160)` | `#121915` | Page background |
| `--foreground` | `oklch(0.95 0.01 130)` | `#ecf0e9` | Body text |
| `--card` | `oklch(0.24 0.016 160)` | `#19221d` | Panels, cards |
| `--card-foreground` | `oklch(0.95 0.01 130)` | `#ecf0e9` | Pairs with its base token |
| `--popover` | `oklch(0.255 0.016 160)` | `#1c2520` | Menus, dropdowns, toasts |
| `--popover-foreground` | `oklch(0.95 0.01 130)` | `#ecf0e9` | Pairs with its base token |
| `--primary` | `oklch(0.74 0.14 154)` | `#58c481` | Brand buttons, links, active states, focus accents |
| `--primary-foreground` | `oklch(0.2 0.035 158)` | `#061b10` | Pairs with its base token |
| `--secondary` | `oklch(0.29 0.018 160)` | `#242e28` | Secondary buttons |
| `--secondary-foreground` | `oklch(0.95 0.01 130)` | `#ecf0e9` | Pairs with its base token |
| `--muted` | `oklch(0.29 0.018 160)` | `#242e28` | Subtle fills, tab lists |
| `--muted-foreground` | `oklch(0.72 0.016 140)` | `#9fa79e` | Secondary text |
| `--accent` | `oklch(0.31 0.045 155)` | `#1c3726` | Hover/selected rows (brand tint) |
| `--accent-foreground` | `oklch(0.95 0.03 150)` | `#e1f5e4` | Pairs with its base token |
| `--destructive` | `oklch(0.52 0.2 27)` | `#c2181d` | Destructive actions, errors |
| `--destructive-foreground` | `oklch(0.985 0.005 27)` | `#fdf9f8` | Pairs with its base token |
| `--border` | `oklch(0.95 0.03 140 / 11%)` | `#29312b (over bg)` | Dividers, card outlines |
| `--input` | `oklch(0.95 0.03 140 / 16%)` | `#333c36 (over bg)` | Form control borders |
| `--ring` | `oklch(0.65 0.13 154)` | `#42a66a` | Focus ring |
| `--chart-1` | `oklch(0.74 0.14 154)` | `#58c481` | Chart series |
| `--chart-2` | `oklch(0.7 0.13 245)` | `#4fa6e9` | Chart series |
| `--chart-3` | `oklch(0.8 0.15 80)` | `#f0b135` | Chart series |
| `--chart-4` | `oklch(0.7 0.17 30)` | `#f66e5c` | Chart series |
| `--chart-5` | `oklch(0.7 0.15 300)` | `#ad87ed` | Chart series |
| `--sidebar` | `oklch(0.225 0.015 160)` | `#161e19` | Sidebar surface |
| `--sidebar-foreground` | `oklch(0.95 0.01 130)` | `#ecf0e9` | Pairs with its base token |
| `--sidebar-primary` | `oklch(0.74 0.14 154)` | `#58c481` | Sidebar surface |
| `--sidebar-primary-foreground` | `oklch(0.2 0.035 158)` | `#061b10` | Pairs with its base token |
| `--sidebar-accent` | `oklch(0.31 0.045 155)` | `#1c3726` | Sidebar surface |
| `--sidebar-accent-foreground` | `oklch(0.95 0.03 150)` | `#e1f5e4` | Pairs with its base token |
| `--sidebar-border` | `oklch(0.95 0.03 140 / 11%)` | `#29312b (over bg)` | Sidebar surface |
| `--sidebar-ring` | `oklch(0.65 0.13 154)` | `#42a66a` | Sidebar surface |
| `--win` | `oklch(0.52 0.14 148)` | `#187e36` | Win fill (bars, dots), white text on top |
| `--win-foreground` | `oklch(1 0 0)` | `#ffffff` | Pairs with its base token |
| `--win-text` | `oklch(0.78 0.16 148)` | `#66d37a` | Win-colored text on surfaces |
| `--draw` | `oklch(0.52 0.025 255)` | `#5f6a77` | Draw fill |
| `--draw-foreground` | `oklch(1 0 0)` | `#ffffff` | Pairs with its base token |
| `--draw-text` | `oklch(0.76 0.03 255)` | `#a5b2c4` | Draw-colored text |
| `--loss` | `oklch(0.53 0.19 27)` | `#c22826` | Loss fill |
| `--loss-foreground` | `oklch(1 0 0)` | `#ffffff` | Pairs with its base token |
| `--loss-text` | `oklch(0.76 0.15 25)` | `#ff8880` | Loss-colored text |
| `--board-light` | `#ecefd6` | `#ecefd6` | Default board light square |
| `--board-dark` | `#6e9358` | `#6e9358` | Default board dark square |
| `--arrow-candidate` | `oklch(0.44 0.19 262)` | `#0a46b9` | Candidate-move arrows |
| `--arrow-preview` | `oklch(0.72 0.17 65)` | `#eb8a00` | Hover/preview arrows |
| `--highlight-last` | `oklch(0.9 0.17 100)` | `#f9e03f` | Last-move square highlight (apply with alpha) |
| `--highlight-selected` | `oklch(0.62 0.19 255)` | `#1d84f5` | Selected square highlight (apply with alpha) |

Board tokens (`--board-*`, `--arrow-*`, `--highlight-*`) are mode-independent; the board does not change with the app theme.

## Board themes (`lib/board-themes.ts`)

| Theme | Light | Dark |
|---|---|---|
| green (default; mirrored by `--board-light/dark`) | `#ecefd6` | `#6e9358` |
| brown | `#f0dbb8` | `#b3865c` |
| blue | `#dfe6ea` | `#7f9aa8` |
| slate | `#d3d7de` | `#667690` |

Keep `--board-light`/`--board-dark` in sync with `BOARD_THEMES.green`. `ThemeToggle.tsx` still carries its own swatch hexes (see report); update them to match.

## Contrast (WCAG 2.x, computed by `contrast.mjs`)

Thresholds: 4.5:1 for text pairs, 3:1 for UI/graphic fills, 1.5:1 minimum for input borders (informational). "bg" rows are text on the tinted chip `bg-<result>/15` (as used by `GamesList`).

| Mode | Foreground | Background | Ratio | Min | Result |
|---|---|---|---|---|---|
| light | foreground | background | 16.72 | 4.5 | PASS |
| light | card-foreground | card | 17.14 | 4.5 | PASS |
| light | popover-foreground | popover | 17.14 | 4.5 | PASS |
| light | muted-foreground | background | 5.70 | 4.5 | PASS |
| light | muted-foreground | muted | 5.25 | 4.5 | PASS |
| light | muted-foreground | card | 5.85 | 4.5 | PASS |
| light | primary-foreground | primary | 6.44 | 4.5 | PASS |
| light | secondary-foreground | secondary | 13.11 | 4.5 | PASS |
| light | accent-foreground | accent | 10.79 | 4.5 | PASS |
| light | destructive-foreground | destructive | 5.83 | 4.5 | PASS |
| light | sidebar-foreground | sidebar | 15.98 | 4.5 | PASS |
| light | win-foreground | win | 6.48 | 4.5 | PASS |
| light | draw-foreground | draw | 5.51 | 4.5 | PASS |
| light | loss-foreground | loss | 6.63 | 4.5 | PASS |
| light | primary | background | 6.41 | 3 | PASS |
| light | ring | background | 3.51 | 3 | PASS |
| light | input | background | 1.77 | 1.5 | PASS |
| light | win | background | 6.16 | 3 | PASS |
| light | draw | background | 5.24 | 3 | PASS |
| light | loss | background | 6.30 | 3 | PASS |
| light | win-text | background | 6.64 | 4.5 | PASS |
| light | draw-text | background | 7.10 | 4.5 | PASS |
| light | loss-text | background | 7.20 | 4.5 | PASS |
| light | win-text on win/15% | bg | 5.31 | 4.5 | PASS |
| light | muted-foreground on draw/15% | bg | 4.67 | 4.5 | PASS |
| light | loss-text on loss/15% | bg | 5.54 | 4.5 | PASS |
| dark | foreground | background | 15.49 | 4.5 | PASS |
| dark | card-foreground | card | 14.14 | 4.5 | PASS |
| dark | popover-foreground | popover | 13.64 | 4.5 | PASS |
| dark | muted-foreground | background | 7.23 | 4.5 | PASS |
| dark | muted-foreground | muted | 5.68 | 4.5 | PASS |
| dark | muted-foreground | card | 6.60 | 4.5 | PASS |
| dark | primary-foreground | primary | 8.21 | 4.5 | PASS |
| dark | secondary-foreground | secondary | 12.17 | 4.5 | PASS |
| dark | accent-foreground | accent | 11.32 | 4.5 | PASS |
| dark | destructive-foreground | destructive | 5.83 | 4.5 | PASS |
| dark | sidebar-foreground | sidebar | 14.76 | 4.5 | PASS |
| dark | win-foreground | win | 5.15 | 4.5 | PASS |
| dark | draw-foreground | draw | 5.51 | 4.5 | PASS |
| dark | loss-foreground | loss | 5.79 | 4.5 | PASS |
| dark | primary | background | 8.19 | 3 | PASS |
| dark | ring | background | 5.86 | 3 | PASS |
| dark | input | background | 1.57 | 1.5 | PASS |
| dark | win | background | 3.47 | 3 | PASS |
| dark | draw | background | 3.24 | 3 | PASS |
| dark | loss | background | 3.08 | 3 | PASS |
| dark | win-text | background | 9.50 | 4.5 | PASS |
| dark | draw-text | background | 8.31 | 4.5 | PASS |
| dark | loss-text | background | 7.73 | 4.5 | PASS |
| dark | win-text on win/15% | bg | 8.29 | 4.5 | PASS |
| dark | muted-foreground on draw/15% | bg | 6.33 | 4.5 | PASS |
| dark | loss-text on loss/15% | bg | 7.11 | 4.5 | PASS |
| light | text-win (raw fill as text) on win/15% | bg | 4.92 | 4.5 | PASS |
| light | text-loss (raw fill as text) on loss/15% | bg | 4.85 | 4.5 | PASS |
| dark | text-win (raw fill as text) on win/15% | bg | 3.03 | 4.5 | FAIL |
| dark | text-loss (raw fill as text) on loss/15% | bg | 2.84 | 4.5 | FAIL |

Known failures: `text-win` / `text-loss` (the raw fill color used as text) on the dark `/15` chip fail AA. Use `text-win-text`, `text-draw-text`, `text-loss-text` for result-colored text; those pass in both modes.

### Arrows and highlights vs. board squares (contrast ratio, informational)

| Theme | square | candidate | preview | highlight-last(as opaque) |
|---|---|---|---|---|
| green | light #ecefd6 | 6.91 | 2.19 | 1.13 |
| green | dark #6e9358 | 2.31 | 1.37 | 2.64 |
| brown | light #f0dbb8 | 6.00 | 1.90 | 1.01 |
| brown | dark #b3865c | 2.50 | 1.26 | 2.43 |
| blue | light #dfe6ea | 6.43 | 2.04 | 1.06 |
| blue | dark #7f9aa8 | 2.74 | 1.15 | 2.22 |
| slate | light #d3d7de | 5.62 | 1.78 | 1.08 |
| slate | dark #667690 | 1.76 | 1.79 | 3.46 |

Arrows sit on mid-tone squares so a hard 3:1 is not achievable against every dark square for any single hue; the deep candidate blue maximizes separation from all four themes (and is distinct in hue from every square color). Draw overlays with partial opacity plus a white or dark outline where legibility matters.

## Usage guidance

- Use semantic tokens in components (`bg-card`, `text-muted-foreground`, `border-border`), not scale steps. Scales are for one-off brand surfaces (logo tile, hero accents).
- Result colors: fills (`bg-win|draw|loss`) carry `text-win-foreground` etc. (white). For colored text on regular surfaces use `text-*-text`.
- Primary is deep green in light mode and light mint in dark mode, so `text-primary` links work on both backgrounds.
- Do not use win green for brand chrome; keep brand `primary` for interaction, `win` strictly for results.
- Highlights: apply `--highlight-last` at about 0.45-0.7 alpha via `color-mix(in oklab, var(--highlight-last) 55%, transparent)`.
- Regenerate the contrast tables after changing tokens: `node contrast.mjs` (script kept in the session scratchpad; it reads `app/globals.css` and `lib/board-themes.ts`).
