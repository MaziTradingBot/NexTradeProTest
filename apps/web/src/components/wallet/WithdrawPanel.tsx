'use client';

import { useMemo, useState } from 'react';
import { Coins, Landmark, Loader2, CheckCircle2, XCircle, Wallet } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

type Mode = 'DEMO' | 'LIVE';
type Method = 'CRYPTO' | 'BANK';
interface WalletRow { asset: string; balance: string; locked: string }

const FEE_RATE = 0.001; // 0.1%
const NETWORKS: Record<string, string[]> = {
  BTC: ['Bitcoin'], ETH: ['ERC20'], USDT: ['ERC20', 'TRC20', 'BEP20'], USDC: ['ERC20', 'BEP20'],
  BNB: ['BEP20'], SOL: ['Solana'], XRP: ['XRP Ledger'], ADA: ['Cardano'], DOGE: ['Dogecoin'], LTC: ['Litecoin'],
};

export function WithdrawPanel({ wallets, onDone }: { mode: Mode; wallets: WalletRow[]; onDone: () => void }) {
  const [method, setMethod] = useState<Method>('CRYPTO');
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/20 p-1">
        {([['CRYPTO', 'Crypto', Coins], ['BANK', 'Bank', Landmark]] as const).map(([m, l, Icon]) => (
          <button key={m} onClick={() => setMethod(m)} className={cn('flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold transition', method === m ? 'bg-brand-blue text-white' : 'text-slate-400 hover:text-white')}>
            <Icon size={15} /> {l}
          </button>
        ))}
      </div>
      {method === 'CRYPTO' ? <CryptoWithdraw wallets={wallets} onDone={onDone} /> : <BankWithdraw wallets={wallets} onDone={onDone} />}
    </div>
  );
}

function AvailableRow({ available, asset }: { available: number; asset: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-xs">
      <span className="flex items-center gap-1.5 text-slate-400"><Wallet size={12} /> Available</span>
      <span className="font-mono font-medium text-white">{available.toLocaleString(undefined, { maximumFractionDigits: 8 })} {asset}</span>
    </div>
  );
}

function Result({ r }: { r: { ok: boolean; msg: string } | null }) {
  if (!r) return null;
  return <p className={cn('flex items-center gap-2 rounded-lg px-3 py-2 text-sm', r.ok ? 'bg-brand-emerald/10 text-brand-emerald' : 'bg-red-500/10 text-red-400')}>{r.ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />} {r.msg}</p>;
}

