'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, ChevronDown, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';
import { NotificationBell } from './NotificationBell';
import { GlobalSearch } from './GlobalSearch';
import { ModeSwitcher } from './ModeSwitcher';
import { UserMenu } from './UserMenu';
import { HeaderWallet } from './HeaderWallet';
import { useAuth } from '@/lib/store';
import { cn } from '@/lib/utils';

// Trading pages grouped under the Markets menu; Pricing stays standalone.
const MARKETS_LINKS = [
  { href: '/markets', label: 'Markets' },
  { href: '/trading', label: 'Trading' },
  { href: '/copy-trading', label: 'Copy Trading' },
  { href: '/ai', label: 'AI' },
  { href: '/news', label: 'News' },
];
const ALL_LINKS = [...MARKETS_LINKS, { href: '/pricing', label: 'Pricing' }];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { user, loadMe } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    loadMe();
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [loadMe]);

  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <header
      className={cn('fixed inset-x-0 top-0 z-50 transition-all duration-300', scrolled ? 'glass shadow-card' : 'bg-transparent')}
      style={{ paddingTop: 'var(--safe-top)' }}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="NexTradePro home" className="shrink-0"><Logo /></Link>

        {/* Primary nav — Markets dropdown + Pricing */}
        <div className="hidden items-center gap-1 lg:flex">
          <MarketsDropdown pathname={pathname} />
          <Link href="/pricing" aria-current={pathname === '/pricing' ? 'page' : undefined} className={cn('relative rounded-lg px-3 py-2 text-sm font-medium transition-colors', pathname === '/pricing' ? 'text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white')}>
            Pricing
            {pathname === '/pricing' && <span className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-brand-gradient" />}
          </Link>
        </div>

        {/* Right cluster */}
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <div className="hidden lg:block"><GlobalSearch /></div>
          <ThemeToggle />
          {user ? (
            <>
              <HeaderWallet />
              <div className="hidden sm:block"><ModeSwitcher compact /></div>
              <NotificationBell />
              <UserMenu />
            </>
          ) : (
            <>
              <Link href="/login" className="hidden text-sm font-semibold text-slate-300 transition hover:text-white sm:block">Login</Link>
              <Link href="/register" className="btn-primary">Get Started</Link>
            </>
          )}
          <button className="rounded-lg p-2 text-slate-200 lg:hidden" onClick={() => setOpen((v) => !v)} aria-label="Toggle navigation" aria-expanded={open}>
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      {open && (
        <div className="glass border-t border-white/10 lg:hidden">
          <div className="space-y-1 px-4 py-4">
            {user && <div className="pb-2 sm:hidden"><ModeSwitcher /></div>}
            <div className="pb-2"><GlobalSearch /></div>
            {ALL_LINKS.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className={cn('block rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-white/5 hover:text-white', pathname === l.href ? 'bg-white/5 text-white' : 'text-slate-300')}>
                {l.label}
              </Link>
            ))}
            {user && (
              <div className="grid grid-cols-2 gap-2 pt-3">
                <Link href="/wallet?tab=DEPOSIT" className="btn-primary" onClick={() => setOpen(false)}>
                  <ArrowDownToLine size={16} /> Deposit
                </Link>
                <Link href="/wallet?tab=WITHDRAW" className="btn-ghost" onClick={() => setOpen(false)}>
                  <ArrowUpFromLine size={16} /> Withdraw
                </Link>
              </div>
            )}
            {!user && (
              <div className="flex flex-col gap-2 pt-3">
                <Link href="/login" className="btn-ghost" onClick={() => setOpen(false)}>Login</Link>
                <Link href="/register" className="btn-primary" onClick={() => setOpen(false)}>Get Started</Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

function MarketsDropdown({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = MARKETS_LINKS.some((l) => l.href === pathname);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn('relative flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors', active || open ? 'text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white')}
      >
        Markets
        <ChevronDown size={14} className={cn('transition-transform', open && 'rotate-180')} />
        {active && <span className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-brand-gradient" />}
      </button>
      <div
        role="menu"
        className={cn('absolute left-0 mt-2 w-52 origin-top-left overflow-hidden rounded-2xl border border-white/10 bg-bg-elevated p-1.5 shadow-card transition duration-150', open ? 'pointer-events-auto scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0')}
      >
        {MARKETS_LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            role="menuitem"
            onClick={() => setOpen(false)}
            className={cn('block rounded-lg px-3 py-2 text-sm font-medium transition', pathname === l.href ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white')}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
