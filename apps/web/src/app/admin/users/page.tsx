'use client';

import { useEffect, useState, useCallback } from 'react';
import { Search, Shield, X, UserCog, Ban, CheckCircle2, Trash2, DollarSign, Zap, KeyRound } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { cn } from '@/lib/utils';

interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  status: string;
  kycStatus: string;
  liveTradingEnabled: boolean;
  tradingStatus: 'ACTIVE' | 'SUSPENDED';
  tradingPermission: 'FULL' | 'READ_ONLY';
  createdAt: string;
  roles: { key: string; name: string; isAdmin: boolean }[];
}
interface Role {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isAdmin: boolean;
  userCount: number;
}

export default function AdminUsersPage() {
  const { user: me, hasPermission } = useAuth();
  const canAssign = me?.isSuperAdmin || hasPermission('roles.assign');
  const canManage = me?.isSuperAdmin || hasPermission('users.manage');
  const canCredit = me?.isSuperAdmin || hasPermission('balances.manage');

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [creditTarget, setCreditTarget] = useState<AdminUser | null>(null);
  const [creditForm, setCreditForm] = useState({ asset: 'USDT', mode: 'LIVE', amount: '' });
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null);
  const [resetForm, setResetForm] = useState({ pw: '', confirm: '' });
  const [toast, setToast] = useState<string | null>(null);

  const loadUsers = useCallback(async (q = '') => {
    try {
      const data = await api.get<AdminUser[]>(`/api/admin/users${q ? `?search=${encodeURIComponent(q)}` : ''}`);
      setUsers(data);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadUsers();
    if (canAssign) api.get<Role[]>('/api/admin/roles').then(setRoles).catch(() => {});
  }, [loadUsers, canAssign]);

  const showToast = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 3000);
  };

  const assignRole = async (userId: string, roleKey: string) => {
    try {
      const res = await api.post<{ message: string }>(`/api/admin/users/${userId}/roles`, { roleKey });
      showToast(res.message);
      await loadUsers(search);
      setSelected((s) => (s ? users.find((u) => u.id === s.id) ?? s : s));
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed');
    }
  };

  const revokeRole = async (userId: string, roleKey: string) => {
    try {
      await api.del(`/api/admin/users/${userId}/roles/${roleKey}`);
      showToast('Role revoked');
      await loadUsers(search);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed');
    }
  };

  const toggleStatus = async (u: AdminUser) => {
    const next = u.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
    try {
      await api.patch(`/api/admin/users/${u.id}/status`, { status: next });
      showToast(`User ${next === 'ACTIVE' ? 'activated' : 'suspended'}`);
      await loadUsers(search);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed');
    }
  };

  const deleteUser = async (u: AdminUser) => {
    if (!confirm(`Delete ${u.fullName} (${u.email})? This permanently removes the account and all its data.`)) return;
    try {
      await api.del(`/api/admin/users/${u.id}`);
      showToast('User deleted');
      await loadUsers(search);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed');
    }
  };

  const submitCredit = async () => {
    if (!creditTarget) return;
    const amount = parseFloat(creditForm.amount);
    if (!amount || amount <= 0) return showToast('Enter a valid amount');
    try {
      await api.post(`/api/admin/users/${creditTarget.id}/credit`, { asset: creditForm.asset, amount, mode: creditForm.mode });
      showToast(`Added ${amount.toLocaleString()} ${creditForm.asset} to ${creditTarget.fullName} (${creditForm.mode})`);
      setCreditTarget(null);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed');
    }
  };

  const setAccess = async (u: AdminUser, patch: Partial<{ liveTradingEnabled: boolean; tradingStatus: string; tradingPermission: string; accountStatus: string }>) => {
    try {
      await api.patch(`/api/admin/users/${u.id}/trading-access`, patch);
      showToast('Live trading access updated');
      await loadUsers(search);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed');
    }
  };

  const submitReset = async () => {
    if (!resetTarget) return;
    if (resetForm.pw.length < 8) return showToast('Password must be at least 8 characters');
    if (resetForm.pw !== resetForm.confirm) return showToast('Passwords do not match');
    try {
      await api.post(`/api/admin/users/${resetTarget.id}/reset-password`, { newPassword: resetForm.pw });
      showToast(`Password reset for ${resetTarget.fullName}`);
      setResetTarget(null);
      setResetForm({ pw: '', confirm: '' });
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed');
    }
  };

  // Keep the drawer's user object in sync after reloads.
  const selectedLive = selected ? users.find((u) => u.id === selected.id) ?? selected : null;
  const assignableRoles = roles.filter((r) => r.key !== 'USER');

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Users &amp; Roles</h1>
          <p className="mt-1 text-slate-400">
            Assign admin roles — Withdrawal, KYC, Finance, Support and more — to any registered user.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              loadUsers(e.target.value);
            }}
            placeholder="Search users..."
            className="input pl-10"
          />
        </div>
      </div>

      <div className="card mt-6 overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-white/10 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">Roles</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-white/[0.03]">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-gradient text-xs font-bold text-white">
                        {u.fullName.charAt(0)}
                      </div>
                      <div>
                        <div className="font-medium text-white">{u.fullName}</div>
                        <div className="text-xs text-slate-500">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap gap-1">
                      {u.roles.map((r) => (
                        <span
                          key={r.key}
                          className={cn('badge', r.isAdmin ? 'bg-brand-blue/15 text-brand-blue' : 'bg-white/5 text-slate-400')}
                        >
                          {r.isAdmin && <Shield size={10} />} {r.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={cn(
                        'badge',
                        u.status === 'ACTIVE' ? 'bg-brand-emerald/15 text-brand-emerald' : 'bg-red-500/15 text-red-400',
                      )}
                    >
                      {u.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex justify-end gap-2">
                      {canCredit && (
                        <button onClick={() => { setCreditTarget(u); setCreditForm({ asset: 'USDT', mode: 'LIVE', amount: '' }); }} title="Add funds" className="btn-ghost px-3 py-1.5 text-xs text-brand-emerald">
                          <DollarSign size={14} /> Add funds
                        </button>
                      )}
                      {(canAssign || canManage) && (
                        <button onClick={() => setSelected(u)} className="btn-ghost px-3 py-1.5 text-xs">
                          <UserCog size={14} /> Manage
                        </button>
                      )}
                      {canManage && (
                        <button
                          onClick={() => setAccess(u, { liveTradingEnabled: !u.liveTradingEnabled })}
                          title={u.liveTradingEnabled ? 'Disable live trading' : 'Enable live trading'}
                          className={cn('btn-ghost px-2.5 py-1.5 text-xs', u.liveTradingEnabled ? 'text-brand-emerald' : 'text-ink-muted')}
                        >
                          <Zap size={14} />
                        </button>
                      )}
                      {canManage && (
                        <button onClick={() => toggleStatus(u)} title={u.status === 'SUSPENDED' ? 'Activate' : 'Suspend'} className="btn-ghost px-2.5 py-1.5 text-xs">
                          {u.status === 'SUSPENDED' ? <CheckCircle2 size={14} /> : <Ban size={14} />}
                        </button>
                      )}
                      {canManage && u.id !== me?.id && !u.roles.some((r) => r.key === 'SUPER_ADMIN') && (
                        <button onClick={() => deleteUser(u)} title="Delete user" className="btn-ghost px-2.5 py-1.5 text-xs text-red-400 hover:bg-red-500/10">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manage drawer — roles, live-trading access and password reset */}
      {selectedLive && (canAssign || canManage) && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm" onClick={() => setSelected(null)}>
          <div
            className="h-full w-full max-w-md overflow-y-auto border-l border-white/10 bg-bg-surface p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Manage user</h2>
                <p className="text-sm text-slate-400">{selectedLive.fullName} · {selectedLive.email}</p>
              </div>
              <button onClick={() => setSelected(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5">
                <X size={18} />
              </button>
            </div>

            {/* Live Trading Access */}
            {canManage && (
              <div className="mt-5 rounded-xl border border-brand-blue/15 bg-brand-blue/5 p-4">
                <h3 className="mb-3 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-brand-blue">
                  <Zap size={13} /> Live Trading Access
                </h3>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-ink-soft">Live Trading Enabled</span>
                  <button
                    onClick={() => setAccess(selectedLive, { liveTradingEnabled: !selectedLive.liveTradingEnabled })}
                    className={cn('relative h-6 w-11 rounded-full transition', selectedLive.liveTradingEnabled ? 'bg-brand-emerald' : 'bg-white/15')}
                  >
                    <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all', selectedLive.liveTradingEnabled ? 'left-[22px]' : 'left-0.5')} />
                  </button>
                </div>
                <div className="mt-2 space-y-3 border-t border-white/5 pt-3">
                  {([
                    ['Trading permission', 'tradingPermission', [['FULL', 'Full trading'], ['READ_ONLY', 'Read only']]],
                    ['Trading status', 'tradingStatus', [['ACTIVE', 'Active'], ['SUSPENDED', 'Suspended']]],
                    ['Account status', 'accountStatus', [['ACTIVE', 'Active'], ['SUSPENDED', 'Suspended'], ['PENDING', 'Pending']]],
                  ] as const).map(([label, field, opts]) => {
                    const current = field === 'accountStatus' ? selectedLive.status : (selectedLive as unknown as Record<string, string>)[field];
                    return (
                      <div key={field}>
                        <div className="mb-1 text-xs text-ink-muted">{label}</div>
                        <div className="flex flex-wrap gap-1.5">
                          {opts.map(([val, lbl]) => (
                            <button
                              key={val}
                              onClick={() => setAccess(selectedLive, { [field]: val })}
                              className={cn('rounded-lg px-2.5 py-1 text-xs font-medium transition', current === val ? 'bg-brand-blue text-white' : 'bg-white/5 text-ink-muted hover:text-ink')}
                            >
                              {lbl}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button
                  onClick={() => { setResetTarget(selectedLive); setResetForm({ pw: '', confirm: '' }); }}
                  className="btn-ghost mt-4 w-full text-xs"
                >
                  <KeyRound size={13} /> Reset password
                </button>
              </div>
            )}

            {canAssign && (
            <>
            <div className="mt-5">
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Current roles</h3>
              <div className="flex flex-wrap gap-2">
                {selectedLive.roles.length === 0 && <span className="text-sm text-slate-500">None</span>}
                {selectedLive.roles.map((r) => (
                  <span key={r.key} className="badge gap-1.5 bg-brand-blue/15 text-brand-blue">
                    {r.isAdmin && <Shield size={10} />} {r.name}
                    {r.key !== 'USER' && (
                      <button onClick={() => revokeRole(selectedLive.id, r.key)} className="ml-1 hover:text-white" aria-label={`Revoke ${r.name}`}>
                        <X size={12} />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Assign an admin role</h3>
              <div className="space-y-2">
                {assignableRoles.map((r) => {
                  const has = selectedLive.roles.some((ur) => ur.key === r.key);
                  return (
                    <div key={r.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                      <div className="pr-3">
                        <div className="flex items-center gap-1.5 text-sm font-medium text-white">
                          {r.isAdmin && <Shield size={12} className="text-brand-blue" />} {r.name}
                        </div>
                        {r.description && <div className="mt-0.5 text-xs text-slate-500">{r.description}</div>}
                      </div>
                      <button
                        disabled={has}
                        onClick={() => assignRole(selectedLive.id, r.key)}
                        className={cn(
                          'shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                          has ? 'cursor-default bg-white/5 text-slate-500' : 'bg-brand-gradient text-white hover:brightness-110',
                        )}
                      >
                        {has ? 'Assigned' : 'Assign'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
            </>
            )}
          </div>
        </div>
      )}

      {/* Add funds modal */}
      {creditTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={() => setCreditTarget(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-bg-surface p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white">Add funds</h2>
            <p className="mt-1 text-sm text-slate-400">To {creditTarget.fullName} ({creditTarget.email})</p>

            <label className="label mt-4">Account</label>
            <div className="grid grid-cols-2 gap-2">
              {(['LIVE', 'DEMO'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setCreditForm((f) => ({ ...f, mode: m }))}
                  className={cn('rounded-xl py-2 text-sm font-semibold transition', creditForm.mode === m ? (m === 'LIVE' ? 'bg-brand-blue text-white' : 'bg-brand-emerald text-white') : 'bg-white/5 text-slate-400')}
                >
                  {m === 'LIVE' ? 'Live account' : 'Demo account'}
                </button>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="col-span-1">
                <label className="label">Asset</label>
                <select value={creditForm.asset} onChange={(e) => setCreditForm((f) => ({ ...f, asset: e.target.value }))} className="input">
                  {['USDT', 'USDC', 'BTC', 'ETH', 'SOL', 'BNB'].map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="label">Amount</label>
                <input value={creditForm.amount} onChange={(e) => setCreditForm((f) => ({ ...f, amount: e.target.value }))} type="number" placeholder="0.00" className="input" autoFocus />
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button onClick={() => setCreditTarget(null)} className="btn-ghost flex-1">Cancel</button>
              <button onClick={submitCredit} className="btn-primary flex-1">Add funds</button>
            </div>
          </div>
        </div>
      )}

      {/* Reset password modal */}
      {resetTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={() => setResetTarget(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-bg-surface p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="flex items-center gap-2 text-lg font-bold text-white"><KeyRound size={18} className="text-brand-gold" /> Reset password</h2>
            <p className="mt-1 text-sm text-slate-400">For {resetTarget.fullName} ({resetTarget.email})</p>
            <p className="mt-2 text-xs text-ink-muted">The user will be signed out of all sessions and must log in with the new password.</p>

            <label className="label mt-4">New password</label>
            <input type="password" value={resetForm.pw} onChange={(e) => setResetForm((f) => ({ ...f, pw: e.target.value }))} placeholder="At least 8 characters" className="input" autoFocus />
            <label className="label mt-3">Confirm password</label>
            <input type="password" value={resetForm.confirm} onChange={(e) => setResetForm((f) => ({ ...f, confirm: e.target.value }))} className="input" />

            <div className="mt-5 flex gap-2">
              <button onClick={() => setResetTarget(null)} className="btn-ghost flex-1">Cancel</button>
              <button onClick={submitReset} disabled={!resetForm.pw || !resetForm.confirm} className="btn-primary flex-1">Reset password</button>
            </div>
          </div>
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
