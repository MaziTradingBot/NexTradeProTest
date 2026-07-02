'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Deposit {
  id: string;
  asset: string;
  amount: string;
  status: string;
  reference: string | null;
  createdAt: string;
  user: { email: string; fullName: string };
}

export default function AdminDepositsPage() {
  const [rows, setRows] = useState<Deposit[]>([]);

  useEffect(() => {
    api.get<Deposit[]>('/api/admin/deposits').then(setRows).catch(() => setRows([]));
  }, []);

  const total = rows
    .filter((r) => r.status === 'COMPLETED' || r.status === 'APPROVED')
    .reduce((s, r) => s + parseFloat(r.amount) * (r.asset === 'USDT' ? 1 : 0), 0);

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Deposits</h1>
      <p className="mt-1 text-slate-400">All incoming deposits across the platform.</p>

      <div className="card mt-6 mb-4 inline-block">
        <div className="text-sm text-slate-400">Total USDT deposited</div>
        <div className="text-2xl font-bold text-white">${total.toLocaleString()}</div>
      </div>

      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-white/10 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-5 py-3">Reference</th>
              <th className="px-5 py-3">User</th>
              <th className="px-5 py-3 text-right">Amount</th>
              <th className="px-5 py-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map((d) => (
              <tr key={d.id}>
                <td className="px-5 py-3.5 font-mono text-slate-300">{d.reference}</td>
                <td className="px-5 py-3.5">
                  <div className="font-medium text-white">{d.user.fullName}</div>
                  <div className="text-xs text-slate-500">{d.user.email}</div>
                </td>
                <td className="px-5 py-3.5 text-right font-mono text-white">
                  {parseFloat(d.amount).toLocaleString()} {d.asset}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <span className={cn('badge', d.status === 'COMPLETED' || d.status === 'APPROVED' ? 'bg-brand-emerald/15 text-brand-emerald' : 'bg-white/5 text-slate-400')}>
                    {d.status}
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-slate-500">
                  No deposits yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
