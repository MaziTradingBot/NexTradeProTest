'use client';

import { useEffect, useMemo, useState } from 'react';
import { Copy, Check, ArrowDownToLine, Info, Loader2 } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { AuthGuard } from '@/components/AuthGuard';
import { QrCode } from '@/components/QrCode';
import { api } from '@/lib/api';
import { useMode } from '@/lib/useMode';
import { cn } from '@/lib/utils';

interface DepositAddress {
  id: string;
  asset: string;
  network: string;
  address: string;
  minDeposit: string;
  confirmations: number;
  instructions: string | null;
  isDefault: boolean;
}

function DepositInner() {
  const { mode } = useMode();
  const [addresses, setAddresses] = useState<DepositAddress[]>([]);
  const [asset, setAsset] = useState<string>('');
  const [network, setNetwork] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [amount, setAmount] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [confirmStep, setConfirmStep] = useState(0);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<DepositAddress[]>('/api/account/deposit-addresses')
      .then((d) => {
        setAddresses(d);
        if (d.length) {
          setAsset(d[0].asset);
          setNetwork(d.find((x) => x.asset === d[0].asset && x.isDefault)?.network ?? d[0].network);
        }
      })
      .catch(() => {});
  }, []);

  const assets = useMemo(() => Array.from(new Set(addresses.map((a) => a.asset))), [addresses]);
  const networks = useMemo(() => addresses.filter((a) => a.asset === asset), [addresses, asset]);
  const current = useMemo(
    () => networks.find((n) => n.network === network) ?? networks[0],
    [networks, network],
  );

  const selectAsset = (a: string) => {
    setAsset(a);
    const def = addresses.find((x) => x.asset === a && x.isDefault) ?? addresses.find((x) => x.asset === a);
    setNetwork(def?.network ?? '');
    setResult(null);
  };

  const copy = () => {
    if (!current) return;
    navigator.clipboard?.writeText(current.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  // Demo: animate blockchain confirmations, then credit. Live: record a request.
  const simulate = async () => {
    if (!current) return;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      setResult('Enter an amount to simulate.');
      return;
    }
    setResult(null);
    setConfirming(true);
    setConfirmStep(0);

    if (mode === 'DEMO') {
      for (let i = 1; i <= current.confirmations; i++) {
        await new Promise((r) => setTimeout(r, Math.min(400, 2000 / current.confirmations)));
        setConfirmStep(i);
      }
    }
    try {
      await api.post('/api/account/deposit', { asset, amount: amt, network });
      setResult(
        mode === 'DEMO'
          ? `✓ ${amt} ${asset} credited to your demo wallet after ${current.confirmations} confirmations.`
          : `✓ Deposit request for ${amt} ${asset} recorded — pending confirmation.`,
      );
      setAmount('');
    } catch (e) {
      setResult(e instanceof Error ? e.message : 'Failed');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <section className="mx-auto max-w-4xl px-4 pt-24 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <div className="inline-flex rounded-2xl bg-brand-gradient p-3 text-white">
          <ArrowDownToLine size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Deposit</h1>
          <p className="text-slate-400">Fund your {mode === 'DEMO' ? 'demo' : 'live'} wallet.</p>
        </div>
        <span className={cn('ml-auto badge', mode === 'DEMO' ? 'bg-brand-emerald/15 text-brand-emerald' : 'bg-brand-blue/15 text-brand-blue')}>
          {mode === 'DEMO' ? 'Demo' : 'Live'} Mode
        </span>
      </div>

      {/* Asset selector */}
      <div className="card mt-6">
        <label className="label">Select asset</label>
        <div className="flex flex-wrap gap-2">
          {assets.map((a) => (
            <button
              key={a}
              onClick={() => selectAsset(a)}
              className={cn('rounded-xl px-3 py-1.5 text-sm font-semibold transition', asset === a ? 'bg-brand-gradient text-white' : 'bg-white/5 text-slate-400 hover:text-white')}
            >
              {a}
            </button>
          ))}
        </div>

        {networks.length > 1 && (
          <>
            <label className="label mt-4">Network</label>
            <div className="flex flex-wrap gap-2">
              {networks.map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    setNetwork(n.network);
                    setResult(null);
                  }}
                  className={cn('rounded-xl px-3 py-1.5 text-sm font-medium transition', network === n.network ? 'bg-brand-blue text-white' : 'bg-white/5 text-slate-400 hover:text-white')}
                >
                  {n.network}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {current && (
        <div className="card mt-4">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            <QrCode text={current.address} size={168} />
            <div className="min-w-0 flex-1">
              <label className="label">{current.asset} deposit address ({current.network})</label>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg bg-black/30 px-3 py-2.5 font-mono text-sm text-white">
                  {current.address}
                </code>
                <button onClick={copy} className="shrink-0 rounded-lg bg-white/10 p-2.5 text-white hover:bg-white/20" aria-label="Copy address">
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-white/5 px-3 py-2">
                  <div className="text-xs text-slate-500">Network</div>
                  <div className="font-medium text-white">{current.network}</div>
                </div>
                <div className="rounded-xl bg-white/5 px-3 py-2">
                  <div className="text-xs text-slate-500">Min deposit</div>
                  <div className="font-medium text-white">{current.minDeposit} {current.asset}</div>
                </div>
                <div className="rounded-xl bg-white/5 px-3 py-2">
                  <div className="text-xs text-slate-500">Confirmations</div>
                  <div className="font-medium text-white">{current.confirmations}</div>
                </div>
                <div className="rounded-xl bg-white/5 px-3 py-2">
                  <div className="text-xs text-slate-500">Est. arrival</div>
                  <div className="font-medium text-white">~{Math.max(1, Math.round(current.confirmations / 2))} min</div>
                </div>
              </div>
            </div>
          </div>

          {current.instructions && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-brand-gold/25 bg-brand-gold/10 px-4 py-3 text-sm text-slate-200">
              <Info size={16} className="mt-0.5 shrink-0 text-brand-gold" />
              <span>{current.instructions}</span>
            </div>
          )}

          {/* Simulate deposit */}
          <div className="mt-5 border-t border-white/10 pt-5">
            <label className="label">
              {mode === 'DEMO' ? 'Simulate a deposit (demo)' : 'Log a deposit request'}
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                type="number"
                placeholder={`Amount in ${current.asset}`}
                className="input"
                disabled={confirming}
              />
              <button onClick={simulate} disabled={confirming} className="btn-primary whitespace-nowrap">
                {confirming ? <Loader2 size={16} className="animate-spin" /> : <ArrowDownToLine size={16} />}
                {confirming ? `Confirming ${confirmStep}/${current.confirmations}` : mode === 'DEMO' ? 'Simulate deposit' : 'Submit request'}
              </button>
            </div>
            {confirming && mode === 'DEMO' && (
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-brand-emerald transition-all"
                  style={{ width: `${(confirmStep / current.confirmations) * 100}%` }}
                />
              </div>
            )}
            {result && <p className="mt-3 text-sm text-slate-200">{result}</p>}
          </div>
        </div>
      )}

      <p className="mt-6 text-center text-xs text-slate-500">
        This is a simulated deposit address for demonstration only. Never send real funds — no real
        blockchain transaction occurs.
      </p>
      <div className="h-16" />
    </section>
  );
}

export default function DepositPage() {
  return (
    <main>
      <Navbar />
      <AuthGuard>
        <DepositInner />
      </AuthGuard>
    </main>
  );
}
