'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Wallet, Shield, ChevronRight, TrendingUp, TrendingDown, Newspaper, PieChart, ArrowRight } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { AuthGuard } from '@/components/AuthGuard';
import { ModeSwitcher } from '@/components/ModeSwitcher';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { useMode } from '@/lib/useMode';
import { useLiveSync } from '@/lib/useLiveSync';
import { useTickers, assetName, type Ticker } from '@/lib/useTickers';
import { formatCurrency, formatPercent, cn } from '@/lib/utils';

interface WalletRow {
  id: string;
  asset: string;
  balance: string;
  locked: string;
}

// Rough USD reference prices for portfolio valuation (demo).
const REF: Record<string, number> = { USDT: 1, BTC: 67000, ETH: 3500 };
// Palette for the asset-allocation bar / legend.
const ALLOC_COLORS = ['#0EA5E9', '#22D3EE', '#34D399', '#F59E0B', '#A78BFA', '#F87171'];

// A single market-mover row (used by Top gainers / losers).
function MoverRow({ t }: { t: Ticker }) {
  return (
    <Link href={`/trading?symbol=${t.symbol}`} className="flex items-center justify-between rounded-lg px-2 py-1.5 transition hover:bg-white/5">
      <span className="text-sm font-medium text-white">{assetName(t.symbol)}<span className="text-slate-500">/USDT</span></span>
      <span className="flex items-center gap-3">
        <span className="font-mono text-sm text-slate-300">${t.price.toLocaleString(undefined, { maximumFractionDigits: t.price < 2 ? 4 : 2 })}</span>
        <span className={cn('w-16 text-right font-mono text-sm font-semibold', t.change >= 0 ? 'text-brand-emerald' : 'text-red-400')}>{formatPercent(t.change)}</span>
      </span>
    </Link>
  );
}

