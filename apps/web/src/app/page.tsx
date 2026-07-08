'use client';

import Link from 'next/link';
import {
  ArrowRight, ShieldCheck, Zap, LineChart, Users, Bot, Globe,
  Check, TrendingUp, TrendingDown, Star, Activity,
} from 'lucide-react';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { useTickers, assetName } from '@/lib/useTickers';
import { cn } from '@/lib/utils';

const FEATURES = [
  { icon: Zap, title: 'Fast execution', desc: 'A responsive matching engine with real-time WebSocket market data from Binance and Bybit.' },
  { icon: LineChart, title: 'Pro charting', desc: 'TradingView Advanced Charts, live order book, market & limit orders, and 80+ indicators.' },
  { icon: Bot, title: 'AI insights', desc: 'Daily market summaries, a portfolio health score and sentiment — right when you need them.' },
  { icon: Users, title: 'Copy trading', desc: 'Mirror top-ranked traders with transparent ROI, win rate and risk levels.' },
  { icon: ShieldCheck, title: 'Enterprise security', desc: 'Two-factor auth, KYC, granular admin roles and full audit logging.' },
  { icon: Globe, title: '350+ markets', desc: 'Spot and futures across a single, unified interface — available 24/7.' },
];

const STATS: [string, string][] = [
  ['$48B+', 'Trading volume'],
  ['2.4M+', 'Active traders'],
  ['350+', 'Markets'],
  ['99.99%', 'Uptime'],
];

const STEPS = [
  { n: '01', title: 'Create your account', desc: 'Sign up free in under 3 minutes — no deposit required to start in demo mode.' },
  { n: '02', title: 'Fund your demo wallet', desc: 'Get a $100,000 virtual balance and live prices to practice with zero risk.' },
  { n: '03', title: 'Trade & learn', desc: 'Place simulated spot and futures trades, follow AI insights, and copy top traders.' },
];

const TESTIMONIALS = [
  { name: 'Marcus Chen', role: 'Prop trader', text: 'The execution speed and clean interface make this my default terminal. Everything I need in one place.' },
  { name: 'Alicia Ramos', role: 'Portfolio manager', text: 'The AI summaries and portfolio health score genuinely help me spot risk before it becomes a problem.' },
  { name: 'Dmitri Volkov', role: 'Quant analyst', text: 'Realistic simulation, solid charting and a copy-trading engine that actually works. Impressive build.' },
];

const fmtPrice = (p: number) => `$${p.toLocaleString(undefined, { minimumFractionDigits: p < 2 ? 4 : 2, maximumFractionDigits: p < 2 ? 4 : 2 })}`;

// Deterministic sparkline path so it doesn't jitter between renders.
function sparkline(seed: number, up: boolean): string {
  const pts: number[] = [];
  let v = 50;
  let s = seed;
  for (let i = 0; i < 24; i++) {
    s = (s * 9301 + 49297) % 233280;
    v += (s / 233280 - (up ? 0.42 : 0.58)) * 16;
    v = Math.max(8, Math.min(92, v));
    pts.push(v);
  }
  return pts.map((y, i) => `${(i / 23) * 100},${100 - y}`).join(' ');
}

