'use client';

import { useEffect, useState, useCallback } from 'react';
import { Search, Shield, X, UserCog, Ban, CheckCircle2, Trash2, DollarSign } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { cn } from '@/lib/utils';

interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  status: string;
  kycStatus: string;
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

  const creditUser = async (u: AdminUser) => {
    const input = prompt(`Add demo USDT to ${u.fullName}'s account:`, '10000');
    if (input === null) return;
    const amount = parseFloat(input);
    if (!amount || amount <= 0) return showToast('Enter a valid amount');
    try {
      await api.post(`/api/admin/users/${u.id}/credit`, { asset: 'USDT', amount });
      showToast(`Added ${amount.toLocaleString()} demo USDT to ${u.fullName}`);
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
                        <button onClick={() => creditUser(u)} title="Add demo funds" className="btn-ghost px-2.5 py-1.5 text-xs text-brand-emerald">
                          <DollarSign size={14} />
                        </button>
                      )}
                      {canAssign && (
                        <button onClick={() => setSelected(u)} className="btn-ghost px-3 py-1.5 text-xs">
                          <UserCog size={14} /> Roles
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

      {/* Role-assignment drawer */}
      {selectedLive && canAssign && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm" onClick={() => setSelected(null)}>
          <div
            className="h-full w-full max-w-md overflow-y-auto border-l border-white/10 bg-bg-surface p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Manage roles</h2>
                <p className="text-sm text-slate-400">{selectedLive.fullName}</p>
              </div>
              <button onClick={() => setSelected(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5">
                <X size={18} />
              </button>
            </div>

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
