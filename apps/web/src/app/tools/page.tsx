'use client';

import { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Calculator, Percent, TrendingDown } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

function num(v: string) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function PositionSizeCalc() {
  const [balance, setBalance] = useState('10000');
  const [riskPct, setRiskPct] = useState('1');
  const [entry, setEntry] = useState('67000');
  const [stop, setStop] = useState('65000');

  const riskAmount = (num(balance) * num(riskPct)) / 100;
  const perUnitRisk = Math.abs(num(entry) - num(stop));
  const positionSize = perUnitRisk > 0 ? riskAmount / perUnitRisk : 0;
  const positionValue = positionSize * num(entry);

  return (
    <div className="card">
      <div className="mb-4 flex items-center gap-2">
        <Calculator size={18} className="text-brand-blue" />
        <h3 className="font-semibold text-white">Position Size</h3>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Account balance ($)" value={balance} onChange={setBalance} />
        <Field label="Risk per trade (%)" value={riskPct} onChange={setRiskPct} />
        <Field label="Entry price ($)" value={entry} onChange={setEntry} />
        <Field label="Stop loss ($)" value={stop} onChange={setStop} />
      </div>
      <div className="mt-4 space-y-1.5 rounded-xl bg-white/5 p-4 text-sm">
        <Row label="Amount at risk" value={formatCurrency(riskAmount)} />
        <Row label="Position size" value={`${positionSize.toFixed(4)} units`} />
        <Row label="Position value" value={formatCurrency(positionValue)} highlight />
      </div>
    </div>
  );
}

function LiquidationCalc() {
  const [entry, setEntry] = useState('67000');
  const [leverage, setLeverage] = useState('10');
  const [side, setSide] = useState<'LONG' | 'SHORT'>('LONG');

  const lev = num(leverage) || 1;
  // Simplified isolated-margin liquidation (no fees/maintenance margin).
  const liq = side === 'LONG' ? num(entry) * (1 - 1 / lev) : num(entry) * (1 + 1 / lev);

  return (
    <div className="card">
      <div className="mb-4 flex items-center gap-2">
        <TrendingDown size={18} className="text-red-400" />
        <h3 className="font-semibold text-white">Liquidation Price</h3>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2">
        {(['LONG', 'SHORT'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSide(s)}
            className={`rounded-xl py-2 text-xs font-semibold transition ${side === s ? (s === 'LONG' ? 'bg-brand-emerald text-white' : 'bg-red-500 text-white') : 'bg-white/5 text-slate-400'}`}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Entry price ($)" value={entry} onChange={setEntry} />
        <Field label="Leverage (x)" value={leverage} onChange={setLeverage} />
      </div>
      <div className="mt-4 space-y-1.5 rounded-xl bg-white/5 p-4 text-sm">
        <Row label="Est. liquidation price" value={formatCurrency(liq)} highlight />
        <Row label="Margin" value={`${(100 / lev).toFixed(2)}%`} />
      </div>
      <p className="mt-2 text-xs text-slate-500">Simplified isolated-margin estimate, excluding fees.</p>
    </div>
  );
}

function ProfitCalc() {
  const [entry, setEntry] = useState('67000');
  const [exit, setExit] = useState('72000');
  const [size, setSize] = useState('0.5');
  const [leverage, setLeverage] = useState('1');

  const pnl = (num(exit) - num(entry)) * num(size);
  const cost = (num(entry) * num(size)) / (num(leverage) || 1);
  const roi = cost > 0 ? (pnl / cost) * 100 : 0;

  return (
    <div className="card">
      <div className="mb-4 flex items-center gap-2">
        <Percent size={18} className="text-brand-emerald" />
        <h3 className="font-semibold text-white">Profit / ROI</h3>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Entry price ($)" value={entry} onChange={setEntry} />
        <Field label="Exit price ($)" value={exit} onChange={setExit} />
        <Field label="Position size (units)" value={size} onChange={setSize} />
        <Field label="Leverage (x)" value={leverage} onChange={setLeverage} />
      </div>
      <div className="mt-4 space-y-1.5 rounded-xl bg-white/5 p-4 text-sm">
        <Row label="Margin used" value={formatCurrency(cost)} />
        <Row label="Profit / Loss" value={formatCurrency(pnl)} highlight tone={pnl >= 0 ? 'pos' : 'neg'} />
        <Row label="ROI" value={`${roi >= 0 ? '+' : ''}${roi.toFixed(2)}%`} tone={roi >= 0 ? 'pos' : 'neg'} />
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-400">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} type="number" className="input py-2" />
    </label>
  );
}

function Row({ label, value, highlight, tone }: { label: string; value: string; highlight?: boolean; tone?: 'pos' | 'neg' }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-400">{label}</span>
      <span
        className={`font-mono font-semibold ${tone === 'pos' ? 'text-brand-emerald' : tone === 'neg' ? 'text-red-400' : highlight ? 'text-white' : 'text-slate-200'} ${highlight ? 'text-base' : ''}`}
      >
        {value}
      </span>
    </div>
  );
}

export default function ToolsPage() {
  return (
    <main>
      <Navbar />
      <section className="mx-auto max-w-7xl px-4 pt-28 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-white sm:text-4xl">Trading Calculators</h1>
        <p className="mt-2 text-slate-400">Risk, position sizing and profit tools for smarter trades.</p>

        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          <PositionSizeCalc />
          <LiquidationCalc />
          <ProfitCalc />
        </div>
      </section>
      <div className="h-20" />
      <Footer />
    </main>
  );
}
