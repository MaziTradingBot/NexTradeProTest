'use client';

import { useState } from 'react';
import { Clock, X, BookOpen } from 'lucide-react';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { cn } from '@/lib/utils';

type Level = 'Beginner' | 'Intermediate' | 'Advanced';
interface Lesson { title: string; level: Level; minutes: number; summary: string; body: string[] }

const LESSONS: Lesson[] = [
  { title: 'What is cryptocurrency?', level: 'Beginner', minutes: 5, summary: 'Blockchains, coins vs tokens, and why crypto trades 24/7.', body: ['A cryptocurrency is a digital asset secured by cryptography and recorded on a public ledger called a blockchain. No single entity controls it.', 'Coins are native to their own blockchains; tokens are built on top of existing chains. Markets trade continuously, 24/7.', 'For traders this means opportunity and risk are always present — which is why risk management matters more than in traditional markets.'] },
  { title: 'Reading a candlestick chart', level: 'Beginner', minutes: 7, summary: 'What open, high, low and close tell you, and how to spot momentum.', body: ['Each candlestick summarizes price over an interval with four values: open, high, low and close (OHLC).', 'The body shows the open-to-close range; the wicks show the extremes. Long wicks signal rejection of a level.', 'Combine candlesticks with volume and support/resistance to build a fuller picture before entering a trade.'] },
  { title: 'Order types explained', level: 'Beginner', minutes: 6, summary: 'Market, limit, stop and take-profit orders — when to use each.', body: ['A market order fills immediately at the best price; a limit order only fills at your price or better.', 'Stop orders trigger once price crosses a level — used to cut losses (stop-loss) or protect gains (take-profit).', 'On NexTradePro you can practice all of these with simulated execution on live prices.'] },
  { title: 'Risk management & position sizing', level: 'Intermediate', minutes: 8, summary: 'The 1% rule, risk/reward ratios and surviving drawdowns.', body: ['Professionals think risk first, profit second. A common rule is to risk no more than 1% of your account per trade.', 'Position size = (account × risk %) ÷ (entry − stop). Our Position Size calculator does this for you.', 'Aim for a favorable risk/reward ratio. With 2:1 you can be profitable winning fewer than half your trades.'] },
  { title: 'Understanding leverage & liquidation', level: 'Intermediate', minutes: 9, summary: 'How margin and leverage amplify gains and losses.', body: ['Leverage lets you control a larger position with less capital. 10x means a 1% move equals 10% on your margin.', 'If price moves against you far enough, the position is liquidated. Higher leverage means a closer liquidation price.', 'Use the Liquidation calculator before opening leveraged positions, and never risk more than you can afford to lose.'] },
  { title: 'Building a trading plan', level: 'Advanced', minutes: 8, summary: 'Turn discretionary trading into a repeatable process.', body: ['A trading plan defines your setups, entry/exit rules, position sizing, and the markets and timeframes you trade.', 'Keep a journal of every trade — setup, reasoning, outcome. Reviewing it weekly turns losses into lessons.', 'Discipline beats prediction. A mediocre strategy executed consistently beats a brilliant one applied haphazardly.'] },
];

const LEVELS: (Level | 'All')[] = ['All', 'Beginner', 'Intermediate', 'Advanced'];
const LEVEL_STYLES: Record<Level, string> = {
  Beginner: 'bg-[#e7f8ef] text-[#0e9f6e]',
  Intermediate: 'bg-[#fff6e6] text-[#c98a00]',
  Advanced: 'bg-[#eef3ff] text-[#1a56ff]',
};

export default function AcademyPage() {
  const [level, setLevel] = useState<(typeof LEVELS)[number]>('All');
  const [active, setActive] = useState<Lesson | null>(null);
  const lessons = LESSONS.filter((l) => level === 'All' || l.level === level);

  return (
    <div className="min-h-screen bg-white text-[#0a1633]" style={{ fontFamily: "'Figtree', system-ui, sans-serif" }}>
      <MarketingNav />

      <section className="bg-gradient-to-b from-[#f2f6ff] to-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-extrabold tracking-tight text-[#0a1633]">NexTradePro Academy</h1>
          <p className="mt-2 text-[#5b6b8c]">Free lessons to take you from beginner to confident trader.</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {LEVELS.map((l) => (
              <button key={l} onClick={() => setLevel(l)} className={cn('rounded-full px-4 py-2 text-sm font-medium transition', level === l ? 'bg-[#1a56ff] text-white' : 'border border-[#dbe1ee] text-[#5b6b8c] hover:text-[#0a1633]')}>{l}</button>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {lessons.map((l) => (
            <button key={l.title} onClick={() => setActive(l)} className="rounded-2xl border border-[#e7ecf5] bg-white p-6 text-left transition hover:border-[#c9d7ff] hover:shadow-[0_16px_40px_-24px_rgba(16,40,90,0.3)]">
              <div className="flex items-center justify-between">
                <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', LEVEL_STYLES[l.level])}>{l.level}</span>
                <span className="flex items-center gap-1 text-xs text-[#8593ad]"><Clock size={12} /> {l.minutes} min</span>
              </div>
              <h3 className="mt-3 text-lg font-semibold text-[#0a1633]">{l.title}</h3>
              <p className="mt-2 text-sm text-[#5b6b8c]">{l.summary}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#1a56ff]"><BookOpen size={14} /> Read lesson</span>
            </button>
          ))}
        </div>
      </section>

      {active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a1633]/40 p-4 backdrop-blur-sm" onClick={() => setActive(null)}>
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl sm:p-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', LEVEL_STYLES[active.level])}>{active.level}</span>
                <h2 className="mt-3 text-2xl font-bold text-[#0a1633]">{active.title}</h2>
                <div className="mt-1 flex items-center gap-1 text-xs text-[#8593ad]"><Clock size={12} /> {active.minutes} min read</div>
              </div>
              <button onClick={() => setActive(null)} className="rounded-lg p-1.5 text-[#8593ad] hover:bg-[#f2f5fa]"><X size={20} /></button>
            </div>
            <div className="mt-5 space-y-4">
              {active.body.map((p, i) => <p key={i} className="text-sm leading-relaxed text-[#41506b]">{p}</p>)}
            </div>
          </div>
        </div>
      )}

      <MarketingFooter />
    </div>
  );
}
