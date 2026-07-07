'use client';

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, RefreshCw, Newspaper } from 'lucide-react';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface NewsItem {
  id: string;
  title: string;
  url: string | null;
  source: string;
  publishedAt: string;
  section: string;
  summary?: string;
}
interface Section { key: string; label: string }
interface NewsResponse { updatedAt: string; sources: string[]; sections: Section[]; items: NewsItem[]; live: boolean }

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const SECTION_TONE: Record<string, string> = {
  BITCOIN: 'text-[#F59E0B]', ETHEREUM: 'text-[#8FA2FF]', DEFI: 'text-[#34D399]',
  AI: 'text-[#22D3EE]', REGULATION: 'text-[#F87171]', MARKETS: 'text-[#0EA5E9]',
  ANALYSIS: 'text-[#A0BDD8]', ALTCOINS: 'text-[#C792EA]',
};

export default function NewsPage() {
  const [data, setData] = useState<NewsResponse | null>(null);
  const [section, setSection] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (sec: string, silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const res = await api.get<NewsResponse>(`/api/news?section=${sec}`);
      setData(res);
    } catch {
      setData({ updatedAt: new Date().toISOString(), sources: [], sections: [], items: [], live: false });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(section); }, [section, load]);

  // Auto-refresh every 2 minutes.
  useEffect(() => {
    const id = setInterval(() => load(section, true), 120000);
    return () => clearInterval(id);
  }, [section, load]);

  const sections = data?.sections?.length ? data.sections : [{ key: 'ALL', label: 'Breaking' }];
  const items = data?.items ?? [];

  return (
    <div className="min-h-screen bg-bg text-[#E8F1FF]" style={{ fontFamily: "'Figtree', system-ui, sans-serif" }}>
      <MarketingNav />

      <section className="bg-gradient-to-b from-[#0F1D35] to-bg">
        <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="flex items-center gap-2.5 text-3xl font-extrabold tracking-tight text-[#E8F1FF] sm:text-4xl"><Newspaper className="text-brand-blue" /> News Center</h1>
              <p className="mt-2 text-sm text-[#A0BDD8] sm:text-base">Breaking crypto news, market moves and platform updates.</p>
            </div>
            <button onClick={() => load(section, true)} className="inline-flex items-center gap-1.5 self-start rounded-full border border-[#12233a] bg-bg-surface px-4 py-2 text-xs font-semibold text-[#A0BDD8] hover:border-[#22D3EE]/40 sm:self-auto">
              <RefreshCw size={13} className={cn(refreshing && 'animate-spin')} /> Refresh
            </button>
          </div>

          <div className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {sections.map((s) => (
              <button key={s.key} onClick={() => setSection(s.key)} className={cn('shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-semibold transition sm:text-sm', section === s.key ? 'border-[#0EA5E9] bg-[#0EA5E9]/15 text-[#0EA5E9]' : 'border-[#12233a] bg-bg-surface text-[#A0BDD8] hover:border-[#22D3EE]/40')}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 pb-20 sm:px-6 lg:px-8">
        {loading ? (
          <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-bg-surface" />)}</div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-[#12233a] bg-bg-surface p-12 text-center text-[#5E7A96]">
            No stories in this section right now. Check back soon.
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((n) => {
              const Wrapper: React.ElementType = n.url ? 'a' : 'div';
              return (
                <Wrapper
                  key={n.id}
                  {...(n.url ? { href: n.url, target: '_blank', rel: 'noreferrer' } : {})}
                  className={cn('block rounded-2xl border border-[#12233a] bg-bg-surface p-5 transition', n.url && 'hover:border-[#22D3EE]/40')}
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className={cn('font-semibold uppercase tracking-wide', SECTION_TONE[n.section] ?? 'text-[#0EA5E9]')}>{n.section === 'ALL' ? 'NEWS' : n.section}</span>
                    <span className="text-[#5E7A96]">·</span>
                    <span className="text-[#5E7A96]">{n.source}</span>
                    <span className="text-[#5E7A96]">·</span>
                    <span className="text-[#5E7A96]">{timeAgo(n.publishedAt)}</span>
                  </div>
                  <h2 className="mt-2 flex items-start gap-2 font-semibold text-[#E8F1FF]">
                    <span>{n.title}</span>
                    {n.url && <ExternalLink size={14} className="mt-1 shrink-0 text-[#5E7A96]" />}
                  </h2>
                  {n.summary && <p className="mt-1.5 line-clamp-2 text-sm text-[#A0BDD8]">{n.summary}</p>}
                </Wrapper>
              );
            })}
          </div>
        )}

        <p className="mt-6 text-center text-xs text-[#5E7A96]">
          {data?.live
            ? `Aggregated from ${data.sources.join(', ') || 'approved providers'} · updated ${data ? timeAgo(data.updatedAt) : ''}`
            : 'Showing NexTradePro platform updates. Live news providers activate when configured.'}
        </p>
      </section>

      <MarketingFooter />
    </div>
  );
}
