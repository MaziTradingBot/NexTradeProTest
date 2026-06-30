'use client';

import { useEffect, useState, useCallback } from 'react';
import { Check, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';

interface KycRow {
  id: string;
  email: string;
  fullName: string;
  createdAt: string;
}

export default function AdminKycPage() {
  const { user, hasPermission } = useAuth();
  const canApprove = user?.isSuperAdmin || hasPermission('kyc.approve');
  const [rows, setRows] = useState<KycRow[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await api.get<KycRow[]>('/api/admin/kyc'));
    } catch {
      setRows([]);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const review = async (id: string, decision: 'APPROVED' | 'REJECTED') => {
    try {
      await api.post(`/api/admin/kyc/${id}/review`, { decision });
      setToast(`KYC ${decision.toLowerCase()}`);
      setTimeout(() => setToast(null), 2500);
      load();
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Failed');
      setTimeout(() => setToast(null), 2500);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">KYC Review</h1>
      <p className="mt-1 text-slate-400">Approve or reject pending identity verifications.</p>

      <div className="card mt-6 overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-white/10 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-5 py-3">Applicant</th>
              <th className="px-5 py-3">Submitted</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-5 py-3.5">
                  <div className="font-medium text-white">{r.fullName}</div>
                  <div className="text-xs text-slate-500">{r.email}</div>
                </td>
                <td className="px-5 py-3.5 text-slate-400">{new Date(r.createdAt).toLocaleDateString()}</td>
                <td className="px-5 py-3.5 text-right">
                  {canApprove ? (
                    <div className="flex justify-end gap-2">
                      <button onClick={() => review(r.id, 'APPROVED')} className="rounded-lg bg-brand-emerald/15 px-3 py-1.5 text-xs font-semibold text-brand-emerald hover:bg-brand-emerald/25">
                        <Check size={14} className="inline" /> Approve
                      </button>
                      <button onClick={() => review(r.id, 'REJECTED')} className="rounded-lg bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/25">
                        <X size={14} className="inline" /> Reject
                      </button>
                    </div>
                  ) : (
                    <span className="badge bg-white/5 text-slate-400">View only</span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-5 py-10 text-center text-slate-500">
                  No pending KYC submissions.
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
