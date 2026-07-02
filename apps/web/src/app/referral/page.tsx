'use client';

import { useEffect, useState } from 'react';
import { Copy, Gift, Users, DollarSign, Award, Check } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { AuthGuard } from '@/components/AuthGuard';
import { api, API_BASE } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';

interface ReferralData {
  code: string;
  totalReferrals: number;
  activeReferrals: number;
  earnings: number;
  tier: { name: string; rate: string };
  tiers: { name: string; min: number; rate: string }[];
  referrals: { name: string; email: string; joined: string; verified: boolean }[];
}

export default function ReferralPage() {
  return (
    <main>
      <Navbar />
      <AuthGuard>
        <ReferralInner />
      </AuthGuard>
    </main>
  );
}

function ReferralInner() {
  const [data, setData] = useState<ReferralData | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.get<ReferralData>('/api/account/referral').then(setData).catch(() => {});
  }, []);

  // Point the share link at the site origin (fallback to API base for demo).
  const origin = typeof window !== 'undefined' ? window.location.origin : API_BASE;
  const link = data ? `${origin}/register?ref=${data.code}` : '';

  const copy = () => {
    navigator.clipboard?.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const stats = [
    { label: 'Total referrals', value: data?.totalReferrals ?? '—', icon: Users },
    { label: 'Active (verified)', value: data?.activeReferrals ?? '—', icon: Check },
    { label: 'Earnings', value: data ? formatCurrency(data.earnings) : '—', icon: DollarSign },
    { label: 'Tier', value: data?.tier.name ?? '—', icon: Award },
  ];

  return (
    <section className="mx-auto max-w-5xl px-4 pt-24 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <div className="inline-flex rounded-2xl bg-brand-gradient p-3 text-white">
          <Gift size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Refer &amp; Earn</h1>
          <p className="text-slate-400">Invite friends and earn commission on their activity.</p>
        </div>
      </div>

      {/* Share link */}
      <div className="card mt-6">
        <label className="label">Your referral link</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input readOnly value={link} className="input font-mono text-sm" />
          <button onClick={copy} className="btn-primary whitespace-nowrap">
            {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
        <div className="mt-3 text-sm text-slate-400">
          Referral code: <span className="font-mono font-semibold text-white">{data?.code ?? '…'}</span>
        </div>
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

      {/* Tiers */}
      <div className="card mt-6">
        <h2 className="mb-4 font-semibold text-white">Commission tiers</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {data?.tiers.map((t) => {
            const isCurrent = data.tier.name === t.name;
            return (
              <div
                key={t.name}
                className={cn('rounded-xl border p-4', isCurrent ? 'border-brand-blue/50 bg-brand-blue/10' : 'border-white/10 bg-white/5')}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">{t.name}</span>
                  {isCurrent && <span className="badge bg-brand-blue/20 text-brand-blue">Current</span>}
                </div>
                <div className="mt-1 text-2xl font-bold gradient-text">{t.rate}</div>
                <div className="text-xs text-slate-500">{t.min}+ referrals</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Referred users */}
      <div className="card mt-6">
        <h2 className="mb-4 font-semibold text-white">Your referrals</h2>
        {data && data.referrals.length > 0 ? (
          <div className="divide-y divide-white/5">
            {data.referrals.map((r, i) => (
              <div key={i} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-gradient text-xs font-bold text-white">
                    {r.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">{r.name}</div>
                    <div className="text-xs text-slate-500">{r.email}</div>
                  </div>
                </div>
                <span className={cn('badge', r.verified ? 'bg-brand-emerald/15 text-brand-emerald' : 'bg-white/5 text-slate-400')}>
                  {r.verified ? 'Verified' : 'Pending'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No referrals yet — share your link to start earning.</p>
        )}
      </div>
      <div className="h-16" />
    </section>
  );
}
