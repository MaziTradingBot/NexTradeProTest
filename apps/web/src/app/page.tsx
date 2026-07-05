'use client';

import Link from 'next/link';
import {
  ArrowRight, ShieldCheck, Zap, LineChart, Users, Bot, Globe,
  Check, TrendingUp, TrendingDown, Star,
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

const STATS = [
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

export default function HomePage() {
  const { tickers } = useTickers(7000);
  const top = tickers.slice(0, 5);
  const btc = tickers.find((t) => t.symbol === 'BTCUSDT');

  return (
    <div className="min-h-screen bg-white text-[#0a1633]" style={{ fontFamily: "'Figtree', system-ui, sans-serif" }}>
      <MarketingNav />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#f2f6ff] to-white" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#dbe6ff] bg-[#eef3ff] px-3.5 py-1.5 text-xs font-semibold text-[#1a56ff]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#12b76a]" /> Live market data · Demo mode available
            </span>
            <h1 className="mt-6 text-4xl font-extrabold leading-[1.05] tracking-tight text-[#0a1633] sm:text-5xl lg:text-6xl">
              Trade crypto with<br /><span className="text-[#1a56ff]">clarity and confidence</span>
            </h1>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-[#5b6b8c]">
              A professional trading platform with live prices, pro charts, AI insights and copy trading — practice risk-free with a $100,000 demo balance.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/register" className="inline-flex items-center justify-center gap-2 rounded-full bg-[#1a56ff] px-7 py-3.5 text-base font-semibold text-white transition hover:bg-[#1246d6]">
                Start trading free <ArrowRight size={18} />
              </Link>
              <Link href="/markets" className="inline-flex items-center justify-center gap-2 rounded-full border border-[#dbe1ee] bg-white px-7 py-3.5 text-base font-semibold text-[#0a1633] transition hover:border-[#1a56ff] hover:text-[#1a56ff]">
                Explore markets
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-[#5b6b8c]">
              <span className="flex items-center gap-1.5"><Check size={16} className="text-[#12b76a]" /> No card required</span>
              <span className="flex items-center gap-1.5"><Check size={16} className="text-[#12b76a]" /> 2FA & KYC</span>
              <span className="flex items-center gap-1.5"><Check size={16} className="text-[#12b76a]" /> Live Binance/Bybit data</span>
            </div>
          </div>

          {/* Product card */}
          <div className="relative">
            <div className="rounded-2xl border border-[#e7ecf5] bg-white p-5 shadow-[0_20px_60px_-25px_rgba(16,40,90,0.35)]">
              <div className="flex items-center justify-between border-b border-[#eef1f7] pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f7931a]/10 text-sm font-bold text-[#f7931a]">₿</div>
                  <div>
                    <div className="font-semibold text-[#0a1633]">BTC / USDT</div>
                    <div className="text-xs text-[#8593ad]">Bitcoin · Spot</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-[#0a1633]">${btc ? btc.price.toLocaleString() : '67,000'}</div>
                  <div className={cn('text-xs font-semibold', btc && btc.change < 0 ? 'text-[#f04438]' : 'text-[#12b76a]')}>
                    {btc ? `${btc.change >= 0 ? '+' : ''}${btc.change.toFixed(2)}%` : '+1.2%'} 24h
                  </div>
                </div>
              </div>
              <div className="mt-4 space-y-1.5">
                {(top.length ? top : Array.from({ length: 5 })).map((t, i) => {
                  const ticker = t as ReturnType<typeof useTickers>['tickers'][number] | undefined;
                  return (
                    <div key={i} className="flex items-center justify-between rounded-xl px-2 py-2 hover:bg-[#f7f9fc]">
                      {ticker ? (
                        <>
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#eef3ff] text-[10px] font-bold text-[#1a56ff]">{assetName(ticker.symbol).slice(0, 3)}</div>
                            <span className="text-sm font-medium text-[#0a1633]">{assetName(ticker.symbol)}/USDT</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-[#0a1633]">${ticker.price.toLocaleString()}</span>
                            <span className={cn('flex w-16 items-center justify-end gap-0.5 text-xs font-semibold', ticker.change >= 0 ? 'text-[#12b76a]' : 'text-[#f04438]')}>
                              {ticker.change >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                              {Math.abs(ticker.change).toFixed(2)}%
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="h-7 w-full animate-pulse rounded bg-[#f0f3f9]" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="absolute -bottom-5 -left-5 hidden items-center gap-3 rounded-xl border border-[#e7ecf5] bg-white px-4 py-3 shadow-[0_16px_40px_-20px_rgba(16,40,90,0.35)] lg:flex">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#12b76a]/10 text-[#12b76a]"><TrendingUp size={18} /></div>
              <div><div className="text-[11px] text-[#8593ad]">24h volume</div><div className="text-sm font-bold text-[#0a1633]">$48.2B+</div></div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-[#eef1f7] bg-[#f7f9fc]">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 sm:px-6 lg:grid-cols-4">
          {STATS.map(([v, l]) => (
            <div key={l} className="text-center">
              <div className="text-3xl font-extrabold text-[#0a1633] sm:text-4xl">{v}</div>
              <div className="mt-1 text-sm text-[#5b6b8c]">{l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-[#1a56ff]">Platform</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[#0a1633] sm:text-4xl">Everything you need to trade well</h2>
          <p className="mt-4 text-lg text-[#5b6b8c]">Professional tools, a clean interface, and clearly labeled simulated execution.</p>
        </div>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-[#e7ecf5] bg-white p-6 transition hover:border-[#c9d7ff] hover:shadow-[0_16px_40px_-24px_rgba(16,40,90,0.3)]">
              <div className="mb-4 inline-flex rounded-xl bg-[#eef3ff] p-3 text-[#1a56ff]"><f.icon size={22} /></div>
              <h3 className="text-lg font-semibold text-[#0a1633]">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#5b6b8c]">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Live markets */}
      <section className="bg-[#f7f9fc]">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-[#1a56ff]">Markets</p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[#0a1633] sm:text-4xl">Live prices, updated in real time</h2>
            </div>
            <Link href="/markets" className="hidden items-center gap-1 text-sm font-semibold text-[#1a56ff] hover:underline sm:flex">
              All markets <ArrowRight size={15} />
            </Link>
          </div>
          <div className="mt-8 overflow-hidden rounded-2xl border border-[#e7ecf5] bg-white">
            <div className="grid grid-cols-12 gap-4 border-b border-[#eef1f7] px-6 py-3 text-xs font-semibold uppercase tracking-wide text-[#8593ad]">
              <div className="col-span-6">Asset</div>
              <div className="col-span-3 text-right">Price</div>
              <div className="col-span-3 text-right">24h</div>
            </div>
            <div className="divide-y divide-[#f0f3f9]">
              {(tickers.slice(0, 8).length ? tickers.slice(0, 8) : Array.from({ length: 8 })).map((t, i) => {
                const ticker = t as ReturnType<typeof useTickers>['tickers'][number] | undefined;
                return (
                  <Link key={i} href={ticker ? `/trading?symbol=${ticker.symbol}` : '/markets'} className="grid grid-cols-12 items-center gap-4 px-6 py-3.5 transition hover:bg-[#f7f9fc]">
                    {ticker ? (
                      <>
                        <div className="col-span-6 flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#eef3ff] text-[11px] font-bold text-[#1a56ff]">{assetName(ticker.symbol).slice(0, 3)}</div>
                          <span className="font-medium text-[#0a1633]">{assetName(ticker.symbol)}<span className="text-[#8593ad]">/USDT</span></span>
                        </div>
                        <div className="col-span-3 text-right font-medium text-[#0a1633]">${ticker.price.toLocaleString()}</div>
                        <div className={cn('col-span-3 text-right text-sm font-semibold', ticker.change >= 0 ? 'text-[#12b76a]' : 'text-[#f04438]')}>
                          {ticker.change >= 0 ? '+' : ''}{ticker.change.toFixed(2)}%
                        </div>
                      </>
                    ) : (
                      <div className="col-span-12 h-8 animate-pulse rounded bg-[#f0f3f9]" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-[#1a56ff]">Get started</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[#0a1633] sm:text-4xl">Trading in three simple steps</h2>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-2xl border border-[#e7ecf5] bg-white p-7">
              <div className="text-3xl font-extrabold text-[#c9d7ff]">{s.n}</div>
              <h3 className="mt-3 text-lg font-semibold text-[#0a1633]">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#5b6b8c]">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-[#f7f9fc]">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-[#1a56ff]">Testimonials</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[#0a1633] sm:text-4xl">Trusted by traders worldwide</h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="flex flex-col rounded-2xl border border-[#e7ecf5] bg-white p-7">
                <div className="mb-4 flex gap-0.5">{Array.from({ length: 5 }).map((_, i) => <Star key={i} size={16} className="fill-[#f5a623] text-[#f5a623]" />)}</div>
                <p className="flex-1 text-[#41506b]">“{t.text}”</p>
                <div className="mt-5 border-t border-[#eef1f7] pt-4">
                  <div className="font-semibold text-[#0a1633]">{t.name}</div>
                  <div className="text-sm text-[#8593ad]">{t.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-3xl bg-[#1a56ff] px-8 py-14 text-center sm:px-16">
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Ready to start trading?</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-white/80">Open your free account and explore the full platform in demo mode — no deposit required.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/register" className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-3.5 text-base font-semibold text-[#1a56ff] transition hover:bg-[#eef3ff]">
              Get started free <ArrowRight size={18} />
            </Link>
            <Link href="/trading" className="inline-flex items-center justify-center rounded-full border border-white/40 px-8 py-3.5 text-base font-semibold text-white transition hover:bg-white/10">
              Open the terminal
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
