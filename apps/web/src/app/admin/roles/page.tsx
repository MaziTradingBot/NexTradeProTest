'use client';

import { useEffect, useState } from 'react';
import { Shield, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Role {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isAdmin: boolean;
  isSystem: boolean;
  userCount: number;
  permissions: string[];
}

export default function AdminRolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);

  useEffect(() => {
    api.get<Role[]>('/api/admin/roles').then(setRoles).catch(() => {});
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Roles &amp; Permissions</h1>
      <p className="mt-1 text-slate-400">
        Built-in admin roles, each bundling a curated set of permissions. Assign them to users from
        the Users &amp; Roles page.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {roles.map((r) => (
          <div key={r.id} className="card">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className={cn('inline-flex rounded-xl p-2', r.isAdmin ? 'bg-brand-gradient text-white' : 'bg-white/5 text-slate-400')}>
                  <Shield size={18} />
                </div>
                <div>
                  <div className="font-semibold text-white">{r.name}</div>
                  <div className="font-mono text-xs text-slate-500">{r.key}</div>
                </div>
              </div>
              <span className="badge bg-white/5 text-slate-400">
                <Users size={11} /> {r.userCount}
              </span>
            </div>

            {r.description && <p className="mt-3 text-sm text-slate-400">{r.description}</p>}

            <div className="mt-4">
              <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                {r.key === 'SUPER_ADMIN' ? 'All permissions' : `${r.permissions.length} permissions`}
              </div>
              <div className="flex flex-wrap gap-1">
                {r.permissions.slice(0, 8).map((p) => (
                  <span key={p} className="badge bg-white/5 font-mono text-[11px] text-slate-400">
                    {p}
                  </span>
                ))}
                {r.permissions.length > 8 && (
                  <span className="badge bg-white/5 text-[11px] text-slate-500">+{r.permissions.length - 8}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
