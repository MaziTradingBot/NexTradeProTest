'use client';

import { useEffect, useMemo, useState } from 'react';
import { Copy, Check, Coins, CreditCard, Landmark, Info, Loader2, CheckCircle2, XCircle, ArrowDownToLine, Maximize2, X, Sparkles } from 'lucide-react';
import { QrCode } from '@/components/QrCode';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

type Mode = 'DEMO' | 'LIVE';
type Method = 'CRYPTO' | 'CARD' | 'BANK';

interface DepositAddress {
  id: string; asset: string; network: string; address: string;
  minDeposit: string; confirmations: number; instructions: string | null; isDefault: boolean;
}

function cardBrand(num: string): 'Visa' | 'Mastercard' | 'Amex' | 'Card' {
  const n = num.replace(/\D/g, '');
  if (/^4/.test(n)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(n)) return 'Mastercard';
  if (/^3[47]/.test(n)) return 'Amex';
  return 'Card';
}

// Platform bank details for bank-transfer deposits (demo).
const PLATFORM_BANK = {
  bankName: 'NexTrade Global Bank',
  accountName: 'NexTradePro Ltd',
  accountNumber: '8801 2245 9930',
  iban: 'GB29 NWBK 6016 1331 9268 19',
  swift: 'NWBKGB2LXXX',
};

