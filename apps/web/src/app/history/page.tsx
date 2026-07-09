'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Receipt as ReceiptIcon, Search } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { AuthGuard } from '@/components/AuthGuard';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { useMode } from '@/lib/useMode';
import { useLiveSync } from '@/lib/useLiveSync';
import { downloadReceipt, type ReceiptTxn } from '@/lib/receipt';
import { cn } from '@/lib/utils';

interface Txn extends ReceiptTxn { note?: string | null }
interface Order {
  id: string; symbol: string; side: string; type: string; status: string;
  price: string; amount: string; leverage: number; margin: string;
  closePrice: string | null; realizedPnl: string | null; createdAt: string; closedAt: string | null;
}

const TX_TYPES = ['ALL', 'DEPOSIT', 'WITHDRAWAL', 'TRANSFER'];
const TX_STATUS = ['ALL', 'PENDING', 'UNDER_REVIEW', 'APPROVED', 'PROCESSING', 'COMPLETED', 'REJECTED'];
const TRADE_STATUS = ['ALL', 'OPEN', 'FILLED', 'CLOSED', 'CANCELLED', 'REJECTED'];
const PAGE = 15;

const statusTone = (s: string) =>
  ['COMPLETED', 'APPROVED', 'CLOSED', 'FILLED'].includes(s) ? 'bg-brand-emerald/15 text-brand-emerald'
    : ['REJECTED', 'CANCELLED'].includes(s) ? 'bg-red-500/15 text-red-400'
      : 'bg-brand-gold/15 text-brand-gold';

