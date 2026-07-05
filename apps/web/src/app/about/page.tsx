'use client';

import Link from 'next/link';
import { ArrowRight, Zap, ShieldCheck, Globe, Users } from 'lucide-react';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';

const VALUES = [
  { icon: Zap, title: 'Performance first', desc: 'Sub-second data and a UI that stays out of your way.' },
  { icon: ShieldCheck, title: 'Security by design', desc: 'Granular roles, 2FA, KYC and audit logging throughout.' },
  { icon: Globe, title: 'Global access', desc: '350+ markets with institutional-grade live pricing.' },
  { icon: Users, title: 'Built for everyone', desc: 'From first-time traders to professional desks.' },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-bg text-[#E8F1FF]" style={{ fontFamily: "'Figtree', system-ui, sans-serif" }}>
      <MarketingNav />

      <section className="bg-gradient-to-b from-[#0F1D35] to-bg">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:py-24">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-[#E8F1FF] sm:text-5xl">
            Building the future of <span className="text-[#0EA5E9]">crypto trading</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-[#A0BDD8]">
            NexTradePro combines professional charts, AI-driven insights, copy trading and enterprise
            security into one clean platform. This build is a demonstration of world-class engineering
            and UX, using live market data and clearly labeled simulated trading.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {VALUES.map((v) => (
            <div key={v.title} className="rounded-2xl border border-[#12233a] bg-bg-surface p-6">
              <div className="mb-4 inline-flex rounded-xl bg-[#0F1D35] p-3 text-[#0EA5E9]"><v.icon size={22} /></div>
              <h3 className="font-semibold text-[#E8F1FF]">{v.title}</h3>
              <p className="mt-2 text-sm text-[#A0BDD8]">{v.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-[#080F1C]">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-14 sm:px-6 lg:grid-cols-4 lg:px-8">
          {[['2.4M+', 'Traders'], ['$48B+', 'Volume'], ['350+', 'Markets'], ['99.99%', 'Uptime']].map(([v, l]) => (
            <div key={l} className="text-center">
              <div className="text-3xl font-extrabold text-[#E8F1FF]">{v}</div>
              <div className="mt-1 text-sm text-[#A0BDD8]">{l}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6 lg:px-8">
        <h2 className="text-3xl font-extrabold tracking-tight text-[#E8F1FF]">Start trading in minutes</h2>
        <p className="mx-auto mt-3 max-w-lg text-[#A0BDD8]">Open a free demo account and explore everything the platform has to offer.</p>
        <Link href="/register" className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#0EA5E9] px-7 py-3.5 text-base font-semibold text-white transition hover:bg-[#0891D4]">
          Get started free <ArrowRight size={18} />
        </Link>
      </section>

      <MarketingFooter />
    </div>
  );
}
