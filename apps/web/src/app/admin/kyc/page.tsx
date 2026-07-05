'use client';

import { useEffect, useState, useCallback } from 'react';
import { Check, X, FileText, Eye } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';

interface Submission {
  fullName: string;
  country: string;
  idType: string;
  idNumber: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  dob: string;
  documentName: string | null;
  documentType: string | null;
  documentData: string | null;
  createdAt: string;
}
interface KycRow {
  id: string;
  email: string;
  fullName: string;
  createdAt: string;
  submission: Submission | null;
}

export default function AdminKycPage() {
  const { user, hasPermission } = useAuth();
  const canApprove = user?.isSuperAdmin || hasPermission('kyc.approve');
  const [rows, setRows] = useState<KycRow[]>([]);
  const [sel, setSel] = useState<KycRow | null>(null);
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
      setSel(null);
      load();
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Failed');
      setTimeout(() => setToast(null), 2500);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">KYC Review</h1>
      <p className="mt-1 text-slate-400">Review submitted documents and approve or reject verifications.</p>

      <div className="card mt-6 overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-white/10 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-5 py-3">Applicant</th>
              <th className="px-5 py-3">Document</th>
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
                <td className="px-5 py-3.5">
                  {r.submission?.documentData ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-brand-emerald"><FileText size={13} /> {r.submission.documentName ?? 'Uploaded'}</span>
                  ) : (
                    <span className="text-xs text-slate-500">No document</span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-slate-400">{new Date(r.createdAt).toLocaleDateString()}</td>
                <td className="px-5 py-3.5 text-right">
                  <button onClick={() => setSel(r)} className="btn-ghost px-3 py-1.5 text-xs"><Eye size={14} /> Review</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={4} className="px-5 py-10 text-center text-slate-500">No pending KYC submissions.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Review drawer */}
      {sel && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm" onClick={() => setSel(null)}>
          <div className="h-full w-full max-w-lg overflow-y-auto border-l border-white/10 bg-bg-surface p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">{sel.fullName}</h2>
                <p className="text-sm text-slate-400">{sel.email}</p>
              </div>
              <button onClick={() => setSel(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5"><X size={18} /></button>
            </div>

            {sel.submission ? (
              <>
                <div className="mt-5 space-y-2 rounded-xl bg-white/5 p-4 text-sm">
                  {[
                    ['Legal name', sel.submission.fullName],
                    ['Country', sel.submission.country],
                    ['Date of birth', sel.submission.dob],
                    ['Document type', sel.submission.idType.replace('_', ' ')],
                    ['Address line 1', sel.submission.addressLine1 ?? sel.submission.idNumber ?? '—'],
                    ['Address line 2', sel.submission.addressLine2 ?? '—'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3"><span className="text-slate-400">{k}</span><span className="text-right text-white">{v}</span></div>
                  ))}
                </div>

                <div className="mt-4">
                  <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Uploaded document</div>
                  {sel.submission.documentData ? (
                    sel.submission.documentType?.startsWith('image/') ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={sel.submission.documentData} alt="ID document" className="w-full rounded-xl border border-white/10" />
                    ) : (
                      <a href={sel.submission.documentData} target="_blank" rel="noreferrer" download={sel.submission.documentName ?? 'document.pdf'} className="btn-ghost w-full">
                        <FileText size={15} /> Open {sel.submission.documentName ?? 'PDF document'}
                      </a>
                    )
                  ) : (
                    <p className="text-sm text-slate-500">No document was uploaded.</p>
                  )}
                </div>
              </>
            ) : (
              <p className="mt-5 text-sm text-slate-500">No submission details found.</p>
            )}

            {canApprove && (
              <div className="mt-6 flex gap-2">
                <button onClick={() => review(sel.id, 'APPROVED')} className="flex-1 rounded-xl bg-brand-emerald/15 py-2.5 text-sm font-semibold text-brand-emerald hover:bg-brand-emerald/25">
                  <Check size={15} className="inline" /> Approve
                </button>
                <button onClick={() => review(sel.id, 'REJECTED')} className="flex-1 rounded-xl bg-red-500/15 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-500/25">
                  <X size={15} className="inline" /> Reject
                </button>
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
