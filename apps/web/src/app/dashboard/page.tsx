'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Wallet, ArrowDownToLine, ListOrderedIcon, Shield } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { AuthGuard } from '@/components/AuthGuard';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';
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
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [txns, setTxns] = useState<TxRow[]>([]);
  const [achievements, setAchievements] = useState<{ title: string; desc: string; icon: string; earned: boolean }[]>([]);
  const [wdAsset, setWdAsset] = useState('USDT');
  const [wdAmount, setWdAmount] = useState('');
  const [wdMsg, setWdMsg] = useState<string | null>(null);

  const load = () => {
    api.get<WalletRow[]>('/api/account/wallets').then(setWallets).catch(() => {});
    api.get<OrderRow[]>('/api/account/orders').then(setOrders).catch(() => {});
    api.get<TxRow[]>('/api/account/transactions').then(setTxns).catch(() => {});
    api
      .get<{ achievements: typeof achievements }>('/api/account/achievements')
      .then((d) => setAchievements(d.achievements))
      .catch(() => {});
  };
  useEffect(load, []);

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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Welcome, {user?.fullName}</h1>
          <div className="mt-1 flex flex-wrap gap-2">
            {user?.roles.map((r) => (
              <span key={r.key} className={cn('badge', r.isAdmin ? 'bg-brand-blue/15 text-brand-blue' : 'bg-white/5 text-slate-300')}>
                {r.isAdmin && <Shield size={11} />} {r.name}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/wallet" className="btn-ghost">
            Wallet
          </Link>
          <Link href="/portfolio" className="btn-ghost">
            Portfolio
          </Link>
          <Link href="/referral" className="btn-ghost">
            Refer &amp; Earn
          </Link>
          <Link href="/kyc" className="btn-ghost">
            Verify (KYC)
          </Link>
          <Link href="/settings" className="btn-ghost">
            Settings
          </Link>
          {user?.isAdmin && (
            <Link href="/admin" className="btn-primary">
              Open Admin Panel
            </Link>
          )}
        </div>
      </div>

      {/* Portfolio summary */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="card">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Wallet size={16} /> Portfolio value
          </div>
          <div className="mt-2 text-3xl font-bold text-white">{formatCurrency(portfolioUsd)}</div>
          <div className="mt-1 text-xs text-brand-emerald">Demo balance</div>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <ListOrderedIcon size={16} /> Open orders
          </div>
          <div className="mt-2 text-3xl font-bold text-white">
            {orders.filter((o) => o.status === 'OPEN').length}
          </div>
          <div className="mt-1 text-xs text-slate-500">{orders.length} total</div>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <ArrowDownToLine size={16} /> Pending withdrawals
          </div>
          <div className="mt-2 text-3xl font-bold text-white">
            {txns.filter((t) => t.type === 'WITHDRAWAL' && t.status === 'PENDING').length}
          </div>
          <div className="mt-1 text-xs text-slate-500">Awaiting approval</div>
        </div>
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
