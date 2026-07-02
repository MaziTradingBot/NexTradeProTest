'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Announcement {
  id: string;
  title: string;
  body: string;
  category: string;
  published: boolean;
  createdAt: string;
}

const CATS = ['UPDATE', 'MARKET', 'SECURITY', 'PROMOTION'] as const;
const CAT_STYLES: Record<string, string> = {
  UPDATE: 'bg-brand-blue/15 text-brand-blue',
  MARKET: 'bg-brand-emerald/15 text-brand-emerald',
  SECURITY: 'bg-red-500/15 text-red-400',
  PROMOTION: 'bg-brand-gold/15 text-brand-gold',
};

export default function AdminAnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<(typeof CATS)[number]>('UPDATE');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api.get<Announcement[]>('/api/admin/announcements').then(setItems).catch(() => setItems([]));
  }, []);
  useEffect(load, [load]);

  const create = async () => {
    setError(null);
    try {
      await api.post('/api/admin/announcements', { title, body, category, published: true });
      setTitle('');
      setBody('');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  };

  const remove = async (id: string) => {
    await api.del(`/api/admin/announcements/${id}`);
    setItems((x) => x.filter((i) => i.id !== id));
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Announcements</h1>
      <p className="mt-1 text-slate-400">Publish updates that appear on the public News page.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* Composer */}
        <div className="card h-fit">
          <div className="mb-4 flex items-center gap-2">
            <Plus size={18} className="text-brand-blue" />
            <h2 className="font-semibold text-white">New announcement</h2>
          </div>
          <label className="label">Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="input mb-3" placeholder="Headline" />
          <label className="label">Category</label>
          <div className="mb-3 grid grid-cols-2 gap-2">
            {CATS.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={cn('rounded-xl py-2 text-xs font-semibold transition', category === c ? 'bg-brand-gradient text-white' : 'bg-white/5 text-slate-400')}
              >
                {c.charAt(0) + c.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
          <label className="label">Body</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} className="input mb-3" placeholder="Message…" />
          {error && <p className="mb-2 text-sm text-red-400">{error}</p>}
          <button onClick={create} className="btn-primary w-full">
            Publish
          </button>
        </div>

        {/* List */}
        <div className="space-y-3">
          {items.map((a) => (
            <div key={a.id} className="card">
              <div className="flex items-start justify-between gap-3">
                <span className={cn('badge', CAT_STYLES[a.category] ?? 'bg-white/5 text-slate-300')}>
                  {a.category.charAt(0) + a.category.slice(1).toLowerCase()}
                </span>
                <button onClick={() => remove(a.id)} className="rounded-lg p-1.5 text-red-400 hover:bg-red-500/10">
                  <Trash2 size={15} />
                </button>
              </div>
              <h3 className="mt-2 font-semibold text-white">{a.title}</h3>
              <p className="mt-1 text-sm text-slate-400">{a.body}</p>
              <div className="mt-2 text-xs text-slate-500">{new Date(a.createdAt).toLocaleString()}</div>
            </div>
          ))}
          {items.length === 0 && <p className="text-sm text-slate-500">No announcements yet — create one on the left.</p>}
        </div>
      </div>
    </div>
  );
}
