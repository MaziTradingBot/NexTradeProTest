'use client';

import { useEffect, useState } from 'react';
import { api } from './api';

export type Flags = Record<string, boolean>;

let cache: Flags | null = null;

export function useFlags() {
  const [flags, setFlags] = useState<Flags>(cache ?? {});
  const [loaded, setLoaded] = useState(!!cache);

  useEffect(() => {
    let active = true;
    api
      .get<Flags>('/api/content/flags')
      .then((f) => {
        cache = f;
        if (active) {
          setFlags(f);
          setLoaded(true);
        }
      })
      .catch(() => active && setLoaded(true));
    return () => {
      active = false;
    };
  }, []);

  return { flags, loaded };
}
