'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Wallet, ArrowDownToLine, ListOrderedIcon, Shield, ChevronRight } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { AuthGuard } from '@/components/AuthGuard';
import { ModeSwitcher } from '@/components/ModeSwitcher';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { useMode } from '@/lib/useMode';
import { useLiveSync } from '@/lib/useLiveSync';
import { formatCurrency, cn } from '@/lib/utils';

interface WalletRow {
  id: string;
  asset: string;
  balance: string;
  locked: string;
}
interface OrderRow {
  id: string;
  symbol: string;
  side: string;
  type: string;
  price: string;
  amount: string;
  status: string;
  createdAt: string;
}
interface TxRow {
  id: string;
  type: string;
  asset: string;
  amount: string;
  status: string;
  createdAt: string;
}

// Rough USD reference prices for portfolio valuation (demo).
const REF: Record<string, number> = { USDT: 1, BTC: 67000, ETH: 3500 };

function DashboardInner() {
  const { user } = useAuth();
  const { mode } = useMode();
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [txns, setTxns] = useState<TxRow[]>([]);
  const [achievements, setAchievements] = useState<{ title: string; desc: string; icon: string; earned: boolean }[]>([]);
  const [wdAsset, setWdAsset] = useState('USDT');
  const [wdAmount, setWdAmount] = useState('');
  const [wdMsg, setWdMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    api.get<WalletRow[]>('/api/account/wallets').then(setWallets).catch(() => {});
    api.get<OrderRow[]>('/api/account/orders').then(setOrders).catch(() => {});
    api.get<TxRow[]>('/api/account/transactions').then(setTxns).catch(() => {});
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

  const submitWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    setWdMsg(null);
    try {
      await api.post('/api/account/withdraw', { asset: wdAsset, amount: parseFloat(wdAmount) });
      setWdMsg('Withdrawal submitted — pending admin approval.');
      setWdAmount('');
      load();
    } catch (err) {
      setWdMsg(err instanceof Error ? err.message : 'Failed');
    }
  };

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

      {/* Portfolio summary — each tile links to its detailed view. */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Link href="/portfolio" className="card-hover group">
          <div className="flex items-center justify-between text-sm text-slate-400">
            <span className="flex items-center gap-2"><Wallet size={16} /> Portfolio value</span>
            <ChevronRight size={16} className="text-slate-600 transition-colors group-hover:text-brand-blue" />
          </div>
          <div className="mt-2 text-3xl font-bold text-white">{formatCurrency(portfolioUsd)}</div>
          <div className={cn('mt-1 text-xs', mode === 'DEMO' ? 'text-brand-emerald' : 'text-brand-blue')}>
            {mode === 'DEMO' ? 'Demo balance' : 'Live balance'}
          </div>
        </Link>
        <Link href="/trading" className="card-hover group">
          <div className="flex items-center justify-between text-sm text-slate-400">
            <span className="flex items-center gap-2"><ListOrderedIcon size={16} /> Open orders</span>
            <ChevronRight size={16} className="text-slate-600 transition-colors group-hover:text-brand-blue" />
          </div>
          <div className="mt-2 text-3xl font-bold text-white">
            {orders.filter((o) => o.status === 'OPEN').length}
          </div>
          <div className="mt-1 text-xs text-slate-500">{orders.length} total</div>
        </Link>
        <Link href="/wallet?tab=HISTORY" className="card-hover group">
          <div className="flex items-center justify-between text-sm text-slate-400">
            <span className="flex items-center gap-2"><ArrowDownToLine size={16} /> Pending withdrawals</span>
            <ChevronRight size={16} className="text-slate-600 transition-colors group-hover:text-brand-blue" />
          </div>
          <div className="mt-2 text-3xl font-bold text-white">
            {txns.filter((t) => t.type === 'WITHDRAWAL' && t.status === 'PENDING').length}
          </div>
          <div className="mt-1 text-xs text-slate-500">Awaiting approval</div>
        </Link>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Wallets */}
        <div className="card lg:col-span-2">
          <h2 className="mb-4 font-semibold text-white">Wallets</h2>
          <div className="space-y-2">
            {wallets.map((w) => (
              <div key={w.id} className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-gradient text-xs font-bold text-white">
                    {w.asset.slice(0, 3)}
                  </div>
                  <span className="font-medium text-white">{w.asset}</span>
                </div>
                <div className="text-right font-mono text-white">{parseFloat(w.balance).toLocaleString()}</div>
              </div>
            ))}
            {wallets.length === 0 && <p className="text-sm text-slate-500">No wallets yet.</p>}
          </div>
        </div>

        {/* Withdraw */}
        <div className="card">
          <h2 className="mb-4 font-semibold text-white">Request withdrawal</h2>
          <form onSubmit={submitWithdraw} className="space-y-3">
            <div>
              <label className="label">Asset</label>
              <select value={wdAsset} onChange={(e) => setWdAsset(e.target.value)} className="input">
                {wallets.map((w) => (
                  <option key={w.asset} value={w.asset}>
                    {w.asset}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Amount</label>
              <input value={wdAmount} onChange={(e) => setWdAmount(e.target.value)} type="number" className="input" placeholder="0.00" required />
            </div>
            <button className="btn-primary w-full">Submit request</button>
            {wdMsg && <p className="text-xs text-slate-300">{wdMsg}</p>}
            <p className="text-xs text-slate-500">Withdrawals require approval from a Withdrawal Admin.</p>
          </form>
        </div>
      </div>

      {/* Achievements */}
      {achievements.length > 0 && (
        <div className="card mt-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-white">Achievements</h2>
            <span className="text-sm text-slate-400">
              {achievements.filter((a) => a.earned).length}/{achievements.length} unlocked
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {achievements.map((a) => (
              <div
                key={a.title}
                className={cn(
                  'rounded-xl border p-3 text-center transition',
                  a.earned ? 'border-brand-gold/30 bg-brand-gold/10' : 'border-white/10 bg-white/5 opacity-50',
                )}
                title={a.desc}
              >
                <div className={cn('text-2xl', !a.earned && 'grayscale')}>{a.icon}</div>
                <div className="mt-1 text-xs font-medium text-white">{a.title}</div>
                <div className="text-[10px] text-slate-500">{a.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent orders */}
      <div className="card mt-6">
        <h2 className="mb-4 font-semibold text-white">Recent orders</h2>
        {orders.length === 0 ? (
          <p className="text-sm text-slate-500">
            No orders yet. <Link href="/trading" className="text-brand-blue hover:underline">Place a trade</Link>.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="pb-2">Pair</th>
                  <th className="pb-2">Side</th>
                  <th className="pb-2">Type</th>
                  <th className="pb-2 text-right">Price</th>
                  <th className="pb-2 text-right">Amount</th>
                  <th className="pb-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {orders.slice(0, 8).map((o) => (
                  <tr key={o.id}>
                    <td className="py-2.5 font-medium text-white">{o.symbol}</td>
                    <td className={cn('py-2.5', o.side === 'BUY' ? 'text-brand-emerald' : 'text-red-400')}>{o.side}</td>
                    <td className="py-2.5 text-slate-400">{o.type}</td>
                    <td className="py-2.5 text-right font-mono text-slate-300">${parseFloat(o.price).toLocaleString()}</td>
                    <td className="py-2.5 text-right font-mono text-slate-300">{parseFloat(o.amount)}</td>
                    <td className="py-2.5 text-right">
                      <span className="badge bg-white/5 text-slate-300">{o.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