export default function HomePage() {
  const { tickers, live } = useTickers(7000);
  const top = tickers.slice(0, 5);
  const btc = tickers.find((t) => t.symbol === 'BTCUSDT') ?? tickers[0];
  const tickerLoop = tickers.length ? [...tickers, ...tickers] : [];

  return (
    <div className="min-h-screen bg-bg text-ink">
      <MarketingNav />

      {/* Live ticker strip */}
      <div className="overflow-hidden border-b border-brand-blue/10 bg-bg-darker/60">
        <div className="flex w-max animate-ticker gap-8 py-2.5">
          {tickerLoop.map((t, i) => (
            <span key={i} className="flex items-center gap-2 whitespace-nowrap font-mono text-xs">
              <span className="font-semibold text-ink-soft">{assetName(t.symbol)}</span>
              <span className="text-ink">{fmtPrice(t.price)}</span>
              <span className={t.change >= 0 ? 'text-brand-emerald' : 'text-brand-red'}>
                {t.change >= 0 ? '+' : ''}{t.change.toFixed(2)}%
              </span>
            </span>
          ))}
          {tickerLoop.length === 0 && <span className="py-0.5 pl-6 text-xs text-ink-muted">Loading live market data…</span>}
        </div>
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-grid-dark [background-size:60px_60px] opacity-60" />
        <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-brand-blue/20 blur-[120px]" />
        <div className="pointer-events-none absolute -right-40 top-20 h-96 w-96 rounded-full bg-brand-cyan/10 blur-[120px]" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:py-28">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-blue/20 bg-brand-blue/10 px-3.5 py-1.5 text-xs font-semibold text-brand-blue">
              <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-brand-cyan" />
              Institutional-grade crypto trading
            </span>
            <h1 className="mt-6 text-5xl font-bold leading-[1.05] tracking-tight text-ink sm:text-6xl">
              Trade crypto<br />
              like a <span className="gradient-text">pro</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink-soft">
              Live market data, professional charts, a full margin trading engine and AI insights — with
              clearly-labeled simulated execution so you can practice with zero risk.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register" className="btn-primary px-6 py-3 text-base">
                Start trading free <ArrowRight size={18} />
              </Link>
              <Link href="/markets" className="btn-ghost px-6 py-3 text-base">
                Explore markets
              </Link>
            </div>
            <div className="mt-10 grid max-w-lg grid-cols-4 gap-4">
              {STATS.map(([v, l]) => (
                <div key={l}>
                  <div className="text-2xl font-bold text-ink">{v}</div>
                  <div className="mt-0.5 text-xs text-ink-muted">{l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Live product card */}
          <div className="relative">
            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-brand-blue/10 to-brand-cyan/5 blur-2xl" />
            <div className="relative rounded-2xl border border-brand-blue/10 bg-bg-surface/90 p-5 shadow-card backdrop-blur">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-gold/20 font-mono text-sm font-bold text-brand-gold">₿</span>
                  <div>
                    <div className="text-sm font-semibold text-ink">{assetName(btc?.symbol ?? 'BTCUSDT')}/USDT</div>
                    <div className="text-xs text-ink-muted">Bitcoin</div>
                  </div>
                </div>
                <span className={cn('badge', live ? 'bg-brand-emerald/20 text-brand-emerald' : 'bg-brand-gold/20 text-brand-gold')}>
                  <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-current" /> {live ? 'Live' : 'Demo'}
                </span>
              </div>

              <div className="mt-4 flex items-end justify-between">
                <div className="text-4xl font-bold tracking-tight text-ink">{btc ? fmtPrice(btc.price) : '—'}</div>
                {btc && (
                  <div className={cn('flex items-center gap-1 text-sm font-semibold', btc.change >= 0 ? 'text-brand-emerald' : 'text-brand-red')}>
                    {btc.change >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                    {btc.change >= 0 ? '+' : ''}{btc.change.toFixed(2)}%
                  </div>
                )}
              </div>

              {/* Sparkline */}
              <div className="mt-3 h-24 w-full">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
                  <defs>
                    <linearGradient id="hero-spark" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0EA5E9" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#0EA5E9" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {(() => {
                    const pts = sparkline(Math.round((btc?.price ?? 60000)), (btc?.change ?? 1) >= 0);
                    const stroke = (btc?.change ?? 1) >= 0 ? '#34D399' : '#F87171';
                    return (
                      <>
                        <polygon points={`0,100 ${pts} 100,100`} fill="url(#hero-spark)" />
                        <polyline points={pts} fill="none" stroke={stroke} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                      </>
                    );
                  })()}
                </svg>
              </div>

              {/* Mini market list */}
              <div className="mt-4 space-y-1">
                {top.slice(0, 4).map((t) => (
                  <div key={t.symbol} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-xs hover:bg-white/[0.03]">
                    <span className="font-medium text-ink-soft">{assetName(t.symbol)}<span className="text-ink-faint">/USDT</span></span>
                    <span className="flex items-center gap-3 font-mono">
                      <span className="text-ink">{fmtPrice(t.price)}</span>
                      <span className={cn('w-14 text-right', t.change >= 0 ? 'text-brand-emerald' : 'text-brand-red')}>
                        {t.change >= 0 ? '+' : ''}{t.change.toFixed(2)}%
                      </span>
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-brand-blue/10 bg-brand-blue/5 px-3 py-2 text-[11px] text-ink-muted">
                <Activity size={13} className="text-brand-blue" /> Prices stream live from public exchange data · execution is simulated.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live markets */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <div className="eyebrow">Markets</div>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-ink">Live crypto prices</h2>
          </div>
          <Link href="/markets" className="hidden text-sm font-semibold text-brand-blue hover:text-brand-cyan sm:flex sm:items-center sm:gap-1">
            All markets <ArrowRight size={15} />
          </Link>
        </div>
        <div className="card overflow-hidden p-0">
          <div className="grid grid-cols-4 border-b border-brand-blue/10 px-5 py-3 text-xs uppercase tracking-wide text-ink-muted">
            <span>Pair</span>
            <span className="text-right">Price</span>
            <span className="text-right">24h</span>
            <span className="hidden text-right sm:block">Trend</span>
          </div>
          {top.map((t) => (
            <Link
              key={t.symbol}
              href={`/trading?symbol=${t.symbol}`}
              className="grid grid-cols-4 items-center border-b border-brand-blue/5 px-5 py-3.5 transition-colors last:border-0 hover:bg-white/[0.03]"
            >
              <span className="flex items-center gap-2.5 font-semibold text-ink">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-blue/10 font-mono text-xs text-brand-blue">
                  {assetName(t.symbol).slice(0, 3)}
                </span>
                {assetName(t.symbol)}<span className="text-ink-faint">/USDT</span>
              </span>
              <span className="text-right font-mono text-ink">{fmtPrice(t.price)}</span>
              <span className={cn('text-right font-mono font-semibold', t.change >= 0 ? 'text-brand-emerald' : 'text-brand-red')}>
                {t.change >= 0 ? '+' : ''}{t.change.toFixed(2)}%
              </span>
              <span className="hidden justify-end sm:flex">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-8 w-24">
                  <polyline
                    points={sparkline(Math.round(t.price), t.change >= 0)}
                    fill="none"
                    stroke={t.change >= 0 ? '#34D399' : '#F87171'}
                    strokeWidth="1.5"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              </span>
            </Link>
          ))}
          {top.length === 0 && <div className="px-5 py-10 text-center text-sm text-ink-muted">Loading live markets…</div>}
        </div>
      </section>

      {/* Features */}
      <section className="border-y border-brand-blue/10 bg-bg-darker/40">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <div className="eyebrow">Why NexTradePro</div>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">Everything a serious trader needs</h2>
            <p className="mt-4 text-ink-soft">A complete, professional trading stack — built for speed, clarity and control.</p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="card-hover group">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-blue/10 text-brand-blue transition-colors group-hover:bg-brand-blue/20">
                  <f.icon size={20} />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-ink">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <div className="eyebrow">Get started</div>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">Start in three steps</h2>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="relative">
              <div className="text-5xl font-bold text-brand-blue/25">{s.n}</div>
              <h3 className="mt-2 text-lg font-semibold text-ink">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="border-t border-brand-blue/10 bg-bg-darker/40">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <div className="eyebrow">Trusted by traders</div>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">What traders say</h2>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="card">
                <div className="flex gap-0.5 text-brand-gold">
                  {Array.from({ length: 5 }).map((_, i) => <Star key={i} size={15} fill="currentColor" />)}
                </div>
                <p className="mt-4 text-sm leading-relaxed text-ink-soft">“{t.text}”</p>
                <div className="mt-5 flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-blue/10 text-sm font-bold text-brand-blue">
                    {t.name.charAt(0)}
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-ink">{t.name}</div>
                    <div className="text-xs text-ink-muted">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-brand-blue/20 bg-gradient-to-br from-brand-blue/10 via-bg-surface to-brand-cyan/10 p-10 text-center sm:p-16">
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-brand-cyan/20 blur-[100px]" />
          <div className="relative">
            <h2 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">Ready to trade smarter?</h2>
            <p className="mx-auto mt-4 max-w-xl text-ink-soft">
              Open a free account and get a $100,000 demo balance with live prices. No deposit, no risk.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/register" className="btn-primary px-7 py-3 text-base">
                Create free account <ArrowRight size={18} />
              </Link>
              <Link href="/login" className="btn-ghost px-7 py-3 text-base">
                Log in
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-ink-muted">
              {['No deposit required', 'Live market data', 'Cancel anytime'].map((f) => (
                <span key={f} className="flex items-center gap-1.5"><Check size={14} className="text-brand-emerald" /> {f}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
