'use client';

import { useEffect, useState, useCallback } from 'react';
import { Check, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { cn } from '@/lib/utils';

interface Withdrawal {
  id: string;
  asset: string;
  amount: string;
  status: string;
  reference: string | null;
  createdAt: string;
  user: { email: string; fullName: string };
}

export default function AdminWithdrawalsPage() {
  const { user, hasPermission } = useAuth();
  const canApprove = user?.isSuperAdmin || hasPermission('withdrawals.approve');
  const [tab, setTab] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [rows, setRows] = useState<Withdrawal[]>([]);
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

  const review = async (id: string, decision: 'APPROVED' | 'REJECTED') => {
    try {
      await api.post(`/api/admin/withdrawals/${id}/review`, { decision });
      setToast(`Withdrawal ${decision.toLowerCase()}`);
      setTimeout(() => setToast(null), 2500);
      load(tab);
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Failed');
      setTimeout(() => setToast(null), 2500);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Withdrawal Requests</h1>
      <p className="mt-1 text-slate-400">Review and approve or reject user withdrawal requests.</p>

      <div className="mt-6 flex gap-2">
        {(['PENDING', 'APPROVED', 'REJECTED'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'rounded-xl px-4 py-2 text-sm font-medium transition',
              tab === t ? 'bg-brand-gradient text-white' : 'bg-white/5 text-slate-400 hover:text-white',
            )}
          >
            {t.charAt(0) + t.slice(1).toLowerCase()}
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
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((w) => (
                <tr key={w.id}>
                  <td className="px-5 py-3.5 font-mono text-slate-300">{w.reference}</td>
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-white">{w.user.fullName}</div>
                    <div className="text-xs text-slate-500">{w.user.email}</div>
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-white">
                    {parseFloat(w.amount).toLocaleString()} {w.asset}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {tab === 'PENDING' && canApprove ? (
                      <div className="flex justify-end gap-2">
                        <button onClick={() => review(w.id, 'APPROVED')} className="rounded-lg bg-brand-emerald/15 px-3 py-1.5 text-xs font-semibold text-brand-emerald hover:bg-brand-emerald/25">
                          <Check size={14} className="inline" /> Approve
                        </button>
                        <button onClick={() => review(w.id, 'REJECTED')} className="rounded-lg bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/25">
                          <X size={14} className="inline" /> Reject
                        </button>
                      </div>
                    ) : (
                      <span className={cn('badge', w.status === 'APPROVED' ? 'bg-brand-emerald/15 text-brand-emerald' : w.status === 'REJECTED' ? 'bg-red-500/15 text-red-400' : 'bg-white/5 text-slate-400')}>
                        {w.status}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-slate-500">
                    No {tab.toLowerCase()} withdrawals.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-xl border border-white/10 bg-bg-elevated px-4 py-2.5 text-sm text-white shadow-card">
          {toast}
        </div>
      )}
    </div>
  );
}
