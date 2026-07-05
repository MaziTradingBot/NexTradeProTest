'use client';

import Link from 'next/link';
import { Check, Minus } from 'lucide-react';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { cn } from '@/lib/utils';

const PLANS = [
  {
    name: 'Starter', price: 'Free', period: '', highlight: false,
    desc: 'Everything you need to start trading in demo mode.',
    features: [['Live market data', true], ['Spot trading (demo)', true], ['Basic charts', true], ['AI insights', false], ['Copy trading', false], ['Priority support', false]] as [string, boolean][],
    cta: 'Get started',
  },
  {
    name: 'Pro', price: '$29', period: '/mo', highlight: true,
    desc: 'Advanced tools for serious traders.',
    features: [['Live market data', true], ['Futures & leverage (demo)', true], ['TradingView charts', true], ['AI trade insights', true], ['Copy trading', true], ['Priority support', true]] as [string, boolean][],
    cta: 'Start Pro trial',
  },
  {
    name: 'Institutional', price: 'Custom', period: '', highlight: false,
    desc: 'For teams, funds and enterprises.',
    features: [['Everything in Pro', true], ['Dedicated infrastructure', true], ['Granular admin roles', true], ['Broker portal', true], ['Audit logs & SSO', true], ['SLA & account manager', true]] as [string, boolean][],
    cta: 'Contact sales',
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-bg text-[#E8F1FF]" style={{ fontFamily: "'Figtree', system-ui, sans-serif" }}>
      <MarketingNav />

      <section className="bg-gradient-to-b from-[#0F1D35] to-bg">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:py-20">
          <h1 className="text-4xl font-extrabold tracking-tight text-[#E8F1FF] sm:text-5xl">Simple, transparent pricing</h1>
          <p className="mt-4 text-lg text-[#A0BDD8]">Start free. Upgrade as you scale. Cancel anytime.</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={cn(
                'relative flex flex-col rounded-2xl border p-8',
                p.highlight ? 'border-[#0EA5E9] shadow-[0_24px_60px_-30px_rgba(26,86,255,0.5)]' : 'border-[#12233a] bg-bg-surface',
              )}
            >
              {p.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#0EA5E9] px-3 py-1 text-xs font-semibold text-white">Most popular</span>
              )}
              <h3 className="text-lg font-semibold text-[#E8F1FF]">{p.name}</h3>
              <div className="mt-3 flex items-end gap-1">
                <span className="text-4xl font-extrabold text-[#E8F1FF]">{p.price}</span>
                {p.period && <span className="mb-1 text-[#5E7A96]">{p.period}</span>}
              </div>
              <p className="mt-2 text-sm text-[#A0BDD8]">{p.desc}</p>
              <ul className="mt-6 flex-1 space-y-3">
                {p.features.map(([label, on]) => (
                  <li key={label} className={cn('flex items-start gap-2 text-sm', on ? 'text-[#E8F1FF]' : 'text-[#5E7A96]')}>
                    {on ? <Check size={16} className="mt-0.5 shrink-0 text-[#34D399]" /> : <Minus size={16} className="mt-0.5 shrink-0" />}
                    {label}
                  </li>
                ))}
              </ul>
              <Link
                href={p.name === 'Institutional' ? '/about' : '/register'}
                className={cn(
                  'mt-8 rounded-full px-6 py-3 text-center text-sm font-semibold transition',
                  p.highlight ? 'bg-[#0EA5E9] text-white hover:bg-[#0891D4]' : 'border border-[#12233a] text-[#E8F1FF] hover:border-[#0EA5E9] hover:text-[#0EA5E9]',
                )}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-[#5E7A96]">All plans include free demo trading with a $100,000 virtual balance.</p>
      </section>

      <MarketingFooter />
    </div>
  );
}