function CryptoWithdraw({ wallets, onDone }: { wallets: WalletRow[]; onDone: () => void }) {
  const withBalance = wallets.filter((w) => parseFloat(w.balance) > 0);
  const list = withBalance.length ? withBalance : wallets;
  const [asset, setAsset] = useState(list[0]?.asset ?? 'USDT');
  const nets = NETWORKS[asset] ?? ['ERC20'];
  const [network, setNetwork] = useState(nets[0]);
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const wallet = wallets.find((w) => w.asset === asset);
  const available = wallet ? Math.max(0, parseFloat(wallet.balance) - parseFloat(wallet.locked)) : 0;
  const amt = parseFloat(amount) || 0;
  const fee = +(amt * FEE_RATE).toFixed(8);

  const changeAsset = (a: string) => { setAsset(a); setNetwork((NETWORKS[a] ?? ['ERC20'])[0]); setResult(null); };

  const submit = async () => {
    setResult(null);
    if (!address.trim() || address.trim().length < 6) return setResult({ ok: false, msg: 'Enter a valid wallet address.' });
    if (!amt || amt <= 0) return setResult({ ok: false, msg: 'Enter a valid amount.' });
    if (amt > available) return setResult({ ok: false, msg: 'Amount exceeds your available balance.' });
    setBusy(true);
    try {
      await api.post('/api/account/withdraw', { asset, amount: amt, network, address: address.trim() });
      setResult({ ok: true, msg: `Withdrawal of ${amt} ${asset} submitted — pending admin approval.` });
      setAmount(''); setAddress(''); onDone();
    } catch (e) { setResult({ ok: false, msg: e instanceof Error ? e.message : 'Failed' }); }
    finally { setBusy(false); }
  };

  return (
    <div className="card space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Asset</label>
          <select value={asset} onChange={(e) => changeAsset(e.target.value)} className="input">
            {wallets.map((w) => <option key={w.asset} value={w.asset}>{w.asset}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Network</label>
          <select value={network} onChange={(e) => setNetwork(e.target.value)} className="input">
            {nets.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label">Recipient wallet address</label>
        <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={`Enter the ${asset} address`} className="input font-mono" />
      </div>
      <div>
        <label className="label">Amount</label>
        <div className="flex gap-2">
          <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" placeholder="0.00" className="input" />
          <button type="button" onClick={() => setAmount(String(available))} className="btn-ghost whitespace-nowrap text-xs">Max</button>
        </div>
      </div>
      <AvailableRow available={available} asset={asset} />
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-lg bg-white/5 px-3 py-2"><div className="text-slate-500">Network fee</div><div className="font-medium text-white">{fee} {asset}</div></div>
        <div className="rounded-lg bg-white/5 px-3 py-2"><div className="text-slate-500">You receive</div><div className="font-medium text-white">{Math.max(0, amt - fee).toLocaleString(undefined, { maximumFractionDigits: 8 })} {asset}</div></div>
      </div>
      <p className="text-xs text-slate-500">Estimated arrival: ~10–30 min after approval. Double-check the address — crypto transfers cannot be reversed.</p>
      <Result r={result} />
      <button onClick={submit} disabled={busy} className="btn-primary w-full disabled:opacity-60">{busy ? <Loader2 size={16} className="animate-spin" /> : null} Request withdrawal</button>
    </div>
  );
}

function BankWithdraw({ wallets, onDone }: { wallets: WalletRow[]; onDone: () => void }) {
  const [f, setF] = useState({ holder: '', bank: '', account: '', amount: '' });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const set = (k: string, v: string) => setF({ ...f, [k]: v });

  const usdt = wallets.find((w) => w.asset === 'USDT');
  const available = usdt ? Math.max(0, parseFloat(usdt.balance) - parseFloat(usdt.locked)) : 0;
  const amt = parseFloat(f.amount) || 0;
  const fee = +(amt * FEE_RATE).toFixed(2);

  const submit = async () => {
    setResult(null);
    if (!f.holder.trim() || !f.bank.trim() || f.account.trim().length < 4) return setResult({ ok: false, msg: 'Fill in the account holder, bank and account/IBAN.' });
    if (!amt || amt <= 0) return setResult({ ok: false, msg: 'Enter a valid amount.' });
    if (amt > available) return setResult({ ok: false, msg: 'Amount exceeds your available USDT balance.' });
    setBusy(true);
    try {
      await api.post('/api/account/withdraw', { asset: 'USDT', amount: amt, network: 'Bank Transfer', address: `${f.bank} · ${f.account} (${f.holder})` });
      setResult({ ok: true, msg: `Bank withdrawal of ${amt} USDT submitted — pending admin approval.` });
      setF({ holder: '', bank: '', account: '', amount: '' }); onDone();
    } catch (e) { setResult({ ok: false, msg: e instanceof Error ? e.message : 'Failed' }); }
    finally { setBusy(false); }
  };

  return (
    <div className="card space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label">Account holder</label><input value={f.holder} onChange={(e) => set('holder', e.target.value)} placeholder="Full name" className="input" /></div>
        <div><label className="label">Bank name</label><input value={f.bank} onChange={(e) => set('bank', e.target.value)} placeholder="Your bank" className="input" /></div>
      </div>
      <div><label className="label">Account number / IBAN</label><input value={f.account} onChange={(e) => set('account', e.target.value)} placeholder="Account number or IBAN" className="input font-mono" /></div>
      <div>
        <label className="label">Amount (USDT)</label>
        <div className="flex gap-2">
          <input value={f.amount} onChange={(e) => set('amount', e.target.value)} type="number" placeholder="0.00" className="input" />
          <button type="button" onClick={() => set('amount', String(available))} className="btn-ghost whitespace-nowrap text-xs">Max</button>
        </div>
      </div>
      <AvailableRow available={available} asset="USDT" />
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-lg bg-white/5 px-3 py-2"><div className="text-slate-500">Withdrawal fee</div><div className="font-medium text-white">{fee} USDT</div></div>
        <div className="rounded-lg bg-white/5 px-3 py-2"><div className="text-slate-500">Processing time</div><div className="font-medium text-white">1–3 business days</div></div>
      </div>
      <Result r={result} />
      <button onClick={submit} disabled={busy} className="btn-primary w-full disabled:opacity-60">{busy ? <Loader2 size={16} className="animate-spin" /> : null} Request bank withdrawal</button>
    </div>
  );
}
