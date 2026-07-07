'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, Clock, Wallet as WalletIcon, Search, ChevronRight } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { AuthGuard } from '@/components/AuthGuard';
import { DepositPanel } from '@/components/wallet/DepositPanel';
import { WithdrawPanel } from '@/components/wallet/WithdrawPanel';
import { api } from '@/lib/api';
import { useMode } from '@/lib/useMode';
import { useLiveSync } from '@/lib/useLiveSync';
import { formatCurrency, cn } from '@/lib/utils';

interface WalletRow { id: string; asset: string; balance: string; locked: string }
interface TxRow { id: string; type: string; asset: string; amount: string; status: string; reference: string | null; note?: string | null; createdAt: string }

const REF: Record<string, number> = { USDT: 1, USDC: 1, DAI: 1, BTC: 67000, ETH: 3500, SOL: 150, BNB: 600, XRP: 0.6 };
type Tab = 'DEPOSIT' | 'WITHDRAW' | 'TRANSFER' | 'HISTORY';

const TABS: { key: Tab; label: string; icon: typeof ArrowDownToLine }[] = [
  { key: 'DEPOSIT', label: 'Deposit', icon: ArrowDownToLine },
  { key: 'WITHDRAW', label: 'Withdraw', icon: ArrowUpFromLine },
  { key: 'TRANSFER', label: 'Transfer', icon: ArrowLeftRight },
  { key: 'HISTORY', label: 'History', icon: Clock },
];

function AssetBadge({ asset }: { asset: string }) {
  return <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-gradient text-xs font-bold text-white">{asset.slice(0, 3)}</div>;
}

