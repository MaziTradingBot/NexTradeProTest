'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/lib/store';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/markets', label: 'Markets' },
  { href: '/copy-trading', label: 'Copy Trading' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/academy', label: 'Academy' },
  { href: '/news', label: 'News' },
  { href: '/about', label: 'About' },
];

export function MarketingNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user, loadMe } = useAuth();
  const pathname = usePathname();

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
        'sticky top-0 z-50 transition-all duration-300',
        scrolled ? 'glass shadow-card' : 'bg-transparent',
      )}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="NexTradePro home" className="shrink-0">
          <Logo />
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={pathname === l.href ? 'page' : undefined}
              className={cn(
                'relative rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                pathname === l.href ? 'text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white',
              )}
            >
              {l.label}
              {pathname === l.href && <span className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-brand-gradient" />}
            </Link>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          {user ? (
            <Link href="/dashboard" className="btn-primary">
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="hidden text-sm font-semibold text-slate-300 transition hover:text-white sm:block">
                Login
              </Link>
              <Link href="/register" className="btn-primary">
                Get Started
              </Link>
            </>
          )}
          <button className="rounded-lg p-2 text-slate-200 lg:hidden" onClick={() => setOpen((v) => !v)} aria-label="Toggle navigation" aria-expanded={open}>
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      {open && (
        <div className="glass border-t border-white/10 lg:hidden">
          <div className="space-y-1 px-4 py-4">
            {LINKS.map((l) => (
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
              <Link href={user ? '/dashboard' : '/register'} className="btn-primary" onClick={() => setOpen(false)}>
                {user ? 'Dashboard' : 'Get Started'}
              </Link>
              {!user && (
                <Link href="/login" className="btn-ghost" onClick={() => setOpen(false)}>
                  Login
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
