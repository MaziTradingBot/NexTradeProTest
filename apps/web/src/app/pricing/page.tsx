'use client';

import Link from 'next/link';
import { Check } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { cn } from '@/lib/utils';

const PLANS = [
  {
    name: 'Starter',
    price: 'Free',
    desc: 'Everything to start trading in demo mode.',
    features: ['Live market data', 'Spot trading (demo)', 'Basic charts', 'Email support'],
    cta: 'Get started',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '$29',
    period: '/mo',
    desc: 'Advanced tools for serious traders.',
    features: ['Everything in Starter', 'Futures & leverage (demo)', 'AI trade insights', 'Copy trading', 'Priority support'],
    cta: 'Start Pro trial',
    highlight: true,
  },
  {
    name: 'Institutional',
    price: 'Custom',
    desc: 'For teams, funds and enterprises.',
    features: ['Everything in Pro', 'Dedicated infrastructure', 'Granular admin roles', 'Audit logs & SSO', 'SLA & account manager'],
    cta: 'Contact sales',
    highlight: false,
  },
];

export default function PricingPage() {
  return (
    <main>
      <Navbar />
      <section className="mx-auto max-w-7xl px-4 pt-28 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-bold text-white sm:text-5xl">Simple, transparent pricing</h1>
          <p className="mt-4 text-slate-400">Start free. Upgrade as you scale. Cancel anytime.</p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={cn(
                'card relative flex flex-col',
                p.highlight && 'border-brand-blue/50 shadow-glow ring-1 ring-brand-blue/30',
              )}
            >
              {p.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-gradient px-3 py-1 text-xs font-semibold text-white">
                  Most popular
                </span>
              )}
              <h3 className="text-lg font-semibold text-white">{p.name}</h3>
              <div className="mt-3 flex items-end gap-1">
                <span className="text-4xl font-bold text-white">{p.price}</span>
                {p.period && <span className="mb-1 text-slate-400">{p.period}</span>}
              </div>
              <p className="mt-2 text-sm text-slate-400">{p.desc}</p>
              <ul className="mt-6 flex-1 space-y-3">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-300">
                    <Check size={16} className="mt-0.5 shrink-0 text-brand-emerald" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/register" className={cn('mt-8', p.highlight ? 'btn-primary' : 'btn-ghost')}>
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>
      <div className="h-20" />
      <Footer />
    </main>
  );
}
