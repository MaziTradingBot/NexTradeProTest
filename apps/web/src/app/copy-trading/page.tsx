'use client';

import { TrendingUp, Users } from 'lucide-react';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
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
    <div className="min-h-screen bg-bg text-[#E8F1FF]" style={{ fontFamily: "'Figtree', system-ui, sans-serif" }}>
      <MarketingNav />

      <section className="bg-gradient-to-b from-[#0F1D35] to-bg">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:py-20">
          <h1 className="text-4xl font-extrabold tracking-tight text-[#E8F1FF] sm:text-5xl">Copy the pros</h1>
          <p className="mt-4 text-lg text-[#A0BDD8]">
            Mirror top-ranked traders with transparent ROI, win rate and risk levels. Copying is simulated for demonstration.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {TRADERS.map((t, i) => (
            <div key={t.name} className="rounded-2xl border border-[#12233a] bg-bg-surface p-6 transition hover:border-[#22D3EE] hover:shadow-[0_16px_40px_-24px_rgba(16,40,90,0.3)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#0EA5E9] font-bold text-white">{t.name.charAt(0)}</div>
                  <div>
                    <div className="font-semibold text-[#E8F1FF]">{t.name}</div>
                    <div className="flex items-center gap-1 text-xs text-[#5E7A96]"><Users size={12} /> {t.followers.toLocaleString()} followers</div>
                  </div>
                </div>
                <span className="rounded-full bg-[#0F1D35] px-2.5 py-0.5 text-xs font-medium text-[#A0BDD8]">#{i + 1}</span>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="flex items-center justify-center gap-1 text-lg font-bold text-[#34D399]"><TrendingUp size={15} />{t.roi}%</div>
                  <div className="text-xs text-[#5E7A96]">ROI (1y)</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-[#E8F1FF]">{t.win}%</div>
                  <div className="text-xs text-[#5E7A96]">Win rate</div>
                </div>
                <div>
                  <div className={cn('text-lg font-bold', t.risk === 'Low' ? 'text-[#34D399]' : t.risk === 'High' ? 'text-[#F87171]' : 'text-[#F59E0B]')}>{t.risk}</div>
                  <div className="text-xs text-[#5E7A96]">Risk</div>
                </div>
              </div>
              <button className="mt-5 w-full rounded-full bg-[#0EA5E9] py-2.5 text-sm font-semibold text-white transition hover:bg-[#0891D4]">Copy trader</button>
            </div>
          ))}
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
