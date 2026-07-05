'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft, Menu, Shield, X } from 'lucide-react';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';
import { NotificationBell } from './NotificationBell';
import { GlobalSearch } from './GlobalSearch';
import { ModeSwitcher } from './ModeSwitcher';
import { useAuth } from '@/lib/store';
import { cn } from '@/lib/utils';

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
  const { user, loadMe, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const showBack = pathname !== '/';

  const goBack = () => {
    // Prefer real history; fall back to home if there's nowhere to go back to.
    if (typeof window !== 'undefined' && window.history.length > 1) router.back();
    else router.push('/');
  };

  useEffect(() => {
    loadMe();
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [loadMe]);

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-all duration-300',
        scrolled ? 'glass shadow-card' : 'bg-transparent',
      )}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          {showBack && (
            <button
              onClick={goBack}
              aria-label="Go back"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft size={17} />
            </button>
          )}
          <Link href="/" aria-label="NexTradePro home">
            <Logo />
          </Link>
        </div>

        <div className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  'relative rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active ? 'text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white',
                )}
              >
                {l.label}
                {active && <span className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-brand-gradient" />}
              </Link>
            );
          })}
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <GlobalSearch />
          <ThemeToggle />
          {user ? (
            <>
              <ModeSwitcher />
              <NotificationBell />
              {user.isBroker && (
                <Link href="/broker" className="btn-ghost">
                  Broker
                </Link>
              )}
              {user.isAdmin && (
                <Link href="/admin" className="btn-ghost border-brand-cyan/30 text-brand-cyan hover:border-brand-cyan/50 hover:bg-brand-cyan/10">
                  <Shield size={15} /> Admin
                </Link>
              )}
              <Link href="/dashboard" className="btn-ghost">
                Dashboard
              </Link>
              <button onClick={() => logout()} className="btn-primary">
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-ghost">
                Login
              </Link>
              <Link href="/register" className="btn-primary">
                Get Started
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <ThemeToggle />
          <button
            className="rounded-lg p-2 text-slate-200"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      {open && (
        <div className="glass border-t border-white/10 lg:hidden">
          <div className="space-y-1 px-4 py-4">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={cn(
                  'block rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-white/5 hover:text-white',
                  pathname === l.href ? 'bg-white/5 text-white' : 'text-slate-300',
                )}
              >
                {l.label}
              </Link>
            ))}
            <div className="flex flex-col gap-2 pt-3">
              {user ? (
                <>
                  {user.isAdmin && (
                    <Link href="/admin" className="btn-ghost border-brand-cyan/30 text-brand-cyan" onClick={() => setOpen(false)}>
                      <Shield size={15} /> Admin Panel
                    </Link>
                  )}
                  <Link href="/dashboard" className="btn-ghost" onClick={() => setOpen(false)}>
                    Dashboard
                  </Link>
                  <button onClick={() => logout()} className="btn-primary">
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" className="btn-ghost" onClick={() => setOpen(false)}>
                    Login
                  </Link>
                  <Link href="/register" className="btn-primary" onClick={() => setOpen(false)}>
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
