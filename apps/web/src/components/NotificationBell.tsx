'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  createdAt: string;
}

const DOT: Record<string, string> = {
  SUCCESS: 'bg-brand-emerald',
  WARNING: 'bg-brand-gold',
  TRADE: 'bg-brand-blue',
  INFO: 'bg-slate-400',
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const load = () => {
    api
      .get<{ items: Notification[]; unread: number }>('/api/account/notifications')
      .then((d) => {
        setItems(d.items);
        setUnread(d.unread);
      })
      .catch(() => {});
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => {
      clearInterval(id);
      document.removeEventListener('mousedown', onClick);
    };
  }, []);

  const markAll = async () => {
    await api.post('/api/account/notifications/read-all').catch(() => {});
    setItems((x) => x.map((n) => ({ ...n, read: true })));
    setUnread(0);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10"
        aria-label="Notifications"
      >
        <Bell size={17} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-2xl border border-white/10 bg-bg-surface shadow-card">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <span className="text-sm font-semibold text-white">Notifications</span>
            {unread > 0 && (
              <button onClick={markAll} className="flex items-center gap-1 text-xs text-brand-blue hover:underline">
                <CheckCheck size={13} /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-500">No notifications</div>
            ) : (
              items.map((n) => (
                <div key={n.id} className={cn('flex gap-3 border-b border-white/5 px-4 py-3', !n.read && 'bg-white/[0.03]')}>
                  <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', DOT[n.type] ?? 'bg-slate-400')} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white">{n.title}</div>
                    <div className="text-xs text-slate-400">{n.body}</div>
                    <div className="mt-1 text-[10px] text-slate-500">{new Date(n.createdAt).toLocaleString()}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
