'use client';

import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { TrendingUp, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

const TRADERS = [
  { name: 'Alex Quant', roi: 184.2, win: 87, followers: 12400, risk: 'Medium' },
  { name: 'Nova Capital', roi: 142.7, win: 81, followers: 9800, risk: 'Low' },
  { name: 'CryptoSage', roi: 121.5, win: 79, followers: 7600, risk: 'Medium' },
  { name: 'DeltaEdge', roi: 98.3, win: 74, followers: 5400, risk: 'High' },
  { name: 'Momentum Lab', roi: 76.9, win: 71, followers: 4200, risk: 'Low' },
  { name: 'BlueWhale FX', roi: 64.1, win: 69, followers: 3100, risk: 'Medium' },
];

export default function CopyTradingPage() {
  return (
    <main>
      <Navbar />
      <section className="mx-auto max-w-7xl px-4 pt-28 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-bold text-white sm:text-4xl">Copy Trading</h1>
          <p className="mt-3 text-slate-400">
            Mirror the strategies of top-ranked traders. Transparent ROI, win rates and risk levels —
            copying is simulated for demonstration.
          </p>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {TRADERS.map((t, i) => (
            <div key={t.name} className="card transition hover:border-brand-blue/40 hover:shadow-glow">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-gradient font-bold text-white">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-semibold text-white">{t.name}</div>
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <Users size={12} /> {t.followers.toLocaleString()} followers
                    </div>
                  </div>
                </div>
                <span className="badge bg-white/5 text-slate-300">#{i + 1}</span>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="flex items-center justify-center gap-1 text-lg font-bold text-brand-emerald">
                    <TrendingUp size={15} />
                    {t.roi}%
                  </div>
                  <div className="text-xs text-slate-500">ROI (1y)</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-white">{t.win}%</div>
                  <div className="text-xs text-slate-500">Win rate</div>
                </div>
                <div>
                  <div
                    className={cn(
                      'text-lg font-bold',
                      t.risk === 'Low' ? 'text-brand-emerald' : t.risk === 'High' ? 'text-red-400' : 'text-brand-gold',
                    )}
                  >
                    {t.risk}
                  </div>
                  <div className="text-xs text-slate-500">Risk</div>
                </div>
              </div>

              <button className="btn-primary mt-5 w-full">Copy trader</button>
            </div>
          ))}
        </div>
      </section>
      <div className="h-20" />
      <Footer />
    </main>
  );
}
