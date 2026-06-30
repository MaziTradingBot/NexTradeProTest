'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface AuditRow {
  id: string;
  action: string;
  target: string | null;
  createdAt: string;
  ip: string | null;
  actor: { email: string; fullName: string } | null;
}

export default function AdminAuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);

  useEffect(() => {
    api.get<AuditRow[]>('/api/admin/audit').then(setRows).catch(() => {});
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Audit Log</h1>
      <p className="mt-1 text-slate-400">Every administrative action is recorded for accountability.</p>

      <div className="card mt-6 overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-white/10 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-5 py-3">Action</th>
              <th className="px-5 py-3">Actor</th>
              <th className="px-5 py-3">Target</th>
              <th className="px-5 py-3 text-right">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-5 py-3">
                  <span className="badge bg-brand-blue/10 font-mono text-brand-blue">{r.action}</span>
                </td>
                <td className="px-5 py-3 text-slate-300">{r.actor?.fullName ?? 'System'}</td>
                <td className="px-5 py-3 font-mono text-xs text-slate-500">{r.target ?? '—'}</td>
                <td className="px-5 py-3 text-right text-slate-400">{new Date(r.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-slate-500">
                  No audit entries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
