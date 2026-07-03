'use client';

import { create } from 'zustand';

export type Mode = 'DEMO' | 'LIVE';

interface ModeState {
  mode: Mode;
  hydrated: boolean;
  init: () => void;
  setMode: (m: Mode) => void;
}

// Active account mode. Persisted to localStorage and mirrored into the api
// client (which reads localStorage directly to set the x-nxp-mode header).
export const useMode = create<ModeState>((set) => ({
  mode: 'DEMO',
  hydrated: false,
  init: () => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('nxp-mode') === 'LIVE' ? 'LIVE' : 'DEMO';
    set({ mode: stored, hydrated: true });
  },
  setMode: (m) => {
    if (typeof window !== 'undefined') localStorage.setItem('nxp-mode', m);
    set({ mode: m });
  },
}));
