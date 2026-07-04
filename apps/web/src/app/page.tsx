'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  TrendingUp, Shield, Zap, BarChart2, Globe, Copy, ChevronRight,
  ArrowUpRight, ArrowDownRight, Menu, X, Check, Star, Lock, Activity,
} from 'lucide-react';
import { useAuth } from '@/lib/store';
import { useTickers, assetName } from '@/lib/useTickers';

const BARLOW = { fontFamily: "'Barlow Condensed', sans-serif" } as const;
const MONO = { fontFamily: "'JetBrains Mono', monospace" } as const;

// ─── Static fallbacks (used until live prices load) ──────────────────────────
const staticTicker = [
  { symbol: 'BTC/USDT', price: '67,842.30', change: '+2.14%', up: true },
  { symbol: 'ETH/USDT', price: '3,521.18', change: '+1.87%', up: true },
  { symbol: 'SOL/USDT', price: '178.44', change: '+5.32%', up: true },
  { symbol: 'XRP/USDT', price: '0.6219', change: '-0.74%', up: false },
  { symbol: 'BNB/USDT', price: '421.07', change: '+0.93%', up: true },
  { symbol: 'ADA/USDT', price: '0.4583', change: '-1.21%', up: false },
];

// ─── Animated candlestick chart (decorative, self-contained) ─────────────────
interface Candle { open: number; high: number; low: number; close: number }
function makeCandle(prev: number): Candle {
  const move = (Math.random() - 0.48) * 180;
  const open = prev;
  const close = +(open + move).toFixed(2);
  return {
    open, close,
    high: +(Math.max(open, close) + Math.random() * 90).toFixed(2),
    low: +(Math.min(open, close) - Math.random() * 90).toFixed(2),
  };
}
function seedCandles(count: number): Candle[] {
  const out: Candle[] = [];
  let price = 67200;
  for (let i = 0; i < count; i++) { const c = makeCandle(price); out.push(c); price = c.close; }
  return out;
}

function CandlestickChart() {
  const VISIBLE = 36;
  const [candles, setCandles] = useState<Candle[]>(() => seedCandles(VISIBLE));
  const tickRef = useRef(0);
  useEffect(() => {
    const id = setInterval(() => {
      tickRef.current += 1;
      setCandles((prev) => {
        const up = [...prev];
        const last = up[up.length - 1];
        const nc = +(last.close + (Math.random() - 0.48) * 55).toFixed(2);
        up[up.length - 1] = { ...last, close: nc, high: Math.max(last.high, nc), low: Math.min(last.low, nc) };
        if (tickRef.current % 8 === 0) {
          const next = makeCandle(nc);
          return [...(up.length >= VISIBLE ? up.slice(1) : up), next];
        }
        return up;
      });
    }, 420);
    return () => clearInterval(id);
  }, []);

  const W = 520, H = 190, PAD = { top: 10, right: 8, bottom: 24, left: 52 };
  const chartW = W - PAD.left - PAD.right, chartH = H - PAD.top - PAD.bottom;
  const prices = candles.flatMap((c) => [c.high, c.low]);
  const pmin = Math.min(...prices), pmax = Math.max(...prices), range = pmax - pmin || 1;
  const candleW = chartW / candles.length, bodyW = Math.max(candleW * 0.55, 3);
  const py = (p: number) => PAD.top + ((pmax - p) / range) * chartH;
  const lastClose = candles[candles.length - 1]?.close ?? 0;
  const firstClose = candles[0]?.close ?? lastClose;
  const pct = (((lastClose - firstClose) / firstClose) * 100).toFixed(2);
  const up = lastClose >= firstClose;
  const yLabels = Array.from({ length: 5 }, (_, i) => { const v = pmin + (range * i) / 4; return { v, y: py(v) }; });

  return (
    <div className="relative w-full select-none">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }} preserveAspectRatio="none">
        {yLabels.map(({ v, y }) => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="#0EA5E9" strokeOpacity={0.07} />
            <text x={PAD.left - 6} y={y + 4} textAnchor="end" fill="#5E7A96" fontSize={9} style={MONO}>{Math.round(v).toLocaleString()}</text>
          </g>
        ))}
        <line x1={PAD.left} x2={W - PAD.right} y1={py(lastClose)} y2={py(lastClose)} stroke={up ? '#34D399' : '#F87171'} strokeOpacity={0.45} strokeDasharray="3 3" />
        <rect x={W - PAD.right} y={py(lastClose) - 9} width={52} height={16} rx={3} fill={up ? '#34D399' : '#F87171'} />
        <text x={W - PAD.right + 26} y={py(lastClose) + 4} textAnchor="middle" fill="#020B18" fontSize={8.5} fontWeight="700" style={MONO}>{Math.round(lastClose).toLocaleString()}</text>
        {candles.map((c, i) => {
          const cx = PAD.left + i * candleW + candleW / 2;
          const isUp = c.close >= c.open;
          const color = isUp ? '#34D399' : '#F87171';
          const bt = py(Math.max(c.open, c.close)), bb = py(Math.min(c.open, c.close));
          const isLast = i === candles.length - 1;
          return (
            <g key={i}>
              <line x1={cx} x2={cx} y1={py(c.high)} y2={py(c.low)} stroke={color} strokeWidth={1} opacity={isLast ? 1 : 0.8} />
              <rect x={cx - bodyW / 2} y={bt} width={bodyW} height={Math.max(bb - bt, 1)} fill={isUp ? color : 'none'} stroke={color} strokeWidth={isUp ? 0 : 1} opacity={isLast ? 1 : 0.85} rx={0.5} />
            </g>
          );
        })}
      </svg>
      <div className="absolute right-0 top-0 flex items-center gap-1.5 text-[10px]" style={MONO}>
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
        <span className="text-emerald-400">LIVE</span>
        <span className={`ml-2 ${up ? 'text-emerald-400' : 'text-red-400'}`}>{up ? '▲' : '▼'} {Math.abs(Number(pct))}%</span>
      </div>
    </div>
  );
}

