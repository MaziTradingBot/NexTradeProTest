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
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1a56ff] text-base font-black text-white">N</span>
      <span className="text-lg font-bold tracking-tight text-[#0a1633]">
        NexTrade<span className="text-[#1a56ff]">Pro</span>
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
    <header className={cn('sticky top-0 z-50 border-b transition-all', scrolled ? 'border-[#e7ecf5] bg-white/90 backdrop-blur-md' : 'border-transparent bg-white')}>
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/"><Wordmark /></Link>

        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn('rounded-lg px-3 py-2 text-sm font-medium transition-colors', pathname === l.href ? 'text-[#1a56ff]' : 'text-[#41506b] hover:text-[#0a1633]')}
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <Link href="/dashboard" className="rounded-full bg-[#1a56ff] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#1246d6]">
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="rounded-full px-4 py-2 text-sm font-semibold text-[#0a1633] transition hover:bg-[#f0f4fb]">
                Log in
              </Link>
              <Link href="/register" className="rounded-full bg-[#1a56ff] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#1246d6]">
                Get started
              </Link>
            </>
          )}
        </div>

        <button className="rounded-lg p-2 text-[#0a1633] md:hidden" onClick={() => setOpen((v) => !v)} aria-label="Menu">
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {open && (
        <div className="border-t border-[#e7ecf5] bg-white px-4 py-4 md:hidden">
          <div className="space-y-1">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm font-medium text-[#41506b] hover:bg-[#f5f8fd] hover:text-[#0a1633]">
                {l.label}
              </Link>
            ))}
            <div className="flex flex-col gap-2 pt-3">
              <Link href={user ? '/dashboard' : '/register'} className="rounded-full bg-[#1a56ff] px-5 py-2.5 text-center text-sm font-semibold text-white" onClick={() => setOpen(false)}>
                {user ? 'Dashboard' : 'Get started'}
              </Link>
              {!user && (
                <Link href="/login" className="rounded-full border border-[#e7ecf5] px-5 py-2.5 text-center text-sm font-semibold text-[#0a1633]" onClick={() => setOpen(false)}>
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
