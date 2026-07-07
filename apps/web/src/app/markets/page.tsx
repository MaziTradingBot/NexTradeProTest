'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Search, TrendingUp, TrendingDown, Activity, Star, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { formatCompact, cn } from '@/lib/utils';

interface Coin {
  symbol: string;
  pair: string;
  name: string;
  logoUrl: string | null;
  price: number;
  change24h: number;
  change7d: number;
  marketCap: number;
  volume24h: number;
  rank: number | null;
  categories: string[];
}
interface CoinsResponse { coins: Coin[]; total: number; page: number; pages: number }
interface Category { key: string; label: string; count: number | null }

const fmtPrice = (p: number) =>
  p >= 1 ? p.toLocaleString(undefined, { maximumFractionDigits: 2 }) : p.toLocaleString(undefined, { maximumFractionDigits: 8 });

function CoinLogo({ coin, size = 34 }: { coin: Pick<Coin, 'logoUrl' | 'symbol'>; size?: number }) {
  const [err, setErr] = useState(false);
  if (coin.logoUrl && !err) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={coin.logoUrl} alt={coin.symbol} width={size} height={size} onError={() => setErr(true)} className="rounded-full" style={{ width: size, height: size }} />;
  }
  return (
    <div className="flex items-center justify-center rounded-full bg-[#0F1D35] text-xs font-bold text-[#0EA5E9]" style={{ width: size, height: size }}>
      {coin.symbol.slice(0, 3)}
    </div>
  );
}

