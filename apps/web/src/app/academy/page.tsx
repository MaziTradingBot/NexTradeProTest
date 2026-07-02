'use client';

import { useState } from 'react';
import { GraduationCap, Clock, X, BookOpen } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { cn } from '@/lib/utils';

type Level = 'Beginner' | 'Intermediate' | 'Advanced';

interface Lesson {
  title: string;
  level: Level;
  minutes: number;
  summary: string;
  body: string[];
}

const LESSONS: Lesson[] = [
  {
    title: 'What is cryptocurrency?',
    level: 'Beginner',
    minutes: 5,
    summary: 'Understand blockchains, coins vs tokens, and why crypto markets trade 24/7.',
    body: [
      'A cryptocurrency is a digital asset secured by cryptography and recorded on a public ledger called a blockchain. No single entity controls it — the network is maintained by distributed participants.',
      'Coins (like BTC and ETH) are native to their own blockchains, while tokens are built on top of existing chains. Because there is no central exchange, crypto markets trade continuously, 24 hours a day, 7 days a week.',
      'For traders this means opportunity and risk are always present — which is why risk management and clearly defined strategies matter more than in traditional markets.',
    ],
  },
  {
    title: 'Reading a candlestick chart',
    level: 'Beginner',
    minutes: 7,
    summary: 'Learn what open, high, low and close tell you, and how to spot momentum.',
    body: [
      'Each candlestick summarizes price over a time interval with four values: open, high, low and close (OHLC). A green candle closes higher than it opened; a red candle closes lower.',
      'The body shows the open-to-close range, while the thin wicks show the extremes reached. Long wicks signal rejection of a price level; large bodies signal strong directional conviction.',
      'Combine candlesticks with volume and support/resistance levels to build a fuller picture before entering a trade.',
    ],
  },
  {
    title: 'Order types explained',
    level: 'Beginner',
    minutes: 6,
    summary: 'Market, limit, stop and take-profit orders — when to use each.',
    body: [
      'A market order fills immediately at the best available price — fast, but you accept some slippage. A limit order only fills at your specified price or better, giving you control at the cost of certainty.',
      'Stop orders trigger once price crosses a level, commonly used to cut losses (stop-loss) or protect gains (take-profit). A trailing stop moves with price to lock in profit as a trade runs.',
      'On NexTradePro you can practice all of these with simulated execution on live market prices.',
    ],
  },
  {
    title: 'Risk management & position sizing',
    level: 'Intermediate',
    minutes: 8,
    summary: 'The 1% rule, risk/reward ratios and sizing trades to survive drawdowns.',
    body: [
      'Professional traders think in risk first, profit second. A common rule is to risk no more than 1% of your account on any single trade — so a string of losses never threatens your capital.',
      'Position size = (account × risk %) ÷ (entry − stop). Our Position Size calculator under Tools does this for you.',
      'Aim for a favorable risk/reward ratio (e.g. risking 1 to make 2). With a 2:1 ratio you can be profitable even winning fewer than half your trades.',
    ],
  },
  {
    title: 'Understanding leverage & liquidation',
    level: 'Intermediate',
    minutes: 9,
    summary: 'How margin and leverage amplify both gains and losses — and how liquidation works.',
    body: [
      'Leverage lets you control a larger position with less capital. 10x leverage means a 1% move equals a 10% change on your margin — magnifying both profit and loss.',
      'If the market moves against you far enough, your margin can no longer cover the loss and the position is liquidated. The higher the leverage, the closer the liquidation price sits to your entry.',
      'Use the Liquidation calculator under Tools before opening leveraged positions, and never risk more than you can afford to lose.',
    ],
  },
  {
    title: 'Technical indicators that matter',
    level: 'Advanced',
    minutes: 10,
    summary: 'Moving averages, RSI, MACD and how to combine them without overfitting.',
    body: [
      'Moving averages smooth price to reveal trend direction; crossovers can signal shifts in momentum. RSI measures whether an asset is overbought or oversold on a 0–100 scale.',
      'MACD tracks the relationship between two moving averages to highlight momentum and potential reversals. No indicator is predictive on its own.',
      'The goal is confluence — several independent signals agreeing — not stacking dozens of indicators until the chart is unreadable.',
    ],
  },
  {
    title: 'Building a trading plan',
    level: 'Advanced',
    minutes: 8,
    summary: 'Turn discretionary trading into a repeatable, reviewable process.',
    body: [
      'A trading plan defines your setups, entry and exit rules, position sizing, and the markets and timeframes you trade. Writing it down removes emotion from in-the-moment decisions.',
      'Keep a journal of every trade — the setup, your reasoning, and the outcome. Reviewing it weekly turns losses into lessons and reinforces what works.',
      'Discipline beats prediction. A mediocre strategy executed consistently outperforms a brilliant one applied haphazardly.',
    ],
  },
];

const LEVELS: (Level | 'All')[] = ['All', 'Beginner', 'Intermediate', 'Advanced'];
const LEVEL_STYLES: Record<Level, string> = {
  Beginner: 'bg-brand-emerald/15 text-brand-emerald',
  Intermediate: 'bg-brand-gold/15 text-brand-gold',
  Advanced: 'bg-brand-blue/15 text-brand-blue',
};

export default function AcademyPage() {
  const [level, setLevel] = useState<(typeof LEVELS)[number]>('All');
  const [active, setActive] = useState<Lesson | null>(null);

  const lessons = LESSONS.filter((l) => level === 'All' || l.level === level);

  return (
    <main>
      <Navbar />
      <section className="mx-auto max-w-7xl px-4 pt-28 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-2xl bg-brand-gradient p-3 text-white">
            <GraduationCap size={26} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white sm:text-4xl">NexTradePro Academy</h1>
            <p className="text-slate-400">Free lessons to take you from beginner to confident trader.</p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {LEVELS.map((l) => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              className={cn(
                'rounded-xl px-4 py-2 text-sm font-medium transition',
                level === l ? 'bg-brand-gradient text-white' : 'bg-white/5 text-slate-400 hover:text-white',
              )}
            >
              {l}
            </button>
          ))}
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {lessons.map((l) => (
            <button
              key={l.title}
              onClick={() => setActive(l)}
              className="card group text-left transition hover:border-brand-blue/40 hover:shadow-glow"
            >
              <div className="flex items-center justify-between">
                <span className={cn('badge', LEVEL_STYLES[l.level])}>{l.level}</span>
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <Clock size={12} /> {l.minutes} min
                </span>
              </div>
              <h3 className="mt-3 text-lg font-semibold text-white">{l.title}</h3>
              <p className="mt-2 text-sm text-slate-400">{l.summary}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-blue">
                <BookOpen size={14} /> Read lesson
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Lesson reader */}
      {active && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setActive(null)}>
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-bg-surface p-6 sm:p-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className={cn('badge', LEVEL_STYLES[active.level])}>{active.level}</span>
                <h2 className="mt-3 text-2xl font-bold text-white">{active.title}</h2>
                <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                  <Clock size={12} /> {active.minutes} min read
                </div>
              </div>
              <button onClick={() => setActive(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5">
                <X size={20} />
              </button>
            </div>
            <div className="mt-5 space-y-4">
              {active.body.map((p, i) => (
                <p key={i} className="text-sm leading-relaxed text-slate-300">
                  {p}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}
      <div className="h-20" />
      <Footer />
    </main>
  );
}
