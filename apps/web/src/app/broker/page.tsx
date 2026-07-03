'use client';

import { useEffect, useState } from 'react';
import { Briefcase, Users, DollarSign, TrendingUp, BadgeCheck, X } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { AuthGuard } from '@/components/AuthGuard';
import { api } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';

interface Overview {
  totalClients: number;
  verifiedClients: number;
  aum: number;
  totalTrades: number;
  commission: number;
}
interface Client {
  id: string;
  email: string;
  fullName: string;
  status: string;
  kycStatus: string;
  createdAt: string;
  lastLoginAt: string | null;
  portfolioUsd: number;
  trades: number;
}
interface ClientDetail {
  id: string;
  fullName: string;
  email: string;
  kycStatus: string;
  portfolioUsd: number;
  wallets: { id: string; asset: string; balance: string }[];
  orders: { id: string; symbol: string; side: string; price: string; amount: string; status: string; createdAt: string }[];
}

function BrokerInner() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [detail, setDetail] = useState<ClientDetail | null>(null);

  useEffect(() => {
    api.get<Overview>('/api/broker/overview').then(setOverview).catch(() => {});
    api.get<Client[]>('/api/broker/clients').then(setClients).catch(() => {});
  }, []);

  const openClient = (id: string) => {
    api.get<ClientDetail>(`/api/broker/clients/${id}`).then(setDetail).catch(() => {});
  };

  const stats = [
    { label: 'Clients', value: overview?.totalClients ?? '—', icon: Users },
    { label: 'Assets under mgmt', value: overview ? formatCurrency(overview.aum) : '—', icon: DollarSign },
    { label: 'Total trades', value: overview?.totalTrades ?? '—', icon: TrendingUp },
    { label: 'Commission (demo)', value: overview ? formatCurrency(overview.commission) : '—', icon: Briefcase },
  ];

  return (
    <section className="mx-auto max-w-6xl px-4 pt-24 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <div className="inline-flex rounded-2xl bg-brand-gradient p-3 text-white">
          <Briefcase size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Broker Portal</h1>
          <p className="text-slate-400">Manage your assigned clients and track performance.</p>
        </div>
        <span className="ml-auto badge bg-brand-gold/10 text-brand-gold">Demo data</span>
      </div>

      {/* Stats */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <s.icon size={15} /> {s.label}
            </div>
            <div className="mt-2 text-2xl font-bold text-white">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Clients */}
      <div className="card mt-6 p-0">
        <div className="border-b border-white/10 px-5 py-3">
          <h2 className="font-semibold text-white">Clients</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-2">Client</th>
                <th className="px-5 py-2 text-right">Portfolio</th>
                <th className="px-5 py-2 text-right">Trades</th>
                <th className="px-5 py-2 text-center">KYC</th>
                <th className="px-5 py-2 text-right">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {clients.map((c) => (
                <tr key={c.id} onClick={() => openClient(c.id)} className="cursor-pointer hover:bg-white/[0.03]">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-gradient text-xs font-bold text-white">
                        {c.fullName.charAt(0)}
                      </div>
                      <div>
                        <div className="font-medium text-white">{c.fullName}</div>
                        <div className="text-xs text-slate-500">{c.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-white">{formatCurrency(c.portfolioUsd)}</td>
                  <td className="px-5 py-3 text-right text-slate-300">{c.trades}</td>
                  <td className="px-5 py-3 text-center">
                    <span className={cn('badge', c.kycStatus === 'APPROVED' ? 'bg-brand-emerald/15 text-brand-emerald' : c.kycStatus === 'PENDING' ? 'bg-brand-gold/15 text-brand-gold' : 'bg-white/5 text-slate-400')}>
                      {c.kycStatus === 'APPROVED' && <BadgeCheck size={11} />} {c.kycStatus}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right text-slate-400">{new Date(c.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {clients.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-500">
                    No clients assigned yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Client detail drawer */}
      {detail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm" onClick={() => setDetail(null)}>
          <div className="h-full w-full max-w-md overflow-y-auto border-l border-white/10 bg-bg-surface p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">{detail.fullName}</h2>
                <p className="text-sm text-slate-400">{detail.email}</p>
              </div>
              <button onClick={() => setDetail(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5">
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 rounded-xl bg-white/5 p-4">
              <div className="text-xs text-slate-500">Portfolio value</div>
              <div className="text-2xl font-bold text-white">{formatCurrency(detail.portfolioUsd)}</div>
            </div>

            <h3 className="mt-5 mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Wallets</h3>
            <div className="space-y-1.5">
              {detail.wallets.map((w) => (
                <div key={w.id} className="flex justify-between rounded-lg bg-white/5 px-3 py-2 text-sm">
                  <span className="text-slate-300">{w.asset}</span>
                  <span className="font-mono text-white">{parseFloat(w.balance).toLocaleString()}</span>
                </div>
              ))}
            </div>

            <h3 className="mt-5 mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Recent trades</h3>
            <div className="space-y-1.5">
              {detail.orders.map((o) => (
                <div key={o.id} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm">
                  <span className="text-white">{o.symbol}</span>
                  <span className={cn('text-xs font-medium', o.side === 'BUY' ? 'text-brand-emerald' : 'text-red-400')}>{o.side}</span>
                  <span className="font-mono text-slate-400">{parseFloat(o.amount)}</span>
                </div>
              ))}
              {detail.orders.length === 0 && <p className="text-sm text-slate-500">No trades yet.</p>}
            </div>
          </div>
        </div>
      )}
      <div className="h-16" />
    </section>
  );
}

export default function BrokerPage() {
  return (
    <main>
      <Navbar />
      <AuthGuard brokerOnly>
        <BrokerInner />
      </AuthGuard>
    </main>
  );
}