function toCsv(rows: Record<string, unknown>[], filename: string) {
  if (rows.length === 0) return;
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function HistoryInner() {
  const { user } = useAuth();
  const { mode } = useMode();
  const [tab, setTab] = useState<'TX' | 'TRADES'>('TX');
  const [txns, setTxns] = useState<Txn[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  // Filters
  const [q, setQ] = useState('');
  const [type, setType] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [tradeStatus, setTradeStatus] = useState('ALL');
  const [page, setPage] = useState(1);

  const load = useCallback(() => {
    api.get<Txn[]>('/api/account/transactions').then(setTxns).catch(() => {});
    api.get<Order[]>('/api/account/orders').then(setOrders).catch(() => {});
  }, []);
  useEffect(() => {
    load();
  }, [load, mode]);
  useLiveSync(load);
  useEffect(() => setPage(1), [q, type, status, from, to, tradeStatus, tab]);

  const filteredTx = useMemo(() => {
    const fromT = from ? new Date(from).getTime() : 0;
    const toT = to ? new Date(to).getTime() + 86400000 : Infinity;
    return txns.filter((t) => {
      if (type !== 'ALL' && t.type !== type) return false;
      if (status !== 'ALL' && t.status !== status) return false;
      const ts = new Date(t.createdAt).getTime();
      if (ts < fromT || ts > toT) return false;
      if (q && ![t.id, t.reference, t.asset, t.type].join(' ').toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [txns, type, status, from, to, q]);

  const filteredTrades = useMemo(
    () => orders.filter((o) => (tradeStatus === 'ALL' || o.status === tradeStatus) && (!q || `${o.symbol} ${o.side} ${o.type}`.toLowerCase().includes(q.toLowerCase()))),
    [orders, tradeStatus, q],
  );

  const rows = tab === 'TX' ? filteredTx : filteredTrades;
  const paged = rows.slice((page - 1) * PAGE, page * PAGE);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const fmt = (v: string | number | null) => (v == null ? '—' : Number(v).toLocaleString(undefined, { maximumFractionDigits: 8 }));
  const dur = (a: string, b: string | null) => (b ? `${Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000))}m` : '—');

  const exportCsv = () => {
    if (tab === 'TX') {
      toCsv(
        filteredTx.map((t) => ({ id: t.id, reference: t.reference ?? '', type: t.type, asset: t.asset, amount: t.amount, fee: t.fee ?? '', network: t.network ?? '', status: t.status, account: t.mode ?? '', date: new Date(t.createdAt).toISOString() })),
        `nextradepro-transactions-${Date.now()}.csv`,
      );
    } else {
      toCsv(
        filteredTrades.map((o) => ({ id: o.id, pair: o.symbol, side: o.side, type: o.type, entry: o.price, exit: o.closePrice ?? '', qty: o.amount, leverage: o.leverage, margin: o.margin, realizedPnl: o.realizedPnl ?? '', status: o.status, openTime: new Date(o.createdAt).toISOString(), closeTime: o.closedAt ? new Date(o.closedAt).toISOString() : '' })),
        `nextradepro-trades-${Date.now()}.csv`,
      );
    }
  };

  return (
    <section className="mx-auto max-w-7xl px-4 pt-24 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">History</h1>
          <p className="mt-1 text-ink-soft">All account activity for your {mode.toLowerCase()} account.</p>
        </div>
        <button onClick={exportCsv} className="btn-ghost"><Download size={15} /> Export CSV</button>
      </div>

      {/* Tabs */}
      <div className="mt-5 inline-flex rounded-xl border border-white/10 bg-black/20 p-1">
        {([['TX', 'Transactions'], ['TRADES', 'Trades']] as const).map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)} className={cn('rounded-lg px-4 py-2 text-sm font-semibold transition', tab === t ? 'bg-brand-blue text-white' : 'text-ink-muted hover:text-ink')}>{l}</button>
        ))}
      </div>

      {/* Filters */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="input py-2 pl-9 text-sm" />
        </div>
        {tab === 'TX' ? (
          <>
            <select value={type} onChange={(e) => setType(e.target.value)} className="input max-w-[150px] py-2 text-sm">{TX_TYPES.map((t) => <option key={t} value={t}>{t === 'ALL' ? 'All types' : t.replace('_', ' ')}</option>)}</select>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="input max-w-[160px] py-2 text-sm">{TX_STATUS.map((s) => <option key={s} value={s}>{s === 'ALL' ? 'All statuses' : s.replace('_', ' ')}</option>)}</select>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input max-w-[150px] py-2 text-sm" />
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input max-w-[150px] py-2 text-sm" />
          </>
        ) : (
          <select value={tradeStatus} onChange={(e) => setTradeStatus(e.target.value)} className="input max-w-[160px] py-2 text-sm">{TRADE_STATUS.map((s) => <option key={s} value={s}>{s === 'ALL' ? 'All statuses' : s}</option>)}</select>
        )}
      </div>

      {/* Data — full tables on tablet/desktop, stacked cards on phones (no
          horizontal scrolling). */}
      {tab === 'TX' ? (
        <>
          {/* Desktop / tablet table */}
          <div className="card mt-4 hidden overflow-x-auto p-0 md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-white/10 text-left text-xs uppercase text-ink-muted">
                <tr><th className="px-4 py-3">Type</th><th className="px-4 py-3">Asset</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3">Reference</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Date</th><th className="px-4 py-3 text-right">Receipt</th></tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {(paged as Txn[]).map((t) => (
                  <tr key={t.id}>
                    <td className="px-4 py-3 font-medium text-white">{t.type.replace('_', ' ')}</td>
                    <td className="px-4 py-3 text-ink-soft">{t.asset}</td>
                    <td className="px-4 py-3 text-right font-mono text-white">{fmt(t.amount)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-muted">{t.reference ?? '—'}</td>
                    <td className="px-4 py-3"><span className={cn('badge', statusTone(t.status))}>{t.status}</span></td>
                    <td className="px-4 py-3 text-ink-muted">{new Date(t.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => downloadReceipt(t, user?.fullName ?? '')} className="btn-ghost px-2.5 py-1.5 text-xs"><ReceiptIcon size={13} /> PDF</button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-ink-muted">No transactions match your filters.</td></tr>}
              </tbody>
            </table>
          </div>
          {/* Phone cards */}
          <div className="mt-4 space-y-2 md:hidden">
            {(paged as Txn[]).map((t) => (
              <div key={t.id} className="card p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-white">{t.type.replace('_', ' ')}</span>
                  <span className={cn('badge', statusTone(t.status))}>{t.status}</span>
                </div>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-ink-muted">{t.asset}</div>
                    {t.reference && <div className="mt-0.5 truncate font-mono text-[11px] text-ink-faint">{t.reference}</div>}
                  </div>
                  <div className="shrink-0 font-mono font-semibold text-white">{fmt(t.amount)} <span className="text-xs font-normal text-ink-muted">{t.asset}</span></div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2.5">
                  <span className="text-xs text-ink-muted">{new Date(t.createdAt).toLocaleString()}</span>
                  <button onClick={() => downloadReceipt(t, user?.fullName ?? '')} className="btn-ghost px-2.5 py-1 text-xs"><ReceiptIcon size={12} /> PDF</button>
                </div>
              </div>
            ))}
            {rows.length === 0 && <div className="card py-10 text-center text-ink-muted">No transactions match your filters.</div>}
          </div>
        </>
      ) : (
        <>
          {/* Desktop / tablet table */}
          <div className="card mt-4 hidden overflow-x-auto p-0 md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-white/10 text-left text-xs uppercase text-ink-muted">
                <tr><th className="px-4 py-3">Pair</th><th className="px-4 py-3">Side</th><th className="px-4 py-3">Type</th><th className="px-4 py-3 text-right">Entry</th><th className="px-4 py-3 text-right">Exit</th><th className="px-4 py-3 text-right">Qty</th><th className="px-4 py-3 text-right">Lev</th><th className="px-4 py-3 text-right">P/L</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Duration</th></tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {(paged as Order[]).map((o) => {
                  const pnl = o.realizedPnl != null ? Number(o.realizedPnl) : null;
                  return (
                    <tr key={o.id}>
                      <td className="px-4 py-3 font-medium text-white">{o.symbol}</td>
                      <td className={cn('px-4 py-3 font-semibold', o.side === 'BUY' ? 'text-brand-emerald' : 'text-red-400')}>{o.side === 'BUY' ? 'Long' : 'Short'}</td>
                      <td className="px-4 py-3 text-ink-muted">{o.type.replace('_', ' ')}</td>
                      <td className="px-4 py-3 text-right font-mono text-ink-soft">{fmt(o.price)}</td>
                      <td className="px-4 py-3 text-right font-mono text-ink-soft">{fmt(o.closePrice)}</td>
                      <td className="px-4 py-3 text-right font-mono text-ink-soft">{fmt(o.amount)}</td>
                      <td className="px-4 py-3 text-right font-mono text-ink-muted">{o.leverage}x</td>
                      <td className={cn('px-4 py-3 text-right font-mono font-semibold', pnl == null ? 'text-ink-muted' : pnl >= 0 ? 'text-brand-emerald' : 'text-red-400')}>{pnl == null ? '—' : `${pnl >= 0 ? '+' : ''}${fmt(pnl)}`}</td>
                      <td className="px-4 py-3"><span className={cn('badge', statusTone(o.status))}>{o.status}</span></td>
                      <td className="px-4 py-3 text-right text-ink-muted">{dur(o.createdAt, o.closedAt)}</td>
                    </tr>
                  );
                })}
                {rows.length === 0 && <tr><td colSpan={10} className="px-4 py-10 text-center text-ink-muted">No trades match your filters.</td></tr>}
              </tbody>
            </table>
          </div>
          {/* Phone cards */}
          <div className="mt-4 space-y-2 md:hidden">
            {(paged as Order[]).map((o) => {
              const pnl = o.realizedPnl != null ? Number(o.realizedPnl) : null;
              return (
                <div key={o.id} className="card p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="font-semibold text-white">{o.symbol}</span>
                      <span className={cn('text-xs font-semibold', o.side === 'BUY' ? 'text-brand-emerald' : 'text-red-400')}>{o.side === 'BUY' ? 'Long' : 'Short'}</span>
                      <span className="text-[11px] text-ink-muted">{o.leverage}x</span>
                    </span>
                    <span className={cn('badge', statusTone(o.status))}>{o.status}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div><div className="text-ink-muted">Entry</div><div className="font-mono text-ink-soft">{fmt(o.price)}</div></div>
                    <div><div className="text-ink-muted">Exit</div><div className="font-mono text-ink-soft">{fmt(o.closePrice)}</div></div>
                    <div><div className="text-ink-muted">Qty</div><div className="font-mono text-ink-soft">{fmt(o.amount)}</div></div>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2.5">
                    <span className="text-xs text-ink-muted">{o.type.replace('_', ' ')} · {dur(o.createdAt, o.closedAt)}</span>
                    <span className={cn('font-mono font-semibold', pnl == null ? 'text-ink-muted' : pnl >= 0 ? 'text-brand-emerald' : 'text-red-400')}>{pnl == null ? '—' : `${pnl >= 0 ? '+' : ''}${fmt(pnl)}`}</span>
                  </div>
                </div>
              );
            })}
            {rows.length === 0 && <div className="card py-10 text-center text-ink-muted">No trades match your filters.</div>}
          </div>
        </>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn-ghost px-3 py-1.5 text-xs disabled:opacity-40">Prev</button>
          <span className="text-sm text-ink-muted">Page {page} of {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="btn-ghost px-3 py-1.5 text-xs disabled:opacity-40">Next</button>
        </div>
      )}
      <div className="h-16" />
    </section>
  );
}

export default function HistoryPage() {
  return (
    <main>
      <Navbar />
      <AuthGuard>
        <HistoryInner />
      </AuthGuard>
    </main>
  );
}
