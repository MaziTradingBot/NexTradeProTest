'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { Users, ArrowDownToLine, BadgeCheck, Receipt, Banknote, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { formatCompact, formatCurrency } from '@/lib/utils';

interface Overview {
  users: number;
  pendingWithdrawals: number;
  pendingKyc: number;
  totalOrders: number;
  totalDeposits: number | string;
}

interface SeriesPoint {
  date: string;
  signups: number;
  revenue: number;
}

export default function AdminOverview() {
  const { user, hasPermission } = useAuth();
  const [data, setData] = useState<Overview | null>(null);
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  const canAnalytics = user?.isSuperAdmin || hasPermission('admin.analytics.view');

  useEffect(() => {
    api.get<Overview>('/api/admin/overview').then(setData).catch(() => {});
    if (canAnalytics) {
      api.get<{ series: SeriesPoint[] }>('/api/admin/analytics?days=14').then((d) => setSeries(d.series)).catch(() => {});
    }
  }, [canAnalytics]);

  const shortDate = (s: string) => s.slice(5); // MM-DD

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

      {canAnalytics && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="card">
            <h2 className="mb-4 font-semibold text-white">Revenue (14d)</h2>
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series}>
                  <defs>
                    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00C896" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#00C896" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={20} />
                  <Tooltip
                    contentStyle={{ background: '#0F1622', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }}
                    formatter={(v: number) => [formatCurrency(v), 'Revenue']}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#00C896" strokeWidth={2} fill="url(#rev)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="card">
            <h2 className="mb-4 font-semibold text-white">New signups (14d)</h2>
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series}>
                  <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={20} />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                    contentStyle={{ background: '#0F1622', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }}
                    formatter={(v: number) => [v, 'Signups']}
                  />
                  <Bar dataKey="signups" fill="#0B6EFF" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

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
