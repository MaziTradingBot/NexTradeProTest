'use client';

import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { ShieldCheck, Globe, Zap, Users } from 'lucide-react';

const VALUES = [
  { icon: Zap, title: 'Performance first', desc: 'Sub-second data and a UI that never gets in your way.' },
  { icon: ShieldCheck, title: 'Security by design', desc: 'Granular roles, audit logging and defense in depth.' },
  { icon: Globe, title: 'Global access', desc: '350+ markets with institutional-grade pricing.' },
  { icon: Users, title: 'Built for everyone', desc: 'From first-time traders to professional desks.' },
];

export default function AboutPage() {
  return (
    <main>
      <Navbar />
      <section className="mx-auto max-w-4xl px-4 pt-28 text-center sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold text-white sm:text-5xl">
          Building the future of <span className="gradient-text">crypto trading</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
          NexTradePro is an enterprise-grade trading platform that combines professional charts,
          AI-driven insights, copy trading and bank-level security. This build is a demonstration
          showcasing world-class engineering and UX.
        </p>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {VALUES.map((v) => (
            <div key={v.title} className="card">
              <div className="mb-4 inline-flex rounded-xl bg-brand-gradient p-2.5 text-white">
                <v.icon size={22} />
              </div>
              <h3 className="font-semibold text-white">{v.title}</h3>
              <p className="mt-2 text-sm text-slate-400">{v.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
          {[
            ['2.4M', 'Traders'],
            ['$48B+', 'Volume'],
            ['350+', 'Markets'],
            ['99.99%', 'Uptime'],
          ].map(([v, l]) => (
            <div key={l} className="card text-center">
              <div className="text-3xl font-bold text-white">{v}</div>
              <div className="mt-1 text-sm text-slate-400">{l}</div>
            </div>
          ))}
        </div>
      </section>
      <Footer />
    </main>
  );
}