// ─── Static content ──────────────────────────────────────────────────────────
const features = [
  { icon: Zap, title: 'Ultra-Low Latency', desc: 'Sub-millisecond order execution with a matching engine tuned for microsecond fills.', tag: '< 1ms fills' },
  { icon: BarChart2, title: 'Professional Charting', desc: 'TradingView Advanced Charts, 80+ indicators, multi-timeframe analysis and drawing tools.', tag: '80+ indicators' },
  { icon: Copy, title: 'Copy Trading', desc: 'Mirror top-performing verified traders in real time. Set allocation and risk caps.', tag: 'One-click mirror' },
  { icon: Shield, title: 'Institutional Security', desc: '2FA enforcement, role-based admin permissions, full audit logging and KYC workflows.', tag: 'Enterprise-grade' },
  { icon: Activity, title: 'AI Market Assistant', desc: 'Real-time sentiment, portfolio health scores and personalized trade signals.', tag: 'AI-powered' },
  { icon: Globe, title: '350+ Global Markets', desc: 'Live Binance & Bybit data across a single unified interface, 24/7.', tag: 'Unified access' },
];
const stats = [
  { value: '$48B+', label: 'Total Trading Volume' },
  { value: '2.4M+', label: 'Active Traders' },
  { value: '350+', label: 'Markets Available' },
  { value: '99.99%', label: 'Uptime SLA' },
];
const testimonials = [
  { name: 'Marcus Chen', role: 'Prop Trader, Hong Kong', text: 'Switched from three separate platforms to NexTradePro and haven’t looked back. The execution speed alone paid for itself.', rating: 5 },
  { name: 'Alicia Ramos', role: 'Portfolio Manager, São Paulo', text: 'The AI signals caught a BTC breakout 40 minutes before the move. That edge separates retail from institutional.', rating: 5 },
  { name: 'Dmitri Volkov', role: 'Quant Analyst, London', text: 'API docs are good, the backtesting is realistic, copy-trading infra is solid. Rare combo.', rating: 5 },
];
const plans = [
  { name: 'Starter', price: '$0', deposit: 'No min. deposit', period: 'forever free', highlight: false, badge: null as string | null, color: '#5E7A96',
    features: [['Markets access', '10 markets'], ['Charting tools', 'Basic (20 indicators)'], ['AI signals', '—'], ['Copy trading', '—'], ['Leverage', 'Up to 10×'], ['Support', 'Community forum']], cta: 'Open Free Account' },
  { name: 'Gold', price: '$250', deposit: '$250 min. deposit', period: 'one-time', highlight: false, badge: null, color: '#F59E0B',
    features: [['Markets access', '100+ markets'], ['Charting tools', 'Advanced (50)'], ['AI signals', '20 / month'], ['Copy trading', 'Up to 3 traders'], ['Leverage', 'Up to 50×'], ['Support', 'Email & live chat']], cta: 'Get Started' },
  { name: 'Pro', price: '$1,000', deposit: '$1,000 min. deposit', period: 'one-time', highlight: true, badge: 'Most Popular', color: '#0EA5E9',
    features: [['Markets access', '350+ markets'], ['Charting tools', 'All 80+ indicators'], ['AI signals', 'Unlimited'], ['Copy trading', 'Unlimited'], ['Leverage', 'Up to 200×'], ['Support', 'Priority 24/7']], cta: 'Get Started' },
  { name: 'Institutional', price: 'Custom', deposit: 'Custom funding', period: 'contact us', highlight: false, badge: null, color: '#A78BFA',
    features: [['Markets access', 'Unlimited'], ['Charting tools', 'Full + custom'], ['AI signals', 'Unlimited + custom'], ['Copy trading', 'Managed accounts'], ['Leverage', 'Negotiated'], ['Support', 'Dedicated manager']], cta: 'Contact Sales' },
];

