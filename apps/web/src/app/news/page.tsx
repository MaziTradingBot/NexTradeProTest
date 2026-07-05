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
  UPDATE: 'bg-[#0F1D35] text-[#0EA5E9]',
  MARKET: 'bg-[#0f2a20] text-[#34D399]',
  SECURITY: 'bg-[#2a1414] text-[#F87171]',
  PROMOTION: 'bg-[#2a2410] text-[#F59E0B]',
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
    <div className="min-h-screen bg-bg text-[#E8F1FF]" style={{ fontFamily: "'Figtree', system-ui, sans-serif" }}>
      <MarketingNav />

      <section className="bg-gradient-to-b from-[#0F1D35] to-bg">
        <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-extrabold tracking-tight text-[#E8F1FF]">News &amp; Updates</h1>
          <p className="mt-2 text-[#A0BDD8]">Platform announcements, market insights and security notices.</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={cn('rounded-full px-4 py-2 text-sm font-medium transition', cat === c ? 'bg-[#0EA5E9] text-white' : 'border border-[#12233a] text-[#A0BDD8] hover:text-[#E8F1FF]')}
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
            Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-[#0F1D35]" />)
          ) : items.length === 0 ? (
            <p className="text-[#5E7A96]">No announcements in this category yet.</p>
          ) : (
            items.map((a) => (
              <article key={a.id} className="rounded-2xl border border-[#12233a] bg-bg-surface p-6 transition hover:border-[#22D3EE]">
                <div className="flex items-center justify-between gap-3">
                  <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', CAT_STYLES[a.category] ?? 'bg-[#0F1D35] text-[#A0BDD8]')}>
                    {a.category.charAt(0) + a.category.slice(1).toLowerCase()}
                  </span>
                  <time className="text-xs text-[#5E7A96]">{new Date(a.createdAt).toLocaleDateString()}</time>
                </div>
                <h2 className="mt-3 text-lg font-semibold text-[#E8F1FF]">{a.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-[#A0BDD8]">{a.body}</p>
              </article>
            ))
          )}
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
