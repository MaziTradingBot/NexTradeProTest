'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
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

function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-blue to-brand-cyan text-base font-black text-white shadow-glow">
        N
      </span>
      <span className="font-display text-xl font-bold uppercase tracking-wide text-ink">
        NexTrade<span className="text-brand-blue">Pro</span>
      </span>
    </span>
  );
}

export function MarketingNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user, loadMe } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    loadMe();
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [loadMe]);

  return (
    <header
      className={cn(
        'sticky top-0 z-50 border-b transition-all',
        scrolled ? 'border-brand-blue/10 bg-bg/80 backdrop-blur-xl' : 'border-transparent bg-transparent',
      )}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/">
          <Wordmark />
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                pathname === l.href ? 'text-brand-blue' : 'text-ink-soft hover:text-ink',
              )}
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <Link href="/dashboard" className="btn-primary rounded-full px-5 py-2 text-sm">
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="rounded-full px-4 py-2 text-sm font-semibold text-ink transition hover:bg-white/5">
                Log in
              </Link>
              <Link href="/register" className="btn-primary rounded-full px-5 py-2 text-sm">
                Get started
              </Link>
            </>
          )}
        </div>

        <button className="rounded-lg p-2 text-ink md:hidden" onClick={() => setOpen((v) => !v)} aria-label="Menu">
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {open && (
        <div className="border-t border-brand-blue/10 bg-bg/95 px-4 py-4 backdrop-blur-xl md:hidden">
          <div className="space-y-1">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-sm font-medium text-ink-soft hover:bg-white/5 hover:text-ink"
              >
                {l.label}
              </Link>
            ))}
            <div className="flex flex-col gap-2 pt-3">
              <Link href={user ? '/dashboard' : '/register'} className="btn-primary rounded-full" onClick={() => setOpen(false)}>
                {user ? 'Dashboard' : 'Get started'}
              </Link>
              {!user && (
                <Link href="/login" className="btn-ghost rounded-full" onClick={() => setOpen(false)}>
                  Log in
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
