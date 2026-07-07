# 03 — UI/UX Design System

The reusable building blocks. Build screens by composing these; do not invent
one-off styles. Tokens live in `apps/web/tailwind.config` and
`apps/web/src/app/globals.css`.

---

## 1. Component classes (globals.css)

| Class            | Purpose                                                    |
|------------------|------------------------------------------------------------|
| `.card`          | Standard panel: `bg.surface`, `line` border, radius, shadow |
| `.btn-primary`   | Primary CTA: `brand.blue` fill, white text, pill           |
| `.btn-ghost`     | Secondary/tertiary: transparent, hover `white/5`           |
| `.input`         | Text/select/textarea field styling                          |
| `.badge`         | Small status pill (variants: success/danger/warning/muted)  |

Compose with utility classes for layout; keep visual tokens in these classes.

## 2. Core components (apps/web/src/components)

Existing, reusable — prefer these over rebuilding:

- **Navigation:** `Navbar`, `AdminSidebar`, `GlobalSearch`, `NotificationBell`,
  `ModeSwitcher`, `ModeBadge`, `ThemeToggle`, `SupportButton`, `WelcomeTour`.
- **Market/trading:** `TradingViewChart`, `OrderBook`, `RecentTrades`,
  `TickerTape`, `Heatmap`, `FearGreed`, `useTickers`, `useOrderBook`,
  `useTradingAccount`.
- **Auth:** `AuthGuard`, `GoogleSignIn`, `MaintenanceGate`.
- **Utility:** `QrCode`, `Logo`, `marketing/*` (landing chrome).

New components must be added here and documented in this file.

## 3. Responsive system (MANDATORY)

### Breakpoint matrix

Every page/modal/table/chart/widget must be verified at each width. No horizontal
scroll may occur during normal use.

| px    | Class of device                | Layout intent                          |
|-------|--------------------------------|----------------------------------------|
| 320   | Small phones                   | Single column, bottom nav, stacked      |
| 375   | iPhone                         | Single column                           |
| 425   | Large phones                   | Single column                           |
| 640   | `sm` — large phone / small tab | 2-col grids begin                       |
| 768   | `md` — tablet portrait         | Sidebar collapsible, 2–3 col            |
| 1024  | `lg` — tablet landscape/laptop | Sidebar visible, trading 3-pane starts  |
| 1280  | `xl` — laptop                  | Full trading terminal                   |
| 1440  | Desktop                        | Full terminal, comfortable gutters      |
| 1920  | Large desktop / 1080p          | Max content width, centered             |
| 2560  | 4K / ultrawide                 | Cap content width; no stretched text    |

### Rules

- **Mobile-first**: default styles target 320px; add complexity upward with
  `sm: md: lg: xl: 2xl:`.
- **No fixed pixel widths** on layout containers; use `max-w-*`, `min-w-0`, `flex`,
  and `grid`. Add `min-w-0` on flex children that contain truncatable text.
- **Tables** → wrap in `overflow-x-auto` **container** (the container scrolls, not
  the page) and provide a stacked-card fallback under `md` for dense tables.
- **Charts** must resize to their container (ResizeObserver / responsive option),
  never a hardcoded width.
- **Trading dashboard**: 3-pane (chart / ticket / book) on `xl+`; tabbed or
  stacked panes on `md` and below.
- **Sidebar/Nav**: desktop sidebar → mobile drawer/bottom-tab. Provide a hamburger.
- **Touch targets** ≥ 44×44px; adequate spacing; no hover-only affordances.
- **Swipe gestures** on mobile for tab/pane switching where natural.
- Cap ultrawide: content `max-w-[1600px]` (or per-page) centered; don't let line
  length exceed ~75ch.

### Type scale (adaptive)

Use clamp-based sizing for display headings, e.g. hero
`text-4xl sm:text-5xl lg:text-6xl`; body stays `text-sm`/`text-base`. Numeric
readouts scale down gracefully on small screens without truncation.

## 4. Cross-platform / cross-browser targets

Must render and function correctly on:

- **Browsers:** Chrome, Edge, Firefox, Safari, Opera (last 2 major versions).
- **OS/devices:** Windows/macOS/Linux desktop & laptop; iPad / Android / Windows
  tablets; iPhone / Android phones; 4K & ultrawide monitors.
- Use standard CSS/Tailwind; avoid non-portable APIs. Test Safari specifically for
  flexbox/gap, date inputs, and sticky headers. Provide `-webkit-` where needed.

## 5. Accessibility

- Semantic HTML, labelled inputs, visible focus rings (`brand.blue`).
- Color is never the only signal (pair with icon/label).
- Contrast ≥ WCAG AA on text against `bg`/`bg.surface`.
- Keyboard operable: all interactive elements reachable and actionable.

## 6. States

Every data view defines: **loading** (skeleton), **empty** (friendly message +
primary action), **error** (retry), and **populated**. No dead ends.

## 7. Performance budget (see `docs/04` §Performance)

Lighthouse target 95+. Lazy-load heavy widgets (charts, heatmaps), code-split by
route, optimize images, and keep main-thread work minimal.
