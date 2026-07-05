'use client';

import { useRouter } from 'next/navigation';
import { Copy, TrendingUp, Users } from 'lucide-react';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { cn } from '@/lib/utils';

const TRADERS = [
  { name: 'Alex Quant', roi: 184.2, win: 87, monthly: 12.4, profit: 184200, followers: 12400, risk: 'Medium', riskScore: 5.2, trades: 1240, drawdown: 14.8, pair: 'BTCUSDT', side: 'BUY', lev: 10 },
  { name: 'Nova Capital', roi: 142.7, win: 81, monthly: 9.1, profit: 142700, followers: 9800, risk: 'Low', riskScore: 3.1, trades: 980, drawdown: 8.2, pair: 'ETHUSDT', side: 'BUY', lev: 5 },
  { name: 'CryptoSage', roi: 121.5, win: 79, monthly: 8.3, profit: 121500, followers: 7600, risk: 'Medium', riskScore: 4.7, trades: 760, drawdown: 12.1, pair: 'SOLUSDT', side: 'BUY', lev: 8 },
  { name: 'DeltaEdge', roi: 98.3, win: 74, monthly: 7.0, profit: 98300, followers: 5400, risk: 'High', riskScore: 7.9, trades: 2100, drawdown: 22.5, pair: 'BTCUSDT', side: 'SELL', lev: 20 },
  { name: 'Momentum Lab', roi: 76.9, win: 71, monthly: 5.6, profit: 76900, followers: 4200, risk: 'Low', riskScore: 2.8, trades: 540, drawdown: 6.9, pair: 'BNBUSDT', side: 'BUY', lev: 4 },
  { name: 'BlueWhale FX', roi: 64.1, win: 69, monthly: 4.8, profit: 64100, followers: 3100, risk: 'Medium', riskScore: 5.5, trades: 890, drawdown: 15.3, pair: 'XRPUSDT', side: 'BUY', lev: 6 },
];

export default function CopyTradingPage() {
  const router = useRouter();

  const copyTrade = (t: (typeof TRADERS)[number]) => {
    const q = new URLSearchParams({ symbol: t.pair, side: t.side, leverage: String(t.lev), copyFrom: t.name });
    router.push(`/trading?${q.toString()}`);
  };

  return (
    <div className="min-h-screen bg-bg text-[#E8F1FF]" style={{ fontFamily: "'Figtree', system-ui, sans-serif" }}>
      <MarketingNav />

      <section className="bg-gradient-to-b from-[#0F1D35] to-bg">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:py-20">
          <h1 className="text-4xl font-extrabold tracking-tight text-[#E8F1FF] sm:text-5xl">Copy the pros</h1>
          <p className="mt-4 text-lg text-[#A0BDD8]">
            Mirror top-ranked traders with transparent stats. Clicking Copy opens a pre-filled order ticket you review and
            confirm — nothing is executed automatically. Copying is simulated for demonstration.
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
              <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-[#12233a] pt-4 text-xs">
                {[
                  ['Monthly return', `+${t.monthly}%`],
                  ['Total profit', `$${t.profit.toLocaleString()}`],
                  ['Total trades', t.trades.toLocaleString()],
                  ['Max drawdown', `-${t.drawdown}%`],
                  ['Risk score', `${t.riskScore}/10`],
                  ['Copies', t.pair.replace('USDT', '') + ' ' + (t.side === 'BUY' ? 'Long' : 'Short') + ' ' + t.lev + 'x'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-[#5E7A96]">{k}</span>
                    <span className="font-medium text-[#E8F1FF]">{v}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => copyTrade(t)} className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[#0EA5E9] py-2.5 text-sm font-semibold text-white transition hover:bg-[#0891D4]">
                <Copy size={15} /> Copy trade
              </button>
            </div>
          ))}
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
