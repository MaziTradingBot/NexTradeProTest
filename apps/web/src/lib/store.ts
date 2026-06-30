'use client';

import { create } from 'zustand';
import { api, setAccessToken } from './api';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  roles: { key: string; name: string; isAdmin: boolean }[];
  permissions: string[];
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  loadMe: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (perm: string) => boolean;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  loading: true,

  loadMe: async () => {
    try {
      const user = await api.get<AuthUser>('/api/auth/me');
      set({ user, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },

  login: async (email, password) => {
    const res = await api.post<{ accessToken: string }>('/api/auth/login', { email, password });
    setAccessToken(res.accessToken);
    await get().loadMe();
  },

  register: async (email, password, fullName) => {
    const res = await api.post<{ accessToken: string }>('/api/auth/register', {
      email,
      password,
      fullName,
    });
    setAccessToken(res.accessToken);
    await get().loadMe();
  },

  logout: async () => {
    try {
      await api.post('/api/auth/logout');
    } catch {
      /* ignore */
    }
    setAccessToken(null);
    set({ user: null });
  },

  hasPermission: (perm) => {
    const u = get().user;
    if (!u) return false;
    return u.isSuperAdmin || u.permissions.includes(perm);
  },
}));
