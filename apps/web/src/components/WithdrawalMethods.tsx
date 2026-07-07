'use client';

import { useCallback, useEffect, useState } from 'react';
import { Landmark, Wallet, Plus, Star, Trash2, X } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

export interface BankAccount {
  id: string; accountHolderName: string; bankName: string; accountNumber: string;
  iban: string | null; swiftBic: string | null; branchName: string | null; branchAddress: string | null;
  country: string; currency: string; isDefault: boolean;
}
export interface PayoutWallet {
  id: string; label: string; asset: string; network: string; address: string; memoTag: string | null; isDefault: boolean;
}

const ASSET_NETWORKS: Record<string, string[]> = {
  BTC: ['Bitcoin'], ETH: ['ERC20'], USDT: ['ERC20', 'TRC20', 'BEP20'], USDC: ['ERC20', 'BEP20'],
  BNB: ['BEP20'], SOL: ['Solana'], XRP: ['XRP Ledger'], DOGE: ['Dogecoin'], ADA: ['Cardano'], LTC: ['Litecoin'],
};
const ASSETS = Object.keys(ASSET_NETWORKS);
const MEMO_ASSETS = new Set(['XRP']);

export function WithdrawalMethods({ onChange }: { onChange?: () => void }) {
  const [tab, setTab] = useState<'CRYPTO' | 'BANK'>('CRYPTO');
  const [wallets, setWallets] = useState<PayoutWallet[]>([]);
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };
  const load = useCallback(() => {
    api.get<PayoutWallet[]>('/api/account/payout-wallets').then(setWallets).catch(() => {});
    api.get<BankAccount[]>('/api/account/bank-accounts').then(setBanks).catch(() => {});
  }, []);
  useEffect(load, [load]);

  const afterMutate = () => { load(); onChange?.(); };

  const setDefault = async (type: 'payout-wallets' | 'bank-accounts', id: string) => {
    await api.post(`/api/account/${type}/${id}/default`).catch(() => {});
    afterMutate();
  };
  const remove = async (type: 'payout-wallets' | 'bank-accounts', id: string) => {
    await api.del(`/api/account/${type}/${id}`).catch(() => {});
    afterMutate();
    flash('Removed');
  };

  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-white">Withdrawal methods</h2>
        <div className="flex rounded-xl bg-black/20 p-1">
          {(['CRYPTO', 'BANK'] as const).map((t) => (
            <button key={t} onClick={() => { setTab(t); setAdding(false); }} className={cn('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition', tab === t ? 'bg-white/10 text-white' : 'text-slate-400')}>
              {t === 'CRYPTO' ? <Wallet size={13} /> : <Landmark size={13} />}{t === 'CRYPTO' ? 'Crypto' : 'Bank'}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {tab === 'CRYPTO' ? (
          wallets.length === 0 ? <Empty text="No saved crypto wallets yet." /> : wallets.map((w) => (
            <MethodRow key={w.id} isDefault={w.isDefault}
              title={<>{w.label} <span className="text-xs text-slate-500">· {w.asset}/{w.network}</span></>}
              subtitle={<span className="font-mono">{w.address.slice(0, 10)}…{w.address.slice(-6)}{w.memoTag ? ` · memo ${w.memoTag}` : ''}</span>}
              onDefault={() => setDefault('payout-wallets', w.id)} onRemove={() => remove('payout-wallets', w.id)} />
          ))
        ) : (
          banks.length === 0 ? <Empty text="No saved bank accounts yet." /> : banks.map((b) => (
            <MethodRow key={b.id} isDefault={b.isDefault}
              title={<>{b.bankName} <span className="text-xs text-slate-500">· {b.currency}</span></>}
              subtitle={<>{b.accountHolderName} · {b.accountNumber}{b.iban ? ` · ${b.iban}` : ''}</>}
              onDefault={() => setDefault('bank-accounts', b.id)} onRemove={() => remove('bank-accounts', b.id)} />
          ))
        )}
      </div>

      {adding ? (
        tab === 'CRYPTO'
          ? <CryptoForm onDone={() => { setAdding(false); afterMutate(); flash('Wallet saved'); }} onCancel={() => setAdding(false)} />
          : <BankForm onDone={() => { setAdding(false); afterMutate(); flash('Bank account saved'); }} onCancel={() => setAdding(false)} />
      ) : (
        <button onClick={() => setAdding(true)} className="btn-ghost mt-3 w-full text-sm"><Plus size={15} /> Add {tab === 'CRYPTO' ? 'crypto wallet' : 'bank account'}</button>
      )}

      {toast && <div className="mt-3 rounded-lg bg-white/5 px-3 py-2 text-xs text-slate-300">{toast}</div>}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-xl bg-white/5 px-4 py-3 text-sm text-slate-500">{text}</p>;
}

function MethodRow({ isDefault, title, subtitle, onDefault, onRemove }: { isDefault: boolean; title: React.ReactNode; subtitle: React.ReactNode; onDefault: () => void; onRemove: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 truncate font-medium text-white">{title}{isDefault && <span className="badge bg-brand-emerald/15 text-brand-emerald">Default</span>}</div>
        <div className="truncate text-xs text-slate-400">{subtitle}</div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {!isDefault && <button onClick={onDefault} aria-label="Set default" className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-brand-gold"><Star size={15} /></button>}
        <button onClick={onRemove} aria-label="Remove" className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-red-400"><Trash2 size={15} /></button>
      </div>
    </div>
  );
}

function CryptoForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [f, setF] = useState({ label: '', asset: 'USDT', network: 'ERC20', address: '', memoTag: '', isDefault: false });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const networks = ASSET_NETWORKS[f.asset] ?? [];

  const submit = async () => {
    if (!f.label.trim() || f.address.trim().length < 6) return setErr('Enter a label and a valid address.');
    setBusy(true); setErr(null);
    try {
      await api.post('/api/account/payout-wallets', { ...f, memoTag: f.memoTag || undefined });
      onDone();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); } finally { setBusy(false); }
  };

  return (
    <FormShell title="New crypto wallet" onCancel={onCancel}>
      <input value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="Label (e.g. My Ledger)" className="input" />
      <div className="grid grid-cols-2 gap-2">
        <select value={f.asset} onChange={(e) => { const asset = e.target.value; setF({ ...f, asset, network: (ASSET_NETWORKS[asset] ?? [''])[0] }); }} className="input">
          {ASSETS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={f.network} onChange={(e) => setF({ ...f, network: e.target.value })} className="input">
          {networks.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      <input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} placeholder="Wallet address" className="input font-mono" />
      {MEMO_ASSETS.has(f.asset) && <input value={f.memoTag} onChange={(e) => setF({ ...f, memoTag: e.target.value })} placeholder="Memo / Tag (required for this asset)" className="input" />}
      <DefaultToggle checked={f.isDefault} onChange={(v) => setF({ ...f, isDefault: v })} />
      {err && <p className="text-xs text-red-400">{err}</p>}
      <button disabled={busy} onClick={submit} className="btn-primary w-full">{busy ? 'Saving…' : 'Save wallet'}</button>
    </FormShell>
  );
}

function BankForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [f, setF] = useState({ accountHolderName: '', bankName: '', accountNumber: '', iban: '', swiftBic: '', branchName: '', branchAddress: '', country: '', currency: 'USD', isDefault: false });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setF({ ...f, [k]: v });

  const submit = async () => {
    if (!f.accountHolderName || !f.bankName || !f.accountNumber || !f.country) return setErr('Fill in the required fields.');
    setBusy(true); setErr(null);
    try { await api.post('/api/account/bank-accounts', f); onDone(); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); } finally { setBusy(false); }
  };

  return (
    <FormShell title="New bank account" onCancel={onCancel}>
      <input value={f.accountHolderName} onChange={(e) => set('accountHolderName', e.target.value)} placeholder="Account holder name *" className="input" />
      <input value={f.bankName} onChange={(e) => set('bankName', e.target.value)} placeholder="Bank name *" className="input" />
      <div className="grid grid-cols-2 gap-2">
        <input value={f.accountNumber} onChange={(e) => set('accountNumber', e.target.value)} placeholder="Account number *" className="input" />
        <input value={f.iban} onChange={(e) => set('iban', e.target.value)} placeholder="IBAN" className="input" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input value={f.swiftBic} onChange={(e) => set('swiftBic', e.target.value)} placeholder="SWIFT / BIC" className="input" />
        <input value={f.branchName} onChange={(e) => set('branchName', e.target.value)} placeholder="Branch name" className="input" />
      </div>
      <input value={f.branchAddress} onChange={(e) => set('branchAddress', e.target.value)} placeholder="Branch address" className="input" />
      <div className="grid grid-cols-2 gap-2">
        <input value={f.country} onChange={(e) => set('country', e.target.value)} placeholder="Country *" className="input" />
        <input value={f.currency} onChange={(e) => set('currency', e.target.value)} placeholder="Currency" className="input" />
      </div>
      <DefaultToggle checked={f.isDefault} onChange={(v) => setF({ ...f, isDefault: v })} />
      {err && <p className="text-xs text-red-400">{err}</p>}
      <button disabled={busy} onClick={submit} className="btn-primary w-full">{busy ? 'Saving…' : 'Save bank account'}</button>
    </FormShell>
  );
}

function FormShell({ title, onCancel, children }: { title: string; onCancel: () => void; children: React.ReactNode }) {
  return (
    <div className="mt-3 space-y-2 rounded-xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-center justify-between"><span className="text-sm font-semibold text-white">{title}</span><button onClick={onCancel} className="rounded p-1 text-slate-400 hover:bg-white/5"><X size={16} /></button></div>
      {children}
    </div>
  );
}

function DefaultToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-400">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-brand-blue" /> Set as default
    </label>
  );
}
