'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  ShieldCheck,
  Zap,
  TrendingUp,
  Bot,
  Users,
  BarChart3,
  Lock,
  Globe,
  Sparkles,
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { TickerTape } from '@/components/TickerTape';
import { useTickers, assetName } from '@/lib/useTickers';
import { formatPercent, formatCompact, cn } from '@/lib/utils';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0 },
};

const STATS = [
  { label: 'Trading Volume', value: '$48B+' },
  { label: 'Active Traders', value: '2.4M' },
  { label: 'Markets', value: '350+' },
  { label: 'Uptime SLA', value: '99.99%' },
];

const FEATURES = [
  { icon: Zap, title: 'Ultra-low Latency', desc: 'Sub-millisecond matching engine with real-time WebSocket market data.' },
  { icon: Bot, title: 'AI Trading Assistant', desc: 'Portfolio health scores, risk analysis and daily market summaries.' },
  { icon: Users, title: 'Copy Trading', desc: 'Mirror top-ranked traders with transparent ROI and win-rate stats.' },
  { icon: BarChart3, title: 'Pro Charting', desc: 'Advanced charts, depth, order book and 100+ technical indicators.' },
  { icon: Lock, title: 'Enterprise Security', desc: '2FA, device detection, audit logs and granular admin permissions.' },
  { icon: Globe, title: 'Global Markets', desc: 'Spot, futures and 350+ pairs with live institutional-grade pricing.' },
];

export default function HomePage() {
  const { tickers } = useTickers(7000);
  const top = tickers.slice(0, 6);

  return (
    <main>
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden pt-28">
        <div className="pointer-events-none absolute inset-0 bg-grid-dark [background-size:40px_40px] opacity-40" />
        <div className="pointer-events-none absolute left-1/2 top-0 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-brand-blue/20 blur-[120px]" />
        <div className="pointer-events-none absolute right-0 top-40 h-[400px] w-[400px] rounded-full bg-brand-emerald/15 blur-[120px]" />

        <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-12 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.12 } } }}
            className="mx-auto max-w-3xl text-center"
          >
            <motion.div variants={fadeUp} className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-slate-300">
              <Sparkles size={15} className="text-brand-gold" />
              Live market data · Simulated execution
            </motion.div>

            <motion.h1 variants={fadeUp} className="text-balance text-4xl font-bold leading-tight tracking-tight text-white sm:text-6xl">
              Trade crypto like an <span className="gradient-text">institution</span>
            </motion.h1>

            <motion.p variants={fadeUp} className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-slate-300">
              NexTradePro brings professional-grade charts, AI insights, copy trading and
              enterprise security into one blazing-fast platform.
            </motion.p>

            <motion.div variants={fadeUp} className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/register" className="btn-primary px-7 py-3 text-base">
                Start trading free <ArrowRight size={18} />
              </Link>
              <Link href="/markets" className="btn-ghost px-7 py-3 text-base">
                Explore markets
              </Link>
            </motion.div>
          </motion.div>

          {/* Live mini market cards */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="mx-auto mt-16 grid max-w-5xl grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
          >
            {(top.length ? top : Array.from({ length: 6 })).map((t, i) => {
              const ticker = t as ReturnType<typeof useTickers>['tickers'][number] | undefined;
              return (
                <div key={i} className="card p-4 text-left">
                  {ticker ? (
                    <>
                      <div className="text-xs text-slate-400">{assetName(ticker.symbol)}/USDT</div>
                      <div className="mt-1 font-mono text-sm font-semibold text-white">
                        ${ticker.price.toLocaleString()}
                      </div>
                      <div className={cn('mt-0.5 text-xs font-medium', ticker.change >= 0 ? 'text-brand-emerald' : 'text-red-400')}>
                        {formatPercent(ticker.change)}
                      </div>
                    </>
                  ) : (
                    <div className="h-12 animate-pulse rounded bg-white/5" />
                  )}
                </div>
              );
            })}
          </motion.div>
        </div>
      </section>

      <TickerTape />

      {/* Stats */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-3xl font-bold text-white sm:text-4xl">{s.value}</div>
              <div className="mt-1 text-sm text-slate-400">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">Everything a pro trader needs</h2>
          <p className="mt-4 text-slate-400">
            Built for performance, designed for clarity, secured for scale.
          </p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="card group transition-all hover:border-brand-blue/40 hover:shadow-glow"
            >
              <div className="mb-4 inline-flex rounded-xl bg-brand-gradient p-2.5 text-white">
                <f.icon size={22} />
              </div>
              <h3 className="text-lg font-semibold text-white">{f.title}</h3>
              <p className="mt-2 text-sm text-slate-400">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Live markets preview */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="card overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-white/10 p-6">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-bold text-white">
                <TrendingUp size={20} className="text-brand-emerald" /> Live Markets
              </h2>
              <p className="text-sm text-slate-400">Real-time prices from public market data</p>
            </div>
            <Link href="/markets" className="btn-ghost">
              View all <ArrowRight size={16} />
            </Link>
          </div>
          <div className="divide-y divide-white/5">
            {(tickers.slice(0, 8).length ? tickers.slice(0, 8) : Array.from({ length: 8 })).map((t, i) => {
              const ticker = t as ReturnType<typeof useTickers>['tickers'][number] | undefined;
              return (
                <div key={i} className="flex items-center justify-between px-6 py-3.5">
                  {ticker ? (
                    <>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-xs font-bold text-white">
                          {assetName(ticker.symbol).slice(0, 3)}
                        </div>
                        <div>
                          <div className="font-medium text-white">{assetName(ticker.symbol)}/USDT</div>
                          <div className="text-xs text-slate-500">Vol {formatCompact(ticker.volume)}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-white">${ticker.price.toLocaleString()}</div>
                        <div className={cn('text-xs font-medium', ticker.change >= 0 ? 'text-brand-emerald' : 'text-red-400')}>
                          {formatPercent(ticker.change)}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="h-9 w-full animate-pulse rounded bg-white/5" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Security band */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="card flex flex-col items-center gap-6 bg-gradient-to-br from-brand-blue/10 to-brand-emerald/5 text-center md:flex-row md:text-left">
          <div className="inline-flex rounded-2xl bg-brand-gradient p-4 text-white">
            <ShieldCheck size={32} />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-white">Enterprise-grade security & role-based admin</h3>
            <p className="mt-2 text-slate-400">
              Granular admin roles — Withdrawal Approval, KYC, Finance, Support and more — with full
              audit logging on every action.
            </p>
          </div>
          <Link href="/register" className="btn-gold">
            Create account
          </Link>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-brand-blue/20 via-bg-surface to-brand-emerald/10 p-10 text-center sm:p-16">
          <div className="pointer-events-none absolute inset-0 bg-grid-dark [background-size:32px_32px] opacity-30" />
          <div className="relative">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">Ready to trade smarter?</h2>
            <p className="mx-auto mt-4 max-w-xl text-slate-300">
              Join NexTradePro and experience an institutional trading platform — free in demo mode.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/register" className="btn-primary px-7 py-3 text-base">
                Get started <ArrowRight size={18} />
              </Link>
              <Link href="/trading" className="btn-ghost px-7 py-3 text-base">
                Open trading terminal
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
