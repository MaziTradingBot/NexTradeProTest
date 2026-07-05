'use client';

import { useEffect, useState } from 'react';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
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
  UPDATE: 'bg-[#eef3ff] text-[#1a56ff]',
  MARKET: 'bg-[#e7f8ef] text-[#0e9f6e]',
  SECURITY: 'bg-[#fdeeee] text-[#e5484d]',
  PROMOTION: 'bg-[#fff6e6] text-[#c98a00]',
};

export default function NewsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>('ALL');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get<Announcement[]>(`/api/content/announcements${cat !== 'ALL' ? `?category=${cat}` : ''}`)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [cat]);

  return (
    <div className="min-h-screen bg-white text-[#0a1633]" style={{ fontFamily: "'Figtree', system-ui, sans-serif" }}>
      <MarketingNav />

      <section className="bg-gradient-to-b from-[#f2f6ff] to-white">
        <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-extrabold tracking-tight text-[#0a1633]">News &amp; Updates</h1>
          <p className="mt-2 text-[#5b6b8c]">Platform announcements, market insights and security notices.</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={cn('rounded-full px-4 py-2 text-sm font-medium transition', cat === c ? 'bg-[#1a56ff] text-white' : 'border border-[#dbe1ee] text-[#5b6b8c] hover:text-[#0a1633]')}
              >
                {c.charAt(0) + c.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="space-y-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-[#f0f3f9]" />)
          ) : items.length === 0 ? (
            <p className="text-[#8593ad]">No announcements in this category yet.</p>
          ) : (
            items.map((a) => (
              <article key={a.id} className="rounded-2xl border border-[#e7ecf5] bg-white p-6 transition hover:border-[#c9d7ff]">
                <div className="flex items-center justify-between gap-3">
                  <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', CAT_STYLES[a.category] ?? 'bg-[#f2f5fa] text-[#5b6b8c]')}>
                    {a.category.charAt(0) + a.category.slice(1).toLowerCase()}
                  </span>
                  <time className="text-xs text-[#8593ad]">{new Date(a.createdAt).toLocaleDateString()}</time>
                </div>
                <h2 className="mt-3 text-lg font-semibold text-[#0a1633]">{a.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-[#5b6b8c]">{a.body}</p>
              </article>
            ))
          )}
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
