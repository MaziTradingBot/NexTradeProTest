'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';
import { NotificationBell } from './NotificationBell';
import { GlobalSearch } from './GlobalSearch';
import { ModeSwitcher } from './ModeSwitcher';
import { UserMenu } from './UserMenu';
import { useAuth } from '@/lib/store';
import { cn } from '@/lib/utils';

// Public / trading navigation only. Account features live in the profile menu.
const NAV_LINKS = [
  { href: '/markets', label: 'Markets' },
  { href: '/trading', label: 'Trading' },
  { href: '/copy-trading', label: 'Copy Trading' },
  { href: '/ai', label: 'AI' },
  { href: '/news', label: 'News' },
  { href: '/pricing', label: 'Pricing' },
];

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
    <header className={cn('fixed inset-x-0 top-0 z-50 transition-all duration-300', scrolled ? 'glass shadow-card' : 'bg-transparent')}>
      <nav className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="NexTradePro home" className="shrink-0"><Logo /></Link>

        {/* Primary nav */}
        <div className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((l) => {
            const active = pathname === l.href;
            return (
              <Link key={l.href} href={l.href} aria-current={active ? 'page' : undefined} className={cn('relative rounded-lg px-3 py-2 text-sm font-medium transition-colors', active ? 'text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white')}>
                {l.label}
                {active && <span className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-brand-gradient" />}
              </Link>
            );
          })}
        </div>

        {/* Right cluster */}
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <div className="hidden lg:block"><GlobalSearch /></div>
          <ThemeToggle />
          {user ? (
            <>
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
          {/* Mobile nav toggle */}
          <button className="rounded-lg p-2 text-slate-200 lg:hidden" onClick={() => setOpen((v) => !v)} aria-label="Toggle navigation" aria-expanded={open}>
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      {/* Mobile drawer — primary nav + mode switch */}
      {open && (
        <div className="glass border-t border-white/10 lg:hidden">
          <div className="space-y-1 px-4 py-4">
            {user && <div className="pb-2 sm:hidden"><ModeSwitcher /></div>}
            <div className="pb-2 lg:hidden"><GlobalSearch /></div>
            {NAV_LINKS.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className={cn('block rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-white/5 hover:text-white', pathname === l.href ? 'bg-white/5 text-white' : 'text-slate-300')}>
                {l.label}
              </Link>
            ))}
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
