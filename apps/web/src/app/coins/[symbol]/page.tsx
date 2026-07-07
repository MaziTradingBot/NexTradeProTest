'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ArrowLeft, Star, Bell, ExternalLink, Globe, FileText, TrendingUp, TrendingDown, LineChart } from 'lucide-react';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { formatCompact, cn } from '@/lib/utils';

const TradingViewChart = dynamic(() => import('@/components/TradingViewChart'), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-[#5E7A96]"><LineChart className="animate-pulse" /></div>,
});

interface Coin {
  symbol: string; pair: string; name: string; logoUrl: string | null;
  price: number; change24h: number; change7d: number; high24h: number; low24h: number;
  marketCap: number; volume24h: number; rank: number | null; circulating: number | null;
  maxSupply: number | null; website: string | null; explorer: string | null;
  whitepaper: string | null; categories: string[]; tradingEnabled: boolean;
}

const CAT_LABELS: Record<string, string> = {
  LAYER1: 'Layer 1', LAYER2: 'Layer 2', DEFI: 'DeFi', MEME: 'Meme', AI: 'AI', GAMING: 'Gaming',
  METAVERSE: 'Metaverse', STABLECOIN: 'Stablecoin', INFRA: 'Infrastructure', EXCHANGE: 'Exchange',
  PRIVACY: 'Privacy', RWA: 'Real World Assets',
};
const fmtPrice = (p: number) => (p >= 1 ? p.toLocaleString(undefined, { maximumFractionDigits: 2 }) : p.toLocaleString(undefined, { maximumFractionDigits: 8 }));

