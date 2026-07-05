'use client';

import { useEffect, useMemo, useState } from 'react';
import { Copy, Check, ArrowDownToLine, Info, Loader2, CreditCard, Coins, CheckCircle2, XCircle } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { AuthGuard } from '@/components/AuthGuard';
import { QrCode } from '@/components/QrCode';
import { api } from '@/lib/api';
import { useMode } from '@/lib/useMode';
import { cn } from '@/lib/utils';

// Detect the card brand from the number prefix (display only).
function cardBrand(num: string): 'Visa' | 'Mastercard' | 'Amex' | 'Card' {
  const n = num.replace(/\D/g, '');
  if (/^4/.test(n)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(n)) return 'Mastercard';
  if (/^3[47]/.test(n)) return 'Amex';
  return 'Card';
}

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
  const [method, setMethod] = useState<'CRYPTO' | 'CARD'>('CRYPTO');
  // Card deposit state
  const [card, setCard] = useState({ number: '', expiry: '', cvc: '', name: '', asset: 'USDT', amount: '' });
  const [cardStatus, setCardStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [cardMsg, setCardMsg] = useState<string | null>(null);

  const formatCardNumber = (v: string) => v.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim();
  const formatExpiry = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 4);
    return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  };

  const payByCard = async () => {
    setCardMsg(null);
    const amt = parseFloat(card.amount);
    if (!amt || amt <= 0) return setCardMsg('Enter a valid amount.');
    if (card.number.replace(/\D/g, '').length < 12) return setCardMsg('Enter a valid card number.');
    if (!/^\d{2}\/\d{2}$/.test(card.expiry)) return setCardMsg('Enter the expiry as MM/YY.');
    if (!/^\d{3,4}$/.test(card.cvc)) return setCardMsg('Enter a valid CVC.');
    if (card.name.trim().length < 2) return setCardMsg('Enter the cardholder name.');
    setCardStatus('processing');
    // Simulated secure-processing delay.
    await new Promise((r) => setTimeout(r, 1600));
    try {
      await api.post('/api/account/deposit/card', {
        asset: card.asset,
        amount: amt,
        cardNumber: card.number.replace(/\D/g, ''),
        expiry: card.expiry,
        cvc: card.cvc,
        name: card.name,
      });
      setCardStatus('success');
      setCardMsg(`${amt} ${card.asset} added to your ${mode.toLowerCase()} wallet.`);
      setCard((c) => ({ ...c, number: '', expiry: '', cvc: '', amount: '' }));
    } catch (e) {
      setCardStatus('error');
      setCardMsg(e instanceof Error ? e.message : 'Payment failed. Please try again.');
    }
  };

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

      {/* Method selector */}
      <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/20 p-1">
        {([['CRYPTO', 'Crypto', Coins], ['CARD', 'Credit / Debit Card', CreditCard]] as const).map(([m, l, Icon]) => (
          <button
            key={m}
            onClick={() => setMethod(m)}
            className={cn('flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition', method === m ? 'bg-brand-blue text-white' : 'text-slate-400 hover:text-white')}
          >
            <Icon size={16} /> {l}
          </button>
        ))}
      </div>

      {method === 'CARD' ? (
        <div className="card mt-4">
          {cardStatus === 'success' ? (
            <div className="py-6 text-center">
              <CheckCircle2 size={44} className="mx-auto text-brand-emerald" />
              <h2 className="mt-3 text-lg font-bold text-white">Payment successful</h2>
              <p className="mt-1 text-sm text-slate-400">{cardMsg}</p>
              <button onClick={() => { setCardStatus('idle'); setCardMsg(null); }} className="btn-ghost mt-5">Make another deposit</button>
            </div>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold text-white">Pay by card</h2>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span className="rounded bg-white/10 px-1.5 py-0.5 font-semibold text-white">{cardBrand(card.number)}</span>
                  <span className="rounded bg-white/5 px-1.5 py-0.5">VISA</span>
                  <span className="rounded bg-white/5 px-1.5 py-0.5">MC</span>
                  <span className="rounded bg-white/5 px-1.5 py-0.5">AMEX</span>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="label">Card number</span>
                  <input value={card.number} onChange={(e) => setCard({ ...card, number: formatCardNumber(e.target.value) })} inputMode="numeric" placeholder="1234 5678 9012 3456" className="input font-mono" />
                </label>
                <label className="block">
                  <span className="label">Expiry (MM/YY)</span>
                  <input value={card.expiry} onChange={(e) => setCard({ ...card, expiry: formatExpiry(e.target.value) })} inputMode="numeric" placeholder="12/28" className="input font-mono" />
                </label>
                <label className="block">
                  <span className="label">CVC</span>
                  <input value={card.cvc} onChange={(e) => setCard({ ...card, cvc: e.target.value.replace(/\D/g, '').slice(0, 4) })} inputMode="numeric" placeholder="123" className="input font-mono" />
                </label>
                <label className="block sm:col-span-2">
                  <span className="label">Cardholder name</span>
                  <input value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })} placeholder="Name on card" className="input" />
                </label>
                <label className="block">
                  <span className="label">Deposit as</span>
                  <select value={card.asset} onChange={(e) => setCard({ ...card, asset: e.target.value })} className="input">
                    {['USDT', 'USDC', 'BTC', 'ETH'].map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="label">Amount</span>
                  <input value={card.amount} onChange={(e) => setCard({ ...card, amount: e.target.value })} type="number" placeholder="0.00" className="input" />
                </label>
              </div>
              {cardMsg && cardStatus === 'error' && (
                <p className="mt-3 flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400"><XCircle size={15} /> {cardMsg}</p>
              )}
              <button onClick={payByCard} disabled={cardStatus === 'processing'} className="btn-primary mt-4 w-full">
                {cardStatus === 'processing' ? <><Loader2 size={16} className="animate-spin" /> Processing securely…</> : <>Pay {card.amount ? `${card.amount} ${card.asset}` : ''}</>}
              </button>
              <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-slate-500">
                <Info size={12} /> Simulated payment gateway — no real card is charged.
              </p>
            </>
          )}
        </div>
      ) : (
      <>
      {/* Asset selector */}
      <div className="card mt-4">
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
      </>
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
