'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowDownToLine, ArrowUpFromLine, Check, Copy } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { AuthGuard } from '@/components/AuthGuard';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Txn {
  id: string;
  type: string;
  asset: string;
  network: string | null;
  address: string | null;
  amount: string;
  fee: string;
  status: string;
  reference: string | null;
  mode: string;
  createdAt: string;
  updatedAt: string;
}

const WITHDRAW_FLOW = ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'PROCESSING', 'COMPLETED'];
const DEPOSIT_FLOW = ['PENDING', 'COMPLETED'];
const label = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace('_', ' ');

function ExplorerInner() {
  const { id } = useParams<{ id: string }>();
  const [txn, setTxn] = useState<Txn | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.get<Txn>(`/api/account/transactions/${id}`).then(setTxn).catch(() => setNotFound(true));
  }, [id]);

  if (notFound) {
    return (
      <section className="mx-auto max-w-2xl px-4 pt-32 text-center">
        <p className="text-slate-400">Transaction not found.</p>
        <Link href="/wallet" className="btn-primary mt-6">Back to wallet</Link>
      </section>
    );
  }
  if (!txn) {
    return <div className="flex min-h-[60vh] items-center justify-center text-slate-500">Loading…</div>;
  }

  const flow = txn.type === 'WITHDRAWAL' ? WITHDRAW_FLOW : DEPOSIT_FLOW;
  const rejected = txn.status === 'REJECTED';
  const currentIdx = flow.indexOf(txn.status);
  const isWithdraw = txn.type === 'WITHDRAWAL';
  const net = parseFloat(txn.amount) - parseFloat(txn.fee);

  const copy = () => {
    if (txn.reference) navigator.clipboard?.writeText(txn.reference);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <section className="mx-auto max-w-2xl px-4 pt-24 sm:px-6">
      <div className="flex items-center gap-3">
        <div className={cn('inline-flex rounded-2xl p-3 text-white', isWithdraw ? 'bg-red-500/80' : 'bg-brand-gradient')}>
          {isWithdraw ? <ArrowUpFromLine size={22} /> : <ArrowDownToLine size={22} />}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">{isWithdraw ? 'Withdrawal' : 'Deposit'} details</h1>
          <p className="text-slate-400">Transaction explorer</p>
        </div>
        <span className={cn('ml-auto badge', txn.mode === 'DEMO' ? 'bg-brand-emerald/15 text-brand-emerald' : 'bg-brand-blue/15 text-brand-blue')}>{txn.mode}</span>
      </div>

      {/* Reference */}
      <div className="card mt-6">
        <div className="text-xs text-slate-500">Transaction reference</div>
        <div className="mt-1 flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-black/30 px-3 py-2.5 font-mono text-sm text-white">{txn.reference ?? '—'}</code>
          <button onClick={copy} className="rounded-lg bg-white/10 p-2.5 text-white hover:bg-white/20" aria-label="Copy">
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
        </div>
      </div>

      {/* Status timeline */}
      <div className="card mt-4">
        <div className="mb-4 text-sm font-semibold text-white">Status</div>
        {rejected ? (
          <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400">This request was rejected.</div>
        ) : (
          <div className="space-y-0">
            {flow.map((s, i) => {
              const done = i <= currentIdx;
              const current = i === currentIdx;
              return (
                <div key={s} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className={cn('flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold', done ? 'bg-brand-emerald text-white' : 'bg-white/10 text-slate-500')}>
                      {done ? <Check size={13} /> : i + 1}
                    </div>
                    {i < flow.length - 1 && <div className={cn('h-6 w-0.5', i < currentIdx ? 'bg-brand-emerald' : 'bg-white/10')} />}
                  </div>
                  <div className={cn('pb-4 text-sm', current ? 'font-semibold text-white' : done ? 'text-slate-300' : 'text-slate-500')}>{label(s)}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Details */}
      <div className="card mt-4">
        <dl className="divide-y divide-white/5 text-sm">
          {[
            ['Type', isWithdraw ? 'Withdrawal' : 'Deposit'],
            ['Asset', txn.asset],
            ['Network', txn.network ?? '—'],
            ...(txn.address ? [['Address', txn.address]] : []),
            ['Amount', `${parseFloat(txn.amount).toLocaleString()} ${txn.asset}`],
            ['Network fee', `${parseFloat(txn.fee).toLocaleString()} ${txn.asset}`],
            ...(isWithdraw ? [['Net received', `${net.toLocaleString()} ${txn.asset}`]] : []),
            ['Created', new Date(txn.createdAt).toLocaleString()],
            ['Updated', new Date(txn.updatedAt).toLocaleString()],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-3 py-2.5">
              <dt className="text-slate-400">{k}</dt>
              <dd className="max-w-[60%] truncate text-right font-mono text-white">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <p className="mt-4 rounded-xl border border-brand-gold/25 bg-brand-gold/10 px-4 py-3 text-center text-xs text-brand-gold">
        Simulated record for demonstration only — this does not represent a real blockchain transaction.
      </p>

      <div className="mt-6 text-center">
        <Link href="/wallet" className="btn-ghost">Back to wallet</Link>
      </div>
      <div className="h-16" />
    </section>
  );
}

export default function TransactionPage() {
  return (
    <main>
      <Navbar />
      <AuthGuard>
        <ExplorerInner />
      </AuthGuard>
    </main>
  );
}
