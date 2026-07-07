# 02 — Brand Guidelines

Derived from the adopted Figma design. These are the **only** approved brand
values. Do not introduce new colors, fonts, or effects without updating this file.

## Brand personality

Premium, precise, calm-under-pressure. Think institutional trading desk meets
modern fintech: deep near-black backgrounds, a confident sky-blue/cyan accent,
crisp condensed display type, generous negative space, restrained motion.

## Color tokens

| Token            | Hex        | Use                                             |
|------------------|------------|-------------------------------------------------|
| `brand.blue`     | `#0EA5E9`  | Primary actions, links, focus, active nav        |
| `brand.cyan`     | `#22D3EE`  | Secondary accent, highlights, admin emphasis     |
| `bg` (base)      | `#04090F`  | App background                                    |
| `bg.surface`     | `#0A121E`  | Cards, panels                                     |
| `bg.elevated`    | `#0F1D35`  | Popovers, drawers, elevated surfaces             |
| `ink` (primary)  | `#E8F1FF`  | Primary text                                      |
| `ink.muted`      | `#A0BDD8`  | Secondary text                                    |
| `ink.subtle`     | `#5E7A96`  | Tertiary text, captions, table labels           |
| `line`           | `#12233a`  | Borders, dividers                                 |
| Success          | `#34D399`  | Gains, buy, approved                              |
| Danger           | `#F87171`  | Losses, sell, rejected, liquidation             |
| Warning          | `#F59E0B`  | Pending, caution, medium risk                     |

Rules:
- Green = up/long/positive, Red = down/short/negative. Never swap.
- Use accent (`brand.blue`) sparingly — it should mean "the primary action here".
- Admin-only emphasis may use `brand.cyan` to distinguish from user actions.

## Typography

| Role     | Family                          | Usage                                  |
|----------|---------------------------------|----------------------------------------|
| Display  | **Barlow Condensed**            | Page titles, hero, big numbers/stats   |
| Body/UI  | **Figtree**                     | All body copy, buttons, forms, tables  |
| Mono     | **JetBrains Mono**              | Prices, order sizes, addresses, code   |

- Prices and any tabular numeric data use the mono face with tabular figures so
  columns align.
- Adaptive typography: scale headings with viewport (see `docs/03` §Type scale).

## Logo & iconography

- Wordmark component: `apps/web/src/components/Logo.tsx`.
- Icons: **lucide-react** only, default stroke, sizes 13–18px inline, 20–24px nav.
- Do not mix icon libraries.

## Motion

- Purposeful and short: 150–250ms ease for hovers/transitions.
- Prefer opacity/transform (GPU-friendly). Respect `prefers-reduced-motion`.
- No gratuitous parallax or auto-playing loud animation.

## Imagery & surfaces

- Dark glassy cards: `bg.surface` with `line` borders and a soft shadow on hover
  (`0 16px 40px -24px rgba(16,40,90,0.3)`).
- Rounded corners: `rounded-xl`/`rounded-2xl` for cards, `rounded-full` for pills
  and primary CTAs.

## Voice & copy

- Confident, plain, specific. No hype, no emoji in product chrome (emoji are OK as
  user-chosen watchlist labels).
- Always disclose simulation where relevant ("Copying is simulated",
  "Demo banking instructions").
