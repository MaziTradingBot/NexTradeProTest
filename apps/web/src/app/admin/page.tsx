'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, ArrowDownToLine, BadgeCheck, Receipt, Banknote, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { formatCompact } from '@/lib/utils';

interface Overview {
  users: number;
  pendingWithdrawals: number;
  pendingKyc: number;
  totalOrders: number;
  totalDeposits: number | string;
}

export default function AdminOverview() {
  const { user } = useAuth();
  const [data, setData] = useState<Overview | null>(null);

  useEffect(() => {
    api.get<Overview>('/api/admin/overview').then(setData).catch(() => {});
  }, []);

  const cards = [
    { label: 'Total users', value: data?.users ?? '—', icon: Users, href: '/admin/users' },
    { label: 'Pending withdrawals', value: data?.pendingWithdrawals ?? '—', icon: ArrowDownToLine, href: '/admin/withdrawals' },
    { label: 'Pending KYC', value: data?.pendingKyc ?? '—', icon: BadgeCheck, href: '/admin/kyc' },
    { label: 'Total orders', value: data?.totalOrders ?? '—', icon: Receipt, href: '/admin/users' },
    { label: 'Total deposits', value: data ? `$${formatCompact(Number(data.totalDeposits))}` : '—', icon: Banknote, href: '/admin/withdrawals' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Admin Overview</h1>
      <p className="mt-1 text-slate-400">
        Signed in as <span className="text-white">{user?.fullName}</span> ·{' '}
        {user?.roles.map((r) => r.name).join(', ')}
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="card group transition hover:border-brand-blue/40 hover:shadow-glow">
            <div className="flex items-center justify-between">
              <div className="inline-flex rounded-xl bg-brand-gradient p-2.5 text-white">
                <c.icon size={20} />
              </div>
              <ArrowRight size={16} className="text-slate-600 transition group-hover:translate-x-1 group-hover:text-white" />
            </div>
            <div className="mt-4 text-3xl font-bold text-white">{c.value}</div>
            <div className="mt-1 text-sm text-slate-400">{c.label}</div>
          </Link>
        ))}
      </div>

      <div className="card mt-6">
        <h2 className="font-semibold text-white">Your admin capabilities</h2>
        <p className="mt-1 text-sm text-slate-400">
          Modules are shown based on the permissions granted to your assigned role(s).
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {user?.isSuperAdmin ? (
            <span className="badge bg-brand-gold/15 text-brand-gold">Full access (Super Admin)</span>
          ) : (
            user?.permissions.map((p) => (
              <span key={p} className="badge bg-white/5 font-mono text-slate-300">
                {p}
              </span>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