export function DepositPanel({ mode, onDone }: { mode: Mode; onDone: () => void }) {
  const [method, setMethod] = useState<Method>('CRYPTO');
  const isDemo = mode === 'DEMO';

  return (
    <div>
      {/* Mode banner */}
      <div className={cn('mb-4 flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm', isDemo ? 'border-brand-emerald/25 bg-brand-emerald/10 text-brand-emerald' : 'border-brand-blue/25 bg-brand-blue/10 text-brand-blue')}>
        {isDemo ? <Sparkles size={15} /> : <ArrowDownToLine size={15} />}
        <span>
          {isDemo
            ? 'Demo Mode — fund your demo wallet with instant, simulated credit. No real money is involved.'
            : 'Live Account — deposit real funds to your live trading wallet.'}
        </span>
      </div>

      {/* Method chooser */}
      <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-black/20 p-1">
        {([['CRYPTO', 'Crypto', Coins], ['CARD', 'Card', CreditCard], ['BANK', 'Bank', Landmark]] as const).map(([m, l, Icon]) => (
          <button key={m} onClick={() => setMethod(m)} className={cn('flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold transition sm:text-sm', method === m ? 'bg-brand-blue text-white' : 'text-slate-400 hover:text-white')}>
            <Icon size={15} /> {l}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {method === 'CRYPTO' && <CryptoDeposit mode={mode} onDone={onDone} />}
        {method === 'CARD' && <CardDeposit mode={mode} onDone={onDone} />}
        {method === 'BANK' && <BankDeposit mode={mode} onDone={onDone} />}
      </div>

      {isDemo && method === 'CRYPTO' && <DemoTopUp onDone={onDone} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Crypto
// ---------------------------------------------------------------------------
function CryptoDeposit({ mode, onDone }: { mode: Mode; onDone: () => void }) {
  const isDemo = mode === 'DEMO';
  const [addresses, setAddresses] = useState<DepositAddress[]>([]);
  const [asset, setAsset] = useState('');
  const [network, setNetwork] = useState('');
  const [amount, setAmount] = useState('');
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [zoom, setZoom] = useState(false);

  useEffect(() => {
    api.get<DepositAddress[]>('/api/account/deposit-addresses').then((d) => {
      // Spec assets: BTC, ETH, USDT, SOL first.
      const order = ['BTC', 'ETH', 'USDT', 'SOL'];
      const sorted = [...d].sort((a, b) => (order.indexOf(a.asset) + 99 * (order.indexOf(a.asset) < 0 ? 1 : 0)) - (order.indexOf(b.asset) + 99 * (order.indexOf(b.asset) < 0 ? 1 : 0)));
      setAddresses(sorted);
      if (sorted.length) { setAsset(sorted[0].asset); setNetwork(sorted.find((x) => x.asset === sorted[0].asset && x.isDefault)?.network ?? sorted[0].network); }
    }).catch(() => {});
  }, []);

  const assets = useMemo(() => [...new Set(addresses.map((a) => a.asset))], [addresses]);
  const networks = useMemo(() => addresses.filter((a) => a.asset === asset), [addresses, asset]);
  const current = useMemo(() => networks.find((n) => n.network === network) ?? networks[0], [networks, network]);

  const copy = () => { if (!current) return; navigator.clipboard?.writeText(current.address); setCopied(true); setTimeout(() => setCopied(false), 1600); };

  const submit = async () => {
    if (!current) return;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return setResult({ ok: false, msg: 'Enter a valid amount.' });
    if (amt < parseFloat(current.minDeposit)) return setResult({ ok: false, msg: `Minimum deposit is ${current.minDeposit} ${current.asset}.` });
    setResult(null); setConfirming(true); setStep(0);
    if (isDemo) for (let i = 1; i <= current.confirmations; i++) { await new Promise((r) => setTimeout(r, Math.min(350, 1800 / current.confirmations))); setStep(i); }
    try {
      await api.post('/api/account/deposit', { asset, amount: amt, network });
      setResult({ ok: true, msg: isDemo ? `${amt} ${asset} credited to your demo wallet.` : `Deposit request for ${amt} ${asset} recorded — funds credited after network confirmation.` });
      setAmount(''); onDone();
    } catch (e) { setResult({ ok: false, msg: e instanceof Error ? e.message : 'Failed' }); }
    finally { setConfirming(false); }
  };

  return (
    <div className="card">
      <label className="label">Select asset</label>
      <div className="flex flex-wrap gap-2">
        {assets.map((a) => (
          <button key={a} onClick={() => { setAsset(a); const def = addresses.find((x) => x.asset === a && x.isDefault) ?? addresses.find((x) => x.asset === a); setNetwork(def?.network ?? ''); setResult(null); }} className={cn('flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-semibold transition', asset === a ? 'bg-brand-gradient text-white' : 'bg-white/5 text-slate-400 hover:text-white')}>
            <span className={cn('flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold', asset === a ? 'bg-white/20 text-white' : 'bg-white/10 text-slate-300')}>{a.slice(0, 3)}</span> {a}
          </button>
        ))}
      </div>

      {networks.length > 1 && (
        <>
          <label className="label mt-4">Network</label>
          <div className="flex flex-wrap gap-2">
            {networks.map((n) => (
              <button key={n.id} onClick={() => { setNetwork(n.network); setResult(null); }} className={cn('rounded-xl px-3 py-1.5 text-sm font-medium transition', network === n.network ? 'bg-brand-blue text-white' : 'bg-white/5 text-slate-400 hover:text-white')}>{n.network}</button>
            ))}
          </div>
        </>
      )}

      {current && (
        <>
          <div className="mt-5 flex flex-col items-center gap-6 border-t border-white/10 pt-5 sm:flex-row sm:items-start">
            <button onClick={() => setZoom(true)} className="group relative shrink-0" aria-label="Enlarge QR code">
              <QrCode text={current.address} size={160} />
              <span className="absolute right-1.5 top-1.5 rounded-md bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100"><Maximize2 size={13} /></span>
            </button>
            <div className="min-w-0 flex-1">
              <label className="label">{current.asset} deposit address ({current.network})</label>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg bg-black/30 px-3 py-2.5 font-mono text-sm text-white">{current.address}</code>
                <button onClick={copy} className="shrink-0 rounded-lg bg-white/10 p-2.5 text-white transition hover:bg-white/20" aria-label="Copy address">{copied ? <Check size={16} className="text-brand-emerald" /> : <Copy size={16} />}</button>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                {[['Network', current.network], ['Min deposit', `${current.minDeposit} ${current.asset}`], ['Confirmations', String(current.confirmations)], ['Est. arrival', `~${Math.max(1, Math.round(current.confirmations / 2))} min`]].map(([k, v]) => (
                  <div key={k} className="rounded-xl bg-white/5 px-3 py-2"><div className="text-xs text-slate-500">{k}</div><div className="font-medium text-white">{v}</div></div>
                ))}
              </div>
            </div>
          </div>

          {current.instructions && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-brand-gold/25 bg-brand-gold/10 px-4 py-3 text-sm text-slate-200"><Info size={16} className="mt-0.5 shrink-0 text-brand-gold" /><span>{current.instructions}</span></div>
          )}

          <div className="mt-5 border-t border-white/10 pt-5">
            <label className="label">{isDemo ? 'Simulate a deposit' : 'Confirm your deposit amount'}</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" placeholder={`Amount in ${current.asset}`} className="input" disabled={confirming} />
              <button onClick={submit} disabled={confirming} className="btn-primary whitespace-nowrap disabled:opacity-60">
                {confirming ? <Loader2 size={16} className="animate-spin" /> : <ArrowDownToLine size={16} />}
                {confirming ? `Confirming ${step}/${current.confirmations}` : isDemo ? 'Simulate deposit' : 'Submit deposit'}
              </button>
            </div>
            {confirming && isDemo && (
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-brand-emerald transition-all" style={{ width: `${(step / current.confirmations) * 100}%` }} /></div>
            )}
            {result && (
              <p className={cn('mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm', result.ok ? 'bg-brand-emerald/10 text-brand-emerald' : 'bg-red-500/10 text-red-400')}>
                {result.ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />} {result.msg}
              </p>
            )}
          </div>
        </>
      )}

      {zoom && current && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setZoom(false)}>
          <div className="rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between"><span className="text-sm font-semibold text-slate-900">{current.asset} · {current.network}</span><button onClick={() => setZoom(false)} className="text-slate-500 hover:text-slate-900"><X size={18} /></button></div>
            <QrCode text={current.address} size={280} />
            <p className="mt-3 max-w-[280px] break-all text-center font-mono text-xs text-slate-600">{current.address}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------
function CardDeposit({ mode, onDone }: { mode: Mode; onDone: () => void }) {
  const [card, setCard] = useState({ number: '', expiry: '', cvc: '', name: '', asset: 'USDT', amount: '' });
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [msg, setMsg] = useState<string | null>(null);

  const fmtNum = (v: string) => v.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim();
  const fmtExp = (v: string) => { const d = v.replace(/\D/g, '').slice(0, 4); return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d; };
  const amt = parseFloat(card.amount) || 0;
  const fee = +(amt * 0.02).toFixed(2);

  const pay = async () => {
    setMsg(null);
    if (!amt || amt <= 0) return setMsg('Enter a valid amount.');
    if (card.number.replace(/\D/g, '').length < 12) return setMsg('Enter a valid card number.');
    if (!/^\d{2}\/\d{2}$/.test(card.expiry)) return setMsg('Enter the expiry as MM/YY.');
    if (!/^\d{3,4}$/.test(card.cvc)) return setMsg('Enter a valid CVC.');
    if (card.name.trim().length < 2) return setMsg('Enter the cardholder name.');
    setStatus('processing');
    await new Promise((r) => setTimeout(r, 1600));
    try {
      await api.post('/api/account/deposit/card', { asset: card.asset, amount: amt, cardNumber: card.number.replace(/\D/g, ''), expiry: card.expiry, cvc: card.cvc, name: card.name });
      setStatus('success'); setMsg(`${amt} ${card.asset} added to your ${mode.toLowerCase()} wallet.`);
      setCard((c) => ({ ...c, number: '', expiry: '', cvc: '', amount: '' })); onDone();
    } catch (e) { setStatus('error'); setMsg(e instanceof Error ? e.message : 'Payment failed. Please try again.'); }
  };

  if (status === 'success') return (
    <div className="card py-6 text-center">
      <CheckCircle2 size={44} className="mx-auto text-brand-emerald" />
      <h2 className="mt-3 text-lg font-bold text-white">Payment successful</h2>
      <p className="mt-1 text-sm text-slate-400">{msg}</p>
      <button onClick={() => { setStatus('idle'); setMsg(null); }} className="btn-ghost mt-5">Make another deposit</button>
    </div>
  );

  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-white">Pay by card</h2>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <span className="rounded bg-brand-blue/20 px-1.5 py-0.5 font-semibold text-brand-blue">{cardBrand(card.number)}</span>
          <span className="rounded bg-white/5 px-1.5 py-0.5">VISA</span><span className="rounded bg-white/5 px-1.5 py-0.5">MC</span><span className="rounded bg-white/5 px-1.5 py-0.5">AMEX</span>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2"><span className="label">Card number</span><input value={card.number} onChange={(e) => setCard({ ...card, number: fmtNum(e.target.value) })} inputMode="numeric" placeholder="1234 5678 9012 3456" className="input font-mono" /></label>
        <label className="block"><span className="label">Expiry (MM/YY)</span><input value={card.expiry} onChange={(e) => setCard({ ...card, expiry: fmtExp(e.target.value) })} inputMode="numeric" placeholder="12/28" className="input font-mono" /></label>
        <label className="block"><span className="label">CVC</span><input value={card.cvc} onChange={(e) => setCard({ ...card, cvc: e.target.value.replace(/\D/g, '').slice(0, 4) })} inputMode="numeric" placeholder="123" className="input font-mono" /></label>
        <label className="block sm:col-span-2"><span className="label">Cardholder name</span><input value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })} placeholder="Name on card" className="input" /></label>
        <label className="block"><span className="label">Deposit as</span><select value={card.asset} onChange={(e) => setCard({ ...card, asset: e.target.value })} className="input">{['USDT', 'USDC', 'BTC', 'ETH'].map((a) => <option key={a} value={a}>{a}</option>)}</select></label>
        <label className="block"><span className="label">Amount</span><input value={card.amount} onChange={(e) => setCard({ ...card, amount: e.target.value })} type="number" placeholder="0.00" className="input" /></label>
      </div>
      <div className="mt-3 flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-xs text-slate-400">
        <span>Processing fee (2%)</span><span className="font-medium text-white">{fee ? `${fee} ${card.asset}` : '—'}</span>
      </div>
      <p className="mt-1 text-xs text-slate-500">Estimated processing time: instant.</p>
      {msg && status === 'error' && <p className="mt-3 flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400"><XCircle size={15} /> {msg}</p>}
      <button onClick={pay} disabled={status === 'processing'} className="btn-primary mt-4 w-full disabled:opacity-60">
        {status === 'processing' ? <><Loader2 size={16} className="animate-spin" /> Processing securely…</> : <>Pay {card.amount ? `${card.amount} ${card.asset}` : ''}</>}
      </button>
      <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-slate-500"><Info size={12} /> Simulated payment gateway — no real card is charged.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bank transfer
// ---------------------------------------------------------------------------
function BankDeposit({ mode, onDone }: { mode: Mode; onDone: () => void }) {
  const isDemo = mode === 'DEMO';
  const [amount, setAmount] = useState('');
  const [proof, setProof] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const reference = useMemo(() => `NXP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`, []);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (label: string, value: string) => { navigator.clipboard?.writeText(value); setCopied(label); setTimeout(() => setCopied(null), 1400); };

  const submit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return setResult({ ok: false, msg: 'Enter a valid amount.' });
    setBusy(true); setResult(null);
    try {
      await api.post('/api/account/deposit', { asset: 'USDT', amount: amt, network: 'Bank Transfer' });
      setResult({ ok: true, msg: isDemo ? `${amt} USDT credited to your demo wallet.` : `Bank deposit of ${amt} USDT submitted (ref ${reference}) — credited after we confirm your transfer.` });
      setAmount(''); setProof(null); onDone();
    } catch (e) { setResult({ ok: false, msg: e instanceof Error ? e.message : 'Failed' }); }
    finally { setBusy(false); }
  };

  const rows: [string, string][] = [
    ['Bank name', PLATFORM_BANK.bankName], ['Account name', PLATFORM_BANK.accountName],
    ['Account number', PLATFORM_BANK.accountNumber], ['IBAN', PLATFORM_BANK.iban],
    ['SWIFT / BIC', PLATFORM_BANK.swift], ['Reference number', reference],
  ];

  return (
    <div className="card">
      <h2 className="font-semibold text-white">Bank transfer</h2>
      <p className="mt-1 text-sm text-slate-400">Send a transfer to the account below, then submit the amount so we can match it{isDemo ? ' (demo — credited instantly)' : ''}.</p>
      <div className="mt-4 divide-y divide-white/5 rounded-xl border border-white/10">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
            <span className="text-slate-400">{k}</span>
            <span className="flex items-center gap-2">
              <span className={cn('font-medium text-white', k === 'Reference number' && 'font-mono text-brand-blue')}>{v}</span>
              <button onClick={() => copy(k, v)} className="rounded p-1 text-slate-500 hover:bg-white/5 hover:text-white" aria-label={`Copy ${k}`}>{copied === k ? <Check size={13} className="text-brand-emerald" /> : <Copy size={13} />}</button>
            </span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-start gap-2 rounded-xl border border-brand-gold/25 bg-brand-gold/10 px-4 py-3 text-xs text-slate-200"><Info size={14} className="mt-0.5 shrink-0 text-brand-gold" /><span>Always include the reference number so your deposit is credited to the right account. Demo bank details — do not send real funds.</span></div>

      <div className="mt-5 border-t border-white/10 pt-5">
        <label className="label">Amount (USDT equivalent)</label>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" placeholder="0.00" className="input" />
        {!isDemo && (
          <label className="mt-3 flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-white/15 px-4 py-3 text-sm text-slate-400 hover:border-white/25">
            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = () => setProof(typeof r.result === 'string' ? r.result : null); r.readAsDataURL(f); } }} />
            {proof ? <span className="text-brand-emerald">✓ Proof of payment attached</span> : 'Upload proof of payment (optional)'}
          </label>
        )}
        <button onClick={submit} disabled={busy} className="btn-primary mt-3 w-full disabled:opacity-60">{busy ? <Loader2 size={16} className="animate-spin" /> : <Landmark size={16} />} {isDemo ? 'Credit demo balance' : 'Submit bank deposit'}</button>
        <p className="mt-2 text-xs text-slate-500">Estimated processing time: {isDemo ? 'instant' : '1–3 business days'}.</p>
        {result && <p className={cn('mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm', result.ok ? 'bg-brand-emerald/10 text-brand-emerald' : 'bg-red-500/10 text-red-400')}>{result.ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />} {result.msg}</p>}
      </div>
    </div>
  );
}

// Demo-only convenience.
function DemoTopUp({ onDone }: { onDone: () => void }) {
  const [msg, setMsg] = useState<string | null>(null);
  const request = async () => {
    const input = prompt('Request a demo balance top-up (USDT). An admin will review it:', '10000');
    if (input === null) return;
    const amt = parseFloat(input);
    if (!amt || amt <= 0) return setMsg('Enter a valid amount.');
    try { await api.post('/api/account/request-demo-funds', { amount: amt }); setMsg(`Requested ${amt.toLocaleString()} demo USDT — pending admin approval.`); onDone(); }
    catch (e) { setMsg(e instanceof Error ? e.message : 'Failed'); }
  };
  return (
    <div className="mt-3 flex flex-col items-start gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm text-slate-400">Need more demo funds for a presentation?</span>
      <button onClick={request} className="btn-ghost text-xs">Request demo top-up</button>
      {msg && <span className="text-xs text-brand-emerald">{msg}</span>}
    </div>
  );
}
