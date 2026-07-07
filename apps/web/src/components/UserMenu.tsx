'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Wallet, PieChart, Clock, Settings, ShieldCheck, BadgeCheck, LifeBuoy, LogOut, Shield, Users, ChevronDown } from 'lucide-react';
import { useAuth } from '@/lib/store';
import { cn } from '@/lib/utils';

interface Item { href?: string; label: string; icon: typeof Wallet; onClick?: () => void; accent?: boolean }

export function UserMenu() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  useEffect(() => { setOpen(false); }, [pathname]);

  if (!user) return null;

  const initials = user.fullName.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() || user.email[0].toUpperCase();

  const openSupport = () => { setOpen(false); if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('nxp:support')); };
  const signOut = async () => { setOpen(false); await logout(); router.push('/'); };

  const items: (Item | 'divider')[] = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/wallet', label: 'Wallet', icon: Wallet },
    { href: '/portfolio', label: 'Portfolio', icon: PieChart },
    { href: '/history', label: 'Transaction History', icon: Clock },
    { href: '/kyc', label: 'KYC Verification', icon: BadgeCheck },
    { href: '/settings', label: 'Settings', icon: Settings },
    { href: '/settings', label: 'Security', icon: ShieldCheck },
    { label: 'Support', icon: LifeBuoy, onClick: openSupport },
    'divider',
    ...(user.isAdmin ? [{ href: '/admin', label: 'Admin Panel', icon: Shield, accent: true } as Item] : []),
    ...(user.isBroker ? [{ href: '/broker', label: 'Broker Portal', icon: Users } as Item] : []),
    ...(user.isAdmin || user.isBroker ? ['divider' as const] : []),
    { label: 'Sign Out', icon: LogOut, onClick: signOut, accent: false },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1 pl-1 pr-2.5 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
      >
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-gradient text-xs font-bold text-white">{initials}</span>
        )}
        <span className="hidden max-w-[110px] truncate text-sm font-medium text-white sm:block">{user.fullName.split(' ')[0]}</span>
        <ChevronDown size={15} className={cn('text-slate-400 transition-transform', open && 'rotate-180')} />
      </button>

      <div
        role="menu"
        aria-label="Account"
        className={cn(
          'absolute right-0 mt-2 w-64 origin-top-right overflow-hidden rounded-2xl border border-white/10 bg-bg-elevated shadow-card transition duration-150',
          open ? 'pointer-events-auto scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0',
        )}
      >
        <div className="border-b border-white/10 px-4 py-3">
          <div className="truncate text-sm font-semibold text-white">{user.fullName}</div>
          <div className="truncate text-xs text-slate-400">{user.email}</div>
        </div>
        <div className="p-1.5">
          {items.map((it, i) =>
            it === 'divider' ? (
              <div key={`d${i}`} className="my-1.5 border-t border-white/10" />
            ) : it.href ? (
              <Link
                key={it.label}
                href={it.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition',
                  it.accent ? 'text-brand-cyan hover:bg-brand-cyan/10' : 'text-slate-300 hover:bg-white/5 hover:text-white',
                )}
              >
                <it.icon size={16} /> {it.label}
              </Link>
            ) : (
              <button
                key={it.label}
                role="menuitem"
                onClick={it.onClick}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition',
                  it.label === 'Sign Out' ? 'text-red-400 hover:bg-red-500/10' : 'text-slate-300 hover:bg-white/5 hover:text-white',
                )}
              >
                <it.icon size={16} /> {it.label}
              </button>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
