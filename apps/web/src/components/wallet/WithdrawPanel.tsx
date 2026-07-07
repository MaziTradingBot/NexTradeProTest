'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Coins, Landmark, Loader2, CheckCircle2, XCircle, Wallet } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { WithdrawalMethods, type BankAccount, type PayoutWallet } from '@/components/WithdrawalMethods';

type Mode = 'DEMO' | 'LIVE';
type Method = 'CRYPTO' | 'BANK';
interface WalletRow { asset: string; balance: string; locked: string }

const FEE_RATE = 0.001; // 0.1%

export function WithdrawPanel({ wallets, onDone }: { mode: Mode; wallets: WalletRow[]; onDone: () => void }) {
  const [method, setMethod] = useState<Method>('CRYPTO');
  const [payoutWallets, setPayoutWallets] = useState<PayoutWallet[]>([]);
  const [banks, setBanks] = useState<BankAccount[]>([]);

  const loadMethods = useCallback(() => {
    api.get<PayoutWallet[]>('/api/account/payout-wallets').then(setPayoutWallets).catch(() => {});
    api.get<BankAccount[]>('/api/account/bank-accounts').then(setBanks).catch(() => {});
  }, []);
  useEffect(loadMethods, [loadMethods]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/20 p-1">
        {([['CRYPTO', 'Crypto', Coins], ['BANK', 'Bank', Landmark]] as const).map(([m, l, Icon]) => (
          <button key={m} onClick={() => setMethod(m)} className={cn('flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold transition', method === m ? 'bg-brand-blue text-white' : 'text-slate-400 hover:text-white')}>
            <Icon size={15} /> {l}
          </button>
        ))}
      </div>

      {method === 'CRYPTO'
        ? <CryptoWithdraw wallets={wallets} payoutWallets={payoutWallets} onDone={onDone} />
        : <BankWithdraw wallets={wallets} banks={banks} onDone={onDone} />}

      {/* Manage saved destinations, inline within the Withdraw tab */}
      <WithdrawalMethods onChange={loadMethods} />
    </div>
  );
}

function AvailableRow({ available, asset }: { available: number; asset: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-xs">
      <span className="flex items-center gap-1.5 text-slate-400"><Wallet size={12} /> Available</span>
      <button type="button" className="font-mono font-medium text-white">{available.toLocaleString(undefined, { maximumFractionDigits: 8 })} {asset}</button>
    </div>
  );
}

