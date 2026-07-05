'use client';

import { useEffect, useState, useCallback } from 'react';
import { X, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { cn } from '@/lib/utils';

interface Withdrawal {
  id: string;
  asset: string;
  amount: string;
  fee: string;
  network: string | null;
  address: string | null;
  status: string;
  note: string | null;
  reference: string | null;
  mode: string;
  createdAt: string;
  user: { email: string; fullName: string };
}

const TABS = ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'PROCESSING', 'COMPLETED', 'REJECTED', 'ALL'] as const;
const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-brand-gold/15 text-brand-gold',
  UNDER_REVIEW: 'bg-brand-blue/15 text-brand-blue',
  APPROVED: 'bg-brand-emerald/15 text-brand-emerald',
  PROCESSING: 'bg-brand-blue/15 text-brand-blue',
  COMPLETED: 'bg-brand-emerald/15 text-brand-emerald',
  REJECTED: 'bg-red-500/15 text-red-400',
};
// The forward flow + the terminal reject action available at each stage.
const NEXT: Record<string, string[]> = {
  PENDING: ['UNDER_REVIEW', 'REJECTED'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED'],
  APPROVED: ['PROCESSING', 'REJECTED'],
  PROCESSING: ['COMPLETED'],
  COMPLETED: [],
  REJECTED: [],
};
const label = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace('_', ' ');

export default function AdminWithdrawalsPage() {
  const { user, hasPermission } = useAuth();
  const canApprove = user?.isSuperAdmin || hasPermission('withdrawals.approve');
  const [tab, setTab] = useState<(typeof TABS)[number]>('PENDING');
  const [rows, setRows] = useState<Withdrawal[]>([]);
  const [sel, setSel] = useState<Withdrawal | null>(null);
  const [note, setNote] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async (status: string) => {
    try {
      setRows(await api.get<Withdrawal[]>(`/api/admin/withdrawals?status=${status}`));
    } catch {
      setRows([]);
    }
  }, []);
  useEffect(() => {
    load(tab);
  }, [tab, load]);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2500);
  };

  const setStatus = async (id: string, status: string) => {
    try {
      await api.post(`/api/admin/withdrawals/${id}/status`, { status, note: note || undefined });
      flash(`Marked ${label(status)}`);
      setSel(null);
      setNote('');
      load(tab);
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Failed');
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Withdrawal Requests</h1>
      <p className="mt-1 text-slate-400">Move requests through the approval flow and add internal notes.</p>

      <div className="mt-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn('rounded-xl px-3.5 py-2 text-xs font-medium transition', tab === t ? 'bg-brand-gradient text-white' : 'bg-white/5 text-slate-400 hover:text-white')}
          >
            {t === 'ALL' ? 'All' : label(t)}
          </button>
        ))}
      </div>

      <div className="card mt-4 overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-white/10 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">Reference</th>
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">Network</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((w) => (
                <tr key={w.id} onClick={() => { setSel(w); setNote(w.note ?? ''); }} className="cursor-pointer hover:bg-white/[0.03]">
                  <td className="px-5 py-3.5 font-mono text-xs text-slate-300">{w.reference}</td>
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-white">{w.user.fullName}</div>
                    <div className="text-xs text-slate-500">{w.user.email}</div>
                  </td>
                  <td className="px-5 py-3.5 text-slate-400">{w.network ?? '—'}</td>
                  <td className="px-5 py-3.5 text-right font-mono text-white">{parseFloat(w.amount).toLocaleString()} {w.asset}</td>
                  <td className="px-5 py-3.5 text-center"><span className={cn('badge', STATUS_STYLES[w.status])}>{label(w.status)}</span></td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-500">No withdrawals here.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review drawer */}
      {sel && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm" onClick={() => setSel(null)}>
          <div className="h-full w-full max-w-md overflow-y-auto border-l border-white/10 bg-bg-surface p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Withdrawal</h2>
                <p className="font-mono text-xs text-slate-500">{sel.reference}</p>
              </div>
              <button onClick={() => setSel(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5"><X size={18} /></button>
            </div>

            <div className="mt-4 space-y-2 rounded-xl bg-white/5 p-4 text-sm">
              {[
                ['User', sel.user.fullName], ['Email', sel.user.email], ['Mode', sel.mode],
                ['Amount', `${parseFloat(sel.amount).toLocaleString()} ${sel.asset}`],
                ['Network fee', `${parseFloat(sel.fee).toLocaleString()} ${sel.asset}`],
                ['Net received', `${(parseFloat(sel.amount) - parseFloat(sel.fee)).toLocaleString()} ${sel.asset}`],
                ['Network', sel.network ?? '—'], ['Address', sel.address ?? '—'],
                ['Requested', new Date(sel.createdAt).toLocaleString()],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <span className="text-slate-400">{k}</span>
                  <span className="max-w-[60%] truncate text-right font-mono text-white">{v}</span>
                </div>
              ))}
              <div className="flex justify-between pt-1">
                <span className="text-slate-400">Status</span>
                <span className={cn('badge', STATUS_STYLES[sel.status])}>{label(sel.status)}</span>
              </div>
            </div>

            {/* Status flow */}
            <div className="mt-5 flex flex-wrap items-center gap-1.5 text-[11px]">
              {['PENDING', 'UNDER_REVIEW', 'APPROVED', 'PROCESSING', 'COMPLETED'].map((s, i, arr) => (
                <span key={s} className="flex items-center gap-1.5">
                  <span className={cn('rounded-md px-2 py-1 font-medium', s === sel.status ? 'bg-brand-gradient text-white' : 'bg-white/5 text-slate-500')}>{label(s)}</span>
                  {i < arr.length - 1 && <ArrowRight size={11} className="text-slate-600" />}
                </span>
              ))}
            </div>

            {canApprove && sel.status !== 'COMPLETED' && sel.status !== 'REJECTED' && (
              <div className="mt-5">
                <label className="label">Internal note (optional)</label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="input mb-3" placeholder="Visible to admins only…" />
                <div className="flex flex-wrap gap-2">
                  {NEXT[sel.status]?.map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatus(sel.id, s)}
                      className={cn('rounded-lg px-3 py-2 text-xs font-semibold', s === 'REJECTED' ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25' : 'bg-brand-gradient text-white hover:brightness-110')}
                    >
                      Mark {label(s)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {sel.note && (
              <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-300">
                <div className="mb-1 text-xs font-medium uppercase text-slate-500">Note</div>
                {sel.note}
              </div>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-xl border border-white/10 bg-bg-elevated px-4 py-2.5 text-sm text-white shadow-card">{toast}</div>
      )}
    </div>
  );
}
