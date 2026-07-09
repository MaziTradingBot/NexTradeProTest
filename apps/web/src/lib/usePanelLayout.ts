'use client';

import { useCallback, useEffect, useState } from 'react';

// Resizable multi-panel layout for the trading terminal. Tracks the pixel width
// of each side panel (chart is the flexible 1fr column), persists the user's
// sizing across sessions, and exposes a pointer-drag handler for splitter grips.
// Only meaningful on wide (xl+) screens; below that the terminal stacks.

const KEY = 'nxp-trade-layout';
const DEFAULTS = { rail: 210, book: 240, entry: 300 };
const LIMITS: Record<PanelKey, readonly [number, number]> = {
  rail: [160, 360],
  book: [200, 460],
  entry: [260, 480],
};

export type PanelKey = keyof typeof DEFAULTS;

const clamp = (v: number, [lo, hi]: readonly [number, number]) => Math.max(lo, Math.min(hi, v));

export function usePanelLayout() {
  const [widths, setWidths] = useState(DEFAULTS);
  const [isXl, setIsXl] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw) as Partial<typeof DEFAULTS>;
        setWidths((w) => ({
          rail: clamp(p.rail ?? w.rail, LIMITS.rail),
          book: clamp(p.book ?? w.book, LIMITS.book),
          entry: clamp(p.entry ?? w.entry, LIMITS.entry),
        }));
      }
    } catch {
      /* ignore */
    }
    const mq = window.matchMedia('(min-width: 1280px)');
    const onChange = () => setIsXl(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const persist = useCallback((w: typeof DEFAULTS) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(w));
    } catch {
      /* ignore */
    }
  }, []);

  // Start a drag on a splitter grip. `dir` is +1 when dragging right should grow
  // the panel (a grip on the panel's right edge) and -1 when it should shrink it
  // (a grip on the panel's left edge).
  const startResize = useCallback(
    (key: PanelKey, dir: 1 | -1) => (e: React.PointerEvent) => {
      e.preventDefault();
      let lastX = e.clientX;
      let latest = { ...DEFAULTS };
      const move = (ev: PointerEvent) => {
        const dx = (ev.clientX - lastX) * dir;
        lastX = ev.clientX;
        setWidths((w) => {
          latest = { ...w, [key]: clamp(w[key] + dx, LIMITS[key]) };
          return latest;
        });
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        persist(latest);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [persist],
  );

  const reset = useCallback(() => {
    setWidths(DEFAULTS);
    persist(DEFAULTS);
  }, [persist]);

  return { widths, isXl, startResize, reset };
}
