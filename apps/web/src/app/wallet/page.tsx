'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDownToLine, ArrowUpFromLine, Wallet as WalletIcon } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { AuthGuard } from '@/components/AuthGuard';
import { api } from '@/lib/api';
import { useMode } from '@/lib/useMode';
import { useLiveSync } from '@/lib/useLiveSync';
import { formatCurrency, cn } from '@/lib/utils';

interface WalletRow {
  id: string;
  asset: string;
  balance: string;
  locked: string;
}
interface TxRow {
  id: string;
  type: string;
  asset: string;
  amount: string;
  status: string;
  reference: string | null;
  createdAt: string;
}

const REF: Record<string, number> = { USDT: 1, BTC: 67000, ETH: 3500 };

function WalletInner() {
  const router = useRouter();
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [txns, setTxns] = useState<TxRow[]>([]);
  const [tab, setTab] = useState<'DEPOSIT' | 'WITHDRAWAL'>('DEPOSIT');
  const [asset, setAsset] = useState('USDT');
  const [amount, setAmount] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'DEPOSIT' | 'WITHDRAWAL'>('ALL');

  const { mode } = useMode();
  const load = useCallback(() => {
    api.get<WalletRow[]>('/api/account/wallets').then(setWallets).catch(() => {});
    api.get<TxRow[]>('/api/account/transactions').then(setTxns).catch(() => {});
  }, []);
  useEffect(() => {
    load();
  }, [load, mode]);
  useLiveSync(load);

  const total = wallets.reduce((s, w) => s + parseFloat(w.balance) * (REF[w.asset] ?? 0), 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return setMsg('Enter a valid amount.');
    try {
      if (tab === 'DEPOSIT') {
        await api.post('/api/account/deposit', { asset, amount: amt });
        setMsg(`✓ Deposited ${amt} ${asset} (demo, instantly credited)`);
      } else {
        await api.post('/api/account/withdraw', { asset, amount: amt });
        setMsg('✓ Withdrawal submitted — pending admin approval.');
      }
      setAmount('');
      load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Failed');
    }
  };

  const requestTopUp = async () => {
    const input = prompt('Request a demo balance top-up (USDT). An admin will review it:', '10000');
    if (input === null) return;
    const amt = parseFloat(input);
    if (!amt || amt <= 0) return setMsg('Enter a valid amount.');
    try {
      await api.post('/api/account/request-demo-funds', { amount: amt });
      setMsg(`✓ Requested ${amt.toLocaleString()} demo USDT — pending admin approval.`);
      load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Failed');
    }
  };

  const filtered = txns.filter((t) => filter === 'ALL' || t.type === filter);

  return (
    <section className="mx-auto max-w-5xl px-4 pt-24 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <div className="inline-flex rounded-2xl bg-brand-gradient p-3 text-white">
          <WalletIcon size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Wallet</h1>
          <p className="text-slate-400">Deposit, withdraw and review your transaction history.</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Balances */}
        <div className="card">
          <div className="text-sm text-slate-400">Total balance</div>
          <div className="mt-1 text-3xl font-bold text-white">{formatCurrency(total)}</div>
          <div className="mt-4 space-y-2">
            {wallets.map((w) => (
              <div key={w.id} className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-gradient text-xs font-bold text-white">
                    {w.asset.slice(0, 3)}
                  </div>
                  <div>
                    <div className="font-medium text-white">{w.asset}</div>
                    {parseFloat(w.locked) > 0 && <div className="text-xs text-slate-500">{parseFloat(w.locked)} locked</div>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-white">{parseFloat(w.balance).toLocaleString()}</div>
                  <div className="text-xs text-slate-500">≈ {formatCurrency(parseFloat(w.balance) * (REF[w.asset] ?? 0))}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Deposit / Withdraw */}
        <div className="card h-fit">
          <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl bg-black/20 p-1">
            {(['DEPOSIT', 'WITHDRAWAL'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn('flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition', tab === t ? 'bg-white/10 text-white' : 'text-slate-400')}
              >
                {t === 'DEPOSIT' ? <ArrowDownToLine size={14} /> : <ArrowUpFromLine size={14} />}
                {t === 'DEPOSIT' ? 'Deposit' : 'Withdraw'}
              </button>
            ))}
          </div>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="label">Asset</label>
              <select value={asset} onChange={(e) => setAsset(e.target.value)} className="input">
                {wallets.map((w) => (
                  <option key={w.asset} value={w.asset}>
                    {w.asset}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Amount</label>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" className="input" placeholder="0.00" />
            </div>
            <button className="btn-primary w-full">{tab === 'DEPOSIT' ? 'Deposit (demo)' : 'Request withdrawal'}</button>
            {msg && <p className="text-xs text-slate-300">{msg}</p>}
            <p className="text-xs text-slate-500">
              {tab === 'DEPOSIT' ? 'Demo deposits are credited instantly.' : 'Withdrawals require admin approval.'}
            </p>
            {tab === 'DEPOSIT' && (
              <>
                <a href="/deposit" className="block text-center text-xs font-medium text-brand-blue hover:underline">
                  Or deposit via wallet address + QR →
                </a>
                <button type="button" onClick={requestTopUp} className="btn-ghost mt-1 w-full text-xs">
                  Request demo top-up (admin approval)
                </button>
              </>
            )}
          </form>
        </div>
      </div>

      {/* History */}
      <div className="card mt-6 p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
          <h2 className="font-semibold text-white">Transaction history</h2>
          <div className="flex gap-1.5">
            {(['ALL', 'DEPOSIT', 'WITHDRAWAL'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn('rounded-lg px-3 py-1.5 text-xs font-medium transition', filter === f ? 'bg-brand-gradient text-white' : 'bg-white/5 text-slate-400')}
              >
                {f.charAt(0) + f.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-2">Reference</th>
                <th className="px-5 py-2">Type</th>
                <th className="px-5 py-2 text-right">Amount</th>
                <th className="px-5 py-2 text-right">Status</th>
                <th className="px-5 py-2 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((t) => (
                <tr key={t.id} onClick={() => router.push(`/transaction/${t.id}`)} className="cursor-pointer hover:bg-white/[0.03]">
                  <td className="px-5 py-3 font-mono text-brand-blue hover:underline">{t.reference ?? '—'}</td>
                  <td className="px-5 py-3">
                    <span className={cn('badge', t.type === 'DEPOSIT' ? 'bg-brand-emerald/15 text-brand-emerald' : 'bg-brand-blue/15 text-brand-blue')}>
                      {t.type.charAt(0) + t.type.slice(1).toLowerCase()}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-white">
                    {parseFloat(t.amount).toLocaleString()} {t.asset}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span
                      className={cn(
                        'badge',
                        t.status === 'COMPLETED' || t.status === 'APPROVED'
                          ? 'bg-brand-emerald/15 text-brand-emerald'
                          : t.status === 'REJECTED'
                            ? 'bg-red-500/15 text-red-400'
                            : 'bg-brand-gold/15 text-brand-gold',
                      )}
                    >
                      {t.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right text-slate-400">{new Date(t.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-500">
                    No transactions yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="h-16" />
    </section>
  );
}

export default function WalletPage() {
  return (
    <main>
      <Navbar />
      <AuthGuard>
        <WalletInner />
      </AuthGuard>
    </main>
  );
}
