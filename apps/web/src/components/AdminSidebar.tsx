'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  ArrowDownToLine,
  ArrowUpToLine,
  Megaphone,
  ShieldCheck,
  FileClock,
  BadgeCheck,
  SlidersHorizontal,
  Wand2,
  Home,
} from 'lucide-react';
import { Logo } from './Logo';
import { useAuth } from '@/lib/store';
import { cn } from '@/lib/utils';

// Each item declares the permission(s) that reveal it. Super Admin sees all.
const ITEMS = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard, perms: ['admin.access'] },
  { href: '/admin/users', label: 'Users & Roles', icon: Users, perms: ['users.view'] },
  { href: '/admin/withdrawals', label: 'Withdrawals', icon: ArrowDownToLine, perms: ['withdrawals.view'] },
  { href: '/admin/deposits', label: 'Deposits', icon: ArrowUpToLine, perms: ['deposits.view'] },
  { href: '/admin/kyc', label: 'KYC Review', icon: BadgeCheck, perms: ['kyc.view'] },
  { href: '/admin/announcements', label: 'Announcements', icon: Megaphone, perms: ['content.manage'] },
  { href: '/admin/roles', label: 'Roles & Permissions', icon: ShieldCheck, perms: ['roles.assign', 'roles.manage'] },
  { href: '/admin/settings', label: 'Platform Settings', icon: SlidersHorizontal, perms: ['system.settings'] },
  { href: '/admin/toolkit', label: 'Presentation Toolkit', icon: Wand2, perms: ['system.settings'] },
  { href: '/admin/audit', label: 'Audit Log', icon: FileClock, perms: ['system.audit'] },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { user, hasPermission } = useAuth();

  const visible = ITEMS.filter((it) => user?.isSuperAdmin || it.perms.some((p) => hasPermission(p)));

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-white/10 bg-bg-surface/60 p-4 lg:flex">
      <Link href="/" className="mb-8 mt-2 px-2">
        <Logo />
      </Link>

      <nav className="flex-1 space-y-1">
        {visible.map((it) => {
          const active = pathname === it.href;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                active ? 'bg-brand-gradient text-white shadow-glow' : 'text-slate-400 hover:bg-white/5 hover:text-white',
              )}
            >
              <it.icon size={18} />
              {it.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="text-xs font-medium text-white">{user?.fullName}</div>
        <div className="truncate text-xs text-slate-500">{user?.email}</div>
        <Link href="/dashboard" className="mt-3 flex items-center gap-2 text-xs text-brand-blue hover:underline">
          <Home size={13} /> Back to app
        </Link>
      </div>
    </aside>
  );
}