function BrandMark() {
  return (
    <div className="flex flex-col items-start leading-none">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0EA5E9]">
        <span className="text-sm font-black tracking-tight text-white" style={BARLOW}>XTP</span>
      </div>
      <span className="mt-1 text-[9px] font-black uppercase tracking-widest" style={{ ...BARLOW, letterSpacing: '0.15em' }}>
        NEX<span className="text-[#0EA5E9]">TRADE</span><span className="text-[#5E7A96]"> PRO</span>
      </span>
    </div>
  );
}

// ─── Landing page ────────────────────────────────────────────────────────────
export default function HomePage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user, loadMe } = useAuth();
  const { tickers } = useTickers(8000);

  useEffect(() => {
    loadMe();
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, [loadMe]);

  // Live ticker items (fallback to static until data arrives).
  const liveTicker = tickers.length
    ? tickers.map((t) => ({
        symbol: `${assetName(t.symbol)}/USDT`,
        price: t.price.toLocaleString(undefined, { maximumFractionDigits: t.price < 2 ? 4 : 2 }),
        change: `${t.change >= 0 ? '+' : ''}${t.change.toFixed(2)}%`,
        up: t.change >= 0,
      }))
    : staticTicker;
  const find = (s: string) => tickers.find((t) => t.symbol === s);
  const btc = find('BTCUSDT');
  const miniRow = ['ETHUSDT', 'SOLUSDT', 'XRPUSDT'].map((s) => {
    const t = find(s);
    return { s: assetName(s), p: t ? `$${t.price.toLocaleString(undefined, { maximumFractionDigits: t.price < 2 ? 4 : 2 })}` : '—', c: t ? `${t.change >= 0 ? '+' : ''}${t.change.toFixed(2)}%` : '', up: t ? t.change >= 0 : true };
  });

  const nav = [
    { label: 'Markets', href: '/markets' },
    { label: 'Features', href: '#features' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'Copy Trading', href: '/copy-trading' },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#04090F] text-[#E8F1FF]" style={{ fontFamily: "'Figtree', sans-serif" }}>
      {/* Ticker bar (live) */}
      <div className="overflow-hidden border-b border-[#0EA5E9]/10 bg-[#020710] py-2">
        <div className="flex animate-[nxp-ticker_40s_linear_infinite] whitespace-nowrap">
          {[...liveTicker, ...liveTicker].map((item, i) => (
            <span key={i} className="mx-6 inline-flex shrink-0 items-center gap-2 text-xs" style={MONO}>
              <span className="text-[#5E7A96]">{item.symbol}</span>
              <span className="font-medium text-[#E8F1FF]">{item.price}</span>
              <span className={item.up ? 'text-emerald-400' : 'text-red-400'}>
                {item.up ? <ArrowUpRight className="inline h-3 w-3" /> : <ArrowDownRight className="inline h-3 w-3" />}{item.change}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* Nav */}
      <nav className={`sticky top-0 z-50 transition-all duration-300 ${scrolled ? 'border-b border-[#0EA5E9]/10 bg-[#04090F]/95 shadow-lg shadow-[#0EA5E9]/5 backdrop-blur-md' : 'bg-transparent'}`}>
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/"><BrandMark /></Link>
          <div className="hidden items-center gap-8 text-sm text-[#A0BDD8] md:flex">
            {nav.map((n) => (
              <Link key={n.label} href={n.href} className="transition-colors hover:text-white">{n.label}</Link>
            ))}
          </div>
          <div className="hidden items-center gap-3 md:flex">
            {user ? (
              <Link href="/dashboard" className="rounded-lg bg-[#0EA5E9] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0891D4]">Dashboard</Link>
            ) : (
              <>
                <Link href="/login" className="px-4 py-2 text-sm text-[#A0BDD8] transition-colors hover:text-white">Sign In</Link>
                <Link href="/register" className="rounded-lg bg-[#0EA5E9] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0891D4]">Open Account</Link>
              </>
            )}
          </div>
          <button className="text-[#A0BDD8] hover:text-white md:hidden" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu">
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {mobileOpen && (
          <div className="flex flex-col gap-4 border-t border-[#0EA5E9]/10 bg-[#080F1C] px-4 py-4 md:hidden">
            {nav.map((n) => (
              <Link key={n.label} href={n.href} onClick={() => setMobileOpen(false)} className="py-1 text-sm text-[#A0BDD8] hover:text-white">{n.label}</Link>
            ))}
            <Link href={user ? '/dashboard' : '/register'} className="mt-2 rounded-lg bg-[#0EA5E9] px-5 py-2.5 text-center text-sm font-semibold text-white">{user ? 'Dashboard' : 'Open Account'}</Link>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden px-4 pb-0 pt-20 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(#0EA5E9 1px, transparent 1px), linear-gradient(90deg, #0EA5E9 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        <div className="pointer-events-none absolute left-1/4 top-0 h-[500px] w-[600px] rounded-full bg-[#0EA5E9]/8 blur-[120px]" />
        <div className="pointer-events-none absolute right-1/4 top-40 h-[400px] w-[400px] rounded-full bg-[#22D3EE]/5 blur-[100px]" />

        <div className="relative mx-auto max-w-7xl">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div className="pt-6 lg:pt-10">
              <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#0EA5E9]/25 bg-[#0EA5E9]/10 px-4 py-1.5 text-xs text-[#22D3EE]" style={MONO}>
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />Live Markets · Demo Mode Available
              </div>
              <h1 className="mb-6 text-6xl font-black uppercase leading-[0.9] tracking-tight sm:text-7xl lg:text-8xl" style={BARLOW}>
                Trade Like<br /><span className="text-[#0EA5E9]">An Institution.</span>
              </h1>
              <p className="mb-10 max-w-md text-lg leading-relaxed text-[#A0BDD8]">
                NexTradePro delivers sub-millisecond execution, AI-powered signals, and institutional-grade security — built for the serious trader.
              </p>
              <div className="mb-12 flex flex-col gap-4 sm:flex-row">
                <Link href="/register" className="group inline-flex items-center justify-center gap-2 rounded-xl bg-[#0EA5E9] px-8 py-4 text-base font-bold text-white transition-all hover:bg-[#0891D4]">
                  Start Trading Free <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link href="/markets" className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#0EA5E9]/25 px-8 py-4 text-base text-[#A0BDD8] transition-all hover:border-[#0EA5E9]/50 hover:text-white">
                  View Live Markets
                </Link>
              </div>
              <div className="flex flex-wrap items-center gap-6 text-xs text-[#5E7A96]">
                <span className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5 text-[#0EA5E9]" /> 2FA + Audit logs</span>
                <span className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5 text-[#0EA5E9]" /> Role-based admin</span>
                <span className="flex items-center gap-1.5"><Activity className="h-3.5 w-3.5 text-emerald-400" /> 99.99% uptime</span>
              </div>
            </div>

            {/* Chart card */}
            <div className="relative lg:pt-6">
              <div className="overflow-hidden rounded-2xl border border-[#0EA5E9]/15 bg-[#080F1C] shadow-2xl shadow-[#0EA5E9]/5">
                <div className="flex items-center justify-between border-b border-[#0EA5E9]/10 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F7931A]/10"><span className="text-xs font-bold text-[#F7931A]">₿</span></div>
                    <div><p className="text-sm font-semibold">BTC / USDT</p><p className="text-[10px] text-[#5E7A96]" style={MONO}>Bitcoin · 1H</p></div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-[#E8F1FF]" style={BARLOW}>${btc ? Math.round(btc.price).toLocaleString() : '67,842'}</p>
                    <p className={`flex items-center justify-end gap-0.5 text-xs ${btc && btc.change < 0 ? 'text-red-400' : 'text-emerald-400'}`} style={MONO}>
                      {btc && btc.change < 0 ? <ArrowDownRight className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />} {btc ? `${btc.change >= 0 ? '+' : ''}${btc.change.toFixed(2)}%` : '+2.14%'} today
                    </p>
                  </div>
                </div>
                <div className="relative px-3 pb-1 pt-5"><CandlestickChart /></div>
                <div className="grid grid-cols-3 divide-x divide-[#0EA5E9]/10 border-t border-[#0EA5E9]/10">
                  {miniRow.map((m) => (
                    <div key={m.s} className="px-4 py-3 text-center">
                      <p className="mb-0.5 text-[10px] text-[#5E7A96]" style={MONO}>{m.s}/USDT</p>
                      <p className="text-sm font-semibold" style={MONO}>{m.p}</p>
                      <p className={`text-[10px] ${m.up ? 'text-emerald-400' : 'text-red-400'}`} style={MONO}>{m.c}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="absolute -bottom-4 -left-4 hidden items-center gap-2.5 rounded-xl border border-[#0EA5E9]/20 bg-[#080F1C] px-4 py-3 shadow-xl lg:flex">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-400/10"><TrendingUp className="h-4 w-4 text-emerald-400" /></div>
                <div><p className="text-[10px] text-[#5E7A96]">24H Volume</p><p className="text-sm font-bold" style={MONO}>$48.2B+</p></div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="relative mx-auto mt-20 grid max-w-7xl grid-cols-2 gap-6 border-y border-[#0EA5E9]/10 py-8 md:grid-cols-4 md:gap-0 md:divide-x md:divide-[#0EA5E9]/10">
          {stats.map((s) => (
            <div key={s.label} className="px-4 text-center">
              <p className="mb-1 text-4xl font-black text-[#0EA5E9] lg:text-5xl" style={BARLOW}>{s.value}</p>
              <p className="text-xs uppercase tracking-widest text-[#5E7A96]">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-4 py-28 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <p className="mb-4 text-xs uppercase tracking-widest text-[#0EA5E9]" style={MONO}>Platform Features</p>
            <h2 className="text-5xl font-black uppercase leading-tight sm:text-6xl" style={BARLOW}>Built for traders who <span className="text-[#0EA5E9]">demand more.</span></h2>
            <p className="mx-auto mt-4 max-w-xl leading-relaxed text-[#A0BDD8]">Every tool is engineered for speed, precision, and edge. No compromises.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="group rounded-2xl border border-[#0EA5E9]/10 bg-[#080F1C] p-6 transition-all hover:border-[#0EA5E9]/35 hover:shadow-lg hover:shadow-[#0EA5E9]/5">
                <div className="mb-5 flex items-start justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0EA5E9]/10 transition-colors group-hover:bg-[#0EA5E9]/15"><f.icon className="h-5 w-5 text-[#0EA5E9]" /></div>
                  <span className="rounded-full border border-[#22D3EE]/15 bg-[#22D3EE]/8 px-2.5 py-1 text-[10px] text-[#22D3EE]" style={MONO}>{f.tag}</span>
                </div>
                <h3 className="mb-2 text-lg font-bold text-[#E8F1FF]">{f.title}</h3>
                <p className="text-sm leading-relaxed text-[#5E7A96]">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why */}
      <section className="relative overflow-hidden bg-[#020710] px-4 py-24 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute right-0 top-0 h-[500px] w-[500px] rounded-full bg-[#0EA5E9]/5 blur-[100px]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-2">
          <div className="space-y-4">
            {[
              { title: 'Execution you can trust', desc: 'Order matching tuned for high throughput with fills at the quoted price.', metric: '500K TPS' },
              { title: 'Risk management built in', desc: 'Stop-losses, take-profits, trailing stops and portfolio drawdown limits.', metric: 'Full control' },
              { title: 'Transparent fees', desc: '0.02% maker / 0.05% taker. No deposit fees, no hidden charges.', metric: '0.02% maker' },
              { title: '24/7 support', desc: 'Live chat and email support, with dedicated managers for Pro tiers.', metric: 'Always on' },
            ].map((item) => (
              <div key={item.title} className="flex gap-5 rounded-xl border border-[#0EA5E9]/10 bg-[#080F1C] p-5 transition-colors hover:border-[#0EA5E9]/25">
                <div className="w-24 shrink-0 text-right"><span className="text-xl font-black text-[#0EA5E9]" style={BARLOW}>{item.metric}</span></div>
                <div className="border-l border-[#0EA5E9]/15 pl-5"><p className="mb-1 text-sm font-semibold text-[#E8F1FF]">{item.title}</p><p className="text-xs leading-relaxed text-[#5E7A96]">{item.desc}</p></div>
              </div>
            ))}
          </div>
          <div>
            <p className="mb-5 text-xs uppercase tracking-widest text-[#0EA5E9]" style={MONO}>Why NexTradePro</p>
            <h2 className="mb-6 text-5xl font-black uppercase leading-tight sm:text-6xl" style={BARLOW}>Your edge <span className="text-[#0EA5E9]">starts</span><br />with the right tools.</h2>
            <p className="mb-8 leading-relaxed text-[#A0BDD8]">Infrastructure once reserved for hedge funds and prime brokers — now in a platform anyone can use.</p>
            <div className="mb-10 space-y-3">
              {['No subscription needed on the Starter plan', 'Demo mode with a $100k virtual balance', 'Live Binance & Bybit market data', 'Granular admin roles + broker portal'].map((pt) => (
                <div key={pt} className="flex items-center gap-3 text-sm text-[#A0BDD8]"><Check className="h-4 w-4 shrink-0 text-emerald-400" />{pt}</div>
              ))}
            </div>
            <Link href="/register" className="inline-flex items-center gap-2 rounded-xl bg-[#0EA5E9] px-8 py-4 text-base font-bold text-white transition-colors hover:bg-[#0891D4]">Open Free Account <ChevronRight className="h-5 w-5" /></Link>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="px-4 py-28 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-14 text-center">
            <p className="mb-4 text-xs uppercase tracking-widest text-[#0EA5E9]" style={MONO}>Trader Stories</p>
            <h2 className="text-5xl font-black uppercase leading-tight sm:text-6xl" style={BARLOW}>The traders have spoken.</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {testimonials.map((t) => (
              <div key={t.name} className="flex flex-col gap-5 rounded-2xl border border-[#0EA5E9]/10 bg-[#080F1C] p-7">
                <div className="flex gap-0.5">{Array.from({ length: t.rating }).map((_, i) => <Star key={i} className="h-4 w-4 fill-[#F59E0B] text-[#F59E0B]" />)}</div>
                <p className="flex-1 text-sm leading-relaxed text-[#A0BDD8]">“{t.text}”</p>
                <div className="border-t border-[#0EA5E9]/10 pt-4"><p className="text-sm font-semibold text-[#E8F1FF]">{t.name}</p><p className="text-xs text-[#5E7A96]">{t.role}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-[#020710] px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-14 text-center">
            <p className="mb-4 text-xs uppercase tracking-widest text-[#0EA5E9]" style={MONO}>Account Types</p>
            <h2 className="text-5xl font-black uppercase leading-tight sm:text-6xl" style={BARLOW}>Transparent pricing. <span className="text-[#0EA5E9]">No surprises.</span></h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((plan) => (
              <div key={plan.name} className={`relative flex flex-col rounded-2xl border p-6 ${plan.highlight ? 'border-[#0EA5E9]/50 shadow-xl shadow-[#0EA5E9]/10' : 'border-[#0EA5E9]/10 bg-[#080F1C]'}`} style={plan.highlight ? { background: 'linear-gradient(160deg,#0c1e38 0%,#080f1c 100%)' } : {}}>
                {plan.badge && <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-4 py-1 text-[10px] font-bold uppercase tracking-widest text-white" style={{ background: plan.color }}>{plan.badge}</div>}
                <div className="mb-5 h-1 w-10 rounded-full" style={{ background: plan.color }} />
                <p className="mb-1 text-[10px] uppercase tracking-widest" style={{ ...MONO, color: plan.color }}>{plan.name}</p>
                <p className="mb-0.5 text-4xl font-black text-[#E8F1FF]" style={BARLOW}>{plan.price}</p>
                <p className="mb-1 text-[11px] text-[#5E7A96]">{plan.period}</p>
                <p className="mb-6 text-[11px]" style={{ ...MONO, color: plan.color }}>{plan.deposit}</p>
                <div className="mb-7 flex-1 space-y-2.5">
                  {plan.features.map(([label, value]) => (
                    <div key={label} className="flex items-start justify-between gap-2 text-xs">
                      <span className="text-[#5E7A96]">{label}</span>
                      <span className={`text-right font-medium ${value === '—' ? 'text-[#2E3F54]' : 'text-[#E8F1FF]'}`}>{value}</span>
                    </div>
                  ))}
                </div>
                <Link href={plan.name === 'Institutional' ? '/about' : '/register'} className="block rounded-xl py-3 text-center text-sm font-bold transition-colors" style={plan.highlight ? { background: plan.color, color: '#fff' } : { border: `1px solid ${plan.color}30`, color: plan.color }}>{plan.cta}</Link>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-[#5E7A96]">All accounts include free demo trading. Deposits are minimum funding requirements, not subscription fees.</p>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden px-4 py-28 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0EA5E9]/10 via-transparent to-[#22D3EE]/5" />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(#0EA5E9 1px, transparent 1px), linear-gradient(90deg, #0EA5E9 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="relative mx-auto max-w-4xl text-center">
          <p className="mb-6 text-xs uppercase tracking-widest text-[#0EA5E9]" style={MONO}>Start Today</p>
          <h2 className="mb-6 text-6xl font-black uppercase leading-tight sm:text-7xl lg:text-8xl" style={BARLOW}>Your next trade<br /><span className="text-[#0EA5E9]">starts here.</span></h2>
          <p className="mx-auto mb-10 max-w-xl text-lg leading-relaxed text-[#A0BDD8]">Open your account in under 3 minutes — no deposit required to start in demo mode.</p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Link href="/register" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0EA5E9] px-10 py-4 text-base font-bold text-white transition-colors hover:bg-[#0891D4]">Open Free Account <ChevronRight className="h-5 w-5" /></Link>
            <Link href="/register" className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#0EA5E9]/25 px-10 py-4 text-base text-[#A0BDD8] transition-colors hover:border-[#0EA5E9]/50 hover:text-white">Try Demo Mode</Link>
          </div>
          <p className="mt-6 text-xs text-[#5E7A96]">Trading is simulated in demo mode. Not financial advice.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#0EA5E9]/10 bg-[#020710] px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 grid grid-cols-2 gap-10 md:grid-cols-5">
            <div className="col-span-2 md:col-span-1">
              <div className="mb-4"><BrandMark /></div>
              <p className="text-xs leading-relaxed text-[#5E7A96]">Institutional-grade trading infrastructure for serious traders worldwide.</p>
            </div>
            {[
              { heading: 'Platform', links: [['Markets', '/markets'], ['Copy Trading', '/copy-trading'], ['AI Signals', '/ai'], ['Academy', '/academy'], ['Status', '/about']] },
              { heading: 'Company', links: [['About', '/about'], ['News', '/news'], ['Careers', '/about'], ['Partners', '/about'], ['Contact', '/about']] },
              { heading: 'Resources', links: [['Calculators', '/tools'], ['Calendar', '/calendar'], ['Academy', '/academy'], ['Pricing', '/pricing'], ['Support', '/about']] },
              { heading: 'Legal', links: [['Terms', '/about'], ['Privacy', '/about'], ['Risk Disclosure', '/about'], ['Cookies', '/about'], ['Disclosures', '/about']] },
            ].map((col) => (
              <div key={col.heading}>
                <p className="mb-4 text-xs uppercase tracking-widest text-[#5E7A96]" style={MONO}>{col.heading}</p>
                <ul className="space-y-2.5">
                  {col.links.map(([label, href]) => (
                    <li key={label}><Link href={href} className="text-xs text-[#5E7A96] transition-colors hover:text-[#A0BDD8]">{label}</Link></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="flex flex-col items-center justify-between gap-4 border-t border-[#0EA5E9]/10 pt-8 text-xs text-[#5E7A96] md:flex-row">
            <p>© {new Date().getFullYear()} NexTradePro. Demo mode only — not financial advice.</p>
            <div className="flex items-center gap-4">
              <Link href="/about" className="transition-colors hover:text-[#A0BDD8]">Privacy</Link>
              <Link href="/about" className="transition-colors hover:text-[#A0BDD8]">Terms</Link>
              <Link href="/about" className="transition-colors hover:text-[#A0BDD8]">Risk Warning</Link>
            </div>
          </div>
        </div>
      </footer>

      <style>{`@keyframes nxp-ticker { 0% { transform: translateX(0) } 100% { transform: translateX(-50%) } }`}</style>
    </div>
  );
}
