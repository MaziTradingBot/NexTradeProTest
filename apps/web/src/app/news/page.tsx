'use client';

import { useEffect, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Announcement {
  id: string;
  title: string;
  body: string;
  category: string;
  createdAt: string;
}

const CATEGORIES = ['ALL', 'UPDATE', 'MARKET', 'SECURITY', 'PROMOTION'] as const;

const CAT_STYLES: Record<string, string> = {
  UPDATE: 'bg-brand-blue/15 text-brand-blue',
  MARKET: 'bg-brand-emerald/15 text-brand-emerald',
  SECURITY: 'bg-red-500/15 text-red-400',
  PROMOTION: 'bg-brand-gold/15 text-brand-gold',
};

export default function NewsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>('ALL');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get<Announcement[]>(`/api/content/announcements${cat !== 'ALL' ? `?category=${cat}` : ''}`)
      .then((d) => setItems(d))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [cat]);

  return (
    <main>
      <Navbar />
      <section className="mx-auto max-w-4xl px-4 pt-28 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-white sm:text-4xl">News &amp; Updates</h1>
        <p className="mt-2 text-slate-400">Platform announcements, market insights and security notices.</p>

        <div className="mt-6 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={cn(
                'rounded-xl px-4 py-2 text-sm font-medium transition',
                cat === c ? 'bg-brand-gradient text-white' : 'bg-white/5 text-slate-400 hover:text-white',
              )}
            >
              {c.charAt(0) + c.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        <div className="mt-8 space-y-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/5" />)
          ) : items.length === 0 ? (
            <p className="text-slate-500">No announcements in this category yet.</p>
          ) : (
            items.map((a) => (
              <article key={a.id} className="card transition hover:border-brand-blue/40">
                <div className="flex items-center justify-between gap-3">
                  <span className={cn('badge', CAT_STYLES[a.category] ?? 'bg-white/5 text-slate-300')}>
                    {a.category.charAt(0) + a.category.slice(1).toLowerCase()}
                  </span>
                  <time className="text-xs text-slate-500">{new Date(a.createdAt).toLocaleDateString()}</time>
                </div>
                <h2 className="mt-3 text-lg font-semibold text-white">{a.title}</h2>
                <p className="mt-2 text-sm text-slate-400">{a.body}</p>
              </article>
            ))
          )}
        </div>
      </section>
      <div className="h-20" />
      <Footer />
    </main>
  );
}
