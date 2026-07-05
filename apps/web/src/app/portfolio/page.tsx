'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { Navbar } from '@/components/Navbar';
import { AuthGuard } from '@/components/AuthGuard';
import { api } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';

interface WalletRow {
  id: string;
  asset: string;
  balance: string;
}

const REF: Record<string, number> = { USDT: 1, BTC: 67000, ETH: 3500, BNB: 600, SOL: 150 };
const COLORS = ['#0B6EFF', '#00C896', '#F5B301', '#7C5CFC', '#FF6B6B', '#34D399'];

// Deterministic-ish demo P&L series so analytics looks alive.
const PNL = [
  { d: 'Mon', v: 320 },
  { d: 'Tue', v: -140 },
  { d: 'Wed', v: 580 },
  { d: 'Thu', v: 210 },
  { d: 'Fri', v: -90 },
  { d: 'Sat', v: 430 },
  { d: 'Sun', v: 660 },
];

interface Stats {
  totalTrades: number; wins: number; losses: number; winRate: number; lossRate: number;
  profitFactor: number; realizedPnl: number; bestTrade: number; worstTrade: number;
  avgDurationMs: number; maxDrawdown: number; sharpe: number;
  dailyProfit: number; weeklyProfit: number; monthlyProfit: number; roi: number;
}

function PortfolioInner() {
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api.get<WalletRow[]>('/api/account/wallets').then(setWallets).catch(() => {});
    api.get<Stats>('/api/account/stats').then(setStats).catch(() => {});
  }, []);

  const fmtDur = (ms: number) => {
    if (!ms) return '—';
    const m = Math.round(ms / 60000);
    if (m < 60) return `${m}m`;
    const h = Math.round(m / 60);
    return h < 24 ? `${h}h` : `${Math.round(h / 24)}d`;
  };
  const pf = stats ? (Number.isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : '∞') : '—';

  const alloc = useMemo(
    () =>
      wallets
        .map((w) => ({ name: w.asset, value: parseFloat(w.balance) * (REF[w.asset] ?? 0) }))
        .filter((a) => a.value > 0)
        .sort((a, b) => b.value - a.value),
    [wallets],
  );
  const total = alloc.reduce((s, a) => s + a.value, 0);
  const weekPnl = PNL.reduce((s, p) => s + p.v, 0);

  const metrics = [
    { label: 'Total value', value: formatCurrency(total) },
    { label: 'Realized P&L', value: `${(stats?.realizedPnl ?? 0) >= 0 ? '+' : ''}${formatCurrency(stats?.realizedPnl ?? weekPnl)}`, tone: (stats?.realizedPnl ?? weekPnl) >= 0 ? 'pos' : 'neg' },
    { label: 'Sharpe ratio', value: stats ? stats.sharpe.toFixed(2) : '—' },
    { label: 'Max drawdown', value: stats ? `-${formatCurrency(stats.maxDrawdown)}` : '—', tone: 'neg' },
  ];

  return (
    <section className="mx-auto max-w-7xl px-4 pt-24 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-white">Portfolio Analytics</h1>
      <p className="mt-1 text-slate-400">Allocation, performance and risk metrics for your holdings.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <div key={m.label} className="card">
            <div className="text-sm text-slate-400">{m.label}</div>
            <div className={cn('mt-1 text-2xl font-bold', m.tone === 'pos' ? 'text-brand-emerald' : m.tone === 'neg' ? 'text-red-400' : 'text-white')}>
              {m.value}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Allocation */}
        <div className="card">
          <h2 className="mb-4 font-semibold text-white">Asset Allocation</h2>
          <div className="flex flex-col items-center gap-6 sm:flex-row">
            <div className="h-52 w-52 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={alloc} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                    {alloc.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#0F1622', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }}
                    formatter={(v: number) => formatCurrency(v)}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2 self-stretch">
              {alloc.map((a, i) => (
                <div key={a.name} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-slate-300">
                    <span className="h-3 w-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    {a.name}
                  </span>
                  <span className="text-slate-400">
                    {total > 0 ? ((a.value / total) * 100).toFixed(1) : '0'}%
                  </span>
                </div>
              ))}
              {alloc.length === 0 && <p className="text-sm text-slate-500">No holdings yet.</p>}
            </div>
          </div>
        </div>

        {/* P&L */}
        <div className="card">
          <h2 className="mb-4 font-semibold text-white">Daily P&amp;L (7d)</h2>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={PNL}>
                <XAxis dataKey="d" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  contentStyle={{ background: '#0F1622', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }}
                  formatter={(v: number) => formatCurrency(v)}
                />
                <Bar dataKey="v" radius={[6, 6, 0, 0]}>
                  {PNL.map((p, i) => (
                    <Cell key={i} fill={p.v >= 0 ? '#00C896' : '#FF6B6B'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Trading statistics */}
      <div className="card mt-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-white">Trading statistics</h2>
          <span className="text-xs text-ink-muted">{stats?.totalTrades ?? 0} closed trades</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {[
            { label: 'Win rate', value: stats ? `${stats.winRate.toFixed(1)}%` : '—', tone: 'pos' },
            { label: 'Loss rate', value: stats ? `${stats.lossRate.toFixed(1)}%` : '—', tone: 'neg' },
            { label: 'Profit factor', value: pf },
            { label: 'Total trades', value: String(stats?.totalTrades ?? 0) },
            { label: 'Best trade', value: stats ? `+${formatCurrency(stats.bestTrade)}` : '—', tone: 'pos' },
            { label: 'Worst trade', value: stats ? formatCurrency(stats.worstTrade) : '—', tone: 'neg' },
            { label: 'Avg duration', value: fmtDur(stats?.avgDurationMs ?? 0) },
            { label: 'Max drawdown', value: stats ? `-${formatCurrency(stats.maxDrawdown)}` : '—', tone: 'neg' },
            { label: 'Daily P&L', value: stats ? `${stats.dailyProfit >= 0 ? '+' : ''}${formatCurrency(stats.dailyProfit)}` : '—', tone: (stats?.dailyProfit ?? 0) >= 0 ? 'pos' : 'neg' },
            { label: 'Weekly P&L', value: stats ? `${stats.weeklyProfit >= 0 ? '+' : ''}${formatCurrency(stats.weeklyProfit)}` : '—', tone: (stats?.weeklyProfit ?? 0) >= 0 ? 'pos' : 'neg' },
            { label: 'Monthly P&L', value: stats ? `${stats.monthlyProfit >= 0 ? '+' : ''}${formatCurrency(stats.monthlyProfit)}` : '—', tone: (stats?.monthlyProfit ?? 0) >= 0 ? 'pos' : 'neg' },
            { label: 'ROI', value: stats ? `${stats.roi >= 0 ? '+' : ''}${stats.roi.toFixed(1)}%` : '—', tone: (stats?.roi ?? 0) >= 0 ? 'pos' : 'neg' },
          ].map((m) => (
            <div key={m.label} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
              <div className="text-[11px] uppercase tracking-wide text-ink-muted">{m.label}</div>
              <div className={cn('mt-0.5 font-mono text-sm font-semibold', m.tone === 'pos' ? 'text-brand-emerald' : m.tone === 'neg' ? 'text-red-400' : 'text-white')}>
                {m.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="h-16" />
    </section>
  );
}

export default function PortfolioPage() {
  return (
    <main>
      <Navbar />
      <AuthGuard>
        <PortfolioInner />
      </AuthGuard>
    </main>
  );
}