function CryptoWithdraw({ wallets, payoutWallets, onDone }: { wallets: WalletRow[]; payoutWallets: PayoutWallet[]; onDone: () => void }) {
  const [asset, setAsset] = useState('USDT');
  const [destId, setDestId] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    const def = payoutWallets.find((w) => w.isDefault) ?? payoutWallets[0];
    if (def && !destId) setDestId(def.id);
  }, [payoutWallets, destId]);

  const wallet = wallets.find((w) => w.asset === asset);
  const available = wallet ? Math.max(0, parseFloat(wallet.balance) - parseFloat(wallet.locked)) : 0;
  const amt = parseFloat(amount) || 0;
  const fee = +(amt * FEE_RATE).toFixed(8);
  const dest = payoutWallets.find((w) => w.id === destId);

  const submit = async () => {
    setResult(null);
    if (!amt || amt <= 0) return setResult({ ok: false, msg: 'Enter a valid amount.' });
    if (amt > available) return setResult({ ok: false, msg: 'Amount exceeds your available balance.' });
    if (!destId) return setResult({ ok: false, msg: 'Add or select a destination wallet below.' });
    setBusy(true);
    try {
      await api.post('/api/account/withdraw', { asset, amount: amt, payoutWalletId: destId });
      setResult({ ok: true, msg: `Withdrawal of ${amt} ${asset} submitted — pending admin approval.` });
      setAmount(''); onDone();
    } catch (e) { setResult({ ok: false, msg: e instanceof Error ? e.message : 'Failed' }); }
    finally { setBusy(false); }
  };

  return (
    <div className="card space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Asset</label>
          <select value={asset} onChange={(e) => { setAsset(e.target.value); setResult(null); }} className="input">
            {wallets.map((w) => <option key={w.asset} value={w.asset}>{w.asset}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Destination wallet</label>
          <select value={destId} onChange={(e) => setDestId(e.target.value)} className="input">
            <option value="">Select a saved wallet…</option>
            {payoutWallets.map((w) => <option key={w.id} value={w.id}>{w.label} · {w.asset}/{w.network}{w.isDefault ? ' (default)' : ''}</option>)}
          </select>
        </div>
      </div>
      {dest && <p className="truncate rounded-lg bg-white/5 px-3 py-2 font-mono text-xs text-slate-400">→ {dest.address}{dest.memoTag ? ` · memo ${dest.memoTag}` : ''} · {dest.network}</p>}
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
      <p className="text-xs text-slate-500">Estimated arrival: ~10–30 min after approval.</p>
      {result && <p className={cn('flex items-center gap-2 rounded-lg px-3 py-2 text-sm', result.ok ? 'bg-brand-emerald/10 text-brand-emerald' : 'bg-red-500/10 text-red-400')}>{result.ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />} {result.msg}</p>}
      <button onClick={submit} disabled={busy} className="btn-primary w-full disabled:opacity-60">{busy ? <Loader2 size={16} className="animate-spin" /> : null} Request withdrawal</button>
    </div>
  );
}

function BankWithdraw({ wallets, banks, onDone }: { wallets: WalletRow[]; banks: BankAccount[]; onDone: () => void }) {
  const [bankId, setBankId] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => { const def = banks.find((b) => b.isDefault) ?? banks[0]; if (def && !bankId) setBankId(def.id); }, [banks, bankId]);

  const usdt = wallets.find((w) => w.asset === 'USDT');
  const available = usdt ? Math.max(0, parseFloat(usdt.balance) - parseFloat(usdt.locked)) : 0;
  const amt = parseFloat(amount) || 0;
  const fee = +(amt * FEE_RATE).toFixed(2);
  const bank = banks.find((b) => b.id === bankId);

  const submit = async () => {
    setResult(null);
    if (!amt || amt <= 0) return setResult({ ok: false, msg: 'Enter a valid amount.' });
    if (amt > available) return setResult({ ok: false, msg: 'Amount exceeds your available USDT balance.' });
    if (!bankId) return setResult({ ok: false, msg: 'Add or select a bank account below.' });
    setBusy(true);
    try {
      await api.post('/api/account/withdraw', { asset: 'USDT', amount: amt, bankAccountId: bankId });
      setResult({ ok: true, msg: `Bank withdrawal of ${amt} USDT submitted — pending admin approval.` });
      setAmount(''); onDone();
    } catch (e) { setResult({ ok: false, msg: e instanceof Error ? e.message : 'Failed' }); }
    finally { setBusy(false); }
  };

  return (
    <div className="card space-y-3">
      <div>
        <label className="label">Bank account</label>
        <select value={bankId} onChange={(e) => setBankId(e.target.value)} className="input">
          <option value="">Select a saved bank account…</option>
          {banks.map((b) => <option key={b.id} value={b.id}>{b.bankName} · {b.accountNumber}{b.isDefault ? ' (default)' : ''}</option>)}
        </select>
      </div>
      {bank && <div className="rounded-lg bg-white/5 px-3 py-2 text-xs text-slate-400">{bank.accountHolderName} · {bank.currency}{bank.iban ? ` · ${bank.iban}` : ''}</div>}
      <div>
        <label className="label">Amount (USDT)</label>
        <div className="flex gap-2">
          <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" placeholder="0.00" className="input" />
          <button type="button" onClick={() => setAmount(String(available))} className="btn-ghost whitespace-nowrap text-xs">Max</button>
        </div>
      </div>
      <AvailableRow available={available} asset="USDT" />
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-lg bg-white/5 px-3 py-2"><div className="text-slate-500">Withdrawal fee</div><div className="font-medium text-white">{fee} USDT</div></div>
        <div className="rounded-lg bg-white/5 px-3 py-2"><div className="text-slate-500">Processing time</div><div className="font-medium text-white">1–3 business days</div></div>
      </div>
      {result && <p className={cn('flex items-center gap-2 rounded-lg px-3 py-2 text-sm', result.ok ? 'bg-brand-emerald/10 text-brand-emerald' : 'bg-red-500/10 text-red-400')}>{result.ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />} {result.msg}</p>}
      <button onClick={submit} disabled={busy} className="btn-primary w-full disabled:opacity-60">{busy ? <Loader2 size={16} className="animate-spin" /> : null} Request bank withdrawal</button>
    </div>
  );
}
