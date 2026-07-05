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
    <div className="min-h-screen bg-white text-[#0a1633]" style={{ fontFamily: "'Figtree', system-ui, sans-serif" }}>
      <MarketingNav />

      <section className="bg-gradient-to-b from-[#f2f6ff] to-white">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:py-24">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-[#0a1633] sm:text-5xl">
            Building the future of <span className="text-[#1a56ff]">crypto trading</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-[#5b6b8c]">
            NexTradePro combines professional charts, AI-driven insights, copy trading and enterprise
            security into one clean platform. This build is a demonstration of world-class engineering
            and UX, using live market data and clearly labeled simulated trading.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {VALUES.map((v) => (
            <div key={v.title} className="rounded-2xl border border-[#e7ecf5] bg-white p-6">
              <div className="mb-4 inline-flex rounded-xl bg-[#eef3ff] p-3 text-[#1a56ff]"><v.icon size={22} /></div>
              <h3 className="font-semibold text-[#0a1633]">{v.title}</h3>
              <p className="mt-2 text-sm text-[#5b6b8c]">{v.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-[#f7f9fc]">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-14 sm:px-6 lg:grid-cols-4 lg:px-8">
          {[['2.4M+', 'Traders'], ['$48B+', 'Volume'], ['350+', 'Markets'], ['99.99%', 'Uptime']].map(([v, l]) => (
            <div key={l} className="text-center">
              <div className="text-3xl font-extrabold text-[#0a1633]">{v}</div>
              <div className="mt-1 text-sm text-[#5b6b8c]">{l}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6 lg:px-8">
        <h2 className="text-3xl font-extrabold tracking-tight text-[#0a1633]">Start trading in minutes</h2>
        <p className="mx-auto mt-3 max-w-lg text-[#5b6b8c]">Open a free demo account and explore everything the platform has to offer.</p>
        <Link href="/register" className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#1a56ff] px-7 py-3.5 text-base font-semibold text-white transition hover:bg-[#1246d6]">
          Get started free <ArrowRight size={18} />
        </Link>
      </section>

      <MarketingFooter />
    </div>
  );
}