function DashboardInner() {
  const { user } = useAuth();
  const { mode } = useMode();
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [achievements, setAchievements] = useState<{ title: string; desc: string; icon: string; earned: boolean }[]>([]);
  const { tickers } = useTickers(8000);

  const load = useCallback(() => {
    api.get<WalletRow[]>('/api/account/wallets').then(setWallets).catch(() => {});
    api
      .get<{ achievements: typeof achievements }>('/api/account/achievements')
      .then((d) => setAchievements(d.achievements))
      .catch(() => {});
  }, []);
  // Refetch on mount and whenever the account mode switches (Demo ↔ Live) so
  // the dashboard always shows balances for the active account.
  useEffect(() => {
    load();
  }, [load, mode]);
  // Real-time refresh on any server-side balance change (e.g. admin funding).
  useLiveSync(load);

  const portfolioUsd = wallets.reduce((sum, w) => sum + parseFloat(w.balance) * (REF[w.asset] ?? 0), 0);

  // Market insights derived from the live ticker feed.
  const gainers = [...tickers].sort((a, b) => b.change - a.change).slice(0, 3);
  const losers = [...tickers].sort((a, b) => a.change - b.change).slice(0, 3);
  const trending = tickers.slice(0, 6);
  // Asset allocation (share of portfolio value per asset).
  const allocation = wallets
    .map((w) => ({ asset: w.asset, usd: parseFloat(w.balance) * (REF[w.asset] ?? 0) }))
    .filter((a) => a.usd > 0)
    .sort((a, b) => b.usd - a.usd);
  const allocTotal = allocation.reduce((s, a) => s + a.usd, 0) || 1;

  return (
    <section className="mx-auto max-w-7xl px-4 pt-24 sm:px-6 lg:px-8">
      {user && user.emailVerified === false && (
        <Link href="/settings" className="mb-5 flex items-center gap-2 rounded-xl border border-brand-gold/30 bg-brand-gold/10 px-4 py-3 text-sm text-brand-gold transition hover:bg-brand-gold/15">
          <Shield size={16} className="shrink-0" />
          <span>Please verify your email address to fully secure your account. <span className="font-semibold underline">Verify now →</span></span>
        </Link>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">Welcome, {user?.fullName}</h1>
            <ModeSwitcher compact />
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {user?.roles.map((r) => (
              <span key={r.key} className={cn('badge', r.isAdmin ? 'bg-brand-blue/15 text-brand-blue' : 'bg-white/5 text-slate-300')}>
                {r.isAdmin && <Shield size={11} />} {r.name}
              </span>
            ))}
          </div>
        </div>
        {user?.isAdmin && (
          <Link href="/admin" className="btn-primary">
            Open Admin Panel
          </Link>
        )}
      </div>

      {/* Mode notice — Demo disclaimer, or a simple activation notice only when
          Live trading has not yet been enabled for this account. */}
      {mode === 'DEMO' ? (
        <div className="mt-5 rounded-xl border border-brand-emerald/25 bg-brand-emerald/10 px-4 py-3 text-sm text-ink-soft">
          <span className="font-semibold text-ink">You are using Demo Mode.</span> All balances, trades, deposits,
          withdrawals, analytics and transaction references are simulated for demonstration and educational purposes.
        </div>
      ) : user && !user.canLiveTrade ? (
        <div className="mt-5 rounded-xl border border-brand-blue/25 bg-brand-blue/10 px-4 py-3 text-sm text-ink-soft">
          <span className="font-semibold text-ink">Live trading not yet enabled.</span> Live trading has not yet been
          enabled for your account. Please contact support or wait for administrator activation. You can still manage
          your wallet, deposits, withdrawals, KYC and settings.
        </div>
      ) : null}

      {/* Account overview + asset allocation */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Link href="/portfolio" className="card-hover group lg:col-span-2">
          <div className="flex items-center justify-between text-sm text-slate-400">
            <span className="flex items-center gap-2"><Wallet size={16} /> Portfolio value</span>
            <ChevronRight size={16} className="text-slate-600 transition-colors group-hover:text-brand-blue" />
          </div>
          <div className="mt-2 text-4xl font-bold text-white">{formatCurrency(portfolioUsd)}</div>
          <div className={cn('mt-1 text-xs', mode === 'DEMO' ? 'text-brand-emerald' : 'text-brand-blue')}>
            {mode === 'DEMO' ? 'Demo balance' : 'Live balance'} · {allocation.length} asset{allocation.length === 1 ? '' : 's'}
          </div>
          {allocation.length > 0 && (
            <div className="mt-4">
              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-white/5">
                {allocation.slice(0, 6).map((a, i) => (
                  <div key={a.asset} className="h-full" style={{ width: `${(a.usd / allocTotal) * 100}%`, background: ALLOC_COLORS[i % 6] }} />
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                {allocation.slice(0, 6).map((a, i) => (
                  <span key={a.asset} className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: ALLOC_COLORS[i % 6] }} />
                    {a.asset} <span className="text-slate-500">{((a.usd / allocTotal) * 100).toFixed(0)}%</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </Link>
        <div className="card">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white"><PieChart size={16} className="text-brand-blue" /> Your assets</div>
          <div className="space-y-1.5">
            {allocation.length === 0 && <p className="text-sm text-slate-500">No holdings yet.</p>}
            {allocation.slice(0, 5).map((a) => (
              <div key={a.asset} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-gradient text-[10px] font-bold text-white">{a.asset.slice(0, 3)}</span>
                  <span className="text-white">{a.asset}</span>
                </span>
                <span className="font-mono text-white">{formatCurrency(a.usd)}</span>
              </div>
            ))}
          </div>
          <Link href="/wallet" className="mt-3 flex items-center justify-center gap-1 text-xs font-semibold text-brand-blue hover:underline">Manage wallet <ArrowRight size={13} /></Link>
        </div>
      </div>

      {/* Market highlights — top movers */}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="card">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white"><TrendingUp size={16} className="text-brand-emerald" /> Top gainers (24h)</div>
          <div className="space-y-1">
            {gainers.map((t) => <MoverRow key={t.symbol} t={t} />)}
            {gainers.length === 0 && <p className="text-sm text-slate-500">Loading market data…</p>}
          </div>
        </div>
        <div className="card">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white"><TrendingDown size={16} className="text-red-400" /> Top losers (24h)</div>
          <div className="space-y-1">
            {losers.map((t) => <MoverRow key={t.symbol} t={t} />)}
            {losers.length === 0 && <p className="text-sm text-slate-500">Loading market data…</p>}
          </div>
        </div>
      </div>

      {/* Trending markets / watchlist */}
      <div className="card mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-white">Trending markets</h2>
          <Link href="/markets" className="flex items-center gap-1 text-xs font-semibold text-brand-blue hover:underline">All markets <ArrowRight size={13} /></Link>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {trending.map((t) => (
            <Link key={t.symbol} href={`/trading?symbol=${t.symbol}`} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2.5 transition hover:bg-white/10">
              <span className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-blue/10 text-[10px] font-bold text-brand-blue">{assetName(t.symbol).slice(0, 3)}</span>
                <span className="text-sm font-semibold text-white">{assetName(t.symbol)}<span className="text-slate-500">/USDT</span></span>
              </span>
              <span className="text-right">
                <span className="block font-mono text-sm text-white">${t.price.toLocaleString(undefined, { maximumFractionDigits: t.price < 2 ? 4 : 2 })}</span>
                <span className={cn('block font-mono text-xs', t.change >= 0 ? 'text-brand-emerald' : 'text-red-400')}>{formatPercent(t.change)}</span>
              </span>
            </Link>
          ))}
          {trending.length === 0 && <p className="text-sm text-slate-500">Loading markets…</p>}
        </div>
      </div>

      {/* Latest news + Achievements */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Link href="/news" className="card-hover group flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-white"><Newspaper size={16} className="text-brand-cyan" /> Latest market news</div>
            <p className="mt-2 text-sm text-slate-400">Stay ahead with curated crypto headlines, analysis and macro updates from the News Center.</p>
          </div>
          <span className="mt-4 flex items-center gap-1 text-xs font-semibold text-brand-blue group-hover:underline">Open News Center <ArrowRight size={13} /></span>
        </Link>
        {achievements.length > 0 && (
          <div className="card lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-white">Achievements</h2>
              <span className="text-sm text-slate-400">{achievements.filter((a) => a.earned).length}/{achievements.length} unlocked</span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {achievements.map((a) => (
                <div key={a.title} className={cn('rounded-xl border p-3 text-center transition', a.earned ? 'border-brand-gold/30 bg-brand-gold/10' : 'border-white/10 bg-white/5 opacity-50')} title={a.desc}>
                  <div className={cn('text-2xl', !a.earned && 'grayscale')}>{a.icon}</div>
                  <div className="mt-1 text-xs font-medium text-white">{a.title}</div>
                  <div className="text-[10px] text-slate-500">{a.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="h-16" />
    </section>
  );
}

export default function DashboardPage() {
  return (
    <main>
      <Navbar />
      <AuthGuard>
        <DashboardInner />
      </AuthGuard>
    </main>
  );
}