export default function CoinDetailPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = use(params);
  const { user } = useAuth();
  const [coin, setCoin] = useState<Coin | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [watched, setWatched] = useState(false);
  const [alert, setAlert] = useState({ condition: 'ABOVE', value: '' });
  const [toast, setToast] = useState<string | null>(null);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };

  useEffect(() => {
    let active = true;
    const load = () => api.get<Coin>(`/api/market/coins/${symbol}`)
      .then((c) => { if (active) { setCoin(c); setLoading(false); } })
      .catch(() => { if (active) { setNotFound(true); setLoading(false); } });
    load();
    const id = setInterval(load, 15000);
    return () => { active = false; clearInterval(id); };
  }, [symbol]);

  useEffect(() => {
    if (!user || !coin) return;
    api.get<string[]>('/api/account/watchlist').then((s) => setWatched(s.includes(coin.pair))).catch(() => {});
  }, [user, coin]);

  const toggleWatch = async () => {
    if (!user || !coin) return;
    const has = watched;
    setWatched(!has);
    try {
      if (has) await api.del(`/api/account/watchlist/${coin.pair}`);
      else await api.post('/api/account/watchlist', { symbol: coin.pair });
    } catch { setWatched(has); }
  };

  const createAlert = async () => {
    if (!coin) return;
    const value = parseFloat(alert.value);
    if (!value || value <= 0) return;
    try {
      await api.post('/api/account/alerts', { symbol: coin.pair, condition: alert.condition, value });
      setAlert((a) => ({ ...a, value: '' }));
      flash('Price alert created');
    } catch (e) { flash(e instanceof Error ? e.message : 'Failed'); }
  };

  return (
    <div className="min-h-screen bg-bg text-[#E8F1FF]" style={{ fontFamily: "'Figtree', system-ui, sans-serif" }}>
      <MarketingNav />

      <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
        <Link href="/markets" className="mb-6 inline-flex items-center gap-1.5 text-sm text-[#A0BDD8] hover:text-[#22D3EE]"><ArrowLeft size={15} /> Back to markets</Link>

        {loading ? (
          <div className="space-y-4"><div className="h-20 animate-pulse rounded-2xl bg-bg-surface" /><div className="h-80 animate-pulse rounded-2xl bg-bg-surface" /></div>
        ) : notFound || !coin ? (
          <div className="rounded-2xl border border-[#12233a] bg-bg-surface p-12 text-center">
            <p className="text-lg font-semibold text-[#E8F1FF]">Coin not found</p>
            <p className="mt-1 text-sm text-[#5E7A96]">This asset isn’t in the NexTradePro universe.</p>
            <Link href="/markets" className="btn-primary mt-5 inline-flex">Browse markets</Link>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex flex-col gap-5 rounded-2xl border border-[#12233a] bg-bg-surface p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <CoinLogo coin={coin} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-extrabold tracking-tight text-[#E8F1FF] sm:text-3xl">{coin.name}</h1>
                    <span className="rounded-md bg-[#0F1D35] px-2 py-0.5 text-xs font-semibold text-[#A0BDD8]">{coin.symbol}</span>
                    {coin.rank && <span className="rounded-md bg-[#0F1D35] px-2 py-0.5 text-xs text-[#5E7A96]">Rank #{coin.rank}</span>}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {coin.categories.map((c) => (
                      <span key={c} className="rounded-full border border-[#12233a] px-2 py-0.5 text-[11px] font-medium text-[#A0BDD8]">{CAT_LABELS[c] ?? c}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="sm:text-right">
                  <div className="font-mono text-3xl font-bold tabular-nums text-[#E8F1FF]">${fmtPrice(coin.price)}</div>
                  <div className={cn('flex items-center gap-1 text-sm font-semibold sm:justify-end', coin.change24h >= 0 ? 'text-[#34D399]' : 'text-[#F87171]')}>
                    {coin.change24h >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}{Math.abs(coin.change24h).toFixed(2)}% (24h)
                  </div>
                </div>
                <div className="flex gap-2">
                  {user && (
                    <button onClick={toggleWatch} aria-label="Watchlist" className={cn('inline-flex items-center gap-1.5 rounded-full border px-4 py-2.5 text-sm font-semibold transition', watched ? 'border-brand-gold/50 bg-brand-gold/15 text-brand-gold' : 'border-[#12233a] text-[#A0BDD8] hover:border-[#22D3EE]/40')}>
                      <Star size={15} fill={watched ? 'currentColor' : 'none'} /> {watched ? 'Watching' : 'Watch'}
                    </button>
                  )}
                  {coin.tradingEnabled && (
                    <Link href={`/trading?symbol=${coin.pair}`} className="btn-primary whitespace-nowrap">Trade {coin.symbol}</Link>
                  )}
                </div>
              </div>
            </div>

            {/* Chart + stats */}
            <div className="mt-5 grid gap-5 lg:grid-cols-3">
              <div className="rounded-2xl border border-[#12233a] bg-bg-surface p-2 lg:col-span-2">
                <div className="h-[320px] w-full sm:h-[440px]">
                  <TradingViewChart symbol={coin.pair} />
                </div>
              </div>

              <div className="space-y-5">
                <div className="rounded-2xl border border-[#12233a] bg-bg-surface p-5">
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#5E7A96]">Statistics</h2>
                  <dl className="space-y-2.5 text-sm">
                    {[
                      ['Market cap', coin.marketCap ? `$${formatCompact(coin.marketCap)}` : '—'],
                      ['Volume (24h)', coin.volume24h ? `$${formatCompact(coin.volume24h)}` : '—'],
                      ['24h high', coin.high24h ? `$${fmtPrice(coin.high24h)}` : '—'],
                      ['24h low', coin.low24h ? `$${fmtPrice(coin.low24h)}` : '—'],
                      ['7d change', `${coin.change7d >= 0 ? '+' : ''}${coin.change7d.toFixed(2)}%`],
                      ['Circulating', coin.circulating ? `${formatCompact(coin.circulating)} ${coin.symbol}` : '—'],
                      ['Max supply', coin.maxSupply ? `${formatCompact(coin.maxSupply)} ${coin.symbol}` : '∞'],
                    ].map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between gap-3">
                        <dt className="text-[#5E7A96]">{k}</dt>
                        <dd className="font-medium tabular-nums text-[#E8F1FF]">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  {(coin.website || coin.explorer || coin.whitepaper) && (
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-[#0F1D35] pt-4">
                      {coin.website && <a href={coin.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs font-medium text-[#A0BDD8] hover:text-[#22D3EE]"><Globe size={13} /> Website</a>}
                      {coin.explorer && <a href={coin.explorer} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs font-medium text-[#A0BDD8] hover:text-[#22D3EE]"><ExternalLink size={13} /> Explorer</a>}
                      {coin.whitepaper && <a href={coin.whitepaper} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs font-medium text-[#A0BDD8] hover:text-[#22D3EE]"><FileText size={13} /> Whitepaper</a>}
                    </div>
                  )}
                </div>

                {user && (
                  <div className="rounded-2xl border border-[#12233a] bg-bg-surface p-5">
                    <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#E8F1FF]"><Bell size={15} className="text-brand-blue" /> Price alert</h2>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <select value={alert.condition} onChange={(e) => setAlert((a) => ({ ...a, condition: e.target.value }))} className="input">
                        <option value="ABOVE">Price above</option>
                        <option value="BELOW">Price below</option>
                        <option value="PCT_CHANGE">% change ≥</option>
                      </select>
                      <input value={alert.value} onChange={(e) => setAlert((a) => ({ ...a, value: e.target.value }))} type="number" placeholder={alert.condition === 'PCT_CHANGE' ? '%' : 'Price'} className="input" />
                    </div>
                    <button onClick={createAlert} className="btn-primary mt-2 w-full">Create alert</button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {toast && <div className="fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-xl border border-white/10 bg-bg-elevated px-4 py-2.5 text-sm text-white shadow-card">{toast}</div>}
      <MarketingFooter />
    </div>
  );
}

function CoinLogo({ coin }: { coin: { logoUrl: string | null; symbol: string } }) {
  const [err, setErr] = useState(false);
  if (coin.logoUrl && !err) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={coin.logoUrl} alt={coin.symbol} width={56} height={56} onError={() => setErr(true)} className="h-14 w-14 rounded-full" />;
  }
  return <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#0F1D35] text-sm font-bold text-[#0EA5E9]">{coin.symbol.slice(0, 3)}</div>;
}
