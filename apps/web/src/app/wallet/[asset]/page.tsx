'use client';

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Copy, Receipt as ReceiptIcon } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { AuthGuard } from '@/components/AuthGuard';
import { QrCode } from '@/components/QrCode';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { useMode } from '@/lib/useMode';
import { useLiveSync } from '@/lib/useLiveSync';
import { downloadReceipt, type ReceiptTxn } from '@/lib/receipt';
import { cn } from '@/lib/utils';

interface Wallet { asset: string; balance: string; locked: string }
interface Txn extends ReceiptTxn { note?: string | null }
interface Addr { asset: string; network: string; address: string; isDefault: boolean }

const CRYPTO = ['BTC', 'ETH', 'USDT', 'SOL', 'BNB', 'XRP'];
const NAMES: Record<string, string> = { BTC: 'Bitcoin', ETH: 'Ethereum', USDT: 'Tether', SOL: 'Solana', BNB: 'BNB', XRP: 'Ripple' };

function AssetInner({ asset }: { asset: string }) {
  const { user } = useAuth();
  const { mode } = useMode();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [addrs, setAddrs] = useState<Addr[]>([]);
  const [tab, setTab] = useState<'ALL' | 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER'>('ALL');
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    api.get<Wallet[]>('/api/account/wallets').then(setWallets).catch(() => {});
    api.get<Txn[]>('/api/account/transactions').then(setTxns).catch(() => {});
    api.get<Addr[]>('/api/account/deposit-addresses').then(setAddrs).catch(() => {});
  }, []);
  useEffect(() => {
    load();
  }, [load, mode]);
  useLiveSync(load);

  const wallet = wallets.find((w) => w.asset === asset);
  const isCrypto = CRYPTO.includes(asset);
  const assetTxns = useMemo(() => txns.filter((t) => t.asset === asset && (tab === 'ALL' || t.type === tab)), [txns, asset, tab]);
  const addr = addrs.find((a) => a.asset === asset && a.isDefault) ?? addrs.find((a) => a.asset === asset);
  const bal = wallet ? parseFloat(wallet.balance) : 0;
  const locked = wallet ? parseFloat(wallet.locked) : 0;

  return (
    <section className="mx-auto max-w-5xl px-4 pt-24 sm:px-6 lg:px-8">
      <Link href="/wallet" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"><ArrowLeft size={15} /> Back to wallet</Link>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* Balance + address */}
        <div className="card">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-blue/10 font-mono font-bold text-brand-blue">{asset.slice(0, 3)}</span>
            <div>
              <div className="text-lg font-bold text-white">{NAMES[asset] ?? asset}</div>
              <div className="text-xs text-ink-muted">{asset} · {mode} account</div>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-white/5 px-4 py-3">
              <div className="text-xs text-ink-muted">Available</div>
              <div className="mt-0.5 font-mono text-xl font-bold text-white">{bal.toLocaleString(undefined, { maximumFractionDigits: 8 })}</div>
            </div>
            <div className="rounded-xl bg-white/5 px-4 py-3">
              <div className="text-xs text-ink-muted">Reserved</div>
              <div className="mt-0.5 font-mono text-xl font-bold text-ink-soft">{locked.toLocaleString(undefined, { maximumFractionDigits: 8 })}</div>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Link href="/wallet" className="btn-primary flex-1">Deposit</Link>
            <Link href="/wallet" className="btn-ghost flex-1">Withdraw</Link>
          </div>
        </div>

        {isCrypto && addr && (
          <div className="card">
            <div className="text-sm font-semibold text-white">Deposit address</div>
            <div className="mt-1 text-xs text-ink-muted">Network: {addr.network}</div>
            <div className="mt-3 flex justify-center rounded-xl bg-white p-3">
              <QrCode text={addr.address} />
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-black/20 px-3 py-2">
              <code className="flex-1 truncate font-mono text-xs text-ink-soft">{addr.address}</code>
              <button onClick={() => { navigator.clipboard?.writeText(addr.address); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="text-ink-muted hover:text-ink"><Copy size={14} /></button>
            </div>
            {copied && <div className="mt-1 text-xs text-brand-emerald">Address copied</div>}
          </div>
        )}
      </div>

      {/* Transaction history for this asset */}
      <div className="card mt-4 p-0">
        <div className="flex items-center gap-1 border-b border-white/10 px-4 py-3">
          {(['ALL', 'DEPOSIT', 'WITHDRAWAL', 'TRANSFER'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={cn('rounded-lg px-3 py-1.5 text-xs font-semibold transition', tab === t ? 'bg-white/10 text-white' : 'text-ink-muted hover:text-ink')}>
              {t === 'ALL' ? 'All' : t.charAt(0) + t.slice(1).toLowerCase()}
            </button>
          ))}
          <Link href="/history" className="ml-auto text-xs font-semibold text-brand-blue hover:text-brand-cyan">Full history →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-ink-muted">
              <tr><th className="px-4 py-2">Type</th><th className="px-4 py-2 text-right">Amount</th><th className="px-4 py-2">Reference</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Date</th><th className="px-4 py-2 text-right">Receipt</th></tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {assetTxns.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-2.5 font-medium text-white">{t.type.replace('_', ' ')}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-white">{Number(t.amount).toLocaleString(undefined, { maximumFractionDigits: 8 })}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-ink-muted">{t.reference ?? '—'}</td>
                  <td className="px-4 py-2.5"><span className={cn('badge', ['COMPLETED', 'APPROVED'].includes(t.status) ? 'bg-brand-emerald/15 text-brand-emerald' : ['REJECTED'].includes(t.status) ? 'bg-red-500/15 text-red-400' : 'bg-brand-gold/15 text-brand-gold')}>{t.status}</span></td>
                  <td className="px-4 py-2.5 text-ink-muted">{new Date(t.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-2.5 text-right"><button onClick={() => downloadReceipt(t, user?.fullName ?? '')} className="btn-ghost px-2.5 py-1 text-xs"><ReceiptIcon size={12} /> PDF</button></td>
                </tr>
              ))}
              {assetTxns.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-ink-muted">No {asset} activity yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <div className="h-16" />
    </section>
  );
}

export default function WalletAssetPage({ params }: { params: Promise<{ asset: string }> }) {
  const { asset } = use(params);
  return (
    <main>
      <Navbar />
      <AuthGuard>
        <AssetInner asset={decodeURIComponent(asset).toUpperCase()} />
      </AuthGuard>
    </main>
  );
}
