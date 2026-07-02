'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart3, Bot, LineChart, ShieldCheck, X } from 'lucide-react';
import { Logo } from './Logo';

const STEPS = [
  {
    icon: LineChart,
    title: 'Welcome to NexTradePro',
    body: 'An institutional-grade crypto trading platform with live market data and clearly labeled simulated execution. Here’s a 20-second tour.',
  },
  {
    icon: BarChart3,
    title: 'Pro trading terminal',
    body: 'Trade spot or futures with live charts, a real-time order book, market & limit orders, and up to 125× leverage — all risk-free in demo mode.',
  },
  {
    icon: Bot,
    title: 'AI insights & analytics',
    body: 'Get a live market summary, a portfolio health score and sentiment from the AI assistant, plus full portfolio analytics.',
  },
  {
    icon: ShieldCheck,
    title: 'Enterprise admin & security',
    body: 'Granular admin roles, real TOTP two-factor auth and KYC verification. Sign in with a demo account to explore it all.',
  },
];

export function WelcomeTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      if (!localStorage.getItem('nxp-tour-done')) {
        const t = setTimeout(() => setOpen(true), 1200);
        return () => clearTimeout(t);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem('nxp-tour-done', '1');
    } catch {
      /* ignore */
    }
  };

  if (!open) return null;
  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-bg-surface p-7 shadow-card">
        <button onClick={close} className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-white/5" aria-label="Skip tour">
          <X size={18} />
        </button>

        <Logo />

        <div className="mt-6 inline-flex rounded-2xl bg-brand-gradient p-3 text-white">
          <s.icon size={26} />
        </div>
        <h2 className="mt-4 text-xl font-bold text-white">{s.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">{s.body}</p>

        {/* Progress dots */}
        <div className="mt-6 flex gap-1.5">
          {STEPS.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-brand-blue' : 'w-1.5 bg-white/15'}`} />
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <button onClick={close} className="text-sm text-slate-500 hover:text-white">
            Skip
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button onClick={() => setStep((s) => s - 1)} className="btn-ghost px-4 py-2 text-sm">
                Back
              </button>
            )}
            {last ? (
              <Link href="/register" onClick={close} className="btn-primary px-5 py-2 text-sm">
                Get started
              </Link>
            ) : (
              <button onClick={() => setStep((s) => s + 1)} className="btn-primary px-5 py-2 text-sm">
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
