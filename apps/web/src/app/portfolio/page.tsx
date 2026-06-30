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

function PortfolioInner() {
  const [wallets, setWallets] = useState<WalletRow[]>([]);

  useEffect(() => {
    api.get<WalletRow[]>('/api/account/wallets').then(setWallets).catch(() => {});
  }, []);

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
    { label: '7d P&L', value: `${weekPnl >= 0 ? '+' : ''}${formatCurrency(weekPnl)}`, tone: weekPnl >= 0 ? 'pos' : 'neg' },
    { label: 'Sharpe ratio', value: '1.82' },
    { label: 'Max drawdown', value: '-8.4%', tone: 'neg' },
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
