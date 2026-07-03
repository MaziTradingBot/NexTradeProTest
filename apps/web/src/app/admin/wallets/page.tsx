'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, Search, Snowflake, Sun, RotateCcw } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { cn } from '@/lib/utils';

interface WalletAddress {
  id: string;
  asset: string;
  network: string;
  address: string;
  minDeposit: string;
  confirmations: number;
  isDefault: boolean;
  enabled: boolean;
}
interface AdminUser {
  id: string;
  email: string;
  fullName: string;
}
interface WalletRow {
  id: string;
  asset: string;
  mode: string;
  balance: string;
  frozen: boolean;
}

export default function AdminWalletsPage() {
  const { user, hasPermission } = useAuth();
  const canAddr = user?.isSuperAdmin || hasPermission('wallets.manage');
  const canBal = user?.isSuperAdmin || hasPermission('balances.manage');

  const [addrs, setAddrs] = useState<WalletAddress[]>([]);
  const [form, setForm] = useState({ asset: '', network: '', address: '', minDeposit: '0', confirmations: 2 });
  const [toast, setToast] = useState<string | null>(null);

  // Manual balance state
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [balForm, setBalForm] = useState({ asset: 'USDT', mode: 'DEMO', amount: '' });

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2500);
  };

  const loadAddrs = useCallback(() => {
    if (canAddr) api.get<WalletAddress[]>('/api/admin/wallet-addresses').then(setAddrs).catch(() => {});
  }, [canAddr]);
  useEffect(loadAddrs, [loadAddrs]);

  const createAddr = async () => {
    try {
      await api.post('/api/admin/wallet-addresses', { ...form, confirmations: Number(form.confirmations) });
      setForm({ asset: '', network: '', address: '', minDeposit: '0', confirmations: 2 });
      loadAddrs();
      flash('Address added');
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Failed');
    }
  };

  const patchAddr = async (id: string, data: Partial<WalletAddress>) => {
    await api.patch(`/api/admin/wallet-addresses/${id}`, data);
    loadAddrs();
  };
  const deleteAddr = async (id: string) => {
    await api.del(`/api/admin/wallet-addresses/${id}`);
    setAddrs((a) => a.filter((x) => x.id !== id));
  };

  // Manual balance
  const searchUsers = async (q: string) => {
    setSearch(q);
    if (q.length < 2) return setUsers([]);
    const data = await api.get<AdminUser[]>(`/api/admin/users?search=${encodeURIComponent(q)}`);
    setUsers(data);
  };
  const pickUser = async (u: AdminUser) => {
    setSelected(u);
    setUsers([]);
    setSearch(u.fullName);
    const w = await api.get<WalletRow[]>(`/api/admin/users/${u.id}/wallets`);
    setWallets(w);
  };
  const doBalance = async (action: string) => {
    if (!selected) return;
    try {
      await api.post(`/api/admin/users/${selected.id}/balance`, {
        asset: balForm.asset,
        mode: balForm.mode,
        action,
        amount: parseFloat(balForm.amount) || 0,
      });
      const w = await api.get<WalletRow[]>(`/api/admin/users/${selected.id}/wallets`);
      setWallets(w);
      flash(`${action} applied`);
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Failed');
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Wallet Management</h1>
      <p className="mt-1 text-slate-400">Manage deposit addresses and adjust user balances.</p>

      {/* Deposit addresses */}
      {canAddr && (
        <div className="card mt-6">
          <h2 className="mb-4 font-semibold text-white">Deposit Wallet Addresses</h2>

          <div className="mb-4 grid gap-2 sm:grid-cols-6">
            <input value={form.asset} onChange={(e) => setForm({ ...form, asset: e.target.value.toUpperCase() })} placeholder="Asset" className="input" />
            <input value={form.network} onChange={(e) => setForm({ ...form, network: e.target.value })} placeholder="Network" className="input" />
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Address" className="input sm:col-span-2" />
            <input value={form.minDeposit} onChange={(e) => setForm({ ...form, minDeposit: e.target.value })} placeholder="Min" className="input" />
            <button onClick={createAddr} className="btn-primary">
              <Plus size={16} /> Add
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-white/10 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Asset</th>
                  <th className="px-3 py-2">Network</th>
                  <th className="px-3 py-2">Address</th>
                  <th className="px-3 py-2 text-center">Default</th>
                  <th className="px-3 py-2 text-center">Enabled</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {addrs.map((a) => (
                  <tr key={a.id}>
                    <td className="px-3 py-2.5 font-medium text-white">{a.asset}</td>
                    <td className="px-3 py-2.5 text-slate-300">{a.network}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-slate-400"><span className="block max-w-[220px] truncate">{a.address}</span></td>
                    <td className="px-3 py-2.5 text-center">
                      <button onClick={() => patchAddr(a.id, { isDefault: !a.isDefault })} className={cn('text-xs font-semibold', a.isDefault ? 'text-brand-gold' : 'text-slate-500')}>
                        {a.isDefault ? '★' : '☆'}
                      </button>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <button
                        onClick={() => patchAddr(a.id, { enabled: !a.enabled })}
                        className={cn('relative inline-block h-5 w-9 rounded-full transition', a.enabled ? 'bg-brand-emerald' : 'bg-white/15')}
                      >
                        <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all', a.enabled ? 'left-[18px]' : 'left-0.5')} />
                      </button>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button onClick={() => deleteAddr(a.id)} className="rounded-lg p-1.5 text-red-400 hover:bg-red-500/10">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manual balance */}
      {canBal && (
        <div className="card mt-6">
          <h2 className="mb-4 font-semibold text-white">Manual Balance Management</h2>

          <div className="relative max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={search} onChange={(e) => searchUsers(e.target.value)} placeholder="Search a user…" className="input pl-9" />
            {users.length > 0 && (
              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-white/10 bg-bg-elevated shadow-card">
                {users.map((u) => (
                  <button key={u.id} onClick={() => pickUser(u)} className="block w-full px-4 py-2 text-left text-sm hover:bg-white/5">
                    <div className="text-white">{u.fullName}</div>
                    <div className="text-xs text-slate-500">{u.email}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selected && (
            <div className="mt-5">
              <div className="mb-3 flex flex-wrap gap-2">
                {wallets.map((w) => (
                  <span key={w.id} className={cn('badge', w.frozen ? 'bg-red-500/15 text-red-400' : 'bg-white/5 text-slate-300')}>
                    {w.mode} {w.asset}: {parseFloat(w.balance).toLocaleString()} {w.frozen && '❄'}
                  </span>
                ))}
              </div>

              <div className="grid gap-2 sm:grid-cols-4">
                <input value={balForm.asset} onChange={(e) => setBalForm({ ...balForm, asset: e.target.value.toUpperCase() })} placeholder="Asset" className="input" />
                <select value={balForm.mode} onChange={(e) => setBalForm({ ...balForm, mode: e.target.value })} className="input">
                  <option value="DEMO">DEMO</option>
                  <option value="LIVE">LIVE</option>
                </select>
                <input value={balForm.amount} onChange={(e) => setBalForm({ ...balForm, amount: e.target.value })} type="number" placeholder="Amount" className="input sm:col-span-2" />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={() => doBalance('CREDIT')} className="rounded-lg bg-brand-emerald/15 px-3 py-2 text-xs font-semibold text-brand-emerald hover:bg-brand-emerald/25">
                  + Credit
                </button>
                <button onClick={() => doBalance('DEBIT')} className="rounded-lg bg-red-500/15 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/25">
                  − Debit
                </button>
                <button onClick={() => doBalance('FREEZE')} className="rounded-lg bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10">
                  <Snowflake size={13} className="mr-1 inline" /> Freeze
                </button>
                <button onClick={() => doBalance('UNFREEZE')} className="rounded-lg bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10">
                  <Sun size={13} className="mr-1 inline" /> Unfreeze
                </button>
                <button onClick={() => doBalance('RESET')} className="rounded-lg bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10">
                  <RotateCcw size={13} className="mr-1 inline" /> Reset
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-xl border border-white/10 bg-bg-elevated px-4 py-2.5 text-sm text-white shadow-card">
          {toast}
        </div>
      )}
    </div>
  );
}