function Pct({ value }: { value: number }) {
  const up = value >= 0;
  return (
    <span className={cn('inline-flex items-center justify-end gap-1 font-semibold tabular-nums', up ? 'text-[#34D399]' : 'text-[#F87171]')}>
      {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
      {Math.abs(value).toFixed(2)}%
    </span>
  );
}

const SORTS: { key: string; label: string; className: string }[] = [
  { key: 'rank', label: '#', className: 'hidden w-10 sm:table-cell' },
  { key: 'price', label: 'Price', className: 'text-right' },
  { key: 'change24h', label: '24h', className: 'text-right' },
  { key: 'change7d', label: '7d', className: 'hidden text-right lg:table-cell' },
  { key: 'marketCap', label: 'Market Cap', className: 'hidden text-right md:table-cell' },
  { key: 'volume24h', label: 'Volume (24h)', className: 'hidden text-right xl:table-cell' },
];

export default function MarketsPage() {
  const { user } = useAuth();
  const [coins, setCoins] = useState<Coin[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [category, setCategory] = useState('ALL');
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [sort, setSort] = useState('rank');
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fng, setFng] = useState<{ value: number; label: string } | null>(null);
  const [watch, setWatch] = useState<Set<string>>(new Set());
  const [onlyWatch, setOnlyWatch] = useState(false);
  const firstLoad = useRef(true);

  // Debounce search.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    api.get<Category[]>('/api/market/categories').then(setCats).catch(() => {});
    api.get<{ value: number; label: string }>('/api/market/fear-greed').then(setFng).catch(() => {});
  }, []);

  const loadWatch = useCallback(() => {
    if (!user) return;
    api.get<string[]>('/api/account/watchlist').then((s) => setWatch(new Set(s))).catch(() => {});
  }, [user]);
  useEffect(loadWatch, [loadWatch]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ category, sort, order, page: String(page), limit: '50' });
      if (debouncedQ) params.set('search', debouncedQ);
      if (onlyWatch && watch.size) params.set('symbols', [...watch].map((s) => s.replace('USDT', '')).join(','));
      const res = await api.get<CoinsResponse>(`/api/market/coins?${params.toString()}`);
      setCoins(res.coins);
      setPages(res.pages || 1);
      setTotal(res.total);
    } catch {
      setCoins([]);
    } finally {
      setLoading(false);
      firstLoad.current = false;
    }
  }, [category, sort, order, page, debouncedQ, onlyWatch, watch]);

  useEffect(() => {
    load();
  }, [load]);

  // Reset to page 1 when filters change.
  useEffect(() => { setPage(1); }, [category, debouncedQ, onlyWatch]);

  // Refresh prices periodically without a full skeleton flash.
  useEffect(() => {
    const id = setInterval(() => { if (!onlyWatch) load(); }, 15000);
    return () => clearInterval(id);
  }, [load, onlyWatch]);

  const toggleSort = (key: string) => {
    if (sort === key) setOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    else { setSort(key); setOrder(key === 'rank' ? 'asc' : 'desc'); }
  };

  const toggleWatch = async (pair: string) => {
    if (!user) return;
    const has = watch.has(pair);
    setWatch((w) => { const n = new Set(w); has ? n.delete(pair) : n.add(pair); return n; });
    try {
      if (has) await api.del(`/api/account/watchlist/${pair}`);
      else await api.post('/api/account/watchlist', { symbol: pair });
    } catch { loadWatch(); }
  };

  const avg = useMemo(() => (coins.length ? coins.reduce((s, t) => s + t.change24h, 0) / coins.length : 0), [coins]);
  const topMover = useMemo(() => [...coins].sort((a, b) => b.change24h - a.change24h)[0], [coins]);

  return (
    <div className="min-h-screen bg-bg text-[#E8F1FF]" style={{ fontFamily: "'Figtree', system-ui, sans-serif" }}>
      <MarketingNav />

      <section className="bg-gradient-to-b from-[#0F1D35] to-bg">
        <div className="mx-auto w-full max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-3xl font-extrabold tracking-tight text-[#E8F1FF] sm:text-4xl">Markets</h1>
              <p className="mt-2 flex items-center gap-2 text-sm text-[#A0BDD8] sm:text-base">
                {total.toLocaleString()} cryptocurrencies · live prices
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#34D399]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#34D399]" />LIVE
                </span>
              </p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5E7A96]" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search 150+ coins…" className="w-full rounded-full border border-[#12233a] bg-bg-surface py-2.5 pl-10 pr-4 text-sm text-[#E8F1FF] placeholder:text-[#5E7A96] focus:border-[#0EA5E9] focus:outline-none" />
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3 sm:gap-4">
            {[
              { label: 'Market bias (24h avg)', value: `${avg >= 0 ? '+' : ''}${avg.toFixed(2)}%`, tone: avg >= 0 ? 'up' : 'down' },
              { label: 'Top mover', value: topMover ? `${topMover.symbol} ${topMover.change24h >= 0 ? '+' : ''}${topMover.change24h.toFixed(1)}%` : '—', tone: 'up' },
              { label: 'Fear & Greed', value: fng ? `${fng.value} · ${fng.label}` : '—', tone: 'neutral' },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-[#12233a] bg-bg-surface p-4 sm:p-5">
                <div className="flex items-center gap-2 text-xs text-[#A0BDD8] sm:text-sm"><Activity size={15} /> {s.label}</div>
                <div className={cn('mt-1.5 text-lg font-bold sm:text-xl', s.tone === 'up' ? 'text-[#34D399]' : s.tone === 'down' ? 'text-[#F87171]' : 'text-[#E8F1FF]')}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1400px] px-4 pb-20 sm:px-6 lg:px-8">
        {/* Category chips */}
        <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {cats.map((c) => (
            <button
              key={c.key}
              onClick={() => setCategory(c.key)}
              className={cn(
                'shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-semibold transition sm:text-sm',
                category === c.key ? 'border-[#0EA5E9] bg-[#0EA5E9]/15 text-[#0EA5E9]' : 'border-[#12233a] bg-bg-surface text-[#A0BDD8] hover:border-[#22D3EE]/40',
              )}
            >
              {c.label}{c.count != null && <span className="ml-1.5 text-[#5E7A96]">{c.count}</span>}
            </button>
          ))}
          {user && (
            <div className="ml-auto hidden shrink-0 items-center gap-2 sm:flex">
              <button onClick={() => setOnlyWatch((v) => !v)} className={cn('inline-flex items-center gap-1 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition sm:text-sm', onlyWatch ? 'border-brand-gold/50 bg-brand-gold/15 text-brand-gold' : 'border-[#12233a] bg-bg-surface text-[#A0BDD8]')}>
                <Star size={13} fill={onlyWatch ? 'currentColor' : 'none'} /> Watchlist
              </button>
              <Link href="/watchlists" className="inline-flex items-center gap-1 rounded-full border border-[#12233a] bg-bg-surface px-3.5 py-1.5 text-xs font-semibold text-[#A0BDD8] transition hover:border-[#22D3EE]/40 sm:text-sm">
                Manage lists
              </Link>
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#12233a] bg-bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full min-w-full text-sm">
              <thead>
                <tr className="border-b border-[#0F1D35] text-xs uppercase tracking-wide text-[#5E7A96]">
                  {user && <th className="w-9 px-3 py-3" />}
                  {SORTS.map((s) => (
                    <th key={s.key} className={cn('px-3 py-3 font-semibold sm:px-4', s.key === 'rank' ? s.className : '', s.key !== 'rank' && s.className)}>
                      <button onClick={() => toggleSort(s.key)} className={cn('inline-flex items-center gap-1 hover:text-[#A0BDD8]', s.className.includes('text-right') && 'flex-row-reverse')}>
                        {s.key === 'rank' ? s.label : <span>{s.label}</span>}
                        {s.key !== 'rank' && <ArrowUpDown size={11} className={cn(sort === s.key ? 'text-[#0EA5E9]' : 'text-[#2E3F54]')} />}
                      </button>
                    </th>
                  ))}
                  <th className="px-3 py-3 text-left font-semibold sm:px-4">
                    <button onClick={() => toggleSort('name')} className="inline-flex items-center gap-1 hover:text-[#A0BDD8]">Asset</button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#0F1D35]">
                {loading && coins.length === 0 ? (
                  Array.from({ length: 12 }).map((_, i) => (
                    <tr key={i}><td colSpan={9} className="px-4 py-3"><div className="h-6 animate-pulse rounded bg-[#0F1D35]" /></td></tr>
                  ))
                ) : coins.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-[#5E7A96]">No coins match your filters.</td></tr>
                ) : (
                  coins.map((c) => (
                    <tr key={c.symbol} className="group transition hover:bg-[#080F1C]">
                      {user && (
                        <td className="px-3 py-3.5">
                          <button onClick={() => toggleWatch(c.pair)} aria-label="Toggle watchlist" className={cn('transition', watch.has(c.pair) ? 'text-brand-gold' : 'text-[#2E3F54] hover:text-[#5E7A96]')}>
                            <Star size={15} fill={watch.has(c.pair) ? 'currentColor' : 'none'} />
                          </button>
                        </td>
                      )}
                      <td className="hidden px-3 py-3.5 text-[#5E7A96] sm:table-cell sm:px-4">{c.rank ?? '—'}</td>
                      <td className="px-3 py-3.5 text-right font-medium tabular-nums text-[#E8F1FF] sm:px-4">${fmtPrice(c.price)}</td>
                      <td className="px-3 py-3.5 text-right sm:px-4"><Pct value={c.change24h} /></td>
                      <td className="hidden px-3 py-3.5 text-right lg:table-cell sm:px-4"><Pct value={c.change7d} /></td>
                      <td className="hidden px-3 py-3.5 text-right tabular-nums text-[#A0BDD8] md:table-cell sm:px-4">${formatCompact(c.marketCap)}</td>
                      <td className="hidden px-3 py-3.5 text-right tabular-nums text-[#5E7A96] xl:table-cell sm:px-4">${formatCompact(c.volume24h)}</td>
                      <td className="px-3 py-3.5 sm:px-4">
                        <Link href={`/coins/${c.symbol}`} className="flex items-center gap-3">
                          <CoinLogo coin={c} />
                          <div className="min-w-0">
                            <div className="truncate font-medium text-[#E8F1FF] group-hover:text-[#22D3EE]">{c.name}</div>
                            <div className="text-xs text-[#5E7A96]">{c.symbol}</div>
                          </div>
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-between border-t border-[#0F1D35] px-4 py-3 text-sm text-[#A0BDD8]">
              <span>Page {page} of {pages}</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="inline-flex items-center gap-1 rounded-lg border border-[#12233a] px-3 py-1.5 text-xs font-semibold disabled:opacity-40 hover:enabled:border-[#22D3EE]/40"><ChevronLeft size={14} /> Prev</button>
                <button disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))} className="inline-flex items-center gap-1 rounded-lg border border-[#12233a] px-3 py-1.5 text-xs font-semibold disabled:opacity-40 hover:enabled:border-[#22D3EE]/40">Next <ChevronRight size={14} /></button>
              </div>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-[#5E7A96]">
          Market data served by the NexTradePro Market Data Service. Prices are indicative and for demonstration.
        </p>
      </section>

      <MarketingFooter />
    </div>
  );
}