function WalletInner() {
  const router = useRouter();
  const { mode, hydrated, init } = useMode();
  useEffect(() => { if (!hydrated) init(); }, [hydrated, init]);
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [txns, setTxns] = useState<TxRow[]>([]);
  const [tab, setTab] = useState<Tab>('DEPOSIT');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'DEPOSIT' | 'WITHDRAWAL'>('ALL');

  const load = useCallback(() => {
    api.get<WalletRow[]>('/api/account/wallets').then(setWallets).catch(() => {});
    api.get<TxRow[]>('/api/account/transactions').then(setTxns).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load, mode]);
  useLiveSync(load);

  const total = useMemo(() => wallets.reduce((s, w) => s + parseFloat(w.balance) * (REF[w.asset] ?? 0), 0), [wallets]);
  const filtered = useMemo(() => txns.filter((t) => (filter === 'ALL' || t.type === filter) && (!q || `${t.reference ?? ''} ${t.asset} ${t.type} ${t.note ?? ''}`.toLowerCase().includes(q.toLowerCase()))), [txns, filter, q]);

  return (
    <section className="mx-auto max-w-5xl px-4 pt-24 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-2xl bg-brand-gradient p-3 text-white"><WalletIcon size={22} /></div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-white">Wallet</h1>
          <p className="text-sm text-slate-400">Manage deposits, withdrawals and transaction history.</p>
        </div>
        <span className={cn('ml-auto badge', mode === 'DEMO' ? 'bg-brand-emerald/15 text-brand-emerald' : 'bg-brand-blue/15 text-brand-blue')}>{mode === 'DEMO' ? 'Demo' : 'Live'} Account</span>
      </div>

      {/* Overview */}
      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="card">
          <div className="text-sm text-slate-400">Total balance</div>
          <div className="mt-1 text-3xl font-bold text-white sm:text-4xl">{formatCurrency(total)}</div>
          <div className="mt-4 space-y-2">
            {wallets.map((w) => (
              <Link key={w.id} href={`/wallet/${w.asset}`} className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3 transition hover:bg-white/10">
                <div className="flex items-center gap-3">
                  <AssetBadge asset={w.asset} />
                  <div>
                    <div className="font-medium text-white">{w.asset}</div>
                    {parseFloat(w.locked) > 0 && <div className="text-xs text-slate-500">{parseFloat(w.locked)} locked</div>}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-right">
                  <div>
                    <div className="font-mono text-white">{parseFloat(w.balance).toLocaleString()}</div>
                    <div className="text-xs text-slate-500">≈ {formatCurrency(parseFloat(w.balance) * (REF[w.asset] ?? 0))}</div>
                  </div>
                  <ChevronRight size={16} className="text-slate-600" />
                </div>
              </Link>
            ))}
            {wallets.length === 0 && <p className="rounded-xl bg-white/5 px-4 py-6 text-center text-sm text-slate-500">No balances yet.</p>}
          </div>
        </div>

        {/* Recent transactions */}
        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Recent activity</h2>
            <button onClick={() => setTab('HISTORY')} className="text-xs font-medium text-brand-blue hover:text-brand-cyan">View all</button>
          </div>
          <div className="space-y-2">
            {txns.slice(0, 5).map((t) => (
              <button key={t.id} onClick={() => router.push(`/transaction/${t.id}`)} className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm transition hover:bg-white/5">
                <span className="flex items-center gap-2">
                  <span className={cn('flex h-7 w-7 items-center justify-center rounded-full', t.type === 'DEPOSIT' ? 'bg-brand-emerald/15 text-brand-emerald' : 'bg-brand-blue/15 text-brand-blue')}>{t.type === 'DEPOSIT' ? <ArrowDownToLine size={13} /> : <ArrowUpFromLine size={13} />}</span>
                  <span className="text-slate-300">{t.type.charAt(0) + t.type.slice(1).toLowerCase()}</span>
                </span>
                <span className="font-mono text-white">{parseFloat(t.amount).toLocaleString()} {t.asset}</span>
              </button>
            ))}
            {txns.length === 0 && <p className="px-2 py-6 text-center text-xs text-slate-500">No activity yet.</p>}
          </div>
        </div>
      </div>

      {/* Action tabs */}
      <div className="mt-6 flex gap-1.5 overflow-x-auto rounded-2xl border border-white/10 bg-black/20 p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={cn('flex flex-1 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition', tab === t.key ? 'bg-brand-gradient text-white shadow-glow' : 'text-slate-400 hover:text-white')}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === 'DEPOSIT' && <DepositPanel mode={mode} onDone={load} />}
        {tab === 'WITHDRAW' && <WithdrawPanel mode={mode} wallets={wallets} onDone={load} />}
        {tab === 'TRANSFER' && (
          <div className="card flex flex-col items-center justify-center py-14 text-center">
            <div className="inline-flex rounded-2xl bg-white/5 p-4 text-slate-400"><ArrowLeftRight size={26} /></div>
            <h2 className="mt-4 text-lg font-semibold text-white">Internal transfers</h2>
            <p className="mt-1 max-w-sm text-sm text-slate-400">Move funds between your NexTradePro accounts and convert between assets. This feature is coming soon.</p>
          </div>
        )}
        {tab === 'HISTORY' && (
          <div className="card p-0">
            <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative sm:w-64">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search transactions…" className="input py-2 pl-9 text-sm" />
              </div>
              <div className="flex gap-1.5">
                {(['ALL', 'DEPOSIT', 'WITHDRAWAL'] as const).map((f) => (
                  <button key={f} onClick={() => setFilter(f)} className={cn('rounded-lg px-3 py-1.5 text-xs font-medium transition', filter === f ? 'bg-brand-gradient text-white' : 'bg-white/5 text-slate-400')}>{f.charAt(0) + f.slice(1).toLowerCase()}</button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-2">Reference</th>
                    <th className="hidden px-5 py-2 sm:table-cell">Type</th>
                    <th className="px-5 py-2 text-right">Amount</th>
                    <th className="px-5 py-2 text-right">Status</th>
                    <th className="hidden px-5 py-2 text-right md:table-cell">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filtered.map((t) => (
                    <tr key={t.id} onClick={() => router.push(`/transaction/${t.id}`)} className="cursor-pointer hover:bg-white/[0.03]">
                      <td className="px-5 py-3 font-mono text-brand-blue hover:underline">{t.reference ?? '—'}</td>
                      <td className="hidden px-5 py-3 sm:table-cell"><span className={cn('badge', t.type === 'DEPOSIT' ? 'bg-brand-emerald/15 text-brand-emerald' : 'bg-brand-blue/15 text-brand-blue')}>{t.type.charAt(0) + t.type.slice(1).toLowerCase()}</span></td>
                      <td className="px-5 py-3 text-right font-mono text-white">{parseFloat(t.amount).toLocaleString()} {t.asset}</td>
                      <td className="px-5 py-3 text-right"><span className={cn('badge', t.status === 'COMPLETED' || t.status === 'APPROVED' ? 'bg-brand-emerald/15 text-brand-emerald' : t.status === 'REJECTED' ? 'bg-red-500/15 text-red-400' : 'bg-brand-gold/15 text-brand-gold')}>{t.status}</span></td>
                      <td className="hidden px-5 py-3 text-right text-slate-400 md:table-cell">{new Date(t.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {filtered.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-500">{q || filter !== 'ALL' ? 'No matching transactions.' : 'No transactions yet.'}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
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
