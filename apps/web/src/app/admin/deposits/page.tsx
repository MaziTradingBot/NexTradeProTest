'use client';

import { useEffect, useState, useCallback } from 'react';
import { Check, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { cn } from '@/lib/utils';

interface Deposit {
  id: string;
  asset: string;
  amount: string;
  status: string;
  reference: string | null;
  note: string | null;
  mode: string;
  createdAt: string;
  user: { email: string; fullName: string };
}

export default function AdminDepositsPage() {
  const { user, hasPermission } = useAuth();
  const canManage = user?.isSuperAdmin || hasPermission('deposits.manage');
  const [rows, setRows] = useState<Deposit[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(() => {
    api.get<Deposit[]>('/api/admin/deposits').then(setRows).catch(() => setRows([]));
  }, []);
  useEffect(load, [load]);

  const review = async (id: string, decision: 'APPROVED' | 'REJECTED') => {
    try {
      await api.post(`/api/admin/deposits/${id}/review`, { decision });
      setToast(`Deposit ${decision.toLowerCase()}`);
      setTimeout(() => setToast(null), 2500);
      load();
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Failed');
      setTimeout(() => setToast(null), 2500);
    }
  };

  const pending = rows.filter((r) => r.status === 'PENDING');
  const total = rows
    .filter((r) => r.status === 'COMPLETED' || r.status === 'APPROVED')
    .reduce((s, r) => s + parseFloat(r.amount) * (r.asset === 'USDT' ? 1 : 0), 0);

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Deposits</h1>
      <p className="mt-1 text-slate-400">Review deposit &amp; demo top-up requests, and see completed deposits.</p>

      <div className="mt-6 mb-4 flex gap-3">
        <div className="card inline-block">
          <div className="text-sm text-slate-400">Total USDT deposited</div>
          <div className="text-2xl font-bold text-white">${total.toLocaleString()}</div>
        </div>
        <div className="card inline-block">
          <div className="text-sm text-slate-400">Pending requests</div>
          <div className="text-2xl font-bold text-brand-gold">{pending.length}</div>
        </div>
      </div>

      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-white/10 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-5 py-3">Reference</th>
              <th className="px-5 py-3">User</th>
              <th className="px-5 py-3 text-right">Amount</th>
              <th className="px-5 py-3 text-center">Mode</th>
              <th className="px-5 py-3 text-right">Status / Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map((d) => (
              <tr key={d.id}>
                <td className="px-5 py-3.5">
                  <div className="font-mono text-slate-300">{d.reference}</div>
                  {d.note && <div className="text-xs text-slate-500">{d.note}</div>}
                </td>
                <td className="px-5 py-3.5">
                  <div className="font-medium text-white">{d.user.fullName}</div>
                  <div className="text-xs text-slate-500">{d.user.email}</div>
                </td>
                <td className="px-5 py-3.5 text-right font-mono text-white">
                  {parseFloat(d.amount).toLocaleString()} {d.asset}
                </td>
                <td className="px-5 py-3.5 text-center">
                  <span className={cn('badge', d.mode === 'DEMO' ? 'bg-brand-emerald/15 text-brand-emerald' : 'bg-brand-blue/15 text-brand-blue')}>{d.mode}</span>
                </td>
                <td className="px-5 py-3.5 text-right">
                  {d.status === 'PENDING' && canManage ? (
                    <div className="flex justify-end gap-2">
                      <button onClick={() => review(d.id, 'APPROVED')} className="rounded-lg bg-brand-emerald/15 px-3 py-1.5 text-xs font-semibold text-brand-emerald hover:bg-brand-emerald/25">
                        <Check size={14} className="inline" /> Approve
                      </button>
                      <button onClick={() => review(d.id, 'REJECTED')} className="rounded-lg bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/25">
                        <X size={14} className="inline" /> Reject
                      </button>
                    </div>
                  ) : (
                    <span className={cn('badge', d.status === 'COMPLETED' || d.status === 'APPROVED' ? 'bg-brand-emerald/15 text-brand-emerald' : d.status === 'REJECTED' ? 'bg-red-500/15 text-red-400' : 'bg-brand-gold/15 text-brand-gold')}>
                      {d.status}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-slate-500">
                  No deposits yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-xl border border-white/10 bg-bg-elevated px-4 py-2.5 text-sm text-white shadow-card">
          {toast}
        </div>
      )}
    </div>
  );
}
